"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Mic, Upload, Loader2, ArrowRight } from "lucide-react";
import { Recorder } from "@/components/Recorder";

type Tab = "cv" | "voice";
const TABS: [Tab, string, typeof Mic][] = [["cv", "Upload CV", FileText], ["voice", "Speak", Mic]];
const wc = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

export default function Onboarding() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("cv");
  const [text, setText] = useState(""), [source, setSource] = useState<"cv" | "audio">("cv");
  const [busy, setBusy] = useState(""), [err, setErr] = useState(""), [consent, setConsent] = useState(false), [audio, setAudio] = useState<File | null>(null);
  const [svc, setSvc] = useState<string>("checking"), [mock, setMock] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null), audioRef = useRef<HTMLInputElement>(null);
  useEffect(() => { fetch("/api/health").then((r) => r.json()).then((d) => setSvc(d.state)).catch(() => setSvc("offline")); }, []);

  async function post(url: string, file: File, key: string) {
    const fd = new FormData(); fd.append("file", file);
    const r = await fetch(url, { method: "POST", body: fd }); const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || "Something went wrong."); if (d.mock) setMock(true); return d[key] as string;
  }
  async function run<T>(label: string, fn: () => Promise<T>) { setErr(""); setBusy(label); try { return await fn(); } catch (e) { setErr((e as Error).message); } finally { setBusy(""); } }
  const onPdf = (f?: File) => f && run("Reading your CV…", async () => { setText(await post("/api/extract", f, "text")); setSource("cv"); });
  const transcribe = (f: File) => run("Transcribing your voice… this can take a minute", async () => { setText(await post("/api/transcribe", f, "text")); setSource("audio"); });
  const analyze = () => run("Starting the analysis…", async () => {
    const r = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, input_type: source }) });
    const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || "The analysis could not start.");
    try { localStorage.setItem("pf_last", d.job_id); } catch {}
    router.push(`/matches/${d.job_id}`);
  });
  const reviewing = text.length > 0;
  const badge = { demo: ["Demo mode: results are sample data", "bg-violet/10 text-violet"], online: ["AI service online", "bg-ok/10 text-ok"], offline: ["AI service unreachable", "bg-bad/10 text-bad"], checking: ["Checking AI service…", "bg-line text-muted"] }[svc] ?? ["", ""];

  return (<main className="mx-auto max-w-3xl px-5 py-10">
    <h1 className="text-3xl font-extrabold md:text-4xl">Tell us about your background</h1>
    <p className="mt-2 text-muted">Choose how you want to share it. You will review the text before anything is analysed.</p>
    <span className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold ${badge[1]}`}>{badge[0]}</span>

    <ol className="mt-6 flex items-center gap-2 text-sm font-medium" aria-label="Progress">
      {["Share", "Review text", "Analysis", "Matches"].map((s, i) => { const cur = (reviewing ? 1 : 0); return (<li key={s} className="flex items-center gap-2"><span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${i <= cur ? "text-white" : "bg-line text-muted"}`} style={i <= cur ? { background: "var(--grad)" } : {}}>{i + 1}</span><span className={i <= cur ? "" : "text-muted"}>{s}</span>{i < 3 && <span className="h-px w-4 bg-line sm:w-8" />}</li>); })}
    </ol>

    <div className="card mt-6 p-6">
      <div role="tablist" className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-bg p-1">
        {TABS.map(([k, l, I]) => (<button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold ${tab === k ? "bg-white text-primary shadow-soft" : "text-muted"}`}><I size={16} />{l}</button>))}
      </div>

      {tab === "cv" && <div>
        <button onClick={() => fileRef.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-bg p-10 text-center hover:border-primary"><Upload className="text-primary" /><span className="font-semibold">Choose a PDF CV</span><span className="text-sm text-muted">Text-based PDF, up to 10 MB. Scanned images are not supported.</span></button>
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => onPdf(e.target.files?.[0])} /></div>}

      {tab === "voice" && <div className="space-y-4">
        <Recorder onReady={setAudio} />
        <div className="text-center text-sm text-muted">or <button className="font-semibold text-primary underline" onClick={() => audioRef.current?.click()}>upload an audio file</button> (mp3, wav, m4a, ogg, flac, webm)</div>
        <input ref={audioRef} type="file" accept="audio/*,.webm" className="sr-only" onChange={(e) => setAudio(e.target.files?.[0] ?? null)} />
        {audio && <><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span>I agree that my recording is sent to the analysis service to be transcribed. The transcription is in English.</span></label>
          <button className="btn btn-primary w-full" disabled={!consent || !!busy} onClick={() => transcribe(audio)}>Transcribe my recording</button></>}</div>}


      {busy && <p className="mt-4 flex items-center gap-2 text-sm text-primary" role="status"><Loader2 className="animate-spin" size={16} />{busy}</p>}
      {err && <p role="alert" className="mt-4 rounded-lg bg-bad/10 p-3 text-sm text-bad">{err}</p>}

      {reviewing && <div className="mt-6 border-t border-line pt-5">
        <label htmlFor="r" className="mb-1.5 block text-sm font-semibold">Review the text we will analyse {source === "audio" ? "(transcription of your recording)" : "(extracted from your PDF)"}</label>
        <p className="mb-2 text-sm text-muted">Fix misheard names or tools, and remove anything you don&apos;t want to share.</p>
        <textarea id="r" rows={9} className="w-full rounded-xl border border-line p-3 text-sm" value={text} onChange={(e) => setText(e.target.value)} /></div>}

      <div className="mt-5 flex items-center justify-between gap-3"><span className="text-sm text-muted">{wc(text)} words{wc(text) > 0 && wc(text) < 15 ? " · 15 minimum" : ""}</span>
        <button className="btn btn-primary" disabled={wc(text) < 15 || !!busy} onClick={analyze}>Find my matches<ArrowRight size={16} /></button></div>
    </div>
    <p className="mt-4 text-xs text-muted">An analysis takes a few minutes. You can keep this tab open; the page will show the result as soon as it is ready.</p>
  </main>);
}
