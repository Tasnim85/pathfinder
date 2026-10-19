import Link from "next/link";
import { notFound } from "next/navigation";
import { Empty } from "@/components/Bits";
import { ApplicantCard } from "@/components/ApplicantCard";
import { db, type AppRow, type JobRow } from "@/lib/db";
import { getSession } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function Applicants({ params }: { params: { id: string } }) {
  const s = (await getSession())!;
  const j = db().prepare("SELECT * FROM jobs WHERE id = ? AND recruiter_id = ?").get(params.id, s.uid) as JobRow | undefined;
  if (!j) notFound();
  const apps = db().prepare("SELECT * FROM applications WHERE job_id = ? ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'accepted' THEN 1 ELSE 2 END, created_at DESC").all(j.id) as AppRow[];
  return (<main className="mx-auto max-w-3xl px-5 py-10">
    <Link href="/recruiter/jobs" className="text-sm font-semibold text-primary">← My jobs</Link>
    <h1 className="mt-2 text-3xl font-extrabold">{j.title}</h1><p className="text-muted">{apps.length} candidate{apps.length === 1 ? "" : "s"}</p>
    <div className="mt-6 space-y-4">{apps.length === 0 ? <Empty title="No candidates yet">They will appear here as soon as someone applies.</Empty> : apps.map((a) => <ApplicantCard key={a.id} a={a} />)}</div>
    <p className="mt-6 text-xs text-muted">You make the final decision. Nothing is accepted or rejected automatically.</p>
  </main>);
}
