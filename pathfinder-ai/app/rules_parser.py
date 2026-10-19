"""
Parser Agent : CV (PDF ou texte brut) -> JSON structuré.
Aucune clé API : règles + regex, 100 % local et déterministe.

Réutilise la logique de votre notebook (TITLES + split_sections), avec deux ajouts :
  - support du PDF (extraction de texte + normalisation des titres)
  - extraction de champs : skills, expériences (dates), diplômes, années d'expérience...

Usage notebook :
    from parser_agent import parse_cv_text, parse_cv_pdf
    cv = parse_cv_text(df_Resume.loc[0, "Resume_str"], cv_id="123", category="INFORMATION-TECHNOLOGY")

Usage API (pour n8n, HTTP Request node) :
    uvicorn parser_agent:app --port 8001
    POST /parse_text  {"text": "...", "cv_id": "123"}
    POST /parse_pdf   (multipart, champ "file")
"""
import io
import json
import re
from datetime import date

# --------------------------------------------------------------------------
# 1. Sections (repris du notebook)
# --------------------------------------------------------------------------
TITLES = ["professional summary", "summary", "career overview", "objective",
          "highlights", "core qualifications", "qualifications", "skills",
          "professional experience", "work history", "experience",
          "education and training", "education", "accomplishments",
          "certifications", "affiliations", "professional affiliations",
          "additional information", "interests", "languages"]

_TITLES_RE = "|".join(sorted(TITLES, key=len, reverse=True))
PATTERN = re.compile(r"(?:^|\s{2,})(" + _TITLES_RE + r")\s{2,}", flags=re.I)

# groupes de titres -> champ logique
GROUPS = {
    "summary":        ["professional summary", "summary", "career overview", "objective"],
    "skills":         ["skills", "core qualifications", "qualifications", "highlights"],
    "experience":     ["professional experience", "work history", "experience"],
    "education":      ["education and training", "education"],
    "certifications": ["certifications", "accomplishments"],
    "languages":      ["languages"],
}


def normalize_pdf_text(text: str) -> str:
    """Un PDF donne des titres seuls sur une ligne ; le notebook attend
    des titres entourés de 2+ espaces. On convertit l'un vers l'autre."""
    text = text.replace("\x00", " ")
    text = re.sub(rf"(?im)^[ \t]*({_TITLES_RE})[ \t]*:?[ \t]*$", r"  \1  ", text)
    return text


def split_sections(text: str):
    matches = list(PATTERN.finditer(text))
    if not matches:
        return [("full_text", text.strip())]
    sections = []
    header = text[:matches[0].start()].strip()
    if header:
        sections.append(("header", header))
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        sections.append((m.group(1).lower(), text[m.end():end].strip()))
    return sections


def _group_text(sections, group):
    return "\n".join(body for t, body in sections if t in GROUPS[group]).strip()


# --------------------------------------------------------------------------
# 2. Extraction de champs
# --------------------------------------------------------------------------
MONTHS = {m: i + 1 for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}
_DATE = (r"(?:(?:0?[1-9]|1[0-2])/\d{4}"
         r"|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?,?\s+\d{4}"
         r"|(?:19|20)\d{2})")
_NOW = r"(?:Current|Present|Now|Today|Ongoing|Till\s+date)"
RANGE_RE = re.compile(rf"({_DATE})\s*(?:to|-|–|—)\s*({_DATE}|{_NOW})", re.I)


def _to_ym(s: str):
    """'02/2011' | 'Jan 2011' | '2011' | 'Current' -> (année, mois)."""
    s = s.strip()
    if re.fullmatch(_NOW, s, flags=re.I):
        t = date.today()
        return t.year, t.month
    m = re.fullmatch(r"(\d{1,2})/(\d{4})", s)
    if m:
        return int(m.group(2)), int(m.group(1))
    m = re.fullmatch(r"([A-Za-z]+)\.?,?\s+(\d{4})", s)
    if m:
        return int(m.group(2)), MONTHS.get(m.group(1)[:3].lower(), 1)
    return int(s), 1


def parse_experience(text: str):
    """Une expérience = une plage de dates. Heuristique : l'en-tête
    (poste / entreprise / lieu) est juste avant la date, sinon juste après."""
    matches = list(RANGE_RE.finditer(text))
    # 1) pour chaque plage de dates, repérer l'en-tête qui la précède (dernier segment avant la date)
    tails, prev_end = [], 0
    for m in matches:
        before = text[prev_end:m.start()]
        tails.append((before, re.split(r"(?<=[.!?])\s|\n", before)[-1]))
        prev_end = m.end()
    entries = []
    for i, m in enumerate(matches):
        before, tail = tails[i]
        head_words = tail.split()
        header_before = len(head_words) >= 2
        header = " ".join(head_words[-14:]) if header_before else ""
        nxt = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        after = text[m.end():nxt]
        if i + 1 < len(matches):                       # retirer l'en-tête de l'expérience suivante
            nb, nt = tails[i + 1]
            if len(nt.split()) >= 2 and nt:
                after = text[m.end():m.end() + len(nb) - len(nt)]
        if not header_before:                           # mise en page "date puis titre"
            header = " ".join(after.split()[:12])
        desc = re.sub(r"\s+", " ", after).strip()
        parts = [p.strip() for p in re.split(r"\s{2,}", tail.strip()) if p.strip() not in {"", ","}]
        sy, sm = _to_ym(m.group(1))
        ey, em = _to_ym(m.group(2))
        entries.append({
            "title": parts[-1] if parts else None,     # approximatif
            "company": parts[0] if len(parts) > 1 else None,
            "header_raw": header,
            "start": f"{sy}-{sm:02d}",
            "end": "current" if re.fullmatch(_NOW, m.group(2), flags=re.I) else f"{ey}-{em:02d}",
            "months": max((ey - sy) * 12 + (em - sm), 0),
            "description": desc[:1200],
            "_iv": (sy * 12 + sm, ey * 12 + em),
        })
    return entries


def total_years(entries) -> float:
    """Union des intervalles (évite de compter deux fois les postes qui se chevauchent)."""
    ivs = sorted(e["_iv"] for e in entries if e["_iv"][1] >= e["_iv"][0])
    total, cur_s, cur_e = 0, None, None
    for s, e in ivs:
        if cur_e is None or s > cur_e:
            if cur_e is not None:
                total += cur_e - cur_s
            cur_s, cur_e = s, e
        else:
            cur_e = max(cur_e, e)
    if cur_e is not None:
        total += cur_e - cur_s
    return round(total / 12, 1)


def split_items(text: str, max_words=10, max_items=60):
    """Découpe une liste (compétences, certifs...) : 2+ espaces, \\n, puces, ';', virgules hors parenthèses."""
    parts = re.split(r"\s{2,}|\n|[•·●▪■◦;|]|,(?![^()]*\))", text)
    seen, out = set(), []
    for p in parts:
        p = re.sub(r"^[\s\-–*•]+|[\s\-–*•.:]+$", "", p)
        if 2 <= len(p) <= 80 and len(p.split()) <= max_words and p.lower() not in seen:
            seen.add(p.lower())
            out.append(p)
    return out[:max_items]


DEGREE_LEVELS = [
    (5, r"ph\.?\s?d|doctorate|doctor of"),
    (4, r"master|mba|m\.s\.|msc|m\.a\.|m\.eng"),
    (3, r"bachelor|b\.s\.|b\.a\.|bsc|b\.eng"),
    (2, r"associate"),
    (1, r"diploma|certificate"),
    (0, r"high school|ged"),
]
LEVEL_NAMES = {5: "doctorate", 4: "master", 3: "bachelor", 2: "associate", 1: "diploma/certificate", 0: "high school"}
_ABBR = re.compile(r"\b(B\.?S\.?|B\.?A\.?|M\.?S\.?|M\.?A\.?|MBA|BSc|MSc|Ph\.?D\.?)(?=[\s,\.;:]|$)")


def parse_education(text: str):
    found = []
    for level, rx in DEGREE_LEVELS:
        if re.search(rf"\b(?:{rx})", text, flags=re.I):
            found.append(level)
    for a in _ABBR.findall(text):                    # abréviations sensibles à la casse
        a_clean = a.replace(".", "")
        found.append(5 if a_clean.lower() == "phd" else 4 if a_clean in {"MS", "MA", "MBA", "MSc"} else 3)
    if not found:
        return {"highest_level": None, "text": text[:500]}
    lvl = max(found)
    return {"highest_level": LEVEL_NAMES[lvl], "text": re.sub(r"\s+", " ", text)[:500]}


def parse_contact(text: str):
    email = re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", text)
    phone = re.search(r"(?<!\d)(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{2,4}(?!\d)", text)
    return {"email": email.group(0) if email else None,
            "phone": phone.group(0).strip() if phone and len(re.sub(r"\D", "", phone.group(0))) >= 8 else None}


def guess_name(text: str, headline):
    """Seulement pertinent pour les vrais PDF : 1re ligne courte, sans chiffres, sans titre de section."""
    first = next((l.strip() for l in text.splitlines() if l.strip()), "")
    if 2 <= len(first.split()) <= 4 and not re.search(r"\d|@", first) and first.lower() not in TITLES:
        return first
    return None


# --------------------------------------------------------------------------
# 3. Fonction principale
# --------------------------------------------------------------------------
def parse_cv_text(text: str, cv_id=None, category=None, from_pdf=False) -> dict:
    raw = normalize_pdf_text(text) if from_pdf else text
    sections = split_sections(raw)
    sec = {g: _group_text(sections, g) for g in GROUPS}
    header = next((b for t, b in sections if t == "header"), "")
    exp = parse_experience(sec["experience"]) if sec["experience"] else []
    years_stated = None
    m = re.search(r"(\d{1,2})\+?\s*(?:years|yrs)", sec["summary"] or raw[:1500], flags=re.I)
    if m:
        years_stated = int(m.group(1))

    # comp. : si pas de section "skills", on tente "highlights/qualifications" déjà inclus dans GROUPS
    skills = split_items(sec["skills"])

    out = {
        "cv_id": str(cv_id) if cv_id is not None else None,
        "category": category,                       # proxy fourni par le dataset (à signaler dans les limites)
        "name": guess_name(text, header) if from_pdf else None,
        "contact": parse_contact(raw) if from_pdf else {"email": None, "phone": None},
        "headline": re.sub(r"\s+", " ", header)[:120] or None,
        "summary": re.sub(r"\s+", " ", sec["summary"])[:1200] or None,
        "skills": skills,
        "experience": [{k: v for k, v in e.items() if k != "_iv"} for e in exp],
        "years_experience_computed": total_years(exp) if exp else None,
        "years_experience_stated": years_stated,
        "education": parse_education(sec["education"]) if sec["education"] else None,
        "certifications": split_items(sec["certifications"], max_words=14),
        "languages": split_items(sec["languages"], max_words=4),
        "sections_found": [t for t, _ in sections],
    }
    # contrôle qualité : sert à l'Orchestrateur pour décider de continuer ou non
    missing = [k for k in ("summary", "skills", "experience", "education") if not out[k]]
    warnings = []
    if sections[0][0] == "full_text":
        warnings.append("aucun titre de section détecté (CV non structuré)")
    if years_stated and out["years_experience_computed"] is not None \
            and abs(years_stated - out["years_experience_computed"]) > 5:
        warnings.append(f"écart années d'expérience : annoncé {years_stated} vs calculé {out['years_experience_computed']}")
    out["quality"] = {"missing_fields": missing, "warnings": warnings,
                      "ok": len(missing) <= 1 and sections[0][0] != "full_text"}
    return out


def pdf_to_text(data: bytes) -> str:
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            txt = "\n".join((p.extract_text() or "") for p in pdf.pages)
    except ImportError:
        from pypdf import PdfReader
        txt = "\n".join((p.extract_text() or "") for p in PdfReader(io.BytesIO(data)).pages)
    if len(txt.strip()) < 50:
        raise ValueError("PDF sans couche texte (scan ?) : OCR nécessaire (pytesseract)")
    return txt


def parse_cv_pdf(path_or_bytes, cv_id=None, category=None) -> dict:
    data = path_or_bytes if isinstance(path_or_bytes, bytes) else open(path_or_bytes, "rb").read()
    return parse_cv_text(pdf_to_text(data), cv_id=cv_id, category=category, from_pdf=True)


# --------------------------------------------------------------------------
# 4. Évaluation : taux de couverture sur N CV (pour le rapport)
# --------------------------------------------------------------------------
def coverage_report(df, n=100, seed=0, text_col="Resume_str", id_col="ID", cat_col="Category"):
    import pandas as pd
    sample = df.sample(min(n, len(df)), random_state=seed)
    rows = [parse_cv_text(r[text_col], r[id_col], r[cat_col]) for _, r in sample.iterrows()]
    cov = pd.DataFrame({
        "summary": [bool(r["summary"]) for r in rows],
        "skills": [len(r["skills"]) >= 3 for r in rows],
        "experience": [len(r["experience"]) >= 1 for r in rows],
        "education": [bool(r["education"]) for r in rows],
        "degree_level": [bool(r["education"] and r["education"]["highest_level"]) for r in rows],
        "quality_ok": [r["quality"]["ok"] for r in rows],
    })
    return (cov.mean() * 100).round(1).rename("% CV"), rows
