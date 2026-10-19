import { RoleShell } from "@/components/RoleShell";
export const dynamic = "force-dynamic";
export default function Layout({ children }: { children: React.ReactNode }) { return <RoleShell>{children}</RoleShell>; }
