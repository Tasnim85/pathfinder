"use client";
import { useState } from "react";
import { Check, ChevronDown, CircleAlert, MapPin, Briefcase, GraduationCap } from "lucide-react";
import Link from "next/link";
import { ScoreRing } from "./ScoreRing";
import { ApplyButton } from "./Actions";
import { COMPONENT_LABELS, scoreLabel, type Job } from "@/lib/schemas";

function vsText(v: unknown): string | null {
  if (Array.isArray(v) && typeof v[0] === "string" && COMPONENT_LABELS[v[0]]) return COMPONENT_LABELS[v[0]];
  return null;
}
export function JobCard({ job, weights, open: o = false }: { job: Job; weights?: Record<string, number>; open?: boolean }) {
  const [open, setOpen] = useState(o), [form, setForm] = useState(false);
  const ahead = vsText(job.vs_next);
  return (<article className="card p-5 shadow-soft">
    <div className="flex items-start gap-4">
      <ScoreRing score={job.score} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">#{job.rank ?? "–"} · {scoreLabel(job.score)}</span>
          {job.capped && <span className="rounded-full bg-warn/10 px-2.5 py-0.5 text-xs font-semibold text-warn" title="The skills score was capped because no shared skill could be verified.">Skills score capped</span>}</div>
        <h3 className="mt-1.5 text-lg font-bold leading-snug">{job.title}</h3>
        {job.site?.company && <p className="text-sm text-muted">{job.site.company}</p>}
        <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          {job.location && <li className="flex items-center gap-1"><MapPin size={14} />{job.location}</li>}
          {job.employment_type && <li className="flex items-center gap-1"><Briefcase size={14} />{job.employment_type}</li>}
          {job.required_education && <li className="flex items-center gap-1"><GraduationCap size={14} />{job.required_education}</li>}
        </ul>
      </div>
    </div>
    {job.reasoning && <p className="mt-4 text-sm leading-relaxed">{job.reasoning}</p>}
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <div><h4 className="mb-1.5 text-sm font-semibold text-ok">Skills you already show</h4>
        {job.matched.length ? <ul className="flex flex-wrap gap-1.5">{job.matched.map((s) => <li key={s} className="flex items-center gap-1 rounded-full bg-ok/10 px-2.5 py-1 text-xs font-medium text-ok"><Check size={12} />{s}</li>)}</ul> : <p className="text-sm text-muted">No shared skill could be verified.</p>}</div>
      <div><h4 className="mb-1.5 text-sm font-semibold text-warn">Requirements not found in your profile</h4>
        {job.missing.length ? <ul className="flex flex-wrap gap-1.5">{job.missing.map((s) => <li key={s} className="flex items-center gap-1 rounded-full bg-warn/10 px-2.5 py-1 text-xs font-medium text-warn"><CircleAlert size={12} />{s}</li>)}</ul> : <p className="text-sm text-muted">None detected.</p>}</div>
    </div>
    <div className="mt-4 border-t border-line pt-4">
      {!job.site ? <p className="text-sm text-muted"><span className="mr-2 rounded-full bg-line px-2.5 py-1 text-xs font-semibold">Reference offer</span>From the research dataset: not an open position on PathFinder, so it cannot be applied to.</p>
        : !job.site.open ? <p className="text-sm text-muted">This position is no longer open.</p>
        : <div className="space-y-3"><div className="flex flex-wrap items-center gap-2">
            <Link href={`/jobs/${encodeURIComponent(job.site.id)}`} className="btn btn-ghost !px-3 !py-1.5 text-sm">View the full offer</Link>
            {!job.site.applied && !form && <button className="btn btn-primary !px-4 !py-1.5 text-sm" onClick={() => setForm(true)}>Apply</button>}</div>
            {(job.site.applied || form) && <ApplyButton jobId={job.site.id} loggedRole="candidate" applied={job.site.applied} />}</div>}
    </div>
    <button onClick={() => setOpen(!open)} aria-expanded={open} className="mt-3 flex items-center gap-1 text-sm font-semibold text-primary"><ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />How this score is built</button>
    {open && <div className="mt-3 space-y-2.5 border-t border-line pt-3">
      {Object.entries(COMPONENT_LABELS).map(([k, label]) => { const v = job.components[k]; return (
        <div key={k} className="grid grid-cols-[9.5rem_1fr_3.2rem] items-center gap-3 text-sm"><span>{label}{weights?.[k] != null && <span className="text-muted"> ({Math.round(weights[k] * 100)}%)</span>}</span>
          {v == null ? <span className="text-muted">Not assessed for this job</span> : <div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full" style={{ width: `${v * 100}%`, background: "var(--grad)" }} /></div>}
          <span className="text-right tabular-nums text-muted">{v == null ? "–" : `${Math.round(v * 100)}%`}</span></div>); })}
      {ahead && <p className="text-sm text-muted">Ranked above the next job mainly on: {ahead}.</p>}
      {job.excerpt && <p className="rounded-lg bg-bg p-3 text-sm text-muted"><b className="text-ink">Job requirements (excerpt): </b>{job.excerpt}</p>}
      {job.n_dropped ? <p className="text-xs text-muted">{job.n_dropped} of {job.n_claimed} statements by the language model were discarded because they could not be verified against your profile or the job text.</p> : null}
      <p className="text-xs text-muted">The score is indicative: weights and thresholds were chosen by reasoning, not calibrated. It never replaces a human decision.</p>
    </div>}
  </article>);
}
