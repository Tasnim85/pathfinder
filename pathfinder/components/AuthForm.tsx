"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Loader2, UserRound, Building2 } from "lucide-react";
import ReCAPTCHA from "react-google-recaptcha";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [role, setRole] = useState<"candidate" | "recruiter">("candidate");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");

    if (!captchaToken) {
      return setErr("Please complete the reCAPTCHA verification.");
    }

    setBusy(true);

    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const bodyPayload = {
      ...(mode === "signup" ? { ...f, role } : f),
      recaptchaToken: captchaToken,
    };

    const r = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyPayload),
    });

    const d = await r.json().catch(() => ({}));
    setBusy(false);

    if (!r.ok) {
      recaptchaRef.current?.reset();
      setCaptchaToken(null);
      return setErr(d.error || "Something went wrong.");
    }

    router.push(next && next.startsWith("/") ? next : d.role === "recruiter" ? "/recruiter" : "/jobs");
    router.refresh();
  }

  function handleGoogleAuth() {
    const googleUrl = `/api/auth/google${mode === "signup" ? `?role=${role}` : ""}`;
    window.location.href = googleUrl;
  }

  const inp = "w-full rounded-xl border border-line bg-white px-3 py-2.5";
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";

  return (
    <div className="card mx-auto w-full max-w-md p-7 shadow-soft">
      <h1 className="text-2xl font-extrabold">
        {mode === "login" ? "Welcome back" : "Create your account"}
      </h1>

      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        {mode === "signup" && (
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold">I am a…</legend>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["candidate", "Candidate", UserRound],
                  ["recruiter", "Recruiter", Building2],
                ] as const
              ).map(([k, l, Icon]) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => setRole(k)}
                  aria-pressed={role === k}
                  className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold ${
                    role === k
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-line text-muted"
                  }`}
                >
                  <Icon size={16} />
                  {l}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {mode === "signup" && (
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-semibold">
              Full name
            </label>
            <input id="name" name="name" autoComplete="name" className={inp} required />
          </div>
        )}

        {mode === "signup" && role === "recruiter" && (
          <div>
            <label htmlFor="company" className="mb-1 block text-sm font-semibold">
              Company
            </label>
            <input id="company" name="company" className={inp} />
          </div>
        )}

        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-semibold">
            Email
          </label>
          <input id="email" name="email" type="email" autoComplete="email" className={inp} required />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-semibold">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={show ? "text" : "password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className={inp + " pr-11"}
              required
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {mode === "signup" && (
            <p className="mt-1 text-xs text-muted">At least 8 characters.</p>
          )}
        </div>

        {/* Google reCAPTCHA v2 Widget (Rendered only on client) */}
        {isMounted && siteKey && (
          <div className="flex justify-center pt-2">
            <ReCAPTCHA
              ref={recaptchaRef}
              sitekey={siteKey}
              onChange={(token) => setCaptchaToken(token)}
              onExpired={() => setCaptchaToken(null)}
              hl="en"
            />
          </div>
        )}

        {err && (
          <p role="alert" className="rounded-lg bg-bad/10 p-3 text-sm text-bad">
            {err}
          </p>
        )}

        {/* Main Submit Button */}
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy && <Loader2 className="animate-spin" size={16} />}
          {mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>

      {/* Divider */}
      <div className="relative my-4 flex items-center justify-center">
        <div className="w-full border-t border-line" />
        <span className="absolute bg-white px-3 text-xs font-medium text-muted">
          or
        </span>
      </div>

      {/* Google Sign-In Button */}
      <button
        type="button"
        onClick={handleGoogleAuth}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-white py-2.5 font-semibold text-ink transition-colors hover:bg-slate-50"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        {mode === "login" ? "Sign in with Google" : "Sign up with Google"}
      </button>

      <p className="mt-4 text-center text-sm text-muted">
        {mode === "login" ? (
          <>
            No account?{" "}
            <Link className="font-semibold text-primary" href="/signup">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already registered?{" "}
            <Link className="font-semibold text-primary" href="/login">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}