import { z } from "zod";
// Schema DERIVED FROM THE NOTEBOOK CODE (cells 178, 180, 184, 186), not from a captured sample.
// Fields whose shape could not be confirmed are typed loosely (z.unknown) on purpose.
const s = z.string().nullish();
export const JobSchema = z.object({
  doc_id: z.string(), title: z.string(),
  location: s, employment_type: s, function: s, required_experience: s, required_education: s, excerpt: s,
  score: z.number(),
  components: z.record(z.number().nullable().optional()).default({}),
  matched: z.array(z.string()).default([]), missing: z.array(z.string()).default([]),
  reasoning: z.string().default(""),
  llm_ok: z.boolean().optional(), capped: z.boolean().optional(),
  n_dropped: z.number().optional(), n_claimed: z.number().optional(),
  lex_hits: z.unknown().optional(), years: z.unknown().optional(), years_src: z.unknown().optional(),
  site: z.object({ id: z.string(), company: z.string().nullish(), open: z.boolean(), applied: z.boolean() }).optional(),
  rank: z.number().optional(), vs_next: z.unknown().optional(), vs_prev: z.unknown().optional(),
});
export const ProfileSchema = z.object({
  target_title: s, summary: s, skills: z.array(z.string()).default([]),
  years_experience: z.number().nullish(), education: z.array(z.string()).default([]),
  experiences: z.array(z.object({ title: z.string().nullish(), company: z.string().nullish(), duration: z.string().nullish() }).passthrough()).default([]),
});
// `paths` (server file paths) is intentionally NOT declared: zod strips it.
export const ReportSchema = z.object({
  cv_id: z.string(), lang: z.string().optional(), generated_at: z.string().optional(),
  profile: ProfileSchema, years: z.unknown().optional(), query: z.string().optional(),
  grader_accepted: z.boolean().optional(), iterations: z.number().optional(), pool_size: z.number().optional(),
  top: z.array(JobSchema), weights: z.record(z.number()).optional(), model: z.string().optional(),
  confidence: z.enum(["low", "high"]).optional(), conf_reasons: z.array(z.string()).default([]),
  summary: z.string().default(""), seconds: z.number().optional(),
  input_type: z.string().optional(), asr_model: z.string().optional(), transcript: z.string().nullish(),
});
export type Report = z.infer<typeof ReportSchema>;
export type Job = z.infer<typeof JobSchema>;

export type ResultEnvelope =
  | { status: "running"; mock?: boolean }
  | { status: "done"; mock?: boolean; report: Report | null; html?: string; schemaIssue?: string }
  | { status: "error"; error: string; mock?: boolean };

export const COMPONENT_LABELS: Record<string, string> = {
  title: "Job-title proximity", skills_llm: "Skills coverage", experience: "Experience level",
  retrieval: "Search relevance", skills_lex: "Keyword overlap", education: "Education level",
};
export const REASON_LABELS: Record<string, string> = {
  r_grader: "The search query was never fully validated by the relevance grader.",
  r_score: "The best match scored below 50/100.",
  r_parse: "The profile could not be extracted cleanly from the input.",
  r_llm: "At least one job was scored without the language-model assessment.",
};
export function scoreLabel(n: number) {
  return n >= 75 ? "Very good fit" : n >= 60 ? "Good fit" : n >= 45 ? "Partial fit" : "Weak fit";
}
