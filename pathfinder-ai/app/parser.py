"""LLM Parser v6 (CV or transcribed speech -> structured profile). Converted from notebook cell 124.
Rule-based fallback = rules_parser.py (cell 123). Never raises."""
import json
import re

from . import llm as L
from . import rules_parser
from .prompts import PROMPTS

ask = L.ask

def prep_text(t, max_words=1500):
    t = re.sub(r"[ \t]{2,}", "\n", t)             # 2+ espaces -> saut de ligne (structure du dataset)
    t = re.sub(r"\n+", "\n", t).strip()
    return t[: max_words * 7]

def extract_json(raw):
    raw = re.sub(r"```(?:json)?", "", raw)
    start, end = raw.find("{"), raw.rfind("}")
    if start == -1 or end == -1:
        return None, "aucun JSON trouvé"
    try:
        return json.loads(raw[start:end + 1]), None
    except json.JSONDecodeError as e:
        return None, f"JSON invalide : {e}"

def check_schema_v2(d):
    problems = []
    checks = {"headline": (str, type(None)), "summary": (str, type(None)), "skills": (list,), "experience": (list,),
              "years_experience": (int, type(None)), "education": (list,), "certifications": (list,), "languages": (list,)}
    for k, types in checks.items():
        if k not in d:
            problems.append(f"champ manquant : {k}")
        elif not isinstance(d[k], types) or isinstance(d[k], bool):
            problems.append(f"mauvais type pour {k} : {type(d[k]).__name__}")
    for e in d.get("experience", []) if isinstance(d.get("experience"), list) else []:
        if not isinstance(e, dict) or not {"title", "company", "start", "end"} <= set(e):
            problems.append("experience : objet incomplet"); break
    for e in d.get("education", []) if isinstance(d.get("education"), list) else []:
        if not isinstance(e, dict) or not {"degree", "field", "school", "year"} <= set(e):
            problems.append("education : objet incomplet"); break
    return problems

PLACEHOLDERS = [r"company\s*name", r"city\s*,?\s*state", r"\[[^\]]*\]", r"[－—–]"]

def clean_value(v):
    if not isinstance(v, str):
        return v
    for p in PLACEHOLDERS:
        v = re.sub(p, " ", v, flags=re.I)
    v = re.sub(r"\s+", " ", v).strip(" ,;-")
    if v.lower() in {"null", "none", "n/a", "na", "unknown", "undefined"}:   # the LLM sometimes writes the word instead of JSON null
        return None
    return v or None

def normalize_parsed(d):
    d = dict(d)
    for k in ("skills", "certifications", "languages", "experience", "education"):
        if not isinstance(d.get(k), list):
            d[k] = []
    for k in ("skills", "certifications", "languages"):
        d[k] = [c for s in d[k] if isinstance(s, str) and (c := clean_value(s))]
    d["experience"] = [{k: clean_value(e.get(k)) for k in ("title", "company", "start", "end")} for e in d["experience"] if isinstance(e, dict)]
    d["education"] = [{k: clean_value(e.get(k)) for k in ("degree", "field", "school", "year")} for e in d["education"] if isinstance(e, dict)]
    y = d.get("years_experience")
    if isinstance(y, str) and y.strip().isdigit():
        d["years_experience"] = int(y)
    elif not isinstance(y, int) or isinstance(y, bool):
        d["years_experience"] = None
    d["headline"] = clean_value(d.get("headline"))
    d["summary"] = clean_value(d.get("summary"))
    return d

# --- compétences : le LLM + les listes de mots-clés détectées par règles (Highlights, Qualifications...)
TITLES_L = ["professional summary", "summary", "career overview", "objective", "highlights", "core qualifications",
            "qualifications", "skills", "professional experience", "work history", "experience",
            "education and training", "education", "accomplishments", "certifications", "affiliations",
            "professional affiliations", "additional information", "interests", "languages",
            "professional highlights", "summary of qualifications"]
SEC_RE = re.compile(r"(?:^|\s{2,})(" + "|".join(sorted(TITLES_L, key=len, reverse=True)) + r")\s{2,}", re.I)
KEYWORD_SECTIONS = {"highlights", "professional highlights", "core qualifications", "qualifications", "summary of qualifications"}

def sections_of(text):
    ms = list(SEC_RE.finditer(text))
    return [(m.group(1).lower(), text[m.end(): ms[i + 1].start() if i + 1 < len(ms) else len(text)]) for i, m in enumerate(ms)]

def keyword_items(body, max_words=5):
    out = []
    for seg in re.split(r"\s{2,}|\n|;|•", body):
        seg = seg.strip()
        if (len(seg) >= 3 and seg[0].isalpha() and not seg.endswith(".") and "," not in seg
                and 1 <= len(seg.split()) <= max_words and seg.lower() not in TITLES_L):
            out.append(seg)
    return out

def hybrid_skills(llm_skills, text):
    kw = []
    for title, body in sections_of(text):
        if title in KEYWORD_SECTIONS:
            kw += keyword_items(body)
    seen, out = set(), []
    for s in list(llm_skills) + kw:
        if s.lower() not in seen:
            seen.add(s.lower()); out.append(s)
    return out, kw

EMPTY = {"headline": None, "summary": None, "skills": [], "experience": [], "years_experience": None,
         "education": [], "certifications": [], "languages": []}

def rules_to_contract(text):
    r = rules_parser.parse_cv_text(text)
    edu = r["education"]["highest_level"] if r.get("education") else None
    return {"headline": r["headline"], "summary": r["summary"], "skills": r["skills"],
            "experience": [{"title": e["title"], "company": e["company"], "start": e["start"], "end": e["end"]} for e in r["experience"]],
            "years_experience": r["years_experience_stated"],
            "education": [{"degree": edu, "field": None, "school": None, "year": None}] if edu else [],
            "certifications": r["certifications"], "languages": r["languages"]}

def parse_cv_llm(text, cv_id=None, category=None, version="v6"):
    """CV (texte brut) -> dict au schéma du contrat de la collègue. Ne plante jamais."""
    P = PROMPTS["parser"][version]
    meta = {"source": None, "retried": False, "schema_problems": []}
    parsed = None
    for max_tokens in (2048, 3072):                          # relance si la réponse est tronquée
        msgs = [{"role": "system", "content": P["system"]},
                {"role": "user", "content": P["user"].replace("<<CV>>", prep_text(text))}]
        parsed, err = extract_json(ask(msgs, max_new_tokens=max_tokens))
        if parsed is not None:
            break
        meta["retried"] = True
    if parsed is not None:
        out = normalize_parsed(parsed)
        out["skills"], _ = hybrid_skills(out["skills"], text)
        meta["source"] = "llm"
    else:
        out = rules_to_contract(text); meta["source"] = "rules_fallback"
    meta["schema_problems"] = check_schema_v2(out)
    out.update({"cv_id": str(cv_id) if cv_id is not None else None, "category": category, "_meta": meta})
    return out

# --- adaptateur : schéma du Parser (collègue) -> profil attendu par le Query Builder et le Grader
def _as_list(x):
    if x is None: return []
    if isinstance(x, str): return [s.strip() for s in re.split(r"[,;]", x) if s.strip()]
    if isinstance(x, list): return [str(s).strip() for s in x if str(s).strip()]
    return []

def clean_profile(p):
    p = p if isinstance(p, dict) else {}
    try: years = int(p.get("years_experience"))
    except Exception: years = None
    exps = p.get("experiences")
    return {"target_title": str(p["target_title"]).strip() if p.get("target_title") else None,
            "summary": str(p["summary"]).strip() if p.get("summary") else None,
            "skills": _as_list(p.get("skills"))[:15], "years_experience": years,
            "education": _as_list(p.get("education"))[:5],
            "experiences": [e for e in exps if isinstance(e, dict)][:5] if isinstance(exps, list) else []}

def to_profile(d):
    exps = [e for e in d.get("experience", []) if e.get("title")]
    target = d.get("headline") or (exps[0]["title"] if exps else None)
    edu = [" ".join(x for x in (e.get("degree"), e.get("field")) if x) for e in d.get("education", [])]
    return clean_profile({
        "target_title": target, "summary": d.get("summary"), "skills": d.get("skills"),
        "years_experience": d.get("years_experience"), "education": [e for e in edu if e],
        "experiences": [{"title": e["title"], "company": e.get("company"),
                         "duration": f"{e.get('start') or '?'} - {e.get('end') or '?'}"} for e in exps]})
