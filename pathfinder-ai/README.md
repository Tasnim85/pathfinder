# PathFinder AI service

FastAPI service around the multi-agent pipeline (Parser -> Query Builder -> Retriever -> Grader -> Scoring -> Report).

## Layout
```
app/        code        data/   from pathfinder_artifacts.zip (chroma_db, jobs_clean.csv, chunks_section.jsonl)
```

## Run with Docker (GPU server with NVIDIA drivers + nvidia-container-toolkit)
```
docker build -t pathfinder-ai .
docker run --gpus all -p 8000:8000 \
  -e API_KEY=choose-a-long-random-string \
  -v $PWD/data:/srv/data -v pf_cache:/srv/cache -v pf_hf:/srv/hf \
  pathfinder-ai
```
First start downloads the models (~20 GB: Qwen 7B, bge-small, bge-reranker, Whisper small) and takes several minutes.
`GET /health` answers immediately: `ok:false` while loading, `ok:true` when ready (`error` explains a failed start).

## Run without Docker
```
pip install -r requirements.txt      # + ffmpeg installed on the system
API_KEY=... uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Settings (environment variables)
| Variable | Default | Meaning |
|---|---|---|
| API_KEY | empty | If set, every route except /health needs header `x-api-key` |
| DATA_DIR | ./data | folder with chroma_db, jobs_clean.csv, chunks_section.jsonl |
| LOAD_4BIT | auto | `1` force 4-bit, `0` force fp16. Auto = fp16 if GPU memory >= 20 GB |
| LLM_STRONG | same | `14b` also loads Qwen 14B (4-bit) for Query Builder / Grader / Scoring / summary |

## Routes
`GET /health` · `POST /transcribe` (multipart `file`) · `POST /analyze` `{text, input_type: "cv"|"audio"}` -> `{job_id}` ·
`GET /result/{id}` -> `running | done {report, html} | error` · `GET /report/{id}` (HTML)

Jobs are kept in memory (last 200): restarting the service forgets them. One analysis runs at a time on the GPU.
Use HTTPS in front (a reverse proxy such as Caddy/nginx or your provider's HTTPS endpoint) and keep API_KEY secret.
