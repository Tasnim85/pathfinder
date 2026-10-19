import Link from "next/link";
import { Plus, Pencil, Users, Download } from "lucide-react";
import { Chip, Empty, fmtDate } from "@/components/Bits";
import { DeleteJob } from "@/components/Actions";
import { Pager } from "@/components/Pager";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
export const dynamic = "force-dynamic";
type R = { id: string; title: string; status: string; created_at: string; total: number; pending: number; accepted: number };
export default async function MyJobs({ searchParams }: { searchParams: { page?: string } }) {
  const s = (await getSession())!;
  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1), SIZE = 20;
  const total = (db().prepare("SELECT COUNT(*) n FROM jobs WHERE recruiter_id=?").get(s.uid) as { n: number }).n;
  const jobs = db().prepare(`SELECT j.id,j.title,j.status,j.created_at, COUNT(a.id) total, COALESCE(SUM(a.status='pending'),0) pending, COALESCE(SUM(a.status='accepted'),0) accepted
    FROM jobs j LEFT JOIN applications a ON a.job_id=j.id WHERE j.recruiter_id=? GROUP BY j.id ORDER BY j.created_at DESC, j.rowid LIMIT ${SIZE} OFFSET ${(page - 1) * SIZE}`).all(s.uid) as R[];
  return (<main className="mx-auto max-w-4xl px-5 py-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-extrabold">My jobs</h1><p className="text-muted">Only your own offers are shown here ({total} in total).</p></div>
      <div className="flex flex-wrap gap-2">{total > 0 && <a href="/api/recruiter/jobs/export" className="btn btn-ghost"><Download size={16} />Export to Excel</a>}<Link href="/recruiter/jobs/new" className="btn btn-primary"><Plus size={16} />Post a job</Link></div></div>
    <div className="mt-6 space-y-4">{jobs.length === 0 ? <Empty title="No jobs yet">Post your first job to start receiving candidates.</Empty> : jobs.map((j) => (
      <div key={j.id} className="card p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div><Link href={`/recruiter/jobs/${j.id}`} className="text-lg font-bold hover:text-primary">{j.title}</Link><p className="text-xs text-muted">Posted {fmtDate(j.created_at)}</p></div><Chip tone={j.status === "open" ? "ok" : "muted"}>{j.status === "open" ? "Open" : "Closed"}</Chip></div>
        <div className="mt-3 flex flex-wrap items-center gap-2"><Link href={`/recruiter/jobs/${j.id}`} className="btn btn-ghost !px-3 !py-1.5 text-sm"><Users size={14} />{j.total} candidate{j.total === 1 ? "" : "s"}{j.pending ? ` · ${j.pending} pending` : ""}</Link>
          <Link href={`/recruiter/jobs/${j.id}/edit`} className="btn btn-ghost !px-3 !py-1.5 text-sm"><Pencil size={14} />Edit</Link><DeleteJob id={j.id} title={j.title} /></div></div>))}</div>
  <Pager page={page} total={total} size={SIZE} basePath="/recruiter/jobs" params={{}} />
  </main>);
}
