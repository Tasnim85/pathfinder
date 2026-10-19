# PathFinder — AI-powered recruitment platform

> *Finding the right career path.*

**The heart of the project is the multi-agent AI (§3) and its n8n orchestrator (§4). Start there to understand what makes PathFinder different; the rest of this file explains how to run and use everything.**

PathFinder connects **candidates** and **recruiters**. A candidate uploads a CV (PDF) or speaks about their background; a team of AI agents reads it, searches the job offers, and returns a ranked shortlist with a **score out of 100** and the reasons behind it (shared skills, missing skills, experience, education). The candidate can apply directly from the results. Recruiters publish jobs, receive applications, and accept or reject candidates; accepted candidates are notified by email.

---

## 1. What is in this folder

```
.
├── pathfinder/                      FRONT: the website (Next.js) — also its own small backend and database
├── pathfinder-ai/                   BACK: the AI service (FastAPI + the multi-agent pipeline)
├── deployment notebook.ipynb        Kaggle launcher: starts pathfinder-ai on a free GPU + a public tunnel
├── Job-matcher-candidat-final.json  n8n workflow (the original orchestrator, now optional — see §4)
└── notebook-final-dl.ipynb          Research notebook: data, experiments, evaluation (the source of the AI)
```

## 2. How the pieces fit together

```
 Browser ──► pathfinder (Next.js, port 3000)                      pathfinder-ai (FastAPI, port 8000)
              │  pages + API routes ("BFF")                          │  Whisper · Parser · Query Builder
              │  SQLite database (users, jobs, applications)         │  Retriever · Grader · Scoring · Report
              │                                                      │
              └── server-side calls with x-api-key ──────────────────┘
                   /api/extract   PDF → text (done in the website)   /transcribe   audio → text
                   /api/transcribe ───────────────────────────────►  /analyze      text → job_id
                   /api/analyze ──────────────────────────────────►  /result/{id}  running | done | error
                   /api/result/{id} ◄─────────────────────────────   /health
```

- The **browser never talks to the AI directly**. The website calls it from the server, so the AI address and key stay secret.
- The AI service has **no database**. The website owns users, jobs, and applications.
- The jobs used by the AI are the **2,954 offers of the dataset**. They are also imported into the website (split between 16 demo recruiters), so every AI match is a real job a candidate can apply to.

## 3. The multi-agent AI system — the heart of the project

### 3.1 The idea
Matching a person to a job is not one prompt. PathFinder splits it into **five specialised LLM agents** (Parser, Query Builder, Relevance Grader, Scoring Agent, Report Generator) and a **search engine** (the Retriever, no language model), each doing one small, checkable job, plus a **loop that corrects itself**. The guiding rules:

- **Numbers come from code, words come from the language model.** The model never invents a score or a fact.
- **Every claim a model makes is checked by code** against the CV and the job text before it is shown.
- **Every step has a fallback**, so a bad model answer degrades the result (and lowers a visible *confidence*) instead of crashing.

```
 CV (PDF) ──► text ─┐
                    ├─► 1 PARSER ─► 2 QUERY BUILDER ─► 3 RETRIEVER ─► 4 RELEVANCE GRADER ──┐
 Audio ──► Whisper ─┘     profile        search query     candidate jobs      accept?        │
                                            ▲                                  no: reasons   │ yes
                                            └──────── rewrite (max 3 rounds) ◄───────────────┘
                                                                                             ▼
        REPORT: top jobs, score /100, reasons  ◄─ 6 REPORT GENERATOR ◄─ 5 SCORING AGENT ◄─ pool of 7 jobs
```

### 3.2 The data behind the agents
| | Source | After cleaning | Used for |
|---|---|---|---|
| Job offers | *Fake Job Postings* | 7,705 offers → **2,954** kept in 9 categories | the search index and the website's job board |
| CVs | *Resume.csv* (24 categories) | **1,012** CVs in the 9 matching categories | evaluation only |

Kept categories (offers): Information Technology 955 · Sales 692 · Engineering 676 · Design 164 · Business Development 107 · Human Resources 104 · Finance 102 · Education 79 · Art/Creative 75.

**Chunking.** Two methods were compared (fixed size vs by section). The retained one is **by section** (description, requirements, company profile, benefits for offers; experience, skills, education for CVs), because each chunk keeps a complete meaning: 12,256 job chunks of ~114 words (sections over 220 words are split again). Only the *requirements* and *description* chunks are searched. Each chunk is indexed as `job title. chunk text`.

### 3.3 The pipeline, step by step

#### Step 1 — Parser (agent)
| | |
|---|---|
| **Job** | Turns free text (a CV, or a transcribed voice message) into a structured profile |
| **Model** | Qwen2.5-7B-Instruct (prompt `v6` for CVs, `a2` for speech) |
| **Input → output** | Text (first ~1,500 words) → JSON: headline / target title, summary, skills, past jobs (title, company, dates), years of experience, education, certifications, languages |
| **Rules** | “Output ONLY one JSON object; never invent information.” Placeholders such as *Company Name* and the word *null* are cleaned out. The LLM's skills are merged with keywords extracted from the CV's own *skills* section |
| **Safeguards** | The schema is validated; if the answer is cut off it is retried with a bigger budget; if it is still unusable, a **rule-based parser** (regular expressions over the CV sections) takes over and the result is marked `rules_fallback`, which lowers the final confidence |
| **Years** | `stated` when the text says it, `estimated` from the date ranges otherwise (the website shows “estimated from dates”) |

*Spoken input.* A spoken text is shorter and less structured than a CV. With the first speech prompt (`a1`) the parser **invented the number of years in 4 of 20 cases** and **missed the job title in 10 of 20**. The adapted prompt `a2` brings both errors to **0 of 20**. A second guard lives in code: the years are kept only if the transcript literally contains a duration such as “6 years” or “six years”. A spoken profile has ~6 skills on average, versus ~32 for a CV.

#### Step 2 — Query Builder (agent)
| | |
|---|---|
| **Job** | Writes the search query the retriever will use |
| **Model** | Qwen2.5-14B (4-bit) in the notebook; the 7B in the API |
| **Output** | One query of **20–35 words**, shaped like the *requirements* of the ideal job: most likely job title first, then 4–6 core skills or tools, then seniority |
| **Rules** | Uses only information from the profile; no company names, no cities, no first person; keeps the candidate's real profession even when the profile is sparse; guided by examples in the prompt |
| **On a retry** | It also receives the previous query and the Grader's reasons, so it fixes the actual problem instead of guessing |

#### Step 3 — Retriever (the search engine: not an agent, no language model)
Finds the job chunks closest to the query, in four stages:
1. **Dense search**: `bge-small-en-v1.5` embeddings in a **Chroma** index (cosine similarity), top 40–60 chunks.
2. **Keyword search**: a home-made **BM25** inverted index over the same chunks.
3. **Fusion**: *Reciprocal Rank Fusion* (k = 60) merges the two rankings, so a job found by either route is kept.
4. **Rerank**: chunks are grouped by job (best chunk per job, identical texts removed), then the **`bge-reranker-base` cross-encoder** reads the query and each job together and orders the best 12.

#### Step 4 — Relevance Grader (agent)
| | |
|---|---|
| **Job** | Checks that the query brings back jobs of the **right profession** before any scoring is spent on them |
| **Model** | Qwen2.5-14B / 7B |
| **Input → output** | The profile + the 3 best passages → a score **0–5 for each passage** with a written rubric (5 = same profession and most skills … 0 = unrelated), a short reasoning, and a suggested better query |
| **Rubric focus** | The profession (title and core skills) comes first; shared generic words like “manager” or “team” do not count |
| **Decision** | Taken **by code, not by the model**: accepted when **at least 2 of the 3 passages score ≥ 3** |
| **The loop** | If rejected, its reasoning goes back to the Query Builder, which rewrites the query. **Maximum 3 rounds.** If no round is accepted, the round with the best average score is kept. If the Grader's answer cannot be read, the round is accepted by default so the system never blocks |
| **Exposed in the report** | `iterations`, `grader_accepted`, and the final `query` (shown on the results page) |

#### Step 5 — Scoring Agent (agent)
Takes a pool of **7 jobs** (top N + 4) retrieved with the validated query, and scores each one out of 100.

*Step A — the model's judgement* (one call per job, cached so the same profile/job pair is never scored twice): `title_fit` 0–5, `skills_fit` 0–5, up to 6 `matched_skills`, up to 5 `missing_skills`, and a ≤ 45-word reasoning.

*Step B — code checks the model*:
- a **matched** skill must appear in **both** the profile and the job text, otherwise it is dropped;
- a **missing** skill must be written in the job text and **not** be in the profile;
- the page shows how many claims were dropped (“5 of 8 statements were discarded”);
- if the model gives a high skills note but **nothing survives verification**, the skills note is **capped at 2/5** (shown as *Skills score capped*).

*Step C — the six components*:

| Component | Weight | Computed by |
|---|---|---|
| Skills coverage of the requirements | 25 % | LLM (`skills_fit`, capped by the check above) |
| Job-title / profession proximity | 25 % | LLM (`title_fit`) |
| Required experience vs candidate's years | 15 % | **code** (rule) |
| Search relevance (reranker score) | 15 % | **retriever** |
| Skills found word for word in the job | 10 % | **code** |
| Required education vs candidate's level | 10 % | **code** (rule) |

If a piece of data is missing (for example an offer with no stated experience), that component is **skipped and the other weights are renormalised**: the site shows it as “Not assessed”. Labels: **≥ 75 very good · ≥ 60 good · ≥ 45 partial · below weak**. The weights and thresholds were chosen by reasoning, **not learned**. Jobs are then ranked, and for each one the code computes **why it is above the next** (the component with the biggest weighted gap).

#### Step 6 — Report Generator (agent)
Writes the executive summary (≤ 140 words, in French by default) **from facts supplied by the code only** — “never invent skills, numbers, companies or dates” — with a template fallback if the model's text is empty or too short. It produces **HTML** (all text escaped), **Markdown** and **JSON**, and the **confidence** of the report:

| Confidence is **low** when… | Shown as |
|---|---|
| the Grader never accepted a query | “search query was never fully validated” |
| the best score is below 50 | “best match scored below 50/100” |
| the Parser fell back to rules or the schema had problems | profile could not be extracted cleanly |
| a job was scored without the model's judgement | partly scored by rules only |

### 3.4 Orchestration and models
`run_pipeline()` chains the agents in the order above. Two details:
- **Models.** In the research notebook the 7B is loaded for the Parser, freed, then the 14B is loaded for the rest (they do not fit together in 2 × T4). **In the API the 7B serves every agent** (a full analysis takes ~1.5–3 min instead of longer); set `LLM_STRONG=14b` on a bigger GPU to use the 14B for the Query Builder, Grader, Scoring and summary.
- **One analysis at a time** on the GPU (a lock), so two users cannot corrupt each other's run. Identical text sent twice reuses the same job.

### 3.5 The voice path
`audio → Whisper small (English) → text → Parser prompt a2 → the same agents`. Transcription quality measured on 20 synthetic recordings (6 different voices): **word error rate 1.9 %** on average (0 % best, 5.8 % worst); **92.6 %** of technical terms are transcribed correctly, and 9 clips out of 20 miss at least one (for instance “SAP” → “SAPI”, “Kronos” → “Chronos”). That is why the website shows the transcript and **lets the user correct it before analysing**.

### 3.6 How well does it work?
Measure: for each of the 20 test candidates, are the returned jobs in a category compatible with the CV's category?

| Input | Compatible jobs |
|---|---|
| Full CV | **77 %** |
| Original spoken text | 68 % |
| Whisper transcript | 70 % |

Audio vs CV on the 20 candidates: better in 1 case, equal in 15, worse in 4. Per category (CV / audio): Engineering, HR, Sales 1.00 / 1.00 · Business Development 0.89 / 1.00 · IT 1.00 / 0.83 · Finance, Teacher 1.00 / 0.67 · **Designer 0.17 / 0.17 · Arts 0.11 / 0.11**. The two weak ones come from the data: very few design and arts offers (164 and 75), and many “Arts” CVs describe jobs far from art (a hypothesis, not measured). The score thresholds were not calibrated.

## 4. n8n — the workflow that orchestrates everything

`Job-matcher-candidat-final.json` is the **n8n workflow “Job matcher candidat”** (12 nodes). It was the project's **user-facing orchestrator**: the one place a user (or any tool) sends a file, and gets the report back. The AI itself runs elsewhere (Kaggle, §3); n8n is the glue.

### 4.1 What it does, step by step
```
 Webhook ─► detect file type ──┬─ PDF ───► extract the text ───────────┐
 (receives   (PDF / audio /    │                                        ├─► text long enough? ─no─► clear error
  the file)   other)           ├─ audio ─► POST /transcribe (Whisper) ──┘            │ yes
                               └─ other ─► refused with a message                    ▼
                                                                          POST /analyze  → job_id
                                                                                     │
                                                         wait 20 s ─► GET /result/{job_id} ─► done?
                                                                                     │ no: loop      │ yes
                                                                                     └───────────────┘ ▼
                                                                    return the HTML report  (or a clear error if the service is down)
```
1. A **webhook** receives the candidate's file.
2. It **detects the type**: PDF, audio, or anything else (refused with a message).
3. **PDF** → the text is extracted. **Audio** → the file is sent to `/transcribe`.
4. It checks the text is **long enough** — a scanned PDF with no text layer is refused.
5. It calls `/analyze`, then **waits and re-reads `/result` until the analysis is finished**.
6. It **returns the HTML report** to the candidate, or a clear error message if the AI service is unavailable.

### 4.2 Why it polls instead of waiting
An analysis takes minutes, but the Cloudflare tunnel in front of Kaggle **cuts any request after ~100 seconds**. So the workflow works in two steps: *start* the analysis (`/analyze` answers immediately with a `job_id`), then *ask for the result every 20 seconds*. Combined with the GPU lock, this is also what lets several users queue safely.

### 4.3 Tested
Works end to end with a **PDF CV** and with an **mp3** recording. Still to test (from the project's own to-do list): the production webhook address, a **scanned PDF**, the **AI service stopped**, and a **CV from a profession absent from the dataset**.

### 4.4 Import and run it
1. In n8n: *Workflows → Import from file* → choose `Job-matcher-candidat-final.json`.
2. In every **HTTP Request** node, set the AI address to your current tunnel URL (it changes at every Kaggle restart).
3. **If you set `API_KEY` on the AI service, add the header `x-api-key: <your key>`** to those nodes, otherwise they get `401`.
4. Test with the webhook's *test URL*, then **activate** the workflow and use its *production URL* (n8n uses two different addresses; mixing them up is the usual reason a webhook “does nothing”).
5. Check the Webhook node for the exact path and the name of the file field expected, then send a file, for example:
   ```bash
   curl -X POST -F "<field-name>=@cv.pdf" https://<your-n8n>/webhook/<path>
   ```

### 4.5 n8n and the website
The website **does the same six steps itself** in its server routes (`/api/extract` for PDFs, `/api/transcribe`, `/api/analyze`, `/api/result/{id}` with polling from the page), and adds accounts, jobs, applications, and emails. So **n8n is not needed to run the website**. Keep it as the **no-code entry point** to the same AI: for a demo without the site, or to plug the matcher into a form, an email inbox, or a chat bot.

## 5. Requirements

| Needed for | What |
|---|---|
| The website | **Node.js 22.13 or newer** (24 works). Nothing to compile: no Visual Studio needed. |
| The AI service | A **GPU with ≥ 24 GB** (or Kaggle's free *GPU T4 x2*), Python 3.10+, `ffmpeg` |
| Hosting the AI data/code | A free **Hugging Face** account (private dataset repo) |
| Free GPU | A **Kaggle** account (phone-verified, to enable GPU and Internet) |
| Google sign-in *(optional)* | A Google Cloud project (free) |
| reCAPTCHA *(optional)* | A free reCAPTCHA v2 key pair |
| Real emails *(optional)* | A Gmail address with an *app password* (or any SMTP service) |

## 6. Quick start — the order to follow

> **Demo only (2 minutes, no AI):** do **§6.3** and **§6.4** with `AI_MOCK=true`. Everything works except the real AI results, which show clearly-labelled sample data.

### 6.1 One time — export the AI artifacts
1. Open `notebook-final-dl.ipynb` on Kaggle and run it until the retriever (cell 117).
2. Paste and run `step1_export_artifacts.py` as the last cell. It creates `pathfinder_artifacts.zip` (data, vector index, library versions) in `/kaggle/working`.
3. Upload it to a **private Hugging Face dataset** named `pathfinder-artifacts`, together with `pathfinder-ai.zip` (the zipped `pathfinder-ai` folder). Kaggle deletes its files at the end of a session, so keep this copy.

### 6.2 Every time — start the AI on Kaggle
Open **`deployment notebook.ipynb`** on Kaggle.

1. Right panel → **Settings**: *Accelerator = GPU T4 x2* and *Internet = On*. **If the GPU is not on, analyses never finish.**
2. **Add-ons → Secrets**: add `HF_TOKEN` (a Hugging Face *Write* token) and `API_KEY` (any password you invent; a fixed one means you never retype it).
3. Run the cells in order (do not run any cell twice):

| Cell | What it does | Takes |
|---|---|---|
| 1 | Installs libraries, downloads code + data from Hugging Face | 3–5 min |
| 2 | Starts the AI service and a public tunnel; **prints `AI_API_URL`, `AI_API_KEY`, `AI_MOCK`** | seconds |
| 3 | Waits until the models are loaded; prints `{'ok': True}` and `API key check: OK` | 5–10 min the first time |
| 4 | Keeps the session alive and prints GPU activity; **leave it running** | — |

4. Copy the three printed lines — you need them in §6.4. The tunnel address **changes at every restart**; the key does not (if you set the `API_KEY` secret).

> Kaggle stops an idle session after ~40 min and limits free GPU hours per week. For a permanent address run the service on your own GPU server (§10.4).

### 6.3 Install the website
```bash
cd pathfinder
npm install
cp .env.example .env.local      # Windows: copy .env.example .env.local
```

### 6.4 Configure `.env.local`
Minimum to talk to the AI:
```ini
AI_API_URL=https://xxxx.trycloudflare.com     # printed by cell 2 (no trailing slash)
AI_API_KEY=your-password                      # same as the API_KEY secret
AI_MOCK=false                                 # true = demo data, no AI needed
AUTH_SECRET=<long random string>              # signs login cookies
```
Generate the secret: `openssl rand -base64 32` (or any 32+ random characters).

All variables:

| Variable | Purpose |
|---|---|
| `AI_API_URL`, `AI_API_KEY`, `AI_MOCK` | Connection to the AI service (empty URL or `AI_MOCK=true` → demo mode) |
| `AUTH_SECRET` | Secret for session cookies. **Required in production** |
| `APP_URL` | Public address of the site (e.g. `https://pathfinder.example.com`). Used in email buttons and the Google redirect. Leave empty on localhost |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Enables **Continue with Google** (§8) |
| `RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY` | Enables the reCAPTCHA on sign-in and sign-up (§8) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Real emails (§9). Empty `SMTP_HOST` = test mailbox only |

After **any** change to `.env.local`, restart the website.

### 6.5 Load the demo data
You need `jobs_clean.csv` (inside `pathfinder_artifacts.zip` → `data`; or `pathfinder-ai/data` if you copied it there).

```bash
# Fresh start (DELETES all accounts), import all dataset jobs, give Tasnim your own email:
npm run seed -- --reset --jobs "D:\path\to\jobs_clean.csv" you@gmail.com

# Keep existing accounts, just add the dataset jobs:
npm run seed -- --jobs-only "D:\path\to\jobs_clean.csv"

# Tiny demo without the dataset (2 recruiters, 8 hand-written jobs):
npm run seed -- --reset
```
Use quotes around paths with spaces. Passwords for **all** demo accounts: `Password123!`

| Role | Accounts |
|---|---|
| Recruiters | `recruiter01@demo.com` … `recruiter16@demo.com` (one company per job category) — or `recruiter1@demo.com`, `recruiter2@demo.com` with the tiny demo |
| Candidates | `tasnim@demo.com` (or the email you passed), `youssef@demo.com`, `lina@demo.com`, `omar@demo.com` |

### 6.6 Run
```bash
npm run dev
```
Open **http://localhost:3000** (use `localhost`, not `127.0.0.1`, so Google sign-in works).
On the AI matching page, the badge must say **“AI service online”** (green). *Demo mode* (violet) means the AI is not connected; *unreachable* (red) means a wrong URL or the notebook stopped.

For a production build: `npm run build` then `npm start`.

## 7. Using the app

**Candidate** (sidebar: *Browse jobs · AI matching · My applications · My profile*)
1. Sign up as a candidate (or *Continue with Google*) and complete **My profile**.
2. **AI matching** → *Upload CV* (text-based PDF, ≤ 10 MB) **or** *Speak* (record in the browser, or upload mp3/wav/m4a/ogg/flac/webm). Audio is transcribed first; **review the text**, then *Find my matches*.
3. Wait a few minutes (usually 1.5–3). The result page shows what the AI understood, a confidence note, a French summary, and the top 3 jobs with the six score components, shared and missing skills.
4. Press **Apply** on a match (optional message), or **Save as my profile** to reuse what the AI extracted.
5. Follow decisions in **My applications**. When accepted you receive an email.

**Recruiter** (sidebar: *Overview · My jobs · Candidates · Post a job*)
1. Sign up as a recruiter (company name required).
2. **Post a job**; edit, close, or delete it later. **My jobs** can be exported with **Export to Excel**.
3. **Candidates** lists everyone who applied to *your* jobs only, filterable by job and status, with profile, skills, message, and CV text.
4. **Accept** (sends the “you are preselected” email) or **Reject**. *Resend email* is available on accepted candidates. You always make the final decision: nothing is automatic.

Everyone: a top bar shows your name; **Sign out** is at the bottom of the sidebar and asks for confirmation.

## 8. Google sign-in and reCAPTCHA (optional)

Both appear only when their keys are set.

**Continue with Google**
1. [console.cloud.google.com](https://console.cloud.google.com) → create a project → *APIs & Services → OAuth consent screen* (External). While the app is in *Testing*, add your Google address under **Test users**.
2. *Credentials → Create credentials → OAuth client ID → Web application*.
   - Authorized JavaScript origin: `http://localhost:3000`
   - Authorized redirect URI: `http://localhost:3000/api/auth/google/callback`
3. Put the Client ID and Secret in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Restart.
4. In production, add your real domain to both lists and set `APP_URL`.

**reCAPTCHA** (protects password sign-in and sign-up; Google sign-in does not need it)
1. [google.com/recaptcha/admin/create](https://www.google.com/recaptcha/admin/create) → type **reCAPTCHA v2 → “I'm not a robot”**, domain `localhost` (add your real domain later).
2. Put the keys in `RECAPTCHA_SITE_KEY` and `RECAPTCHA_SECRET_KEY`. Restart.

## 9. Emails

Sent when a recruiter accepts a candidate (branded template with the PathFinder logo).

- **Without SMTP**: a free test mailbox is used. The page says **TEST MODE** and gives a *View the test email* link. Nothing reaches a real inbox.
- **With Gmail**: turn on 2-step verification, create an *app password* at `myaccount.google.com/apppasswords` (16 characters), then:
  ```ini
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=you@gmail.com
  SMTP_PASS=the16characters
  MAIL_FROM="PathFinder <you@gmail.com>"
  ```
- **Test the settings without the site:** `npm run mailtest -- someone@example.com` (shows what was read and the exact error).
- **Preview the template:** `npm run mailpreview` → opens `email-preview.html`.
- **Windows + antivirus** error `self-signed certificate in certificate chain`: run Node with the Windows certificate store: `node --use-system-ca node_modules/next/dist/bin/next dev`, or once: `setx NODE_OPTIONS "--use-system-ca"` and open a new terminal.

## 10. The AI service (`pathfinder-ai`)

### 10.1 The pipeline
See **§3 — The multi-agent AI system** for every agent, the score, and the evaluation.

### 10.2 Routes
| Route | Role |
|---|---|
| `GET /health` | `{ok, model, error}`; `ok:false` while models load |
| `POST /transcribe` | audio file → text (Whisper small, English) |
| `POST /analyze` | `{text, input_type: "cv"\|"audio"}` → `{job_id}`; the same text twice reuses the same job |
| `GET /result/{id}` | `running` → `done` (report JSON + HTML) or `error` |
| `GET /report/{id}` | standalone HTML report |

All routes except `/health` need the header `x-api-key` when `API_KEY` is set. One analysis runs at a time on the GPU; jobs are kept in memory (last 200), so a restart forgets them.

### 10.3 Environment variables
| Variable | Default | Meaning |
|---|---|---|
| `API_KEY` | empty | Password required in `x-api-key` |
| `DATA_DIR` | `./data` | `chroma_db/`, `jobs_clean.csv`, `chunks_section.jsonl` |
| `LOAD_4BIT` | auto | `1` force 4-bit, `0` force fp16 (auto: fp16 if GPU memory ≥ 20 GB) |
| `LLM_STRONG` | `same` | `14b` also loads Qwen2.5-14B for Query Builder/Grader/Scoring/summary |
| `REPORT_LANG` | `fr` | Language of the summary and explanations: `fr` or `en` |

### 10.4 Running on your own GPU server (permanent URL)
```bash
cd pathfinder-ai
pip install -r requirements.txt          # plus ffmpeg on the system
API_KEY=your-password uvicorn app.main:app --host 0.0.0.0 --port 8000
```
Or Docker (`nvidia-container-toolkit` installed):
```bash
docker build -t pathfinder-ai .
docker run --gpus all -p 8000:8000 -e API_KEY=your-password \
  -v $PWD/data:/srv/data -v pf_cache:/srv/cache -v pf_hf:/srv/hf pathfinder-ai
```
Put your artifacts in `pathfinder-ai/data/` first (`chroma_db`, `jobs_clean.csv`, `chunks_section.jsonl`). The first start downloads ~20 GB of models. Put an HTTPS reverse proxy in front, then set `AI_API_URL` to its address.

## 11. Project structure (website)

```
pathfinder/
├─ app/
│  ├─ page.tsx                      landing page
│  ├─ login, signup, auth/…         authentication
│  ├─ (candidate)/                  jobs, onboarding (AI matching), matches/[id], applications, profile
│  ├─ jobs/[id]/                    job details + apply
│  ├─ recruiter/                    overview, jobs, candidates, jobs/new, jobs/[id], jobs/[id]/edit
│  └─ api/                          auth, jobs, applications, profile, extract, transcribe, analyze, result, recruiter/jobs/export
├─ components/                      AppShell (sidebars + top bar), JobCard, ScoreRing, Recorder, SignOut, Pager…
├─ lib/                             db (built-in SQLite), session/auth, validation (zod), ai client + report schema, mail + email template
├─ scripts/                         seed.mjs, mailtest.mjs, mailpreview.mjs
├─ middleware.ts                    login required everywhere except landing, /login, /signup
└─ data/app.db                      created at first run (git-ignored)
```
Stack: Next.js 14 (App Router) · TypeScript · Tailwind CSS · Zod · jose (sessions) · bcryptjs · nodemailer · ExcelJS · Node's built-in SQLite. AI side: FastAPI · PyTorch / Transformers · Qwen2.5 · Whisper · sentence-transformers · ChromaDB.

## 12. Security notes
- Passwords are hashed (bcrypt); sessions are signed, `httpOnly` cookies valid 7 days.
- Every page except the landing page, login, and signup requires an account; roles are enforced in the middleware **and** in every API route. A recruiter only ever sees their own jobs and their candidates.
- The AI address and key are used only on the server.
- Inputs are validated (Zod); PDF uploads are checked (≤ 10 MB, `%PDF` signature), audio ≤ 25 MB.
- CV and audio are sent to the AI service, which keeps results in memory and saves audio and reports on its own disk. Ask for consent where you collect audio (the recorder has a consent checkbox).
- Do not commit `.env.local` or `data/`. Change `AUTH_SECRET` and use HTTPS in production.

## 13. Troubleshooting

| Problem | Cause → fix |
|---|---|
| `npm install` asks for Visual Studio / node-gyp | Old version of the project. Use the current `package.json` (no native modules) and Node ≥ 22.13 |
| `EPERM … rmdir` during `npm install` | Files locked on Windows. Stop `npm run dev`, close the editor, delete `node_modules`, retry |
| `Missing script: "seed"` / `"mailtest"` | You still have the old `package.json`. Copy the new one |
| Next.js “two parallel pages resolve to the same path” | After an update, delete the `app` and `.next` folders before copying the new `app` |
| Badge says **Demo mode** | `.env.local` missing/empty `AI_API_URL`, or the site was not restarted |
| `401 Invalid API key` | Key differs between Kaggle and `.env.local`. Set the same `API_KEY` secret, restart the Kaggle session, run cells 1–4 once |
| Analysis stays **running** for 10+ min | GPU not activated in Kaggle (Settings → Accelerator), or the server was stopped. Check cell 4's output |
| AI works but the tunnel URL is dead | It changes at every restart: paste the new `AI_API_URL`, restart the site |
| `422` when uploading a PDF | Scanned PDF (images) or protected file. Use a text-based PDF or record yourself |
| No email received | Run `npm run mailtest -- you@…`, check spam, use *Resend email*; see the certificate note in §9 |
| Google: `redirect_uri_mismatch` | The redirect URI in Google Cloud must be exactly `http://localhost:3000/api/auth/google/callback`; open the site on `localhost` |
| Google: “access blocked / app not verified” | Add your address under *Test users* in the OAuth consent screen |
| reCAPTCHA does not appear | Keys missing, or the domain (`localhost`) not added to the key |
| Kaggle session stops after ~40 min | Leave cell 4 running; free sessions also have weekly GPU limits |

## 14. Known limits (honest list)
- The AI is only available while its Kaggle session (or your GPU server) is running; the tunnel address changes at each restart.
- Inputs are **English**; reports are written in French by default (`REPORT_LANG=en` for English).
- Job offers come from a research dataset (*Fake Job Postings*, 2,954 offers in 9 categories) and are attributed to **demo recruiters**; they are not real vacancies.
- *Design* and *Arts* profiles match poorly (few offers in the dataset). Measured category match: CV 77 %, spoken text 68 %, Whisper transcript 70 %; Whisper word error rate 1.9 %.
- Scores and label thresholds are indicative, not learned. A score never replaces a human decision.
- Scanned PDFs are not read (no OCR). Password reset and email verification are not implemented.

## 15. Credits
Project built by the PathFinder team. AI models: Qwen2.5 (Alibaba), Whisper (OpenAI), BGE (BAAI). Dataset: *Fake Job Postings* and *Resume.csv* (Kaggle).
