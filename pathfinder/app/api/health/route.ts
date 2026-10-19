import { NextResponse } from "next/server";
import { IS_MOCK, aiFetch } from "@/lib/ai";
export const dynamic = "force-dynamic";
export async function GET() {
  if (IS_MOCK) return NextResponse.json({ state: "demo" });
  try { const r = await aiFetch("/health", {}, 6000); return NextResponse.json({ state: r.ok ? "online" : "offline" }); }
  catch { return NextResponse.json({ state: "offline" }); }
}
