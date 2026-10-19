import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { guard, requireUser } from "@/lib/auth";
import { getResult } from "@/lib/ai";
export const dynamic = "force-dynamic"; export const maxDuration = 30;
// Adds `site` to every AI result that is a real job of this website (same doc_id), so the page can offer "Apply".
export const GET = guard(async (_: Request, { params }: { params: { id: string } }) => {
  const s = await requireUser("candidate");
  if (!/^[a-zA-Z0-9_]{4,40}$/.test(params.id)) return NextResponse.json({ status: "error", error: "Invalid id." }, { status: 400 });
  const res = await getResult(params.id);
  if (res.status === "done" && res.report) {
    const q = db().prepare(`SELECT j.id, j.status, u.company, EXISTS(SELECT 1 FROM applications a WHERE a.job_id = j.id AND a.candidate_id = ?) AS applied
      FROM jobs j JOIN users u ON u.id = j.recruiter_id WHERE j.id = ?`);
    for (const job of res.report.top) {
      const r = q.get(s.uid, job.doc_id) as { id: string; status: string; company: string | null; applied: number } | undefined;
      if (r) job.site = { id: r.id, company: r.company, open: r.status === "open", applied: !!r.applied };
    }
  }
  return NextResponse.json(res);
});
