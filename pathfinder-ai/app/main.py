"""FastAPI service. Same 5 routes and JSON shapes as the notebook's API, plus: models load once at startup,
optional API key, bounded in-memory job store, one analysis at a time on the GPU.
Run:  uvicorn app.main:app --host 0.0.0.0 --port 8000"""
import hashlib
import json
import os
import tempfile
import threading
import time
import uuid
from collections import OrderedDict
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Body, Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.responses import HTMLResponse

from . import audio, llm as L, pipeline, report, scoring

API_KEY = os.getenv("API_KEY", "")
MAX_JOBS = 200
JOBS: "OrderedDict[str, dict]" = OrderedDict()
READY = {"ok": False, "error": None}


def _boot():
    try:
        if os.getenv("PF_SKIP_LOAD") != "1":
            from . import agents
            from .retriever import Retriever
            scoring.load_jobs()
            agents.init(Retriever())
            L.load_models()
            audio.load_asr()
        READY["ok"] = True
    except Exception as e:                                   # keep the server up and say why it is not ready
        READY["error"] = f"{type(e).__name__}: {e}"


@asynccontextmanager
async def lifespan(app):
    threading.Thread(target=_boot, daemon=True).start()      # /health answers immediately, models load in the background
    yield


app = FastAPI(title="PathFinder AI", lifespan=lifespan)


def auth(x_api_key: str = Header(default="")):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(401, "Invalid API key")


def need_ready():
    if not READY["ok"]:
        raise HTTPException(503, READY["error"] or "Models are still loading, retry in a few minutes")


@app.get("/health")
def health():
    return {"ok": READY["ok"], "model": L.model_tag(), "error": READY["error"]}


@app.post("/transcribe", dependencies=[Depends(auth)])
def transcribe(file: UploadFile = File(...)):
    need_ready()
    ext = Path(file.filename or "").suffix.lower()
    if ext not in audio.AUDIO_EXT:
        raise HTTPException(415, f"Audio format not accepted: {ext}")
    data = file.file.read()
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(413, "Audio is larger than 25 MB")
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / f"{uuid.uuid4().hex[:8]}{ext}"
        path.write_bytes(data)
        try:
            with L.GPU_LOCK:
                text = audio.transcribe_audio(path)
        except ValueError as e:
            raise HTTPException(422, str(e))
    return {"text": text, "n_words": len(text.split())}


def _work(job_id, text, kind):
    try:
        with L.GPU_LOCK:
            rep = pipeline.run_pipeline(text, kind, top_n=3, save=True)
        JOBS[job_id] = {"status": "done", "report": json.loads(json.dumps(rep, default=str)),
                        "html": report.build_report_html(rep, standalone=True)}
    except Exception as e:
        JOBS[job_id] = {"status": "error", "error": f"{type(e).__name__}: {e}"}


@app.post("/analyze", dependencies=[Depends(auth)])
def analyze(body: dict = Body(...)):
    need_ready()
    text = (body.get("text") or "").strip()
    kind = "audio" if body.get("input_type") == "audio" else "cv"
    if len(text.split()) < 15:
        raise HTTPException(422, "Text too short to analyse the profile")
    # identical text already running or done -> reuse it (avoids duplicate GPU work)
    h = hashlib.md5(f"{kind}|{text}".encode()).hexdigest()[:10]
    if h in JOBS and JOBS[h]["status"] in ("running", "done"):
        return {"job_id": h, "status": JOBS[h]["status"]}
    JOBS[h] = {"status": "running", "t": time.time()}
    while len(JOBS) > MAX_JOBS:
        JOBS.popitem(last=False)
    threading.Thread(target=_work, args=(h, text, kind), daemon=True).start()
    return {"job_id": h, "status": "running"}


@app.get("/result/{job_id}", dependencies=[Depends(auth)])
def result(job_id: str):
    if job_id not in JOBS:
        raise HTTPException(404, "Unknown job")
    return {k: v for k, v in JOBS[job_id].items() if k != "t"}


@app.get("/report/{job_id}", response_class=HTMLResponse, dependencies=[Depends(auth)])
def report_page(job_id: str):
    return JOBS.get(job_id, {}).get("html") or "<p>Report not ready</p>"
