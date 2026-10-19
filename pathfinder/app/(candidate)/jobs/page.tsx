import Link from "next/link";
import { redirect } from "next/navigation";
import { MapPin, Briefcase, Search } from "lucide-react";
import { Chip, Empty, fmtDate } from "@/components/Bits";
import { Pager } from "@/components/Pager";
import { db, type JobRow } from "@/lib/db";
import { getSession } from "@/lib/auth";
export const dynamic = "force-dynamic";
const SIZE = 15;
export default async function Jobs({ searchParams }: { searchParams: { q?: string; type?: string; category?: string; page?: string } }) {
  if ((await getSession())?.role === "recruiter") redirect("/recruiter/jobs");
  const q = (searchParams.q || "").trim().slice(0, 80), type = searchParams.type || "", cat = searchParams.category || "";
  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1), like = `%${q.replace(/[%_]/g, "")}%`;
  const W = `j.status = 'open' AND (? = '' OR j.title LIKE ? OR j.description LIKE ? OR j.requirements LIKE ? OR j.location LIKE ? OR u.company LIKE ?) AND (? = '' OR j.employment_type = ?) AND (? = '' OR j.category = ?)`;
  const P = [q, like, like, like, like, like, type, type, cat, cat];
  const total = (db().prepare(`SELECT COUNT(*) n FROM jobs j JOIN users u ON u.id = j.recruiter_id WHERE ${W}`).get(...P) as { n: number }).n;
  const jobs = db().prepare(`SELECT j.*, u.company FROM jobs j JOIN users u ON u.id = j.recruiter_id WHERE ${W} ORDER BY j.created_at DESC, j.rowid LIMIT ? OFFSET ?`).all(...P, SIZE, (page - 1) * SIZE) as JobRow[];
  const opts = (col: string) => (db().prepare(`SELECT DISTINCT ${col} v FROM jobs WHERE status='open' AND ${col} IS NOT NULL AND ${col} <> '' ORDER BY 1`).all() as { v: string }[]).map((r) => r.v);
  const sel = "rounded-xl border border-line bg-white px-3 py-2.5 text-sm";
  return (<main className="mx-auto max-w-4xl px-5 py-8">
    <h1 className="text-3xl font-extrabold md:text-4xl">Open positions</h1>
    <p className="mt-1 text-muted">Posted by recruiters on PathFinder. Prefer a shortlist? <Link href="/onboarding" className="font-semibold text-primary">Let the AI rank them for you</Link>.</p>
    <form className="mt-6 flex flex-wrap gap-2" role="search"><div className="relative min-w-[14rem] flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input name="q" defaultValue={q} placeholder="Title, skill, company, city…" aria-label="Search jobs" className="w-full rounded-xl border border-line bg-white py-2.5 pl-9 pr-3 text-sm" /></div>
      <select name="category" defaultValue={cat} aria-label="Category" className={sel}><option value="">All categories</option>{opts("category").map((t) => <option key={t}>{t}</option>)}</select>
      <select name="type" defaultValue={type} aria-label="Contract type" className={sel}><option value="">All contracts</option>{opts("employment_type").map((t) => <option key={t}>{t}</option>)}</select>
      <button className="btn btn-primary !py-2.5">Search</button></form>
    <div className="mt-6 space-y-4">{jobs.length === 0 ? <Empty title="No open positions found">{q || type || cat ? "Try other words or filters." : "Recruiters have not published jobs yet."}</Empty> : jobs.map((j) => (
      <Link key={j.id} href={`/jobs/${encodeURIComponent(j.id)}`} className="card block p-5 transition hover:border-primary hover:shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-2"><h2 className="text-lg font-bold">{j.title}</h2><span className="text-xs text-muted">{fmtDate(j.created_at)}</span></div>
        <p className="text-sm text-muted">{j.company}</p>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">{j.location && <li className="flex items-center gap-1"><MapPin size={14} />{j.location}</li>}{j.employment_type && <li className="flex items-center gap-1"><Briefcase size={14} />{j.employment_type}</li>}</ul>
        <p className="mt-3 line-clamp-2 text-sm">{j.description}</p>
        <div className="mt-3 flex flex-wrap gap-2">{j.category && <Chip>{j.category}</Chip>}{j.required_experience && <Chip tone="muted">{j.required_experience}</Chip>}</div></Link>))}</div>
    <Pager page={page} total={total} size={SIZE} basePath="/jobs" params={{ q, type, category: cat }} />
  </main>);
}
