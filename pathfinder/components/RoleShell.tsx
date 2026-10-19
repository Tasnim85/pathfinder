import { AppShell } from "./AppShell";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
// Picks the sidebar from the logged-in role. Middleware already blocks anonymous visitors.
export async function RoleShell({ children }: { children: React.ReactNode }) {
  const s = (await getSession())!;
  const u = db().prepare("SELECT company FROM users WHERE id = ?").get(s.uid) as { company: string | null } | undefined;
  return <AppShell kind={s.role} name={s.name} sub={u?.company}>{children}</AppShell>;
}
