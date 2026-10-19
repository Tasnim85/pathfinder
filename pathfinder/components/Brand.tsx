"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
export function Logo({ size = 36 }: { size?: number }) {
  return (<Link href="/" className="flex items-center gap-2.5 font-display text-xl font-extrabold text-ink" aria-label="PathFinder home">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/logo-mark.jpg" alt="" width={size} height={size * 0.875} className="mix-blend-multiply" style={{ height: size * 0.875, width: size }} />PathFinder</Link>);
}
type U = { name: string; role: "candidate" | "recruiter" } | null;
export function Nav() {
  const [u, setU] = useState<U | undefined>(undefined);
  const router = useRouter();
  useEffect(() => { fetch("/api/auth/me").then((r) => r.json()).then((d) => setU(d.user)).catch(() => setU(null)); }, []);
  async function out() { await fetch("/api/auth/logout", { method: "POST" }); setU(null); router.push("/"); router.refresh(); }
  const L = ({ href, children }: { href: string; children: React.ReactNode }) => <Link href={href} className="hover:text-ink">{children}</Link>;
  return (<header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
    <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3">
      <Logo />
      <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-medium text-muted">
        {u?.role !== "recruiter" && <L href="/jobs">Jobs</L>}
        {u?.role === "candidate" && <><L href="/onboarding">AI matching</L><L href="/applications">My applications</L><L href="/profile">My profile</L></>}
        {u?.role === "recruiter" && <L href="/recruiter">Recruiter dashboard</L>}
        {!u && <L href="/#how">How it works</L>}
      </nav>
      <div className="flex items-center gap-2 text-sm">
        {u === undefined ? null : u ? <><span className="hidden text-muted sm:inline">{u.name}</span><button onClick={out} className="btn btn-ghost !py-2">Sign out</button></>
          : <><Link href="/login" className="btn btn-ghost !py-2">Sign in</Link><Link href="/signup" className="btn btn-primary !py-2">Sign up</Link></>}
      </div>
    </div></header>);
}
