import "server-only";
import { ReportSchema, type ResultEnvelope } from "./schemas";
import { MOCK_REPORT, MOCK_TRANSCRIPT } from "./mock";

export const BASE = (process.env.AI_API_URL || "").replace(/\/$/, "");
export const IS_MOCK = process.env.AI_MOCK === "true" || !BASE;
const MOCK_DELAY_MS = 9000;

export async function aiFetch(path: string, init: RequestInit = {}, timeoutMs = 30000) {
  const headers = new Headers(init.headers);
  if (process.env.AI_API_KEY) headers.set("x-api-key", process.env.AI_API_KEY);
  return fetch(BASE + path, { ...init, headers, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
}
export const mockTranscript = () => MOCK_TRANSCRIPT;
export const newMockJob = () => `mock_${Date.now()}`;

export async function getResult(id: string): Promise<ResultEnvelope> {
  if (id.startsWith("mock_")) {
    const age = Date.now() - Number(id.slice(5));
    if (!(age >= MOCK_DELAY_MS)) return { status: "running", mock: true };
    return { status: "done", mock: true, report: MOCK_REPORT };
  }
  if (IS_MOCK) return { status: "error", error: "Unknown job." };
  let r: Response;
  try { r = await aiFetch(`/result/${encodeURIComponent(id)}`, {}, 25000); }
  catch { return { status: "error", error: "The AI service is unreachable. The Kaggle session may have stopped or its tunnel URL changed." }; }
  if (r.status === 404) return { status: "error", error: "This analysis no longer exists (the AI service keeps jobs in memory and was probably restarted). Please run it again." };
  if (!r.ok) return { status: "error", error: `The AI service answered with an error (${r.status}).` };
  const data = await r.json();
  if (data.status === "running") return { status: "running" };
  if (data.status === "error") return { status: "error", error: String(data.error || "The analysis failed.") };
  const parsed = ReportSchema.safeParse(data.report);
  if (parsed.success) return { status: "done", report: parsed.data };
  // Safety net: if the schema drifted, still deliver the notebook's own HTML report.
  return { status: "done", report: null, html: data.html, schemaIssue: parsed.error.issues[0]?.path.join(".") };
}
