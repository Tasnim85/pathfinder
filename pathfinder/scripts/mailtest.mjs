// Checks your email settings WITHOUT the website.   npm run mailtest -- you@gmail.com
import fs from "node:fs"; import nodemailer from "nodemailer";
const env = {};
for (const f of [".env", ".env.local"]) if (fs.existsSync(f)) for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/); if (m && !l.trim().startsWith("#")) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const to = process.argv.slice(2).find((a) => a.includes("@")) || env.SMTP_USER;
console.log("Settings read from .env.local:");
for (const k of ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "MAIL_FROM"]) console.log(`  ${k} = ${env[k] || "(EMPTY)"}`);
console.log(`  SMTP_PASS = ${env.SMTP_PASS ? env.SMTP_PASS.replace(/\s+/g, "").length + " characters" : "(EMPTY)"}  (a Gmail app password has 16)`);
if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) { console.log("\nPROBLEM: SMTP_HOST, SMTP_USER or SMTP_PASS is empty. Edit .env.local, save it, and run this again."); process.exit(1); }
const port = Number(env.SMTP_PORT || 587);
const t = nodemailer.createTransport({ host: env.SMTP_HOST, port, secure: port === 465, auth: { user: env.SMTP_USER, pass: env.SMTP_PASS.replace(/\s+/g, "") } });
try { await t.verify(); console.log("\nOK: connected and logged in to the mail server."); }
catch (e) {
  console.log(`\nFAILED to log in: ${e.code || ""} ${e.message}`);
  if (e.code === "EAUTH") console.log("→ Wrong login. For Gmail: use an APP PASSWORD (not your normal password) from myaccount.google.com/apppasswords, with 2-step verification ON; SMTP_USER must be the full Gmail address.");
  else if (["ETIMEDOUT", "ECONNECTION", "ESOCKET", "ECONNREFUSED"].includes(e.code)) console.log("→ Cannot reach the server: check SMTP_HOST/SMTP_PORT (Gmail: smtp.gmail.com, 587), your internet, or an antivirus/firewall blocking port 587. Try 465.");
  process.exit(1);
}
try {
  const info = await t.sendMail({ from: env.MAIL_FROM || env.SMTP_USER, to, subject: "PathFinder test email", text: "If you read this, your email settings work." });
  console.log(`Test email sent to ${to}. Accepted: ${JSON.stringify(info.accepted)}  Rejected: ${JSON.stringify(info.rejected)}\nCheck the inbox AND the spam folder.`);
} catch (e) { console.log(`FAILED to send: ${e.code || ""} ${e.message}`); process.exit(1); }
