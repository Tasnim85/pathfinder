// Demo data for PathFinder.
//   npm run seed -- --reset                                   small demo (2 recruiters, 8 hand-written jobs)
//   npm run seed -- --reset --jobs "C:\path\jobs_clean.csv"    FULL: the ~2,950 dataset jobs split between many recruiters
//   npm run seed -- --jobs-only "C:\path\jobs_clean.csv"       add the dataset jobs to an existing database (keeps your accounts)
// Add your own email at the end to give it to the first candidate (Tasnim): ... you@gmail.com
import fs from "node:fs"; import path from "node:path"; import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite"; import bcrypt from "bcryptjs";

const args = process.argv.slice(2), has = (f) => args.includes(f), val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const reset = has("--reset"), jobsOnly = has("--jobs-only"), csvPath = val("--jobs") ?? val("--jobs-only"), myEmail = args.find((a) => a.includes("@"));
const dir = path.join(process.cwd(), "data"); fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, "app.db"); if (reset) for (const f of [file, file + "-wal", file + "-shm"]) fs.rmSync(f, { force: true });
const db = new DatabaseSync(file); db.exec("PRAGMA foreign_keys = ON;");
db.exec(fs.readFileSync("lib/db.ts", "utf8").match(/const SCHEMA = `([\s\S]*?)`;/)[1]);
if (!db.prepare("PRAGMA table_info(jobs)").all().some((c) => c.name === "category")) db.exec("ALTER TABLE jobs ADD COLUMN category TEXT");
db.exec("CREATE INDEX IF NOT EXISTS idx_jobs_cat ON jobs(category); CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);");
if ((jobsOnly || has("--jobs-only")) && !csvPath) { console.log("Give the CSV path: --jobs-only \"C:\\path\\jobs_clean.csv\""); process.exit(1); }
if (!jobsOnly && db.prepare("SELECT COUNT(*) n FROM users").get().n > 0) { console.log("Database already has data. Use --reset (this deletes all accounts) or --jobs-only <csv>."); process.exit(0); }

const PASSWORD = "Password123!", hash = bcrypt.hashSync(PASSWORD, 10);
const user = (name, email, role, company = null) => {
  const ex = db.prepare("SELECT id FROM users WHERE email = ?").get(email); if (ex) return ex.id;
  const id = randomUUID(); db.prepare("INSERT INTO users (id,email,password_hash,role,name,company) VALUES (?,?,?,?,?,?)").run(id, email, hash, role, name, company); return id;
};
const insJob = db.prepare("INSERT OR IGNORE INTO jobs (id,recruiter_id,title,location,employment_type,required_experience,required_education,description,requirements,category,status) VALUES (?,?,?,?,?,?,?,?,?,?,'open')");

// ---------- CSV (RFC 4180: quotes, commas and line breaks inside fields) ----------
function parseCsv(t) {
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < t.length; i++) { const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; } else if (c !== "\r") f += c; }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  return rows;
}
// ---------- one recruiter company per job category (split further when a category is large) ----------
const COMPANIES = {
  "Information Technology": ["Northwind Technologies", "Cobalt Systems", "Helix Software", "Quantum Leap Labs"],
  "Sales": ["Summit Sales Group", "Redwood Commerce", "BrightPath Retail"],
  "Engineering": ["Ironbridge Engineering", "Atlas Industrial", "Vertex Mechanical"],
  "Design": ["Studio Lumen"], "Art/Creative": ["Canvas & Co"], "Business Development": ["Meridian Partners"],
  "Finance": ["Ledgerline Financial"], "Human Resources": ["PeopleFirst Consulting"], "Education": ["BrightMinds Academy"],
};
const PEOPLE = ["Rita Ben Salah", "Karim Nasri", "Amel Gharbi", "Hedi Jlassi", "Nour Chaabane", "Walid Mejri", "Salma Rekik", "Fares Dridi", "Ines Bouzid", "Anis Kammoun", "Mariem Zouari", "Sami Ayari", "Yasmine Hamdi", "Rached Oueslati", "Dorra Khedher", "Bilel Sassi"];
const PER_RECRUITER = 250;

function importDataset(csv) {
  const rows = parseCsv(fs.readFileSync(csv, "utf8")).filter((r) => r.length > 1);
  const head = rows.shift().map((h) => h.trim()), col = Object.fromEntries(head.map((h, i) => [h, i]));
  const need = ["doc_id", "title", "description"]; const miss = need.filter((n) => !(n in col));
  if (miss.length) { console.log(`Missing column(s) ${miss.join(", ")}. Columns found: ${head.join(", ")}`); process.exit(1); }
  const g = (r, n) => ((n in col ? r[col[n]] : "") || "").trim();
  const jobs = rows.map((r) => ({ id: g(r, "doc_id"), title: g(r, "title"), location: g(r, "location"), type: g(r, "employment_type"), exp: g(r, "required_experience"), edu: g(r, "required_education"), desc: g(r, "description"), req: g(r, "requirements"), cat: g(r, "function") })).filter((j) => j.id && j.title && j.desc);
  const byCat = new Map(); for (const j of jobs) { const c = j.cat || "General"; if (!byCat.has(c)) byCat.set(c, []); byCat.get(c).push(j); }
  const out = []; let n = 0, person = 0; const first = {};
  db.exec("BEGIN");
  for (const [cat, list] of [...byCat].sort((a, b) => b[1].length - a[1].length)) {
    const k = Math.max(1, Math.ceil(list.length / PER_RECRUITER)), names = COMPANIES[cat] || ["Horizon Staffing"];
    for (let i = 0; i < k; i++) {
      const company = i < names.length ? names[i] : `${names[i % names.length]} ${["II", "III", "IV", "V"][Math.floor(i / names.length) - 1] || i}`;
      const email = `recruiter${String(++person).padStart(2, "0")}@demo.com`;
      const rid = user(PEOPLE[(person - 1) % PEOPLE.length], email, "recruiter", company);
      const slice = list.filter((_, idx) => idx % k === i);                                   // even split
      for (const j of slice) { insJob.run(j.id, rid, j.title, j.location || null, j.type || null, j.exp || null, j.edu || null, j.desc, j.req || null, cat === "General" ? null : cat); n++; if (!first[cat]) first[cat] = j.id; }
      out.push([email, company, cat, slice.length]);
    }
  }
  db.exec("COMMIT");
  return { n, out, first, skipped: rows.length - jobs.length };
}

let report = "", firstByCat = {}, handJobs = [];
if (csvPath) {
  const r = importDataset(csvPath); firstByCat = r.first;
  report = `Imported ${r.n} jobs (skipped ${r.skipped} incomplete rows) between ${r.out.length} recruiters:\n` + r.out.map(([e, c, cat, k]) => `  ${e.padEnd(24)} ${c.padEnd(26)} ${String(k).padStart(4)} jobs  (${cat})`).join("\n");
  if (jobsOnly) { console.log(report + `\nPassword for these recruiters: ${PASSWORD}`); process.exit(0); }
} else {
  const r1 = user("Rita Ben Salah", "recruiter1@demo.com", "recruiter", "Acme Tech"), r2 = user("Karim Nasri", "recruiter2@demo.com", "recruiter", "Nova Studio");
  const J = [
    [r1, "Senior Python Backend Developer", "Tunis, Tunisia", "Full-time", "Mid-Senior level", "Bachelor's Degree", "Build and scale backend services for our data products. You will design REST APIs, work with PostgreSQL and deploy on AWS with Docker.", "Python, Django or FastAPI, PostgreSQL, Docker, AWS, REST APIs, Git. 4+ years of experience.", "Information Technology"],
    [r1, "Full Stack Engineer (React / Node.js)", "Remote", "Full-time", "Mid-Senior level", "Bachelor's Degree", "Own features end to end in a small agile team, from the React interface to the Node.js API.", "JavaScript, TypeScript, React, Node.js, SQL, Git. Experience with CI/CD is a plus.", "Information Technology"],
    [r1, "DevOps Engineer", "Sfax, Tunisia", "Contract", "Mid-Senior level", "Bachelor's Degree", "Automate deployments and keep our cloud infrastructure reliable and secure.", "Linux, Docker, Kubernetes, Terraform, CI/CD, monitoring, AWS or Azure.", "Information Technology"],
    [r1, "Data Analyst Intern", "Tunis, Tunisia", "Internship", "Entry level", "Bachelor's Degree", "Support the analytics team with dashboards and ad-hoc analyses over six months.", "SQL, Excel, Python or R, curiosity, good communication.", "Information Technology"],
    [r2, "UI / UX Designer", "Paris, France", "Full-time", "Mid-Senior level", "Bachelor's Degree", "Design clear, accessible interfaces for web and mobile products, from research to high-fidelity prototypes.", "Figma, design systems, user research, prototyping, Adobe Creative Suite, HTML/CSS basics.", "Design"],
    [r2, "Digital Marketing Specialist", "Remote", "Full-time", "Associate", "Bachelor's Degree", "Plan and run social media and email campaigns, write content and report results.", "Social media, content writing, Google Analytics, SEO, Excel.", "Sales"],
    [r2, "Sales Representative (B2B)", "Lyon, France", "Full-time", "Entry level", "High School or equivalent", "Prospect and close new business accounts in the SaaS market.", "Prospecting, CRM, negotiation, French and English, motivation.", "Sales"],
    [r2, "Financial Accountant", "Tunis, Tunisia", "Part-time", "Mid-Senior level", "Bachelor's Degree", "Keep the ledgers, prepare monthly closings and support the annual audit.", "Accounting, SAP or equivalent ERP, Excel, reconciliation, tax basics.", "Finance"],
  ];
  handJobs = J.map(([rid, ...j]) => { const id = randomUUID(); insJob.run(id, rid, ...j); return { id, cat: j[8] }; });
  firstByCat = Object.fromEntries(handJobs.map((j) => [j.cat, j.id])); report = "Recruiters: recruiter1@demo.com (Acme Tech), recruiter2@demo.com (Nova Studio). 8 hand-written jobs.";
}

const cands = [
  ["Tasnim Ben Hassine", myEmail || "tasnim@demo.com", { headline: "Software engineer", skills: ["Python", "Django", "PostgreSQL", "Docker", "AWS", "REST APIs", "Git"], years: 6, education: "MSc Computer Science", summary: "Backend-oriented engineer who likes data-heavy products.", cv_text: "Software engineer with 6 years of experience building web applications with Python and Django." }],
  ["Youssef Trabelsi", "youssef@demo.com", { headline: "Full stack developer", skills: ["JavaScript", "TypeScript", "React", "Node.js", "SQL"], years: 3, education: "BSc Computer Science", summary: "Front-end leaning full stack developer.", cv_text: "" }],
  ["Lina Gharbi", "lina@demo.com", { headline: "Product designer", skills: ["Figma", "User research", "Prototyping", "Design systems"], years: 5, education: "BA Graphic Design", summary: "Designer focused on accessible interfaces.", cv_text: "" }],
  ["Omar Khelifi", "omar@demo.com", { headline: "Accountant", skills: ["Accounting", "SAP", "Excel", "Reconciliation"], years: 8, education: "Master in Finance", summary: "", cv_text: "" }],
];
const cid = cands.map(([name, email, p]) => { const id = user(name, email, "candidate"); db.prepare("INSERT OR REPLACE INTO profiles (user_id,headline,summary,skills,years,education,cv_text) VALUES (?,?,?,?,?,?,?)").run(id, p.headline, p.summary, JSON.stringify(p.skills), p.years, p.education, p.cv_text); return id; });
// a few applications, spread over the jobs that exist: [category, 2nd job of that category?, candidate, status, note]
const pick = (cat, nth = 0) => db.prepare("SELECT id FROM jobs WHERE category = ? ORDER BY rowid LIMIT 1 OFFSET ?").get(cat, nth)?.id;
const apps = [["Information Technology", 0, 0, "pending", "I would love to work on data products."], ["Information Technology", 1, 0, "pending", null], ["Information Technology", 0, 1, "pending", null], ["Information Technology", 1, 1, "accepted", "Happy to discuss."], ["Design", 0, 2, "pending", "Portfolio available on request."], ["Finance", 0, 3, "rejected", null], ["Finance", 0, 0, "pending", null]];
let made = 0;
for (const [cat, nth, c, status, note] of apps) {
  const jid = pick(cat, nth); if (!jid) continue; const [name, email, p] = cands[c];
  db.prepare("INSERT OR IGNORE INTO applications (id,job_id,candidate_id,status,note,snapshot,decided_at) VALUES (?,?,?,?,?,?,?)")
    .run(randomUUID(), jid, cid[c], status, note, JSON.stringify({ name, email, headline: p.headline, summary: p.summary || null, skills: p.skills, years: p.years, education: p.education, cv_text: p.cv_text || null }), status === "pending" ? null : new Date().toISOString().slice(0, 19).replace("T", " ")); made++;
}
console.log(`${report}\n\nCandidates (${cands.length}): ${cands.map((c) => c[1]).join(", ")}   |   ${made} sample applications\nPassword for ALL accounts: ${PASSWORD}`);
