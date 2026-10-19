"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Pause, Play, Square, RotateCcw } from "lucide-react";
type S = "idle" | "recording" | "paused" | "done";
export function Recorder({ onReady }: { onReady: (f: File | null) => void }) {
  const [s, setS] = useState<S>("idle"), [sec, setSec] = useState(0), [url, setUrl] = useState<string | null>(null), [err, setErr] = useState("");
  const rec = useRef<MediaRecorder | null>(null), chunks = useRef<Blob[]>([]), timer = useRef<ReturnType<typeof setInterval>>();
  useEffect(() => () => { clearInterval(timer.current); rec.current?.stream.getTracks().forEach((t) => t.stop()); }, []);
  const tick = () => { clearInterval(timer.current); timer.current = setInterval(() => setSec((x) => x + 1), 1000); };
  async function start() {
    setErr("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return setErr("Recording is not supported in this browser. Upload an audio file or a CV (PDF) instead.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream); chunks.current = [];
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.onstop = () => { stream.getTracks().forEach((t) => t.stop()); const b = new Blob(chunks.current, { type: mr.mimeType || "audio/webm" });
        setUrl(URL.createObjectURL(b)); onReady(new File([b], "recording.webm", { type: b.type })); setS("done"); };
      rec.current = mr; mr.start(); setSec(0); setS("recording"); tick();
    } catch (e) { setErr((e as DOMException).name === "NotAllowedError" ? "Microphone access was denied. Allow it in your browser's site settings, or upload an audio file instead." : "No microphone could be started. Upload an audio file instead."); }
  }
  const pause = () => { rec.current?.pause(); clearInterval(timer.current); setS("paused"); };
  const resume = () => { rec.current?.resume(); tick(); setS("recording"); };
  const stop = () => { clearInterval(timer.current); rec.current?.stop(); };
  const reset = () => { if (url) URL.revokeObjectURL(url); setUrl(null); setSec(0); setS("idle"); onReady(null); };
  const mm = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  return (<div className="rounded-2xl border border-dashed border-primary/40 bg-bg p-6 text-center">
    <div className={`mx-auto grid h-20 w-20 place-items-center rounded-full text-white ${s === "recording" ? "animate-pulse" : ""}`} style={{ background: "var(--grad)" }}><Mic size={30} /></div>
    <p className="mt-3 font-display text-3xl font-bold tabular-nums" aria-live="off">{mm}</p>
    <p className="text-sm text-muted">{s === "idle" ? "Introduce yourself: your job title, years of experience, skills and education. About 1 minute." : s === "recording" ? "Recording…" : s === "paused" ? "Paused" : "Listen back, then transcribe."}</p>
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      {s === "idle" && <button className="btn btn-primary" onClick={start}><Mic size={16} />Start recording</button>}
      {s === "recording" && <><button className="btn btn-ghost" onClick={pause}><Pause size={16} />Pause</button><button className="btn btn-primary" onClick={stop}><Square size={16} />Stop</button></>}
      {s === "paused" && <><button className="btn btn-ghost" onClick={resume}><Play size={16} />Resume</button><button className="btn btn-primary" onClick={stop}><Square size={16} />Stop</button></>}
      {s === "done" && <button className="btn btn-ghost" onClick={reset}><RotateCcw size={16} />Record again</button>}
    </div>
    {url && <audio src={url} controls className="mx-auto mt-4 w-full max-w-sm" />}
    {err && <p role="alert" className="mt-3 text-sm text-bad">{err}</p>}
  </div>);
}
