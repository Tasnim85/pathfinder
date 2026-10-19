import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
type Tx = { transporter: Transporter; test: boolean };
let tx: Promise<Tx> | undefined;
async function transport(): Promise<Tx> {
  const host = process.env.SMTP_HOST?.trim();
  if (host) {
    const port = Number(process.env.SMTP_PORT || 587);
    console.log(`[mail] mode: REAL SMTP via ${host}:${port} as ${process.env.SMTP_USER || "(no user)"}`);
    return { test: false, transporter: nodemailer.createTransport({ host, port, secure: port === 465, auth: { user: process.env.SMTP_USER?.trim(), pass: process.env.SMTP_PASS?.replace(/\s+/g, "") } }) };
  }
  console.log("[mail] mode: TEST mailbox (SMTP_HOST is empty): emails are NOT delivered to real inboxes");
  const acc = await nodemailer.createTestAccount();           // free throw-away mailbox for development
  return { test: true, transporter: nodemailer.createTransport({ host: "smtp.ethereal.email", port: 587, auth: { user: acc.user, pass: acc.pass } }) };
}
export type MailResult = { ok: boolean; mode: "smtp" | "test"; previewUrl?: string; error?: string };
export async function sendMail(m: { to: string; subject: string; text: string; html: string; attachments?: { filename: string; path: string; cid: string }[] }): Promise<MailResult> {
  let test = !process.env.SMTP_HOST?.trim();
  try {
    const t = await (tx ??= transport()); test = t.test;
    const from = process.env.MAIL_FROM?.trim() || process.env.SMTP_USER?.trim() || "PathFinder <no-reply@pathfinder.local>";
    const info = await t.transporter.sendMail({ from, ...m });
    return { ok: true, mode: test ? "test" : "smtp", previewUrl: test ? (nodemailer.getTestMessageUrl(info) || undefined) : undefined };
  } catch (e) {
    console.error("[mail] failed:", e); tx = undefined;
    const err = e as { code?: string; message?: string };
    return { ok: false, mode: test ? "test" : "smtp", error: [err.code, (err.message || "").split("\n")[0]].filter(Boolean).join(": ").slice(0, 200) };
  }
}
