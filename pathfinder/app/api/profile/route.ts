import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { guard, requireUser } from "@/lib/auth";
import { ProfileSchema } from "@/lib/validation";
export const dynamic = "force-dynamic";
export const GET = guard(async () => {
  const s = await requireUser("candidate");
  const p = db().prepare("SELECT headline,summary,skills,years,education,cv_text FROM profiles WHERE user_id = ?").get(s.uid) as Record<string, unknown> | undefined;
  return NextResponse.json({ profile: p ? { ...p, skills: JSON.parse(String(p.skills)) } : null });
});
export const PUT = guard(async (req: Request) => {
  const s = await requireUser("candidate");
  const d = ProfileSchema.parse(await req.json().catch(() => ({})));
  db().prepare(`INSERT INTO profiles (user_id,headline,summary,skills,years,education,cv_text,updated_at) VALUES (?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET headline=excluded.headline,summary=excluded.summary,skills=excluded.skills,years=excluded.years,education=excluded.education,cv_text=excluded.cv_text,updated_at=datetime('now')`)
    .run(s.uid, d.headline, d.summary, JSON.stringify(d.skills), d.years ?? null, d.education, d.cv_text);
  return NextResponse.json({ ok: true });
});
