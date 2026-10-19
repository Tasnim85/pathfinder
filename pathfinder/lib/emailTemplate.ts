// Branded "you are preselected" email. Table layout + inline CSS (email clients ignore stylesheets).
// No imports on purpose, so it can also be rendered by scripts/mailpreview.mjs.
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export const LOGO_CID = "pathfinder-logo";

export type PreselectedData = { name: string; jobTitle: string; company: string; location?: string | null; type?: string | null; appUrl?: string; logoSrc?: string };

export function preselectedEmail(d: PreselectedData) {
  const first = d.name.trim().split(/\s+/)[0] || d.name;
  const logo = d.logoSrc || `cid:${LOGO_CID}`;
  const meta = [d.location, d.type].filter(Boolean).join("  ·  ");
  const url = d.appUrl ? d.appUrl.replace(/\/$/, "") + "/applications" : "";
  const subject = `You are preselected for ${d.jobTitle} at ${d.company}`;
  const text = [`Hello ${first},`, "", `Good news: ${d.company} has preselected you for the position "${d.jobTitle}".`, "The team will contact you soon, at this email address.", "", ...(url ? [`Follow your application: ${url}`, ""] : []), "Congratulations, and good luck!", "The PathFinder team", "", "You received this email because you applied through PathFinder."].join("\n");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#EEF3FC;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#EEF3FC;">${esc(d.company)} has preselected you for ${esc(d.jobTitle)}. The team will contact you soon.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#EEF3FC"><tr><td align="center" style="padding:28px 12px;">
 <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #DDE5F7;border-radius:16px;overflow:hidden;font-family:Inter,'Segoe UI',Helvetica,Arial,sans-serif;color:#1B1F5E;">
  <tr><td style="padding:0;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;"><tr><td width="34%" height="5" bgcolor="#38D3F0" style="background:#38D3F0;height:5px;line-height:5px;font-size:1px;">&nbsp;</td><td width="33%" height="5" bgcolor="#2F6FDB" style="background:#2F6FDB;height:5px;line-height:5px;font-size:1px;">&nbsp;</td><td width="33%" height="5" bgcolor="#8B6CF0" style="background:#8B6CF0;height:5px;line-height:5px;font-size:1px;">&nbsp;</td></tr></table></td></tr>
  <tr><td align="center" style="padding:30px 32px 6px;text-align:center;">
    <img src="${logo}" width="110" height="96" alt="PathFinder" style="display:block;border:0;outline:none;width:110px;height:auto;margin:0 auto;"><!--[if mso]><![endif]-->
    <div style="font-size:24px;font-weight:800;letter-spacing:-0.3px;color:#1B1F5E;padding-top:10px;">PathFinder</div>
    <div style="font-size:13px;color:#5B6490;padding-top:2px;">Finding the right career path</div></td></tr>
  <tr><td style="padding:22px 36px 4px;">
    <div style="font-size:26px;line-height:1.25;font-weight:800;letter-spacing:-0.4px;color:#1B1F5E;">Congratulations ${esc(first)}, you are preselected!</div>
    <p style="margin:14px 0 0;font-size:16px;line-height:1.6;color:#1B1F5E;"><strong>${esc(d.company)}</strong> reviewed your application and would like to take it further. Your profile has been preselected for this position:</p></td></tr>
  <tr><td style="padding:18px 36px 4px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#F5F8FF" style="background:#F5F8FF;border:1px solid #DDE5F7;border-left:4px solid #2F6FDB;border-radius:10px;"><tr><td style="padding:16px 18px;">
    <div style="font-size:18px;font-weight:700;color:#1B1F5E;line-height:1.3;">${esc(d.jobTitle)}</div>
    <div style="font-size:14px;color:#5B6490;padding-top:4px;">${esc(d.company)}${meta ? `  ·  ${esc(meta)}` : ""}</div></td></tr></table></td></tr>
  <tr><td style="padding:18px 36px 0;"><p style="margin:0;font-size:16px;line-height:1.6;color:#1B1F5E;"><strong>What happens next?</strong><br>The team will contact you soon, directly at this email address. There is nothing else you need to do for now.</p></td></tr>
  ${url ? `<tr><td align="center" style="padding:26px 36px 4px;text-align:center;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" bgcolor="#2F6FDB" style="background:#2F6FDB;border-radius:12px;"><a href="${esc(url)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">View my applications</a></td></tr></table></td></tr>` : ""}
  <tr><td style="padding:26px 36px 30px;"><p style="margin:0;font-size:15px;line-height:1.6;color:#1B1F5E;">Congratulations, and good luck!<br><span style="color:#5B6490;">The PathFinder team</span></p></td></tr>
  <tr><td bgcolor="#F5F8FF" style="background:#F5F8FF;border-top:1px solid #DDE5F7;padding:16px 36px;font-size:12px;line-height:1.5;color:#5B6490;">You received this email because you applied to a job through PathFinder. A preselection is not a final offer: the recruiter makes the final decision.</td></tr>
 </table></td></tr></table></body></html>`;
  return { subject, text, html };
}
