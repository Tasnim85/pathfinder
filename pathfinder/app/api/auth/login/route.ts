import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkPassword, guard, setSession } from "@/lib/auth";
import { LoginSchema } from "@/lib/validation";
import { verifyRecaptcha } from "@/lib/recaptcha";

const DUMMY = "$2a$11$0000000000000000000000000000000000000000000000000000.";   // keeps timing similar for unknown emails

export const POST = guard(async (req: Request) => {
  const rawBody = await req.json().catch(() => ({}));
  
  // 1. Verify reCAPTCHA token first
  const { recaptchaToken, email, password } = rawBody;
  if (!recaptchaToken) {
    return NextResponse.json({ error: "reCAPTCHA token is missing." }, { status: 400 });
  }

  const isHuman = await verifyRecaptcha(recaptchaToken);
  if (!isHuman) {
    return NextResponse.json({ error: "reCAPTCHA verification failed. Please try again." }, { status: 400 });
  }

  // 2. Validate email and password fields using Zod
  const d = LoginSchema.parse({ email, password });

  // 3. Authenticate user
  const u = db().prepare("SELECT id, password_hash, role, name FROM users WHERE email = ?").get(d.email) as { id: string; password_hash: string; role: "candidate" | "recruiter"; name: string } | undefined;
  const ok = await checkPassword(d.password, u?.password_hash ?? DUMMY);
  
  if (!u || !ok) return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });

  await setSession({ uid: u.id, role: u.role, name: u.name });
  return NextResponse.json({ role: u.role });
});