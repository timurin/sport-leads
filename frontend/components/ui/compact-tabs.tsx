"use client";

export type CompactTabItem = { id: string; label: string; count?: number };

export function CompactTabs({ items, value, onChange, label, size = "default", className = "" }: {
  items: readonly CompactTabItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  size?: "compact" | "default";
  className?: string;
}) {
  return <div className={`flex max-w-full gap-1 overflow-x-auto ${className}`} role="tablist" aria-label={label}>{items.map((item) => <button key={item.id} type="button" role="tab" aria-selected={value === item.id} onClick={() => onChange(item.id)} className={`shrink-0 rounded-[var(--portal-radius-md)] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${size === "compact" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm"} ${value === item.id ? "bg-portal-primary text-white" : "bg-portal-surface-secondary text-slate-600 hover:bg-slate-200"}`}>{item.label}{item.count === undefined ? null : <span className="ml-1 opacity-75">{item.count}</span>}</button>)}</div>;
}
