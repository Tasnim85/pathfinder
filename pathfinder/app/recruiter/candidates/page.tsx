import Link from "next/link";
import { Empty } from "@/components/Bits";
import { ApplicantCard } from "@/components/ApplicantCard";
import { db, type AppRow } from "@/lib/db";
import { getSession } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function Candidates({ searchParams }: { searchParams: { job?: string; status?: string } }) {
  const s = (await getSession())!;
  const status = ["pending", "accepted", "rejected"].includes(searchParams.status || "") ? searchParams.status! : "";
  const myJobs = db().prepare("SELECT id,title FROM jobs WHERE recruiter_id=? ORDER BY created_at DESC").all(s.uid) as { id: string; title: string }[];
  const job = myJobs.some((j) => j.id === searchParams.job) ? searchParams.job! : "";               // an id that is not yours is ignored
  const rows = db().prepare(`SELECT a.*, j.title job_title, j.id jid FROM applications a JOIN jobs j ON j.id=a.job_id
    WHERE j.recruiter_id=? AND (?='' OR a.job_id=?) AND (?='' OR a.status=?) ORDER BY CASE a.status WHEN 'pending' THEN 0 WHEN 'accepted' THEN 1 ELSE 2 END, a.created_at DESC`).all(s.uid, job, job, status, status) as (AppRow & { job_title: string; jid: string })[];
  const sel = "rounded-xl border border-line bg-white px-3 py-2.5 text-sm";
  return (<main className="mx-auto max-w-3xl px-5 py-8"><h1 className="text-3xl font-extrabold">Candidates</h1><p className="text-muted">Everyone who applied to your jobs, and only them.</p>
    <form className="mt-5 flex flex-wrap gap-2"><select name="job" defaultValue={job} aria-label="Job" className={sel}><option value="">All my jobs</option>{myJobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}</select>
      <select name="status" defaultValue={status} aria-label="Status" className={sel}><option value="">All statuses</option><option value="pending">Pending</option><option value="accepted">Preselected</option><option value="rejected">Not selected</option></select>
      <button className="btn btn-primary !py-2.5">Filter</button>{(job || status) && <Link href="/recruiter/candidates" className="btn btn-ghost !py-2.5">Reset</Link>}</form>
    <div className="mt-6 space-y-4">{rows.length === 0 ? <Empty title="No candidates found">Try another filter.</Empty> : rows.map((a) => <ApplicantCard key={a.id} a={a} jobTitle={a.job_title} jobId={a.jid} />)}</div>
  </main>);
}
