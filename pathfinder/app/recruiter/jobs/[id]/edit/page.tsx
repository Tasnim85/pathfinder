import { notFound } from "next/navigation";
import { JobForm } from "@/components/JobForm";
import { db, type JobRow } from "@/lib/db";
import { getSession } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function Edit({ params }: { params: { id: string } }) {
  const s = (await getSession())!;
  const j = db().prepare("SELECT * FROM jobs WHERE id = ? AND recruiter_id = ?").get(params.id, s.uid) as JobRow | undefined;
  if (!j) notFound();
  return <main className="mx-auto max-w-2xl px-5 py-10"><h1 className="mb-6 text-3xl font-extrabold">Edit job</h1><JobForm job={j} /></main>;
}
