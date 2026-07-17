import { Ellipsis } from "lucide-react";
import type { ReactNode } from "react";

export function ActionMenu({ children, label = "Открыть меню действий", align = "end", className = "" }: {
  children: ReactNode;
  label?: string;
  align?: "start" | "end";
  className?: string;
}) {
  return <details className={`relative ${className}`}><summary aria-label={label} className="flex size-8 cursor-pointer list-none items-center justify-center rounded-md text-portal-muted hover:bg-portal-surface-secondary hover:text-portal-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 [&::-webkit-details-marker]:hidden"><Ellipsis size={17} /></summary><div role="menu" className={`absolute z-50 mt-1 min-w-44 rounded-[var(--portal-radius-lg)] border border-portal-border bg-portal-surface p-1.5 shadow-[var(--portal-shadow-overlay)] ${align === "end" ? "right-0" : "left-0"}`}>{children}</div></details>;
}

export function ActionMenuItem({ children, tone = "default", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  tone?: "default" | "danger";
}) {
  return <button type="button" role="menuitem" {...props} className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${tone === "danger" ? "text-red-700 hover:bg-red-50" : "text-slate-700 hover:bg-slate-50"} ${className}`}>{children}</button>;
}
