import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { guard, requireUser } from "@/lib/auth";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
// Excel export of the logged-in recruiter's own jobs (never anyone else's), with application counts.
export const GET = guard(async () => {
  const s = await requireUser("recruiter");
  const rows = db().prepare(`SELECT j.title, j.category, j.location, j.employment_type, j.required_experience, j.required_education, j.status, j.created_at,
      COUNT(a.id) total, COALESCE(SUM(a.status='pending'),0) pending, COALESCE(SUM(a.status='accepted'),0) accepted, COALESCE(SUM(a.status='rejected'),0) rejected
    FROM jobs j LEFT JOIN applications a ON a.job_id = j.id WHERE j.recruiter_id = ? GROUP BY j.id ORDER BY j.created_at DESC, j.rowid`).all(s.uid) as Record<string, string | number | null>[];
  const wb = new ExcelJS.Workbook(); wb.creator = "PathFinder"; wb.created = new Date();
  const ws = wb.addWorksheet("My jobs", { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = [
    { header: "Job title", key: "title", width: 42 }, { header: "Category", key: "category", width: 24 }, { header: "Location", key: "location", width: 26 },
    { header: "Contract", key: "employment_type", width: 14 }, { header: "Experience", key: "required_experience", width: 18 }, { header: "Education", key: "required_education", width: 22 },
    { header: "Status", key: "status", width: 10 }, { header: "Posted", key: "created_at", width: 13, style: { numFmt: "dd/mm/yyyy" } },
    { header: "Applications", key: "total", width: 13 }, { header: "Pending", key: "pending", width: 10 }, { header: "Preselected", key: "accepted", width: 12 }, { header: "Not selected", key: "rejected", width: 13 },
  ];
  for (const r of rows) ws.addRow({ ...r, status: r.status === "open" ? "Open" : "Closed", created_at: new Date(String(r.created_at).replace(" ", "T") + "Z") });
  const head = ws.getRow(1); head.height = 22;
  head.eachCell((c) => { c.font = { bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F6FDB" } }; c.alignment = { vertical: "middle" }; });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columns.length } };
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="pathfinder-my-jobs-${new Date().toISOString().slice(0, 10)}.xlsx"`, "Cache-Control": "no-store" } });
});
