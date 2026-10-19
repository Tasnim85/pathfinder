"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { SaveProfile } from "@/components/SaveProfile";
import { JobCard } from "@/components/JobCard";
import { REASON_LABELS, type ResultEnvelope } from "@/lib/schemas";

const AGENTS = ["Parser", "Query Builder", "Retriever", "Relevance Grader", "Scoring Agent", "Report Generator"];
export default function Matches() {
  const { id } = useParams<{ id: string }>();
  const [res, setRes] = useState<ResultEnvelope>({ status: "running" }), [elapsed, setElapsed] = useState(0), [net, setNet] = useState(0);
  const stop = useRef(false);
  useEffect(() => {
    stop.current = false; const t0 = Date.now(); let to: ReturnType<typeof setTimeout>;
    const clock = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000);
    async function poll() {
      try { const r = await fetch(`/api/result/${id}`, { cache: "no-store" }); const d: ResultEnvelope = await r.json(); setNet(0); setRes(d); if (d.status !== "running" || stop.current) return; }
      catch { setNet((n) => n + 1); }
      to = setTimeout(poll, 8000);
    }
    poll(); return () => { stop.current = true; clearTimeout(to); clearInterval(clock); };
  }, [id]);
  const mm = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  return (<main className="mx-auto max-w-4xl px-5 py-10">
    {res.mock && <p className="mb-4 rounded-lg bg-violet/10 p-3 text-sm font-medium text-violet">Demo mode: these results are sample data, not an analysis of your input. Set AI_API_URL to connect the real service.</p>}

    {res.status === "running" && <section className="card p-8 text-center" role="status" aria-live="polite">
      <Loader2 className="mx-auto animate-spin text-primary" size={34} />
      <h1 className="mt-4 text-2xl font-bold">The agents are working on your profile</h1>
      <p className="mt-1 text-muted">Elapsed {mm}. A real analysis usually takes a few minutes. You can leave this tab open.</p>
      <svg viewBox="0 0 600 40" className="mx-auto mt-6 w-full max-w-md" aria-hidden><line x1="20" y1="20" x2="580" y2="20" stroke="#2F6FDB" strokeOpacity=".5" strokeWidth="2" className="flow" />{AGENTS.map((_, i) => <circle key={i} cx={20 + i * 112} cy="20" r="7" fill="#fff" stroke="#2F6FDB" strokeWidth="3" />)}</svg>
      <p className="mt-2 text-xs text-muted">{AGENTS.join(" → ")}</p>
      <p className="mt-3 text-xs text-muted">The service only reports “running” or “done”, so no per-agent progress is shown.</p>
      {net > 2 && <p className="mt-3 text-sm text-warn">Connection problem, retrying…</p>}
      <div className="mx-auto mt-6 grid max-w-md gap-2">{[0, 1].map((i) => <div key={i} className="skel h-14" />)}</div>
    </section>}

    {res.status === "error" && <section className="card p-8 text-center"><AlertTriangle className="mx-auto text-bad" size={32} /><h1 className="mt-3 text-2xl font-bold">The analysis did not finish</h1><p className="mx-auto mt-2 max-w-lg text-muted">{res.error}</p>
      <Link href="/onboarding" className="btn btn-primary mt-6"><RotateCcw size={16} />Start again</Link></section>}

    {res.status === "done" && !res.report && <section>
      <p className="mb-3 rounded-lg bg-warn/10 p-3 text-sm text-warn">The detailed view could not be built (unexpected field: {res.schemaIssue || "unknown"}). Showing the original report instead.</p>
      <iframe title="Analysis report" sandbox="" srcDoc={res.html} className="h-[80vh] w-full rounded-2xl border border-line bg-white" /></section>}

    {res.status === "done" && res.report && (() => { const r = res.report; const p = r.profile; return (<>
      <h1 className="text-3xl font-extrabold md:text-4xl">Your best matches</h1>
      <p className="mt-1 text-muted">{r.top.length} jobs ranked from {r.pool_size ?? "a pool of"} candidates{r.seconds ? ` · analysed in ${r.seconds}s` : ""}.</p>

      {r.confidence === "low" && <div className="mt-5 flex gap-3 rounded-xl border border-warn/30 bg-warn/10 p-4 text-sm" role="note"><AlertTriangle className="shrink-0 text-warn" size={18} /><div><b>Limited confidence in these results.</b><ul className="mt-1 list-disc pl-5">{r.conf_reasons.map((c) => <li key={c}>{REASON_LABELS[c] ?? c}</li>)}</ul></div></div>}

      <section className="card mt-6 p-5"><h2 className="text-lg font-bold">What we understood about you</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">Target role</dt><dd className="font-semibold">{p.target_title || "Not detected"}</dd></div>
          <div><dt className="text-muted">Experience</dt><dd className="font-semibold">{(() => { const y = Array.isArray(r.years) ? r.years : []; const n = p.years_experience ?? (typeof y[0] === "number" ? y[0] : null); return n != null ? `${n} years${p.years_experience == null ? " (estimated from dates)" : ""}` : "Not detected"; })()}</dd></div>
          <div><dt className="text-muted">Education</dt><dd className="font-semibold">{p.education.length ? p.education.join(", ") : "Not detected"}</dd></div>
          <div><dt className="text-muted">Search query used</dt><dd className="font-semibold">{r.query || "–"}</dd></div></dl>
        {p.skills.length > 0 && <ul className="mt-4 flex flex-wrap gap-1.5">{p.skills.map((s) => <li key={s} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{s}</li>)}</ul>}
        {r.transcript && <details className="mt-4 text-sm"><summary className="cursor-pointer font-semibold text-primary">Transcription used ({r.asr_model})</summary><p className="mt-2 text-muted">{r.transcript}</p></details>}
        <p className="mt-3 text-xs text-muted">If something is wrong, fix your text and run the analysis again.</p></section>

      <SaveProfile profile={p} years={Array.isArray(r.years) && typeof r.years[0] === "number" ? Math.round(r.years[0]) : null} />
      {r.summary && <section className="mt-6"><h2 className="text-lg font-bold">Summary <span className="text-sm font-normal text-muted">(written in French by the report generator)</span></h2><div className="mt-2 space-y-2 leading-relaxed">{r.summary.split("\n\n").map((t, i) => <p key={i}>{t}</p>)}</div></section>}

      <p className="mt-8 rounded-lg bg-bg p-3 text-sm text-muted">Jobs from recruiters on PathFinder have an <b className="text-ink">Apply</b> button. A “Reference offer” comes from the research dataset and cannot be applied to.</p>
      <section className="mt-4 space-y-5" aria-label="Ranked jobs">{r.top.length ? r.top.map((j, i) => <JobCard key={j.doc_id} job={j} weights={r.weights} open={i === 0} />) : <div className="card p-8 text-center"><h2 className="font-bold">No matching job found</h2><p className="mt-1 text-muted">The job index may not cover your profession. Try describing your skills in more detail.</p></div>}</section>
      <div className="mt-8 flex gap-3"><Link href="/onboarding" className="btn btn-ghost"><RotateCcw size={16} />Run a new analysis</Link></div>
    </>); })()}
  </main>);
}
