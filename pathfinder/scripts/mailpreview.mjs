// Writes email-preview.html: open it in a browser to see the email without sending anything.   npm run mailpreview
import fs from "node:fs";
const { preselectedEmail } = await import("../lib/emailTemplate.ts");
const logo = "data:image/png;base64," + fs.readFileSync("public/logo-email.png").toString("base64");
const { html } = preselectedEmail({ name: "Sara Mansour", jobTitle: "Senior Python Backend Developer", company: "Acme Tech", location: "Tunis, Tunisia", type: "Full-time", appUrl: "https://pathfinder.example.com", logoSrc: logo });
fs.writeFileSync("email-preview.html", html); console.log("Wrote email-preview.html");
