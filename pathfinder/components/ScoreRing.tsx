import { scoreLabel } from "@/lib/schemas";
export function ScoreRing({ score, size = 84 }: { score: number; size?: number }) {
  const r = size / 2 - 7, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, score));
  return (<div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`Score ${v.toFixed(0)} out of 100, ${scoreLabel(v)}`}>
    <svg width={size} height={size} className="-rotate-90"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stopColor="#38D3F0" /><stop offset=".55" stopColor="#2F6FDB" /><stop offset="1" stopColor="#8B6CF0" /></linearGradient></defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E6ECFB" strokeWidth="7" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#g)" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} /></svg>
    <div className="absolute inset-0 grid place-items-center text-center"><div><div className="font-display text-xl font-extrabold leading-none">{v.toFixed(0)}</div><div className="text-[10px] text-muted">/ 100</div></div></div>
  </div>);
}
