import Link from "next/link";
import { Empty, StatusChip, fmtDate } from "@/components/Bits";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function Applications() {
  const s = (await getSession())!;
  const rows = db().prepare(`SELECT a.id,a.status,a.created_at,a.decided_at,j.id AS job_id,j.title,u.company FROM applications a JOIN jobs j ON j.id=a.job_id JOIN users u ON u.id=j.recruiter_id WHERE a.candidate_id=? ORDER BY a.created_at DESC`).all(s.uid) as { id: string; status: string; created_at: string; decided_at: string | null; job_id: string; title: string; company: string }[];
  return (<main className="mx-auto max-w-3xl px-5 py-10"><h1 className="text-3xl font-extrabold">My applications</h1>
    <div className="mt-6 space-y-4">{rows.length === 0 ? <Empty title="No applications yet"><Link href="/jobs" className="font-semibold text-primary">Browse jobs</Link> or <Link href="/onboarding" className="font-semibold text-primary">let the AI find matches</Link>.</Empty> : rows.map((r) => (
      <div key={r.id} className="card p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div><Link href={`/jobs/${r.job_id}`} className="text-lg font-bold hover:text-primary">{r.title}</Link><p className="text-sm text-muted">{r.company}</p></div><StatusChip s={r.status} /></div>
        <ol className="mt-4 flex gap-6 text-sm text-muted"><li>Applied {fmtDate(r.created_at)}</li>{r.decided_at && <li>Decision {fmtDate(r.decided_at)}</li>}</ol>
        {r.status === "accepted" && <p className="mt-3 rounded-lg bg-ok/10 p-3 text-sm text-ok">You are preselected. The team will contact you soon.</p>}</div>))}</div></main>);
}
