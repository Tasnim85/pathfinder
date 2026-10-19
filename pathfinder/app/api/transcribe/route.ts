import { NextResponse } from "next/server";
import { guard, requireUser } from "@/lib/auth";
import { IS_MOCK, aiFetch, mockTranscript } from "@/lib/ai";
export const runtime = "nodejs"; export const maxDuration = 120;
const EXT = [".wav", ".mp3", ".m4a", ".ogg", ".flac", ".webm"];
export const POST = guard(async (req: Request) => {
  await requireUser("candidate");
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No audio received." }, { status: 400 });
  const name = file.name || "recording.webm";
  if (!EXT.some((e) => name.toLowerCase().endsWith(e))) return NextResponse.json({ error: "Unsupported audio format." }, { status: 415 });
  if (file.size > 25 * 1024 * 1024) return NextResponse.json({ error: "Audio is larger than 25 MB." }, { status: 413 });
  if (IS_MOCK) return NextResponse.json({ text: mockTranscript(), n_words: mockTranscript().split(" ").length, mock: true });
  const fd = new FormData(); fd.append("file", file, name);
  try {
    const r = await aiFetch("/transcribe", { method: "POST", body: fd }, 110000);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json({ error: typeof data.detail === "string" ? data.detail : "Transcription failed." }, { status: r.status });
    return NextResponse.json(data);
  } catch { return NextResponse.json({ error: "The AI service is unreachable." }, { status: 503 }); }
});
