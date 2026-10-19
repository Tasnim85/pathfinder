import { z } from "zod";
const t = (max: number) => z.string().trim().max(max);
export const SignupSchema = z.object({
  name: t(80).min(2, "Enter your name."), email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(120),
  password: z.string().min(8, "Password must be at least 8 characters.").max(100),
  role: z.enum(["candidate", "recruiter"]), company: t(100).optional(),
}).refine((d) => d.role !== "recruiter" || !!d.company, { message: "Enter your company name.", path: ["company"] });
export const LoginSchema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address."), password: z.string().min(1, "Enter your password.") });
export const JobSchema = z.object({
  title: t(120).min(3, "The title is too short."), location: t(120).optional().default(""),
  employment_type: z.enum(["Full-time", "Part-time", "Contract", "Internship", "Temporary"]).optional(),
  required_experience: t(80).optional().default(""), required_education: t(80).optional().default(""),
  description: t(8000).min(30, "Describe the job (at least 30 characters)."), requirements: t(8000).optional().default(""),
  status: z.enum(["open", "closed"]).default("open"),
});
export const ProfileSchema = z.object({
  headline: t(120).optional().default(""), summary: t(3000).optional().default(""),
  skills: z.array(t(40).min(1)).max(40).default([]), years: z.number().int().min(0).max(60).nullable().optional(),
  education: t(300).optional().default(""), cv_text: t(40000).optional().default(""),
});
export const DecisionSchema = z.object({ status: z.enum(["accepted", "rejected"]) });
