import Link from "next/link";
import { Mic, FileText, Search, ShieldCheck, Gauge, Languages } from "lucide-react";
import { Nav, Logo } from "@/components/Brand";
import { ScoreRing } from "@/components/ScoreRing";

const agents = [
  ["Parser", "Reads your CV or transcript and builds a structured profile: title, years, education, skills, past roles."],
  ["Query Builder", "Turns that profile into a short search query for the job index."],
  ["Retriever", "Searches 2,954 job offers with embeddings and keywords, then reranks the best passages."],
  ["Relevance Grader", "Checks the results are the right profession. If not, it sends its reasons back and the query is rewritten (up to 3 times)."],
  ["Scoring Agent", "Scores each job out of 100 from six signals, then the code verifies every claim the language model makes."],
];
export default function Home() {
  return (<>
    <Nav />
    <main>
      <section className="hex relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-[1.1fr_.9fr] md:py-24">
          <div>
            <h1 className="text-4xl font-extrabold leading-[1.08] md:text-6xl">Stop searching. Start with the jobs that fit you.</h1>
            <p className="mt-5 max-w-xl text-lg text-muted">Upload your CV or just talk about your background. Five AI agents read it, search the job offers and rank the best ones, with a score out of 100 and the reasons behind it.</p>
            <div className="mt-8 flex flex-wrap gap-3"><Link href="/signup" className="btn btn-primary">Find your next opportunity</Link><Link href="/signup" className="btn btn-ghost">Hire smarter</Link></div>
            <p className="mt-4 text-sm text-muted">Free account required. English CVs and recordings; reports are written in French.</p>
          </div>
          <div className="card p-5 shadow-soft" aria-label="Example of a result">
            <p className="mb-3 text-xs text-muted">Example result (demo data)</p>
            {[["Senior Python Backend Developer", 81, "Python, PostgreSQL, Docker"], ["Full Stack Engineer", 63, "PostgreSQL, REST APIs"]].map(([t, s, m]) => (
              <div key={t as string} className="mb-3 flex items-center gap-4 rounded-xl border border-line bg-bg/60 p-3"><ScoreRing score={s as number} size={64} />
                <div><div className="font-semibold leading-snug">{t}</div><div className="mt-0.5 text-sm text-muted">Shared: {m}</div></div></div>))}
            <p className="text-sm text-muted">Every match lists the skills you share and the requirements still missing.</p>
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="max-w-2xl text-3xl font-bold md:text-4xl">Give it a CV or your voice. Get a ranked shortlist.</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[[FileText, "Upload a PDF", "Text-based CVs up to 10 MB. We extract the text and let you review it before analysis."], [Mic, "Or record yourself", "A short spoken introduction is transcribed with Whisper. Fix any word it misheard before continuing."], [Search, "Read your matches", "Top jobs with shared skills, missing requirements, and how each score was built."]].map(([I, t, d], i) => { const Icon = I as typeof Mic; return (
            <div key={i} className="card p-6"><Icon className="text-primary" /><h3 className="mt-4 text-lg font-bold">{t as string}</h3><p className="mt-1.5 text-muted">{d as string}</p></div>); })}
        </div>
      </section>

      <section id="agents" className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="max-w-2xl text-3xl font-bold md:text-4xl">Five agents, one loop that corrects itself.</h2>
          <p className="mt-3 max-w-2xl text-muted">This is the pipeline running behind every analysis. A full run takes a few minutes.</p>
          <ol className="relative mt-10 space-y-6 border-l-2 border-dashed border-primary/30 pl-8">
            {agents.map(([n, d]) => (<li key={n} className="relative"><span className="absolute -left-[41px] top-1 h-4 w-4 rounded-full border-[3px] border-primary bg-white" /><h3 className="font-bold">{n}</h3><p className="max-w-2xl text-muted">{d}</p></li>))}
            <li className="relative"><span className="absolute -left-[41px] top-1 h-4 w-4 rounded-full bg-primary" /><h3 className="font-bold">Report</h3><p className="max-w-2xl text-muted">A written summary plus a ranked list, with the reasons for every rank.</p></li>
          </ol>
        </div>
      </section>

      <section id="honest" className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="max-w-2xl text-3xl font-bold md:text-4xl">What it does well, and where it doesn&apos;t.</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {[[ShieldCheck, "Claims are checked", "If the model says you share a skill, the code confirms it appears in both your profile and the job. Unverified claims are dropped."], [Gauge, "Scores are indicative", "Weights and the 75 / 60 / 45 thresholds were chosen by reasoning and have not been calibrated."], [Languages, "Known limits", "English inputs only. Design and Arts roles match poorly because the job index has few such offers. Jobs come from a research dataset, not live listings."]].map(([I, t, d], i) => { const Icon = I as typeof Mic; return (
            <div key={i} className="card p-6"><Icon className="text-violet" /><h3 className="mt-4 text-lg font-bold">{t as string}</h3><p className="mt-1.5 text-muted">{d as string}</p></div>); })}
        </div>
      </section>

      <section id="recruiters" className="mx-auto max-w-6xl px-5 pb-16">
        <div className="card flex flex-col items-start justify-between gap-5 p-8 md:flex-row md:items-center">
          <div><h2 className="text-2xl font-bold">For recruiters</h2><p className="mt-1.5 max-w-xl text-muted">Publish your offers, receive applications with each candidate&apos;s profile, and preselect or decline them. Candidates you accept are notified by email. You always make the final decision.</p></div>
          <Link href="/signup" className="btn btn-primary shrink-0">Create a recruiter account</Link>
        </div>
      </section>

      <section className="px-5 pb-20"><div className="mx-auto max-w-6xl rounded-3xl p-10 text-center text-white md:p-14" style={{ background: "var(--grad)" }}>
        <h2 className="text-3xl font-bold md:text-4xl">Ready to see where you fit?</h2><p className="mx-auto mt-3 max-w-lg opacity-90">It takes one file or one minute of speaking.</p>
        <Link href="/signup" className="btn mt-7 bg-white text-ink">Create your free account</Link></div></section>
    </main>
    <footer className="border-t border-line bg-white"><div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-5 py-8 text-sm text-muted md:flex-row md:items-center"><Logo size={30} /><p>Finding the right career path. This app stores accounts, jobs and applications. Text and audio you analyse are forwarded to the analysis service, which keeps results in memory and saves audio and reports on its own server.</p></div></footer>
  </>);
}
