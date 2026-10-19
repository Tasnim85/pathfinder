import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, verifySession } from "@/lib/session";
// Everything except the landing page, /login and /signup requires an account.
export async function middleware(req: NextRequest) {
  const s = await verifySession(req.cookies.get(COOKIE)?.value);
  const p = req.nextUrl.pathname;
  const go = (path: string, search = "") => { const u = req.nextUrl.clone(); u.pathname = path; u.search = search; return NextResponse.redirect(u); };
  if (!s) return go("/login", `?next=${encodeURIComponent(p)}`);
  if (/^\/jobs\/[^/]+/.test(p)) return NextResponse.next();                 // a single job: candidates (open jobs) and its owner; the page decides
  const recruiterArea = p.startsWith("/recruiter");
  if (recruiterArea && s.role !== "recruiter") return go("/jobs");
  if (!recruiterArea && s.role !== "candidate") return go("/recruiter");
  return NextResponse.next();
}
export const config = { matcher: ["/recruiter/:path*", "/jobs", "/jobs/:path*", "/onboarding", "/matches/:path*", "/applications", "/profile"] };
