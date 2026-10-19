"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
// Red "Sign out" entry + a confirmation dialog (native <dialog>: focus is trapped, Esc closes it).
export function SignOutButton() {
  const ref = useRef<HTMLDialogElement>(null), router = useRouter(), [busy, setBusy] = useState(false);
  async function confirm() { setBusy(true); await fetch("/api/auth/logout", { method: "POST" }); router.push("/"); router.refresh(); }
  return (<>
    <button onClick={() => ref.current?.showModal()} className="flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-bad hover:bg-bad/10 md:mt-auto"><LogOut size={18} />Sign out</button>
    <dialog ref={ref} aria-labelledby="so-title" onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }} className="rounded-2xl border border-line bg-white p-0 shadow-xl backdrop:bg-black/40">
      <div className="w-[min(90vw,23rem)] p-6">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-bad/10 text-bad"><LogOut size={20} /></div>
        <h2 id="so-title" className="mt-4 text-lg font-bold">Sign out?</h2>
        <p className="mt-1 text-sm text-muted">You will need to sign in again to access your account.</p>
        <div className="mt-6 flex justify-end gap-2">
          <button autoFocus onClick={() => ref.current?.close()} className="btn btn-ghost !py-2 text-sm">Cancel</button>
          <button onClick={confirm} disabled={busy} className="btn !py-2 text-sm bg-bad text-white hover:opacity-90">{busy && <Loader2 className="animate-spin" size={14} />}Sign out</button>
        </div></div></dialog>
  </>);
}
