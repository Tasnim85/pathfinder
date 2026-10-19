// Edge-safe (used by middleware): only `jose`, no bcrypt / node APIs.
import { SignJWT, jwtVerify } from "jose";
export const COOKIE = "pf_session";
export type Session = { uid: string; role: "candidate" | "recruiter"; name: string };
function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET must be set (16+ characters) in production");
    return new TextEncoder().encode("dev-only-secret-do-not-use-in-production");
  }
  return new TextEncoder().encode(s);
}
export const signSession = (p: Session) => new SignJWT({ ...p }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("7d").sign(secret());
export async function verifySession(t?: string): Promise<Session | null> {
  if (!t) return null;
  try { const { payload } = await jwtVerify(t, secret()); return { uid: String(payload.uid), role: payload.role as Session["role"], name: String(payload.name) }; } catch { return null; }
}
