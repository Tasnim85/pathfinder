"""Report Generator: LLM-written summary (facts supplied by code), HTML / Markdown / JSON. From notebook cell 182."""
import json
import re

from . import config as C
from .llm import llm_strong
from .scoring import LANG_NAME, verdict_idx
from .textutil import esc

REPORT_DIR = C.REPORT_DIR


# ===== 7.5 Report Generator : textes, HTML, Markdown, JSON =====
RT = {
 "fr": dict(
   title="Rapport de recommandation de postes", gen="Généré le", cand="Profil du candidat", target="Poste visé",
   years="Expérience", y_stated="annoncée dans le CV", y_est="estimée d'après les dates", na="non renseigné",
   edu="Formation", skills="Compétences clés", summ="Synthèse", ranking="Classement des postes",
   c_rank="Rang", c_job="Poste", c_loc="Lieu", c_type="Contrat", c_score="Score", details="Détail des postes recommandés",
   breakdown="Détail du score", matched="Compétences en commun", missing="Exigences du poste non retrouvées dans le profil",
   ahead="Devant le #{n} surtout grâce à : {c} (≈ +{d:.0f} pts)", behind="Derrière le #{n} surtout à cause de : {c} (≈ -{d:.0f} pts)",
   tie="Score quasi identique à celui du #{n}", req_exp="Expérience demandée", req_edu="Formation demandée",
   excerpt="Extrait des exigences", method="Comment lire ce score",
   method_txt=("Le score (0 à 100) est une moyenne pondérée de six critères : compétences et métier jugés par un modèle de langage, "
               "niveau d'expérience et de formation calculés par des règles, recouvrement de mots-clés et similarité avec la requête. "
               "Les poids sont fixés a priori et non appris. Les catégories d'adéquation (≥75, ≥60, ≥45) sont indicatives. "
               "Ce rapport aide à la décision ; il ne la remplace pas."),
   conf_ok="Confiance : élevée", conf_low="Confiance : limitée",
   r_grader="la requête n'a pas été validée par le contrôle de pertinence", r_score="le meilleur score est inférieur à 50",
   r_parse="le profil du CV a été mal extrait", r_llm="certains postes ont été notés sans l'évaluation sémantique du modèle",
   v=("Très bonne adéquation", "Bonne adéquation", "Adéquation partielle", "Faible adéquation"),
   llm_off="Évaluation sémantique indisponible pour ce poste : score calculé sans elle.",
   capped="Note de compétences plafonnée : aucune compétence commune vérifiée.",
   no_match="Aucun poste suffisamment proche n'a été trouvé.", pool="postes analysés", q="Requête de recherche",
   comp={"skills_llm": "couverture des compétences requises", "title": "proximité du métier", "experience": "niveau d'expérience",
         "retrieval": "similarité avec la requête", "skills_lex": "mots-clés de compétences communs", "education": "niveau de formation"}),
 "en": dict(
   title="Job recommendation report", gen="Generated on", cand="Candidate profile", target="Target role",
   years="Experience", y_stated="stated in the resume", y_est="estimated from dates", na="not available",
   edu="Education", skills="Key skills", summ="Summary", ranking="Job ranking",
   c_rank="Rank", c_job="Job", c_loc="Location", c_type="Contract", c_score="Score", details="Recommended jobs in detail",
   breakdown="Score breakdown", matched="Shared skills", missing="Job requirements not found in the profile",
   ahead="Ahead of #{n} mainly thanks to: {c} (≈ +{d:.0f} pts)", behind="Behind #{n} mainly because of: {c} (≈ -{d:.0f} pts)",
   tie="Score almost identical to #{n}", req_exp="Required experience", req_edu="Required education",
   excerpt="Requirements excerpt", method="How to read this score",
   method_txt=("The score (0 to 100) is a weighted average of six criteria: skills and role judged by a language model, "
               "experience and education levels computed by rules, keyword overlap and similarity with the search query. "
               "Weights are set a priori, not learned. Fit labels (>=75, >=60, >=45) are indicative. "
               "This report supports a decision; it does not replace it."),
   conf_ok="Confidence: high", conf_low="Confidence: limited",
   r_grader="the search query was not validated by the relevance check", r_score="the best score is below 50",
   r_parse="the resume profile was poorly extracted", r_llm="some jobs were scored without the model's semantic evaluation",
   v=("Excellent fit", "Good fit", "Partial fit", "Weak fit"),
   llm_off="Semantic evaluation unavailable for this job: score computed without it.",
   capped="Skills rating capped: no verified shared skill.",
   no_match="No sufficiently close job was found.", pool="jobs analysed", q="Search query",
   comp={"skills_llm": "coverage of required skills", "title": "closeness of the role", "experience": "experience level",
         "retrieval": "similarity with the query", "skills_lex": "shared skill keywords", "education": "education level"}),
}
COMP_ORDER = ["skills_llm", "title", "experience", "retrieval", "skills_lex", "education"]

# --- synthèse rédigée : le LLM écrit le texte, le code fournit tous les faits et tous les chiffres ----------------
def _fmt_years(rep, L):
    y, src = rep["years"]
    return L["na"] if y is None else f"{y:g} ans · {L['y_stated'] if src == 'stated' else L['y_est']}" if rep["lang"] == "fr" \
        else f"{y:g} years · {L['y_stated'] if src == 'stated' else L['y_est']}"

def summary_fallback(rep):
    """Synthèse sans LLM, construite par gabarit (utilisée si le LLM échoue)."""
    top, p, fr = rep["top"], rep["profile"], rep["lang"] == "fr"
    if not top:
        return RT[rep["lang"]]["no_match"]
    t1 = top[0]
    s = (f"Le candidat est positionné sur « {p.get('target_title') or 'profil non précisé'} ». " if fr
         else f"The candidate is positioned as \"{p.get('target_title') or 'unspecified profile'}\". ")
    s += (f"Le poste n°1, « {t1['title']} », obtient le meilleur score ({t1['score']:.0f}/100)" if fr
          else f"Job #1, \"{t1['title']}\", has the best score ({t1['score']:.0f}/100)")
    if len(top) > 1 and t1["vs_next"] and t1["vs_next"][0]:
        s += (f", devant « {top[1]['title']} » ({top[1]['score']:.0f}/100), surtout grâce à {RT['fr']['comp'][t1['vs_next'][0]]}. " if fr
              else f", ahead of \"{top[1]['title']}\" ({top[1]['score']:.0f}/100), mainly thanks to {RT['en']['comp'][t1['vs_next'][0]]}. ")
    else:
        s += ". "
    gaps = list(dict.fromkeys(g for j in top[:3] for g in j["missing"]))[:4]
    if gaps:
        s += ("Compétences à renforcer : " if fr else "Skills to strengthen: ") + ", ".join(gaps) + "."
    return s

def write_summary(rep):
    """Le LLM reformule des faits fournis par le code. Repli sur le gabarit si la sortie est vide ou trop courte."""
    top, p = rep["top"], rep["profile"]
    if not top:
        return summary_fallback(rep)
    facts = {"candidate": {"target_title": p.get("target_title"), "years_experience": rep["years"][0],
                           "skills": (p.get("skills") or [])[:8], "education": (p.get("education") or [])[:2]},
             "jobs": [{"rank": j["rank"], "title": j["title"], "score_out_of_100": j["score"],
                       "shared_skills": j["matched"][:4], "missing_skills": j["missing"][:3],
                       "main_reason_vs_next_job": (RT["en"]["comp"][j["vs_next"][0]] if j["vs_next"] and j["vs_next"][0] else None)}
                      for j in top[:5]]}
    system = ("You write the executive summary of a candidate-to-job matching report for a recruiter. Use ONLY the facts in the "
              "JSON. Never invent skills, numbers, companies or dates. Plain text, no markdown, no bullet points, no headings. "
              f"Language: {LANG_NAME[rep['lang']]}. Maximum 140 words. Structure: (1) the candidate profile in 1-2 sentences; "
              "(2) why job rank 1 comes first and how rank 2 differs (mention rank 3 if useful); (3) one sentence on the main "
              "skills to strengthen. Refer to jobs by rank and exact title.")
    try:
        txt = llm_strong(system, json.dumps(facts, ensure_ascii=False), 380)
        txt = re.sub(r"[*#`]+", "", txt).strip()
        if len(txt) >= 60:
            return txt
    except Exception as ex:
        print("⚠️ synthèse LLM indisponible :", type(ex).__name__)
    return summary_fallback(rep)

# --- HTML ---------------------------------------------------------------------------------------------------------
RP_CSS = """<style>
.rp{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1e293b;max-width:980px;margin:0 auto;line-height:1.5}
.rp h1{font-size:22px;margin:0 0 2px}.rp h2{font-size:16px;margin:22px 0 8px;border-bottom:2px solid #e2e8f0;padding-bottom:4px}
.rp .sub{color:#64748b;font-size:12.5px}.rp .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px}
.rp table{border-collapse:collapse;width:100%;font-size:13px}.rp th{background:#0f172a;color:#fff;text-align:left;padding:6px 10px}
.rp td{padding:6px 10px;border-bottom:1px solid #e2e8f0;vertical-align:top}
.rp .chip{display:inline-block;border-radius:999px;padding:2px 10px;margin:0 6px 5px 0;font-size:12px;font-weight:600}
.rp .ok{background:#dcfce7;color:#166534}.rp .ko{background:#ffedd5;color:#9a3412}.rp .nt{background:#e2e8f0;color:#334155}
.rp .card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin:12px 0;page-break-inside:avoid}
.rp .head{display:flex;align-items:center;gap:12px}.rp .rank{font-size:20px;font-weight:800;color:#0f172a;min-width:38px}
.rp .ttl{flex:1;font-weight:700;font-size:15px}.rp .badge{color:#fff;border-radius:8px;padding:4px 10px;font-weight:800;font-size:15px;white-space:nowrap}
.rp .meta{color:#64748b;font-size:12.5px;margin:4px 0 6px}.rp .vd{font-weight:700;font-size:13px;margin:2px 0}
.rp .why{background:#eff6ff;border-left:4px solid #2563eb;padding:6px 10px;border-radius:4px;font-size:12.5px;margin:8px 0}
.rp .bar{height:7px;background:#e2e8f0;border-radius:4px;overflow:hidden}.rp .bar div{height:100%}
.rp .bl{display:flex;gap:8px;align-items:center;font-size:12px;margin:3px 0}.rp .bl>span:first-child{width:230px;flex:none}.rp .bl>.bar{flex:1}.rp .bl>span:last-child{width:42px;text-align:right;flex:none}
.rp .warn{background:#fef3c7;border-left:4px solid #d97706;padding:8px 12px;border-radius:4px;font-size:13px;margin:10px 0}
.rp .good{background:#dcfce7;border-left:4px solid #15803d;padding:8px 12px;border-radius:4px;font-size:13px;margin:10px 0}
.rp .tiny{font-size:11.5px;color:#64748b}
</style>"""

def score_color(s):
    return "#15803d" if s >= 75 else "#2563eb" if s >= 60 else "#d97706" if s >= 45 else "#b91c1c"

def _why_text(j, L):
    for pair, n, tpl in ((j.get("vs_prev"), j["rank"] - 1, "behind"), (j.get("vs_next"), j["rank"] + 1, "ahead")):
        if pair is None or j["rank"] > 1 and tpl == "ahead":
            continue
        k, d = pair
        if k is None or abs(d) < 0.5:
            return L["tie"].format(n=n)
        return L[tpl].format(n=n, c=L["comp"][k], d=abs(d))
    return ""

def build_report_html(rep, standalone=False):
    L, p = RT[rep["lang"]], rep["profile"]
    e = esc
    h = [f"<div class='rp'><h1>{e(L['title'])}</h1>",
         f"<div class='sub'>CV {e(rep['cv_id'])} · {e(L['gen'])} {e(rep['generated_at'])} · {rep['pool_size']} {e(L['pool'])}</div>"]
    h.append(f"<h2>{e(L['cand'])}</h2><div class='box'>"
             f"<b>{e(L['target'])}</b> : {e(p.get('target_title') or L['na'])}<br>"
             f"<b>{e(L['years'])}</b> : {e(_fmt_years(rep, L))}<br>"
             f"<b>{e(L['edu'])}</b> : {e(', '.join(p.get('education') or []) or L['na'])}<div style='margin-top:8px'>"
             + "".join(f"<span class='chip nt'>{e(s)}</span>" for s in (p.get("skills") or [])[:10]) + "</div></div>")
    if rep["confidence"] == "low":
        h.append(f"<div class='warn'><b>{e(L['conf_low'])}</b> : " + " ; ".join(e(L[r]) for r in rep["conf_reasons"]) + ".</div>")
    else:
        h.append(f"<div class='good'><b>{e(L['conf_ok'])}</b></div>")
    h.append(f"<h2>{e(L['summ'])}</h2>" + "".join(f"<p>{e(par)}</p>" for par in rep["summary"].split("\n\n") if par.strip()))
    if not rep["top"]:
        h.append(f"<div class='warn'>{e(L['no_match'])}</div></div>")
        return (RP_CSS + "".join(h)) if not standalone else _wrap_page(rep, RP_CSS + "".join(h))
    h.append(f"<h2>{e(L['ranking'])}</h2><table><tr><th>{e(L['c_rank'])}</th><th>{e(L['c_job'])}</th><th>{e(L['c_loc'])}</th>"
             f"<th>{e(L['c_type'])}</th><th>{e(L['c_score'])}</th></tr>")
    for j in rep["top"]:
        h.append(f"<tr><td><b>#{j['rank']}</b></td><td>{e(j['title'][:80])}</td><td>{e(j['location'] or '-')}</td>"
                 f"<td>{e(j['employment_type'] or '-')}</td><td><b style='color:{score_color(j['score'])}'>{j['score']:.0f}/100</b></td></tr>")
    h.append("</table>")
    h.append(f"<h2>{e(L['details'])}</h2>")
    for j in rep["top"]:
        col = score_color(j["score"])
        meta = [x for x in (j["location"], j["employment_type"],
                            f"{L['req_exp']} : {j['required_experience']}" if j["required_experience"] else "",
                            f"{L['req_edu']} : {j['required_education']}" if j["required_education"] else "") if x]
        h.append(f"<div class='card'><div class='head'><div class='rank'>#{j['rank']}</div><div class='ttl'>{e(j['title'][:90])}</div>"
                 f"<div class='badge' style='background:{col}'>{j['score']:.0f}/100</div></div>"
                 f"<div class='meta'>{e(' · '.join(meta))}</div><div class='vd' style='color:{col}'>{e(L['v'][verdict_idx(j['score'])])}</div>")
        if j["reasoning"]:
            h.append(f"<div style='font-size:13px'>{e(j['reasoning'])}</div>")
        why = _why_text(j, L)
        if why:
            h.append(f"<div class='why'>{e(why)}</div>")
        if j["matched"]:
            h.append(f"<div style='margin-top:6px'><b style='font-size:12.5px'>{e(L['matched'])}</b><br>"
                     + "".join(f"<span class='chip ok'>{e(s)}</span>" for s in j["matched"]) + "</div>")
        if j["missing"]:
            h.append(f"<div><b style='font-size:12.5px'>{e(L['missing'])}</b><br>"
                     + "".join(f"<span class='chip ko'>{e(s)}</span>" for s in j["missing"]) + "</div>")
        h.append(f"<div style='margin-top:8px'><b style='font-size:12.5px'>{e(L['breakdown'])}</b>")
        for k in COMP_ORDER:
            v = j["components"].get(k)
            if v is None:
                h.append(f"<div class='bl'><span>{e(L['comp'][k])}</span><span class='tiny'>{e(L['na'])}</span><span></span></div>")
            else:
                h.append(f"<div class='bl'><span>{e(L['comp'][k])}</span><div class='bar'><div style='width:{v * 100:.0f}%;background:{score_color(v * 100)}'></div></div>"
                         f"<span>{v * 100:.0f}%</span></div>")
        h.append("</div>")
        if not j["llm_ok"]:
            h.append(f"<div class='tiny'>⚠ {e(L['llm_off'])}</div>")
        if j["capped"]:
            h.append(f"<div class='tiny'>⚠ {e(L['capped'])}</div>")
        h.append(f"<div class='tiny' style='margin-top:6px'><b>{e(L['excerpt'])}</b> : {e(j['excerpt'])}</div></div>")
    h.append(f"<h2>{e(L['method'])}</h2><div class='tiny'>{e(L['method_txt'])}<br>{e(L['q'])} : {e(rep['query'])}</div></div>")
    body = RP_CSS + "".join(h)
    return _wrap_page(rep, body) if standalone else body

def _wrap_page(rep, body):
    return ("<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
            f"<title>{esc(RT[rep['lang']]['title'])} - CV {esc(rep['cv_id'])}</title></head>"
            f"<body style='margin:0;padding:18px;background:#fff'>{body}</body></html>")

def build_report_md(rep):
    L, p = RT[rep["lang"]], rep["profile"]
    m = [f"# {L['title']} : CV {rep['cv_id']}", f"*{L['gen']} {rep['generated_at']} · {rep['pool_size']} {L['pool']}*", "",
         f"## {L['cand']}", f"- **{L['target']}** : {p.get('target_title') or L['na']}",
         f"- **{L['years']}** : {_fmt_years(rep, L)}", f"- **{L['edu']}** : {', '.join(p.get('education') or []) or L['na']}",
         f"- **{L['skills']}** : {', '.join((p.get('skills') or [])[:10]) or L['na']}", ""]
    m += [("> ⚠️ **" + L["conf_low"] + "** : " + " ; ".join(L[r] for r in rep["conf_reasons"])) if rep["confidence"] == "low"
          else "> ✅ **" + L["conf_ok"] + "**", "", f"## {L['summ']}", rep["summary"], ""]
    if not rep["top"]:
        return "\n".join(m + [L["no_match"]])
    m += [f"## {L['ranking']}", f"| {L['c_rank']} | {L['c_job']} | {L['c_loc']} | {L['c_type']} | {L['c_score']} |", "|---|---|---|---|---|"]
    m += [f"| #{j['rank']} | {j['title'][:80]} | {j['location'] or '-'} | {j['employment_type'] or '-'} | {j['score']:.0f}/100 |" for j in rep["top"]]
    m += ["", f"## {L['details']}"]
    for j in rep["top"]:
        m += ["", f"### #{j['rank']} · {j['title']} : {j['score']:.0f}/100 ({L['v'][verdict_idx(j['score'])]})"]
        if j["reasoning"]:
            m.append(j["reasoning"])
        if _why_text(j, L):
            m.append(f"*{_why_text(j, L)}*")
        if j["matched"]:
            m.append(f"- **{L['matched']}** : {', '.join(j['matched'])}")
        if j["missing"]:
            m.append(f"- **{L['missing']}** : {', '.join(j['missing'])}")
        m.append(f"- **{L['breakdown']}** : " + " · ".join(f"{L['comp'][k]} {j['components'][k] * 100:.0f}%" for k in COMP_ORDER
                                                          if j["components"].get(k) is not None))
    m += ["", f"## {L['method']}", L["method_txt"], f"{L['q']} : {rep['query']}"]
    return "\n".join(m)

def save_report(rep):
    base = REPORT_DIR / f"report_{rep['cv_id']}"
    paths = {"html": f"{base}.html", "md": f"{base}.md", "json": f"{base}.json"}
    open(paths["html"], "w", encoding="utf-8").write(build_report_html(rep, standalone=True))
    open(paths["md"], "w", encoding="utf-8").write(build_report_md(rep))
    open(paths["json"], "w", encoding="utf-8").write(json.dumps(rep, ensure_ascii=False, indent=1, default=str))
    return paths
