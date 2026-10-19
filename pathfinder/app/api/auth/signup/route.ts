import { NextResponse } from "next/server";
import { db, uid } from "@/lib/db";
import { guard, hashPassword, setSession } from "@/lib/auth";
import { SignupSchema } from "@/lib/validation";
export const POST = guard(async (req: Request) => {
  const d = SignupSchema.parse(await req.json().catch(() => ({})));
  if (db().prepare("SELECT 1 FROM users WHERE email = ?").get(d.email)) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  const id = uid();
  db().prepare("INSERT INTO users (id,email,password_hash,role,name,company) VALUES (?,?,?,?,?,?)").run(id, d.email, await hashPassword(d.password), d.role, d.name, d.role === "recruiter" ? d.company : null);
  await setSession({ uid: id, role: d.role, name: d.name });
  return NextResponse.json({ role: d.role });
});
