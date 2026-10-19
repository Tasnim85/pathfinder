"""Central settings. Everything that was a notebook constant lives here (override with environment variables)."""
import os
from pathlib import Path

DATA_DIR = Path(os.getenv("DATA_DIR", "./data"))            # unzip pathfinder_artifacts.zip's `data/` folder here
CHROMA_PATH = DATA_DIR / "chroma_db"
JOBS_CSV = DATA_DIR / "jobs_clean.csv"
CHUNKS_JSONL = DATA_DIR / "chunks_section.jsonl"

EMBED_MODEL = "BAAI/bge-small-en-v1.5"
RERANK_MODEL = "BAAI/bge-reranker-base"
QUERY_PREFIX = "Represent this sentence for searching relevant passages: "
CHROMA_COLLECTION = "jobs_sectiontitle"                      # from manifest.json: 12,256 chunks

CACHE_DIR = Path(os.getenv("CACHE_DIR", "./cache")); CACHE_DIR.mkdir(parents=True, exist_ok=True)
REPORT_DIR = Path(os.getenv("REPORT_DIR", "./reports")); REPORT_DIR.mkdir(parents=True, exist_ok=True)
