import { NextResponse, type NextRequest } from "next/server";
import { db, uid } from "@/lib/db";
import { COOKIE, signSession } from "@/lib/session";
import { hashPassword } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=GoogleAuthFailed", req.url));
  }

  let role = "candidate";
  try {
    if (stateParam) {
      const parsed = JSON.parse(stateParam);
      if (parsed.role) role = parsed.role;
    }
  } catch {}

  try {
    // 1. Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return NextResponse.redirect(new URL("/login?error=TokenExchangeFailed", req.url));
    }

    // 2. Fetch user profile from Google
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const googleUser = await userRes.json();
    const { email, name } = googleUser;

    if (!email) {
      return NextResponse.redirect(new URL("/login?error=NoEmailProvided", req.url));
    }

    // 3. Find existing user in SQLite database or create one if they don't exist
    let dbUser = db().prepare("SELECT id, role, name FROM users WHERE email = ?").get(email) as
      | { id: string; role: "candidate" | "recruiter"; name: string }
      | undefined;

    if (!dbUser) {
      const newId = uid();
      const randomPasswordHash = await hashPassword(uid() + Math.random());
      const userName = name || email.split("@")[0];

      db().prepare(
        "INSERT INTO users (id, email, password_hash, role, name, company) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(newId, email, randomPasswordHash, role, userName, null);

      dbUser = { id: newId, role: role as "candidate" | "recruiter", name: userName };
    }

    // 4. Create the session token using the actual database user ID
    const sessionToken = await signSession({
      uid: dbUser.id,
      role: dbUser.role,
      name: dbUser.name,
    });

    // 5. Determine redirect route based on role
    const redirectPath = dbUser.role === "recruiter" ? "/recruiter" : "/jobs";
    const res = NextResponse.redirect(new URL(redirectPath, req.url));

    // 6. Set the session cookie so middleware and RoleShell validate successfully
    res.cookies.set(COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 86400,
    });

    return res;
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return NextResponse.redirect(new URL("/login?error=ServerError", req.url));
  }
}