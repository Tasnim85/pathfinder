"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Briefcase, Users, PlusCircle, Sparkles, FileText, UserRound, Search } from "lucide-react";
import { Logo } from "./Brand";
import { SignOutButton } from "./SignOut";
type Item = { href: string; label: string; icon: typeof Users; exact?: boolean; also?: string[] };
const MENUS: Record<"recruiter" | "candidate", Item[]> = {
  recruiter: [
    { href: "/recruiter", label: "Overview", icon: LayoutDashboard, exact: true },
    { href: "/recruiter/jobs", label: "My jobs", icon: Briefcase },
    { href: "/recruiter/candidates", label: "Candidates", icon: Users },
    { href: "/recruiter/jobs/new", label: "Post a job", icon: PlusCircle, exact: true },
  ],
  candidate: [
    { href: "/jobs", label: "Browse jobs", icon: Search },
    { href: "/onboarding", label: "AI matching", icon: Sparkles, also: ["/matches"] },
    { href: "/applications", label: "My applications", icon: FileText },
    { href: "/profile", label: "My profile", icon: UserRound },
  ],
};
export function AppShell({ kind, name, sub, children }: { kind: "recruiter" | "candidate"; name: string; sub?: string | null; children: React.ReactNode }) {
  const path = usePathname();
  const active = (i: Item) => (i.exact ? path === i.href : path.startsWith(i.href) || !!i.also?.some((a) => path.startsWith(a)))
    && !(i.href === "/recruiter/jobs" && path === "/recruiter/jobs/new");
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  return (<div className="min-h-screen md:flex">
    <aside className="flex flex-col border-b border-line bg-white md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:border-b-0 md:border-r">
      <div className="px-5 py-4"><Logo size={32} /></div>
      <nav aria-label={kind === "candidate" ? "Candidate" : "Recruiter"} className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-visible">
        {MENUS[kind].map((i) => { const a = active(i); return (
          <Link key={i.href} href={i.href} aria-current={a ? "page" : undefined} className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold ${a ? "bg-primary/10 text-primary" : "text-muted hover:bg-bg hover:text-ink"}`}><i.icon size={18} />{i.label}</Link>); })}
        <SignOutButton />
      </nav>
    </aside>
    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-20 flex items-center justify-end border-b border-line bg-bg/85 px-5 py-2.5 backdrop-blur">
        <div className="flex items-center gap-3"><div className="text-right leading-tight"><p className="text-sm font-semibold">{name}</p><p className="text-xs text-muted">{sub || (kind === "candidate" ? "Candidate" : "Recruiter")}</p></div>
          <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-white" style={{ background: "var(--grad)" }}>{initials}</span></div>
      </header>
      {children}
    </div>
  </div>);
}
