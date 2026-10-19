import Link from "next/link";
import { Chip, StatusChip, fmtDate } from "./Bits";
import { DecisionButtons } from "./Actions";
import type { AppRow, Snapshot } from "@/lib/db";
export function ApplicantCard({ a, jobTitle, jobId }: { a: AppRow; jobTitle?: string; jobId?: string }) {
  const c: Snapshot = JSON.parse(a.snapshot);
  return (<article className="card p-5">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-lg font-bold">{c.name}</h2>
      <p className="text-sm text-muted">{c.headline || "No headline"} · <a className="text-primary" href={`mailto:${c.email}`}>{c.email}</a></p>
      {jobTitle && <p className="mt-1 text-sm">Applied to <Link className="font-semibold text-primary" href={`/recruiter/jobs/${jobId}`}>{jobTitle}</Link></p>}</div><StatusChip s={a.status} /></div>
    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-muted">Experience</dt><dd className="font-semibold">{c.years != null ? `${c.years} years` : "Not specified"}</dd></div><div><dt className="text-muted">Education</dt><dd className="font-semibold">{c.education || "Not specified"}</dd></div></dl>
    {c.skills.length > 0 && <ul className="mt-3 flex flex-wrap gap-1.5">{c.skills.map((k) => <li key={k}><Chip>{k}</Chip></li>)}</ul>}
    {c.summary && <p className="mt-3 text-sm">{c.summary}</p>}
    {a.note && <p className="mt-3 rounded-lg bg-bg p-3 text-sm"><b>Message: </b>{a.note}</p>}
    {c.cv_text && <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold text-primary">CV text</summary><p className="mt-2 max-h-72 overflow-auto whitespace-pre-line text-muted">{c.cv_text}</p></details>}
    <div className="mt-4 flex flex-wrap items-end justify-between gap-3"><span className="text-xs text-muted">Applied {fmtDate(a.created_at)}</span><DecisionButtons id={a.id} status={a.status} notified={!!a.notified_at} /></div>
  </article>);
}
