import fs from "fs";
import path from "path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('candidate','recruiter')), name TEXT NOT NULL, company TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  headline TEXT, summary TEXT, skills TEXT NOT NULL DEFAULT '[]', years INTEGER, education TEXT, cv_text TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY, recruiter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, location TEXT, employment_type TEXT, required_experience TEXT, required_education TEXT,
  description TEXT NOT NULL, requirements TEXT, category TEXT, status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  note TEXT, snapshot TEXT NOT NULL, notified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), decided_at TEXT,
  UNIQUE (job_id, candidate_id));
CREATE INDEX IF NOT EXISTS idx_jobs_recruiter ON jobs(recruiter_id);
CREATE INDEX IF NOT EXISTS idx_apps_job ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_apps_candidate ON applications(candidate_id);`;

// Node's built-in SQLite (Node >= 22.13): nothing to compile, works on Windows without Visual Studio.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Stmt = { get(...p: any[]): any; all(...p: any[]): any[]; run(...p: any[]): unknown };
type DB = { prepare(sql: string): Stmt; exec(sql: string): void };
const g = globalThis as unknown as { _pfdb?: DB };
function open(): DB {
  const { DatabaseSync } = (process as any).getBuiltinModule("node:sqlite");   // getBuiltinModule avoids bundler issues
  const dir = path.join(process.cwd(), "data"); fs.mkdirSync(dir, { recursive: true });
  const d: DB = new DatabaseSync(path.join(dir, "app.db"));
  d.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;"); d.exec(SCHEMA);
  if (!d.prepare("PRAGMA table_info(jobs)").all().some((c: { name: string }) => c.name === "category")) d.exec("ALTER TABLE jobs ADD COLUMN category TEXT");   // older databases
  d.exec("CREATE INDEX IF NOT EXISTS idx_jobs_cat ON jobs(category); CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);");
  return d;
}
export const db = () => (g._pfdb ??= open());
export const uid = () => crypto.randomUUID();

export type Role = "candidate" | "recruiter";
export type JobRow = { id: string; recruiter_id: string; title: string; location: string | null; employment_type: string | null; required_experience: string | null; required_education: string | null; description: string; requirements: string | null; category?: string | null; status: "open" | "closed"; created_at: string; updated_at: string; company?: string | null };
export type AppRow = { id: string; job_id: string; candidate_id: string; status: "pending" | "accepted" | "rejected"; note: string | null; snapshot: string; notified_at: string | null; created_at: string; decided_at: string | null };
export type Snapshot = { name: string; email: string; headline: string | null; summary: string | null; skills: string[]; years: number | null; education: string | null; cv_text: string | null };
