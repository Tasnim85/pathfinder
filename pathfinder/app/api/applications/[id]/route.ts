import { NextResponse } from "next/server";
import { db, type AppRow } from "@/lib/db";
import { guard, requireUser } from "@/lib/auth";
import { sendMail } from "@/lib/mail";
import { DecisionSchema } from "@/lib/validation";
import { z } from "zod";
import path from "path";
import { LOGO_CID, preselectedEmail } from "@/lib/emailTemplate";
// The recruiter who owns the job accepts or rejects. Acceptance sends the "preselected" email to the candidate.
export const PATCH = guard(async (req: Request, { params }: { params: { id: string } }) => {
  const s = await requireUser("recruiter");
  const body = await req.json().catch(() => ({}));
  const { status } = DecisionSchema.parse(body);
  const resend = z.object({ resend: z.boolean().optional() }).parse(body).resend === true;
  const row = db().prepare(`SELECT a.*, j.title AS job_title, j.location AS location, j.employment_type AS jtype, u.company AS company, c.email AS email, c.name AS cname
    FROM applications a JOIN jobs j ON j.id = a.job_id JOIN users u ON u.id = j.recruiter_id JOIN users c ON c.id = a.candidate_id
    WHERE a.id = ? AND j.recruiter_id = ?`).get(params.id, s.uid) as (AppRow & { job_title: string; location: string | null; jtype: string | null; company: string | null; email: string; cname: string }) | undefined;
  if (!row) return NextResponse.json({ error: "Application not found." }, { status: 404 });
  db().prepare("UPDATE applications SET status = ?, decided_at = datetime('now') WHERE id = ?").run(status, params.id);
  let mail: Awaited<ReturnType<typeof sendMail>> | null = null;
  if (status === "accepted" && (!row.notified_at || resend)) {          // not twice by accident; only when the recruiter asks to resend
    const co = row.company || "The recruiting team";
    const m = preselectedEmail({ name: row.cname, jobTitle: row.job_title, company: co, location: row.location, type: row.jtype, appUrl: process.env.APP_URL });
    mail = await sendMail({ to: row.email, ...m, attachments: [{ filename: "pathfinder-logo.png", path: path.join(process.cwd(), "public", "logo-email.png"), cid: LOGO_CID }] });
    if (mail.ok && mail.mode === "smtp") db().prepare("UPDATE applications SET notified_at = datetime('now') WHERE id = ?").run(params.id);
  }
  return NextResponse.json({ ok: true, to: row.email, mail });
});
