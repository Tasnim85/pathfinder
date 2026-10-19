import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {
    colors: { ink: "var(--ink)", primary: "var(--primary)", cyan: "var(--cyan)", violet: "var(--violet)",
      bg: "var(--bg)", line: "var(--line)", muted: "var(--muted)", ok: "var(--ok)", warn: "var(--warn)", bad: "var(--bad)" },
    fontFamily: { display: ["var(--font-display)"], sans: ["var(--font-body)"] },
    boxShadow: { soft: "0 1px 2px rgba(27,31,94,.06), 0 8px 24px -12px rgba(59,130,230,.25)" },
  } }, plugins: [],
} satisfies Config;
