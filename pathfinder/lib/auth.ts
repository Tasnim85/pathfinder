import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { db, type Role } from "./db";
import { COOKIE, signSession, verifySession, type Session } from "./session";

export const hashPassword = (p: string) => bcrypt.hash(p, 11);
export const checkPassword = (p: string, h: string) => bcrypt.compare(p, h);

export async function getSession(): Promise<Session | null> {
  const s = await verifySession(cookies().get(COOKIE)?.value);
  if (!s) return null;
  return db().prepare("SELECT 1 FROM users WHERE id = ?").get(s.uid) ? s : null;   // deleted users are logged out
}
export async function setSession(s: Session) {
  cookies().set(COOKIE, await signSession(s), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 7 * 86400 });
}
export const clearSession = () => cookies().delete(COOKIE);

export async function requireUser(role?: Role): Promise<Session> {
  const s = await getSession();
  if (!s) throw NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (role && s.role !== role) throw NextResponse.json({ error: "You are not allowed to do this." }, { status: 403 });
  return s;
}
// Wraps a route handler: thrown Responses are returned, validation errors become 400, the rest 500.
export const guard = <A extends unknown[]>(fn: (...a: A) => Promise<Response>) => async (...a: A): Promise<Response> => {
  try { return await fn(...a); } catch (e) {
    if (e instanceof Response) return e;
    if (e instanceof ZodError) return NextResponse.json({ error: e.issues[0]?.message || "Invalid data." }, { status: 400 });
    console.error(e); return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
};
