"""Retriever v2: dense (bge-small + Chroma) + BM25, fused with RRF, then reranked by a cross-encoder.
Converted from notebook cell 117 (+ helpers from cells 103, 111, 114). Behaviour is unchanged; no display code."""
import json
import math
import re
from collections import Counter, defaultdict

import chromadb
import numpy as np
import torch
from sentence_transformers import CrossEncoder, SentenceTransformer

from . import config as C
from .textutil import _sig, strip_label, tokenize

JOB_SECTIONS = ("requirements", "description")               # company_profile and benefits are excluded
class BM25:
    """Home-made BM25 (inverted index): no external dependency, fast for ~12,000 chunks."""

    def __init__(self, docs_tokens, k1=1.5, b=0.75):
        self.k1, self.b, self.N = k1, b, len(docs_tokens)
        self.len = np.array([len(d) for d in docs_tokens], dtype=float)
        self.avg = self.len.mean() if self.N else 0.0
        self.inv = defaultdict(list)
        for i, d in enumerate(docs_tokens):
            for t, n in Counter(d).items():
                self.inv[t].append((i, n))
        self.idf = {t: math.log(1 + (self.N - len(p) + 0.5) / (len(p) + 0.5)) for t, p in self.inv.items()}

    def scores(self, q_tokens):
        sc = defaultdict(float)
        for t in set(q_tokens):
            for i, n in self.inv.get(t, ()):
                sc[i] += self.idf[t] * n * (self.k1 + 1) / (n + self.k1 * (1 - self.b + self.b * self.len[i] / self.avg))
        return sc


class Retriever:
    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.embedder = SentenceTransformer(C.EMBED_MODEL, device=self.device)
        self.reranker = CrossEncoder(C.RERANK_MODEL, device=self.device, max_length=512)
        with open(C.CHUNKS_JSONL, encoding="utf-8") as f:
            self.chunks = [json.loads(l) for l in f]
        self.lex = BM25([tokenize(c["text"]) for c in self.chunks])
        self.col = chromadb.PersistentClient(path=str(C.CHROMA_PATH)).get_collection(C.CHROMA_COLLECTION)
        assert self.col.count() == len(self.chunks), "Chroma index and chunks file do not match"

    def encode(self, texts, batch_size=64):
        return self.embedder.encode(list(texts), normalize_embeddings=True, batch_size=batch_size,
                                    show_progress_bar=False).tolist()

    def _lexical_top(self, query, n, function=None, sections=None):
        out = []
        for i, s in sorted(self.lex.scores(tokenize(query)).items(), key=lambda x: -x[1]):
            c = self.chunks[i]
            if function and c["function"] != function:
                continue
            if sections and c["section"] not in sections:
                continue
            out.append(c["chunk_id"])
            if len(out) >= n:
                break
        return out

    def search(self, query, k=3, function=None, sections=JOB_SECTIONS, hybrid=True, rerank=True,
               n_cand=40, n_rerank=12, rrf_k=60, prefix=None):
        conds = []
        if function:
            conds.append({"function": function})
        if sections:
            conds.append({"section": {"$in": list(sections)}})
        where = None if not conds else (conds[0] if len(conds) == 1 else {"$and": conds})

        if prefix is None:                                    # the BGE prefix only helps short queries
            prefix = len(query.split()) <= 40
        qv = self.encode([(C.QUERY_PREFIX if prefix else "") + query])
        res = self.col.query(query_embeddings=qv, n_results=n_cand, where=where)
        info = {i: dict(meta, dist=d, text=doc)
                for i, meta, d, doc in zip(res["ids"][0], res["metadatas"][0], res["distances"][0], res["documents"][0])}
        fused = defaultdict(float)
        for r, cid in enumerate(res["ids"][0]):
            fused[cid] += 1.0 / (rrf_k + r + 1)

        if hybrid:                                            # lexical route + RRF fusion (chunk level)
            for r, cid in enumerate(self._lexical_top(query, n_cand, function, sections)):
                fused[cid] += 1.0 / (rrf_k + r + 1)
            missing = [c for c in fused if c not in info]
            if missing:                                       # chunks found only by BM25: fetch their data
                got = self.col.get(ids=missing, include=["documents", "metadatas", "embeddings"])
                for i, meta, doc, emb in zip(got["ids"], got["metadatas"], got["documents"], got["embeddings"]):
                    info[i] = dict(meta, dist=1.0 - float(np.dot(qv[0], np.asarray(emb))), text=doc)

        docs, seen_sig = {}, {}                               # group by job (best chunk per job, duplicate texts dropped)
        for cid in sorted(fused, key=fused.get, reverse=True):
            m = info[cid]
            key = m["doc_id"]
            if key not in docs:
                sig = _sig(m["text"])
                if sig in seen_sig:
                    continue
                seen_sig[sig] = key
                docs[key] = dict(m, n_chunks=0, rrf=fused[cid])
            docs[key]["n_chunks"] += 1
        cands = list(docs.values())[:n_rerank if rerank else k]

        if rerank and len(cands) > 1:                         # cross-encoder reads query AND text together
            pairs = [(query, f"{c['title']}. {strip_label(c['text'])}") for c in cands]
            for c, s in zip(cands, self.reranker.predict(pairs, batch_size=16, show_progress_bar=False)):
                c["rerank"] = float(s)
            cands.sort(key=lambda c: -c["rerank"])
        return cands[:k]
