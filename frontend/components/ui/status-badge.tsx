import type { ReactNode } from "react";

export function StatusBadge({ children, tone = "neutral", size = "default", dot = false, className = "" }: {
  children: ReactNode;
  tone?: "neutral" | "primary" | "success" | "warning" | "danger";
  size?: "compact" | "default";
  dot?: boolean;
  className?: string;
}) {
  const tones = {
    neutral: "bg-slate-100 text-slate-700 ring-slate-200",
    primary: "bg-blue-50 text-blue-700 ring-blue-200",
    success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    warning: "bg-amber-50 text-amber-800 ring-amber-200",
    danger: "bg-red-50 text-red-700 ring-red-200",
  }[tone];
  const sizes = { compact: "px-2 py-0.5 text-[11px]", default: "px-2.5 py-1 text-xs" }[size];
  return <span className={`inline-flex max-w-full items-center rounded-full font-semibold ring-1 ${tones} ${sizes} ${className}`}>{dot ? <span className="mr-1.5 size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" /> : null}<span className="truncate">{children}</span></span>;
}
