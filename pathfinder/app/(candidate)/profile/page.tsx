"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
export default function Profile() {
  const [p, setP] = useState({ headline: "", summary: "", skills: "", years: "", education: "", cv_text: "" });
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  useEffect(() => { fetch("/api/profile").then((r) => r.json()).then((d) => { const x = d.profile; if (x) setP({ headline: x.headline || "", summary: x.summary || "", skills: (x.skills || []).join(", "), years: x.years ?? "", education: x.education || "", cv_text: x.cv_text || "" }); setLoading(false); }); }, []);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setP({ ...p, [k]: e.target.value });
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const body = { ...p, skills: p.skills.split(",").map((s) => s.trim()).filter(Boolean), years: p.years === "" ? null : Number(p.years) };
    const r = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const d = await r.json().catch(() => ({})); setBusy(false);
    setMsg(r.ok ? { ok: true, t: "Profile saved." } : { ok: false, t: d.error || "Could not save." });
  }
  const inp = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm";
  return (<main className="mx-auto max-w-2xl px-5 py-10"><h1 className="text-3xl font-extrabold">My profile</h1>
    <p className="mt-1 text-muted">This is what recruiters see when you apply. A copy is taken at the moment you apply. You can also fill it from an AI analysis: open your matches and choose “Save as my profile”.</p>
    {loading ? <div className="mt-6 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skel h-12" />)}</div> :
      <form onSubmit={save} className="card mt-6 space-y-4 p-6">
        <div><label htmlFor="h" className="mb-1 block text-sm font-semibold">Headline</label><input id="h" className={inp} value={p.headline} onChange={set("headline")} placeholder="e.g. Software engineer" /></div>
        <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="y" className="mb-1 block text-sm font-semibold">Years of experience</label><input id="y" type="number" min={0} max={60} className={inp} value={p.years} onChange={set("years")} /></div>
          <div><label htmlFor="e" className="mb-1 block text-sm font-semibold">Education</label><input id="e" className={inp} value={p.education} onChange={set("education")} /></div></div>
        <div><label htmlFor="s" className="mb-1 block text-sm font-semibold">Skills (separated by commas)</label><input id="s" className={inp} value={p.skills} onChange={set("skills")} /></div>
        <div><label htmlFor="su" className="mb-1 block text-sm font-semibold">About you</label><textarea id="su" rows={3} className={inp} value={p.summary} onChange={set("summary")} /></div>
        <div><label htmlFor="c" className="mb-1 block text-sm font-semibold">CV text (optional)</label><textarea id="c" rows={6} className={inp} value={p.cv_text} onChange={set("cv_text")} /></div>
        {msg && <p role="status" className={`text-sm ${msg.ok ? "text-ok" : "text-bad"}`}>{msg.t}</p>}
        <button className="btn btn-primary" disabled={busy}>{busy && <Loader2 className="animate-spin" size={16} />}Save profile</button></form>}
  </main>);
}
