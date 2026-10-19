import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { guard, requireUser } from "@/lib/auth";
import { JobSchema } from "@/lib/validation";
const owned = (id: string, uid: string) => db().prepare("SELECT 1 FROM jobs WHERE id = ? AND recruiter_id = ?").get(id, uid);
export const PUT = guard(async (req: Request, { params }: { params: { id: string } }) => {
  const s = await requireUser("recruiter");
  if (!owned(params.id, s.uid)) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  const d = JobSchema.parse(await req.json().catch(() => ({})));
  db().prepare("UPDATE jobs SET title=?,location=?,employment_type=?,required_experience=?,required_education=?,description=?,requirements=?,status=?,updated_at=datetime('now') WHERE id=?")
    .run(d.title, d.location, d.employment_type ?? null, d.required_experience, d.required_education, d.description, d.requirements, d.status, params.id);
  return NextResponse.json({ ok: true });
});
export const DELETE = guard(async (_: Request, { params }: { params: { id: string } }) => {
  const s = await requireUser("recruiter");
  if (!owned(params.id, s.uid)) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  db().prepare("DELETE FROM jobs WHERE id = ?").run(params.id);          // applications are deleted with it (ON DELETE CASCADE)
  return NextResponse.json({ ok: true });
});
