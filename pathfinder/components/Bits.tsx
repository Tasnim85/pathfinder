export const Chip = ({ children, tone = "primary" }: { children: React.ReactNode; tone?: "primary" | "ok" | "warn" | "muted" | "bad" }) => {
  const c = { primary: "bg-primary/10 text-primary", ok: "bg-ok/10 text-ok", warn: "bg-warn/10 text-warn", muted: "bg-line text-muted", bad: "bg-bad/10 text-bad" }[tone];
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${c}`}>{children}</span>;
};
export const StatusChip = ({ s }: { s: string }) => <Chip tone={s === "accepted" ? "ok" : s === "rejected" ? "bad" : "warn"}>{s === "accepted" ? "Preselected" : s === "rejected" ? "Not selected" : "Pending"}</Chip>;
export const Empty = ({ title, children }: { title: string; children?: React.ReactNode }) => <div className="card p-10 text-center"><h2 className="font-bold">{title}</h2><div className="mt-2 text-muted">{children}</div></div>;
export const fmtDate = (s: string) => new Date(s.replace(" ", "T") + "Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
