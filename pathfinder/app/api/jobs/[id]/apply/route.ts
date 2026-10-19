import { NextResponse } from "next/server";
import { z } from "zod";
import { db, uid, type Snapshot } from "@/lib/db";
import { guard, requireUser } from "@/lib/auth";
export const POST = guard(async (req: Request, { params }: { params: { id: string } }) => {
  const s = await requireUser("candidate");
  const { note } = z.object({ note: z.string().trim().max(1500).optional() }).parse(await req.json().catch(() => ({})));
  const job = db().prepare("SELECT status FROM jobs WHERE id = ?").get(params.id) as { status: string } | undefined;
  if (!job || job.status !== "open") return NextResponse.json({ error: "This job is no longer open." }, { status: 404 });
  const u = db().prepare("SELECT name,email FROM users WHERE id = ?").get(s.uid) as { name: string; email: string };
  const p = db().prepare("SELECT headline,summary,skills,years,education,cv_text FROM profiles WHERE user_id = ?").get(s.uid) as Record<string, string | number | null> | undefined;
  if (!p || (!p.headline && !p.cv_text)) return NextResponse.json({ error: "Complete your profile first (a headline or your CV text), so the recruiter can see who you are.", needsProfile: true }, { status: 422 });
  const snap: Snapshot = { name: u.name, email: u.email, headline: (p.headline as string) || null, summary: (p.summary as string) || null, skills: JSON.parse(String(p.skills)), years: (p.years as number) ?? null, education: (p.education as string) || null, cv_text: (p.cv_text as string) || null };
  try { db().prepare("INSERT INTO applications (id,job_id,candidate_id,note,snapshot) VALUES (?,?,?,?,?)").run(uid(), params.id, s.uid, note || null, JSON.stringify(snap)); }
  catch { return NextResponse.json({ error: "You already applied to this job." }, { status: 409 }); }
  return NextResponse.json({ ok: true });
});
