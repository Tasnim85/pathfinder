import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
export function Pager({ page, total, size, basePath, params }: { page: number; total: number; size: number; basePath: string; params: Record<string, string> }) {
  const pages = Math.max(1, Math.ceil(total / size)); if (pages <= 1) return null;
  const href = (p: number) => { const q = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).filter(([, v]) => v)), page: String(p) }); return `${basePath}?${q}`; };
  const cls = "btn btn-ghost !px-3 !py-1.5 text-sm", off = " pointer-events-none opacity-40";
  return (<nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-3">
    <Link href={href(page - 1)} aria-disabled={page <= 1} className={cls + (page <= 1 ? off : "")}><ChevronLeft size={14} />Previous</Link>
    <span className="text-sm text-muted">Page {page} of {pages} · {total} results</span>
    <Link href={href(page + 1)} aria-disabled={page >= pages} className={cls + (page >= pages ? off : "")}>Next<ChevronRight size={14} /></Link></nav>);
}
