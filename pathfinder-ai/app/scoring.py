"""Scoring Agent: 4 code-computed signals + the LLM's judgement, verified by code, combined into a score /100.
Converted from notebook cells 174, 176, 178, 180 (logic unchanged; the notebook's self-tests are kept)."""
import datetime
import hashlib
import json
import math
import re

import pandas as pd

from . import config as C
from .agents import llm_json_strong, profile_brief, snip
from .prompts import PROMPTS
from .textutil import tokenize

jobs_df = None


def load_jobs():
    """jobs_clean.csv indexed by doc_id (NaN -> empty string), as in the notebook."""
    global jobs_df
    jobs_df = pd.read_csv(C.JOBS_CSV).fillna("").set_index("doc_id")
    return jobs_df


TOP_N       = 5            # nombre de postes dans le rapport final (3 ou 5 ; toute valeur >= 1 fonctionne)
POOL_EXTRA  = 4            # postes supplémentaires scorés en plus du top N : pool = TOP_N + POOL_EXTRA
REPORT_LANG = __import__("os").getenv("REPORT_LANG", "fr")         # langue du rapport : "fr" ou "en"
SC_VERSION  = "v1"         # version du prompt du Scoring Agent (fait partie de la clé de cache)

# Poids du score final (somme = 1). Choisis a priori par raisonnement métier, PAS appris : voir 7.7 (ablation).
WEIGHTS = {"skills_llm": 0.25,   # couverture des exigences par les compétences (jugement du LLM)
           "title":      0.25,   # proximité du métier / de l'intitulé (jugement du LLM)
           "experience": 0.15,   # niveau d'expérience demandé vs années du candidat (règle)
           "retrieval":  0.15,   # similarité requête-poste mesurée par le reranker (retriever)
           "skills_lex": 0.10,   # compétences du candidat retrouvées mot pour mot dans l'offre (règle)
           "education":  0.10}   # niveau de formation demandé vs niveau du candidat (règle)
assert abs(sum(WEIGHTS.values()) - 1) < 1e-9

LANG_NAME = {"fr": "French", "en": "English"}


# ===== 7.2 Signaux calculés par le code (aucun LLM) =====

# --- (a) Expérience ------------------------------------------------------------------------------
# Plages d'années associées aux valeurs de `required_experience` du dataset (hypothèse de travail, voir markdown).
EXP_RANGES = {"internship": (0, 1), "entry level": (0, 2), "associate": (2, 5),
              "mid-senior level": (4, 10), "director": (8, 20), "executive": (10, 40)}

def estimate_years(experiences):
    """Années d'expérience estimées d'après les dates des expériences (union des intervalles, précision = année).
    Sert de repli quand le CV n'annonce pas explicitement ses années d'expérience."""
    now, ivs = datetime.date.today().year, []
    for e in experiences or []:
        d = str(e.get("duration") or "")
        ys = [int(y) for y in re.findall(r"(?:19|20)\d{2}", d)]
        if not ys:
            continue
        start = ys[0]
        end = ys[1] if len(ys) > 1 else (now if re.search(r"current|present|now|today", d, re.I) else None)
        if end is None or end < start:
            continue
        ivs.append((start, end))
    if not ivs:
        return None
    ivs.sort()
    total, cs, ce = 0, ivs[0][0], ivs[0][1]
    for s, e in ivs[1:]:
        if s > ce:
            total += ce - cs
            cs, ce = s, e
        else:
            ce = max(ce, e)
    total += ce - cs
    return float(total) if total > 0 else None

def candidate_years(p):
    """(années, source) ; source = 'stated' (annoncée dans le CV), 'estimated' (calculée) ou None."""
    y = p.get("years_experience")
    if isinstance(y, int) and not isinstance(y, bool) and 0 <= y <= 60:
        return float(y), "stated"
    est = estimate_years(p.get("experiences"))
    return (est, "estimated") if est is not None else (None, None)

def exp_score(years, required):
    """1.0 si les années tombent dans la plage du niveau demandé ; pénalité si trop peu (forte) ou trop (douce)."""
    rng = EXP_RANGES.get(str(required or "").strip().lower())
    if years is None or rng is None:
        return None                                      # inconnu : la composante est ignorée (poids redistribués)
    lo, hi = rng
    if years < lo:
        return max(0.0, 1 - (lo - years) / 4)            # 1 an de moins = 0.75, 4 ans de moins = 0
    if years > hi:
        return max(0.5, 1 - 0.05 * (years - hi))         # sur-qualification : jamais sous 0.5
    return 1.0

# --- (b) Formation -------------------------------------------------------------------------------
_EDU_WORDS = [(5, r"ph\.?\s?d|doctorat|doctor"), (4, r"master|mba"), (3, r"bachelor|undergraduate|baccalaur"),
              (2, r"associate"), (1, r"diploma|certificat|vocational|some college"),
              (0, r"high school|\bged\b|secondary school")]
_EDU_ABBR = [(5, r"\bPh\.?D\b"),
             (4, r"\b(?:M\.?S\.?|M\.?Sc\.?|M\.?A\.?|M\.?Eng\.?)(?![A-Za-z])"),
             (3, r"\b(?:B\.?S\.?|B\.?Sc\.?|B\.?A\.?|B\.?Eng\.?|BBA)(?![A-Za-z])")]

def edu_level(texts):
    """Niveau de formation le plus élevé repéré dans un texte ou une liste de textes (5 doctorat ... 0 lycée), sinon None."""
    if isinstance(texts, str):
        texts = [texts]
    best = None
    for t in texts or []:
        t = str(t)
        for lvl, rx in _EDU_WORDS:
            if re.search(rx, t, re.I):
                best = lvl if best is None else max(best, lvl)
        for lvl, rx in _EDU_ABBR:                         # abréviations : sensibles à la casse (MA, MS, BA...)
            if re.search(rx, t):
                best = lvl if best is None else max(best, lvl)
    return best

def edu_score(cand_level, req_level):
    if cand_level is None or req_level is None:
        return None
    gap = req_level - cand_level
    return 1.0 if gap <= 0 else (0.5 if gap == 1 else 0.2)

# --- (c) Compétences : recouvrement lexical + vérification des affirmations du LLM ----------------
def _norm_tok(t):
    return t[:-1] if len(t) > 3 and t.endswith("s") and not t.endswith("ss") else t      # pluriel simple

def norm_tokens(text):
    return {_norm_tok(t) for t in tokenize(text)}

def supported(item, token_set, min_ratio=1.0):
    """Vrai si au moins `min_ratio` des mots de `item` figurent dans `token_set`."""
    toks = [_norm_tok(t) for t in tokenize(item)]
    return bool(toks) and sum(t in token_set for t in toks) / len(toks) >= min_ratio

def profile_tokens(p):
    parts = [p.get("target_title") or "", p.get("summary") or ""] + list(p.get("skills") or []) + list(p.get("education") or [])
    parts += [str(e.get("title") or "") for e in p.get("experiences") or []]
    return norm_tokens(" ".join(parts))

def lexical_overlap(p, job_tokens, saturation=4):
    """Part de compétences du CV (15 max) retrouvées dans l'offre, saturée à `saturation` compétences."""
    hits = sum(supported(s, job_tokens) for s in (p.get("skills") or [])[:15])
    return min(1.0, hits / saturation), hits

# --- (d) Signal du retriever -----------------------------------------------------------------------
def retrieval_signal(c):
    """Score du reranker (0-1) ; à défaut, similarité cosinus ramenée de [0.5 ; 1] vers [0 ; 1]."""
    if c.get("rerank") is not None:
        s = float(c["rerank"])
        return s if 0 <= s <= 1 else 1 / (1 + math.exp(-s))
    return max(0.0, min(1.0, ((1 - float(c["dist"])) - 0.5) / 0.5))

# --- mini auto-test (instantané) -----------------------------------------------------------------
assert exp_score(5, "Mid-Senior level") == 1.0 and exp_score(3, "Mid-Senior level") == 0.75
assert exp_score(1, "Mid-Senior level") == 0.25 and exp_score(None, "Associate") is None and exp_score(5, "Not Applicable") is None
assert edu_level("Bachelor of Science") == 3 and edu_level("Master's Degree") == 4 and edu_level("High School or equivalent") == 0
assert edu_level(["MBA", "B.A. Economics"]) == 4 and edu_level("Unspecified") is None
assert edu_score(3, 4) == 0.5 and edu_score(2, 4) == 0.2 and edu_score(4, 3) == 1.0
assert estimate_years([{"duration": "2010 - 2013"}, {"duration": "2012 - 2015"}, {"duration": "? - ?"}]) == 5.0

def _cut(text, n):
    w = " ".join(str(text).split()).split()
    return " ".join(w[:n]) + (" ..." if len(w) > n else "")

def job_for_scoring(doc_id, req_words=200, desc_words=170):
    """Texte du poste montré au LLM : métadonnées utiles + exigences + description (tronqués pour limiter le temps de calcul)."""
    r = jobs_df.loc[doc_id]
    head = [f"Title: {r['title']}"]
    for lab, col in (("Location", "location"), ("Employment type", "employment_type"),
                     ("Required experience", "required_experience"), ("Required education", "required_education")):
        if r[col]:
            head.append(f"{lab}: {r[col]}")
    return "\n".join(head) + f"\nRequirements: {_cut(r['requirements'], req_words)}\nDescription: {_cut(r['description'], desc_words)}"

def _clip_int(x, lo=0, hi=5):
    return max(lo, min(hi, int(round(float(x)))))

def _str_list(x, n):
    if not isinstance(x, list):
        return []
    out, seen = [], set()
    for s in x:
        s = " ".join(str(s).split())
        if s and len(s) <= 60 and s.lower() not in seen:
            seen.add(s.lower()); out.append(s)
    return out[:n]

def _validate_llm(obj):
    out = {"ok": False, "title_fit": None, "skills_fit": None, "matched": [], "missing": [], "reasoning": ""}
    if not isinstance(obj, dict):
        return out
    try:
        out["title_fit"], out["skills_fit"] = _clip_int(obj["title_fit"]), _clip_int(obj["skills_fit"])
    except Exception:
        return out
    out.update(ok=True, matched=_str_list(obj.get("matched_skills"), 6), missing=_str_list(obj.get("missing_skills"), 5),
               reasoning=" ".join(str(obj.get("reasoning") or "").split())[:400])
    return out

# --- cache : un couple (profil, poste, version du prompt, langue) n'est jamais noté deux fois -----------------
SC_CACHE_PATH = str(C.CACHE_DIR / "score_cache.json")
try:
    sc_cache = json.load(open(SC_CACHE_PATH, encoding="utf-8"))
except Exception:
    sc_cache = {}

def _ckey(p, doc_id, lang):
    h = hashlib.md5(f"{profile_brief(p)}|{SC_VERSION}|{lang}".encode("utf-8")).hexdigest()[:12]
    return f"{h}|{doc_id}"

def llm_score_job(p, doc_id, lang):
    P = PROMPTS["scorer"][SC_VERSION]
    user = P["user"].replace("<<PROFILE>>", profile_brief(p)).replace("<<JOB>>", job_for_scoring(doc_id))
    obj, raw = llm_json_strong(P["system"].replace("<<LANG>>", LANG_NAME[lang]), user, max_new_tokens=320)
    return _validate_llm(obj)

# ===== 7.4 Score final, vérification, classement et explication du rang =====
def combine(components, weights=None):
    """Moyenne pondérée des composantes DISPONIBLES (poids renormalisés si une composante est inconnue)."""
    weights = weights or WEIGHTS
    avail = {k: w for k, w in weights.items() if w > 0 and components.get(k) is not None}
    tot = sum(avail.values())
    return sum(components[k] * w for k, w in avail.items()) / tot if tot else 0.0

def score_job(p, cand, lang=None):
    """Note UN poste candidat pour UN profil. `cand` = un résultat du retriever (dict avec doc_id, dist, rerank...)."""
    lang = lang or REPORT_LANG
    doc_id = cand["doc_id"]
    r = jobs_df.loc[doc_id]
    job_tok = norm_tokens(f"{r['title']} {r['requirements']} {r['description']}")
    prof_tok = profile_tokens(p)

    key = _ckey(p, doc_id, lang)                                          # 1) jugement du LLM (avec cache)
    if key in sc_cache:
        llm = sc_cache[key]
    else:
        llm = llm_score_job(p, doc_id, lang)
        if llm["ok"]:
            sc_cache[key] = llm
            json.dump(sc_cache, open(SC_CACHE_PATH, "w", encoding="utf-8"), ensure_ascii=False)

    matched = [s for s in llm["matched"] if supported(s, job_tok, 0.5) and supported(s, prof_tok, 0.5)]      # 2) vérification
    missing = [s for s in llm["missing"] if supported(s, job_tok, 0.5) and not supported(s, prof_tok, 1.0)
               and s.lower() not in {m.lower() for m in matched}]
    n_dropped = (len(llm["matched"]) - len(matched)) + (len(llm["missing"]) - len(missing))

    skills_llm = llm["skills_fit"] / 5 if llm["ok"] else None
    capped = False
    if llm["ok"] and not matched and llm["skills_fit"] > 2:               # note élevée sans aucune preuve : plafonnée à 2/5
        skills_llm, capped = 2 / 5, True

    years, ysrc = candidate_years(p)                                      # 3) signaux du code
    lex, hits = lexical_overlap(p, job_tok)
    comp = {"title": llm["title_fit"] / 5 if llm["ok"] else None,
            "skills_llm": skills_llm,
            "skills_lex": lex,
            "experience": exp_score(years, r["required_experience"]),
            "education": edu_score(edu_level(p.get("education")), edu_level(r["required_education"])),
            "retrieval": retrieval_signal(cand)}
    return {"doc_id": doc_id, "title": r["title"], "location": r["location"], "employment_type": r["employment_type"],
            "function": r["function"], "required_experience": r["required_experience"],
            "required_education": r["required_education"], "excerpt": snip(r["requirements"], 300),
            "score": round(100 * combine(comp), 1), "components": comp,
            "matched": matched, "missing": missing, "reasoning": llm["reasoning"],
            "llm_ok": llm["ok"], "capped": capped, "n_dropped": n_dropped, "n_claimed": len(llm["matched"]) + len(llm["missing"]),
            "lex_hits": hits, "years": years, "years_src": ysrc}

def rank_jobs(scored, weights=None):
    """Classe du meilleur au moins bon (égalité : meilleur signal du retriever d'abord). Ne modifie pas la liste d'entrée."""
    weights = weights or WEIGHTS
    out = [dict(j, score=round(100 * combine(j["components"], weights), 1)) for j in scored]
    return sorted(out, key=lambda j: (-j["score"], -(j["components"].get("retrieval") or 0)))

def why_above(a, b, weights=None):
    """Composante qui explique le mieux pourquoi `a` a un meilleur score que `b` : (clé, écart en points sur 100)."""
    weights = weights or WEIGHTS
    keys = [k for k in weights if weights[k] > 0 and a["components"].get(k) is not None and b["components"].get(k) is not None]
    tot = sum(weights[k] for k in keys) or 1
    diffs = {k: 100 * (a["components"][k] - b["components"][k]) * weights[k] / tot for k in keys}
    if not diffs:
        return None, 0.0
    k = max(diffs, key=diffs.get)
    return k, diffs[k]

def verdict_idx(score):
    return 0 if score >= 75 else 1 if score >= 60 else 2 if score >= 45 else 3

def annotate_ranking(top):
    """Ajoute le rang et, pour chaque poste, ce qui le distingue du précédent et du suivant."""
    for i, j in enumerate(top):
        j["rank"] = i + 1
        j["vs_next"] = why_above(j, top[i + 1]) if i + 1 < len(top) else None
        j["vs_prev"] = why_above(top[i - 1], j) if i > 0 else None
    return top
