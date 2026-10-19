import Link from "next/link";
import { Plus } from "lucide-react";
import { Empty } from "@/components/Bits";
import { ApplicantCard } from "@/components/ApplicantCard";
import { db, type AppRow } from "@/lib/db";
import { getSession } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function Overview() {
  const s = (await getSession())!;
  const n = db().prepare(`SELECT (SELECT COUNT(*) FROM jobs WHERE recruiter_id=@u) jobs, (SELECT COUNT(*) FROM jobs WHERE recruiter_id=@u AND status='open') open,
    COUNT(a.id) apps, COALESCE(SUM(a.status='pending'),0) pending, COALESCE(SUM(a.status='accepted'),0) accepted
    FROM applications a JOIN jobs j ON j.id=a.job_id WHERE j.recruiter_id=@u`.replace(/@u/g, "?")).get(s.uid, s.uid, s.uid) as Record<string, number>;
  const pend = db().prepare(`SELECT a.*, j.title job_title, j.id jid FROM applications a JOIN jobs j ON j.id=a.job_id WHERE j.recruiter_id=? AND a.status='pending' ORDER BY a.created_at DESC LIMIT 5`).all(s.uid) as (AppRow & { job_title: string; jid: string })[];
  const cards: [string, number][] = [["Open jobs", n.open], ["Candidates", n.apps], ["Awaiting your decision", n.pending], ["Preselected", n.accepted]];
  return (<main className="mx-auto max-w-4xl px-5 py-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-3xl font-extrabold">Hello {s.name.split(" ")[0]}</h1><p className="text-muted">Here is what needs your attention.</p></div>
      <Link href="/recruiter/jobs/new" className="btn btn-primary"><Plus size={16} />Post a job</Link></div>
    <div className="mt-6 grid gap-3 sm:grid-cols-4">{cards.map(([l, v]) => <div key={l} className="card p-4"><div className="text-2xl font-extrabold">{v}</div><div className="text-sm text-muted">{l}</div></div>)}</div>
    <h2 className="mt-8 text-lg font-bold">Waiting for a decision</h2>
    <div className="mt-3 space-y-4">{pend.length === 0 ? <Empty title="Nothing waiting">{n.jobs === 0 ? "Post your first job to start receiving candidates." : "You have answered every candidate."}</Empty> : pend.map((a) => <ApplicantCard key={a.id} a={a} jobTitle={a.job_title} jobId={a.jid} />)}</div>
    {n.pending > 5 && <p className="mt-4 text-sm"><Link className="font-semibold text-primary" href="/recruiter/candidates?status=pending">See all {n.pending} pending candidates</Link></p>}
  </main>);
}
