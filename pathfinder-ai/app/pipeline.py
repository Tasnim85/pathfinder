"""Orchestrator: text (CV or transcribed speech) -> Parser -> Query Builder -> Retriever -> Grader -> Scoring -> Report.
Rewritten from notebook cell 184 (run_pipeline) without notebook-only parts (dataset ids, display, tqdm, model swapping)."""
import datetime
import hashlib
import time

from . import agents, audio, parser, report, scoring
from . import llm as L


def make_id(text, input_type):
    prefix = "audio_web_" if input_type == "audio" else "cv_web_"
    return prefix + hashlib.md5(text.encode("utf-8")).hexdigest()[:8]


def retrieve_pool(profile, pool_size, max_iter=3):
    """Agentic loop (query + Grader), then a wider pool retrieved with the retained query."""
    out = agents.agentic_search(profile, max_iter=max_iter)
    query = out["final"]["query"]
    pool = agents.retriever(query, k=pool_size, n_cand=60, n_rerank=max(12, pool_size + 4))
    return pool, query, out


def run_pipeline(text, input_type="cv", top_n=3, lang=None, pool_extra=None, save=True):
    top_n = top_n or scoring.TOP_N
    lang = lang or scoring.REPORT_LANG
    pool_extra = scoring.POOL_EXTRA if pool_extra is None else pool_extra
    t0 = time.time()
    cid = make_id(text, input_type)

    is_audio = input_type == "audio"
    d = parser.parse_cv_llm(text, cid, None, "a2" if is_audio else "v6")      # a2 = prompt adapted to speech
    if is_audio and d["years_experience"] is not None and not audio.years_stated(text):
        d["years_experience"] = None                                         # the code has the last word
    profile, parse_ok = parser.to_profile(d), (d["_meta"]["source"] == "llm" and not d["_meta"]["schema_problems"])

    pool, query, out = retrieve_pool(profile, top_n + pool_extra)
    scored = scoring.rank_jobs([scoring.score_job(profile, c, lang) for c in pool])
    top = scoring.annotate_ranking(scored[:top_n])

    years = scoring.candidate_years(profile)
    reasons = ([] if out["accepted"] else ["r_grader"]) + ([] if top and top[0]["score"] >= 50 else ["r_score"]) \
        + ([] if parse_ok else ["r_parse"]) + ([] if all(j["llm_ok"] for j in top) else ["r_llm"])
    rep = {"cv_id": cid, "lang": lang, "generated_at": datetime.datetime.now().strftime("%d/%m/%Y %H:%M"),
           "profile": profile, "years": years, "query": query, "grader_accepted": out["accepted"],
           "iterations": len(out["trace"]), "pool_size": len(pool), "top": top, "weights": dict(scoring.WEIGHTS),
           "model": L.model_tag(), "confidence": "low" if reasons else "high", "conf_reasons": reasons,
           "input_type": input_type}
    if is_audio:
        rep.update({"asr_model": "whisper-small", "transcript": text})
    rep["summary"] = report.write_summary(rep)
    rep["paths"] = report.save_report(rep) if save else None
    rep["seconds"] = round(time.time() - t0)
    return rep
