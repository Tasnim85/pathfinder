"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Report } from "@/lib/schemas";
export function SaveProfile({ profile: p, years }: { profile: Report["profile"]; years: number | null }) {
  const [role, setRole] = useState<string | null | undefined>(undefined), [state, setState] = useState<"idle" | "busy" | "ok" | "err">("idle");
  useEffect(() => { fetch("/api/auth/me").then((r) => r.json()).then((d) => setRole(d.user?.role ?? null)).catch(() => setRole(null)); }, []);
  async function save() {
    setState("busy");
    const body = { headline: p.target_title || "", summary: p.summary || "", skills: p.skills.slice(0, 40), years: p.years_experience ?? years, education: p.education.join("; ").slice(0, 300), cv_text: "" };
    const cur = await fetch("/api/profile").then((r) => r.json()).catch(() => ({}));           // keep an existing CV text
    const r = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, cv_text: cur.profile?.cv_text || "" }) });
    setState(r.ok ? "ok" : "err");
  }
  if (role === undefined || role === "recruiter") return null;
  return (<div className="card mt-4 flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
    {role === null ? <p>Want to apply to jobs? <Link className="font-semibold text-primary" href="/signup">Create a candidate account</Link> to save this profile.</p>
      : state === "ok" ? <p className="font-semibold text-ok">Saved. Review it in <Link className="underline" href="/profile">My profile</Link>, then <Link className="underline" href="/jobs">browse jobs</Link>.</p>
      : <><p>Use what the AI understood as your profile (it replaces your current headline, skills and education).</p><button className="btn btn-primary !py-2" onClick={save} disabled={state === "busy"}>Save as my profile</button>{state === "err" && <span className="text-bad">Could not save.</span>}</>}
  </div>);
}
