"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
export type JobInit = { id?: string; title?: string; location?: string | null; employment_type?: string | null; required_experience?: string | null; required_education?: string | null; description?: string; requirements?: string | null; status?: string };
const TYPES = ["Full-time", "Part-time", "Contract", "Internship", "Temporary"];
export function JobForm({ job }: { job?: JobInit }) {
  const router = useRouter(), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(""); setBusy(true);
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const body = { ...f, employment_type: f.employment_type || undefined };
    const r = await fetch(job?.id ? `/api/jobs/${job.id}` : "/api/jobs", { method: job?.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok) return setErr(d.error || "Could not save the job.");
    router.push("/recruiter/jobs"); router.refresh();
  }
  const inp = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm";
  const F = ({ id, label, children }: { id: string; label: string; children: React.ReactNode }) => <div><label htmlFor={id} className="mb-1 block text-sm font-semibold">{label}</label>{children}</div>;
  return (<form onSubmit={submit} className="card space-y-4 p-6" noValidate>
    <F id="title" label="Job title"><input id="title" name="title" defaultValue={job?.title} className={inp} required /></F>
    <div className="grid gap-4 sm:grid-cols-2">
      <F id="location" label="Location"><input id="location" name="location" defaultValue={job?.location ?? ""} placeholder="City, country or Remote" className={inp} /></F>
      <F id="employment_type" label="Contract type"><select id="employment_type" name="employment_type" defaultValue={job?.employment_type ?? ""} className={inp}><option value="">Not specified</option>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></F>
      <F id="required_experience" label="Experience level"><input id="required_experience" name="required_experience" defaultValue={job?.required_experience ?? ""} placeholder="e.g. Mid-Senior level, 3+ years" className={inp} /></F>
      <F id="required_education" label="Education"><input id="required_education" name="required_education" defaultValue={job?.required_education ?? ""} placeholder="e.g. Bachelor's Degree" className={inp} /></F></div>
    <F id="description" label="Description"><textarea id="description" name="description" rows={6} defaultValue={job?.description} className={inp} required /></F>
    <F id="requirements" label="Requirements (skills, tools, qualifications)"><textarea id="requirements" name="requirements" rows={5} defaultValue={job?.requirements ?? ""} className={inp} /></F>
    <F id="status" label="Status"><select id="status" name="status" defaultValue={job?.status ?? "open"} className={inp}><option value="open">Open (visible to candidates)</option><option value="closed">Closed (hidden)</option></select></F>
    {err && <p role="alert" className="rounded-lg bg-bad/10 p-3 text-sm text-bad">{err}</p>}
    <button className="btn btn-primary" disabled={busy}>{busy && <Loader2 className="animate-spin" size={16} />}{job?.id ? "Save changes" : "Publish job"}</button>
  </form>);
}
