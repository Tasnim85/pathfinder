import { NextResponse } from "next/server";
import { db, uid } from "@/lib/db";
import { guard, requireUser } from "@/lib/auth";
import { JobSchema } from "@/lib/validation";
export const POST = guard(async (req: Request) => {
  const s = await requireUser("recruiter");
  const d = JobSchema.parse(await req.json().catch(() => ({})));
  const id = uid();
  db().prepare("INSERT INTO jobs (id,recruiter_id,title,location,employment_type,required_experience,required_education,description,requirements,status) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run(id, s.uid, d.title, d.location, d.employment_type ?? null, d.required_experience, d.required_education, d.description, d.requirements, d.status);
  return NextResponse.json({ id });
});
