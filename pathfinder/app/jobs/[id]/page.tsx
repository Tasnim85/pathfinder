import { notFound } from "next/navigation";
import { MapPin, Briefcase, GraduationCap } from "lucide-react";
import { ApplyButton } from "@/components/Actions";
import { db, type JobRow } from "@/lib/db";
import { getSession } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function JobPage({ params }: { params: { id: string } }) {
  try { params = { id: decodeURIComponent(params.id) }; } catch { /* keep the raw id */ }
  const j = db().prepare("SELECT j.*, u.company FROM jobs j JOIN users u ON u.id = j.recruiter_id WHERE j.id = ?").get(params.id) as JobRow | undefined;
  const s = await getSession();
  if (!j || (s?.role === "recruiter" ? s.uid !== j.recruiter_id : j.status !== "open" && s?.uid !== j.recruiter_id)) notFound();   // a recruiter only sees his own posts
  const applied = s?.role === "candidate" && !!db().prepare("SELECT 1 FROM applications WHERE job_id = ? AND candidate_id = ?").get(j.id, s.uid);
  return (<main className="mx-auto max-w-3xl px-5 py-10">
    {j.status === "closed" && <p className="mb-4 rounded-lg bg-warn/10 p-3 text-sm text-warn">This job is closed: only you can see it.</p>}
    <h1 className="text-3xl font-extrabold">{j.title}</h1><p className="mt-1 text-muted">{j.company}</p>
    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">{j.location && <li className="flex items-center gap-1"><MapPin size={14} />{j.location}</li>}{j.employment_type && <li className="flex items-center gap-1"><Briefcase size={14} />{j.employment_type}</li>}{j.required_education && <li className="flex items-center gap-1"><GraduationCap size={14} />{j.required_education}</li>}{j.required_experience && <li>{j.required_experience}</li>}</ul>
    <section className="card mt-6 p-6"><h2 className="font-bold">Description</h2><p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{j.description}</p>
      {j.requirements && <><h2 className="mt-5 font-bold">Requirements</h2><p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{j.requirements}</p></>}</section>
    {j.status === "open" && <section className="card mt-6 p-6"><h2 className="mb-3 font-bold">Apply</h2><ApplyButton jobId={j.id} loggedRole={s?.role ?? null} applied={applied} /></section>}
  </main>);
}
