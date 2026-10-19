import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const role = url.searchParams.get("role") || "candidate";

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/google/callback`;
  
  const scope = encodeURIComponent("openid email profile");
  const state = encodeURIComponent(JSON.stringify({ role }));

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=${scope}&state=${state}&access_type=offline&prompt=select_account`;

  return NextResponse.redirect(googleAuthUrl);
}