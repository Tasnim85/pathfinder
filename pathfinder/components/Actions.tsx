"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, X, Loader2, Trash2 } from "lucide-react";

export function DeleteJob({ id, title }: { id: string; title: string }) {
  const router = useRouter(), [busy, setBusy] = useState(false);
  async function del() {
    if (!confirm(`Delete "${title}"? Its applications will be deleted too. This cannot be undone.`)) return;
    setBusy(true); const r = await fetch(`/api/jobs/${id}`, { method: "DELETE" }); setBusy(false);
    if (r.ok) router.refresh(); else alert("Could not delete the job.");
  }
  return <button onClick={del} disabled={busy} className="btn btn-ghost !px-3 !py-1.5 text-sm text-bad"><Trash2 size={14} />Delete</button>;
}

export function DecisionButtons({ id, status }: { id: string; status: string; notified?: boolean }) {
  const router = useRouter(), [busy, setBusy] = useState(""), [msg, setMsg] = useState<{ t: string; tone: "ok" | "warn" | "bad"; url?: string } | null>(null);
  async function decide(s: "accepted" | "rejected", resend = false) {
    setBusy(resend ? "resend" : s); setMsg(null);
    const r = await fetch(`/api/applications/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: s, resend }) });
    const d = await r.json().catch(() => ({})); setBusy("");
    if (!r.ok) return setMsg({ t: d.error || "Could not save the decision.", tone: "bad" });
    const m = d.mail;
    if (s === "accepted") {
      if (!m) setMsg({ t: "Saved. No email was sent (use “Resend email” if the candidate was not notified).", tone: "warn" });
      else if (!m.ok) setMsg({ t: `Candidate preselected, but the email FAILED: ${m.error || "unknown error"}. Check the SMTP settings, then use “Resend email”.`, tone: "bad" });
      else if (m.mode === "test") setMsg({ t: "Candidate preselected. TEST MODE: the email was NOT delivered to a real inbox (SMTP is not configured).", tone: "warn", url: m.previewUrl });
      else setMsg({ t: `Candidate preselected. Email sent to ${d.to}.`, tone: "ok" });
    }
    router.refresh();
  }
  const tone = { ok: "text-ok", warn: "text-warn", bad: "text-bad" };
  return (<div className="space-y-2"><div className="flex flex-wrap gap-2">
    {status !== "accepted" && <button onClick={() => decide("accepted")} disabled={!!busy} className="btn btn-primary !px-3 !py-1.5 text-sm">{busy === "accepted" ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}Accept</button>}
    {status === "accepted" && <button onClick={() => decide("accepted", true)} disabled={!!busy} className="btn btn-ghost !px-3 !py-1.5 text-sm">{busy === "resend" ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}Resend email</button>}
    {status !== "rejected" && <button onClick={() => decide("rejected")} disabled={!!busy} className="btn btn-ghost !px-3 !py-1.5 text-sm">{busy === "rejected" ? <Loader2 className="animate-spin" size={14} /> : <X size={14} />}Reject</button>}</div>
    {msg && <p role="status" className={`text-xs font-medium ${tone[msg.tone]}`}>{msg.t} {msg.url && <a className="font-semibold underline" href={msg.url} target="_blank" rel="noreferrer">View the test email</a>}</p>}</div>);
}

export function ApplyButton({ jobId, loggedRole, applied }: { jobId: string; loggedRole: string | null; applied: boolean }) {
  const router = useRouter(), [busy, setBusy] = useState(false), [err, setErr] = useState(""), [done, setDone] = useState(applied), [note, setNote] = useState(""), [needsProfile, setNP] = useState(false);
  if (loggedRole === "recruiter") return <p className="text-sm text-muted">Recruiter accounts cannot apply.</p>;
  if (!loggedRole) return <Link className="btn btn-primary" href={`/login?next=/jobs/${jobId}`}>Sign in to apply</Link>;
  if (done) return <p className="rounded-lg bg-ok/10 p-3 text-sm font-semibold text-ok">You applied to this job. Track it in <Link className="underline" href="/applications">My applications</Link>.</p>;
  async function apply() {
    setBusy(true); setErr(""); const r = await fetch(`/api/jobs/${jobId}/apply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note }) });
    const d = await r.json().catch(() => ({})); setBusy(false);
    if (r.ok) { setDone(true); router.refresh(); } else { setErr(d.error || "Could not apply."); setNP(!!d.needsProfile); }
  }
  return (<div className="space-y-3"><label htmlFor="note" className="block text-sm font-semibold">Message to the recruiter (optional)</label>
    <textarea id="note" rows={3} maxLength={1500} value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-xl border border-line p-3 text-sm" />
    <button onClick={apply} disabled={busy} className="btn btn-primary">{busy && <Loader2 className="animate-spin" size={16} />}Apply with my profile</button>
    {err && <p role="alert" className="text-sm text-bad">{err} {needsProfile && <Link className="font-semibold underline" href="/profile">Complete my profile</Link>}</p>}</div>);
}
