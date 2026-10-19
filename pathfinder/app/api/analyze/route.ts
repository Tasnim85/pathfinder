import { NextResponse } from "next/server";
import { guard, requireUser } from "@/lib/auth";
import { z } from "zod";
import { IS_MOCK, aiFetch, newMockJob } from "@/lib/ai";
export const runtime = "nodejs"; export const maxDuration = 60;
const Body = z.object({ text: z.string().min(1).max(60000), input_type: z.enum(["cv", "audio"]) });
export const POST = guard(async (req: Request) => {
  await requireUser("candidate");
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { text, input_type } = parsed.data;
  if (text.trim().split(/\s+/).length < 15) return NextResponse.json({ error: "The text is too short to analyse (15 words minimum)." }, { status: 422 });
  if (IS_MOCK) return NextResponse.json({ job_id: newMockJob(), mock: true });
  try {
    const r = await aiFetch("/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, input_type }) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json({ error: typeof data.detail === "string" ? data.detail : "The analysis could not start." }, { status: r.status });
    return NextResponse.json({ job_id: data.job_id });
  } catch { return NextResponse.json({ error: "The AI service is unreachable. Check that the Kaggle notebook is running and the tunnel URL is up to date." }, { status: 503 }); }
});
