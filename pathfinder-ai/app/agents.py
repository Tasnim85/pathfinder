"""Query Builder + Relevance Grader + agentic search loop. Converted from notebook cell 160 (logic unchanged)."""
import json

from . import llm as L
from .prompts import PROMPTS
from .textutil import strip_label

QB_VERSION, GR_VERSION = "v2", "v2"
llm_json_strong = L.llm_json_strong
_retriever = None


def init(retriever_obj):
    global _retriever
    _retriever = retriever_obj


def retriever(query, k=3, function=None, **over):
    return _retriever.search(query, k, function, **over)


def snip(text, n=260):
    t = " ".join(strip_label(text).split())
    return t if len(t) <= n else t[:n].rsplit(" ", 1)[0] + " …"


def profile_brief(p):
    return json.dumps({"target_title": p["target_title"], "summary": p["summary"], "skills": p["skills"][:12],
                       "years_experience": p["years_experience"], "education": p["education"][:3],
                       "past_titles": [e.get("title") for e in p["experiences"]][:4]}, ensure_ascii=False)

def qb_rules(p):                                   # version sans LLM (référence de comparaison)
    parts = []
    if p["target_title"]:
        parts.append(p["target_title"])
    if p["skills"]:
        parts.append("skills: " + ", ".join(p["skills"][:10]))
    if p["years_experience"]:
        parts.append(f"{p['years_experience']} years of experience")
    return ". ".join(parts) if parts else (p["summary"] or "")

def build_query(p, previous=None, verdict=None, version=None):
    P = PROMPTS["query_builder"][version or QB_VERSION]
    if previous is None:
        user = P["user"].replace("<<PROFILE>>", profile_brief(p))
    else:
        v = verdict or {}
        user = (P["user_retry"].replace("<<PROFILE>>", profile_brief(p)).replace("<<PREV>>", previous)
                .replace("<<REASON>>", v.get("reasoning") or "").replace("<<SUGG>>", v.get("suggested_query") or ""))
    call = llm_json_strong
    obj, raw = call(P["system"], user, max_new_tokens=150)
    q = obj.get("query") if isinstance(obj, dict) else None
    return " ".join(str(q).split()) if q else qb_rules(p)

def grade(p, query, results, threshold=3, version=None):
    if not results:
        return {"score": 0, "relevant": False, "reasoning": "no passage retrieved", "suggested_query": "", "error": False}
    version = version or GR_VERSION
    P = PROMPTS["grader"][version]
    passages = "\n".join(f"[{i}] {r['title']} - {snip(r['text'], 450)}" for i, r in enumerate(results, 1))
    user = (P["user"].replace("<<PROFILE>>", profile_brief(p)).replace("<<QUERY>>", query)
            .replace("<<PASSAGES>>", passages))
    call = llm_json_strong
    obj, raw = call(P["system"], user, max_new_tokens=300)
    scores, score = None, None
    if isinstance(obj, dict):
        try:
            if version == "v1":
                score = float(max(0, min(5, int(obj.get("score")))))
                relevant = score >= threshold
            else:
                scores = [max(0, min(5, int(s))) for s in obj.get("scores", [])][:len(results)]
                if len(scores) != len(results):
                    raise ValueError("nombre de scores incorrect")
                score = round(sum(scores) / len(scores), 2)                 # moyenne : sert à choisir la meilleure itération
                relevant = sum(s >= threshold for s in scores) >= 2        # décision par le code : 2 passages sur 3 au moins
        except Exception:
            score = None
    if score is None:                              # le grader n'a pas répondu proprement : on ne bloque pas
        return {"score": float(threshold), "relevant": True, "reasoning": "grader parse error: accepted by default",
                "suggested_query": "", "error": True, "scores": None}
    return {"score": score, "relevant": relevant, "reasoning": str(obj.get("reasoning", "")),
            "suggested_query": str(obj.get("suggested_query") or ""), "error": False, "scores": scores}

def agentic_search(profile, first_query=None, max_iter=3, threshold=3, k=3, qb_v=None, gr_v=None):
    trace, query = [], first_query or build_query(profile, version=qb_v)
    for it in range(1, max_iter + 1):
        results = retriever(query, k)
        verdict = grade(profile, query, results, threshold, version=gr_v)
        trace.append({"iter": it, "query": query, "results": results, "verdict": verdict})
        if verdict["relevant"] or it == max_iter:
            break
        new_query = build_query(profile, previous=query, verdict=verdict, version=qb_v)
        if new_query.strip().lower() == query.strip().lower():
            break
        query = new_query
    best = max(trace, key=lambda t: (t["verdict"]["score"], -t["iter"]))
    return {"profile": profile, "trace": trace, "final": best, "accepted": best["verdict"]["relevant"]}
