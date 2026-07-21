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
  return (
    <div className={`flex max-w-full gap-1 overflow-x-auto ${className}`} role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={value === item.id}
          onClick={() => onChange(item.id)}
          className={`shrink-0 rounded-portal-md font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-focus-ring ${size === "compact" ? "px-2.5 py-1.5 text-portal-caption" : "px-3 py-2 text-portal-body"} ${value === item.id ? "bg-portal-primary text-portal-primary-on" : "bg-portal-surface-secondary text-portal-muted hover:bg-portal-primary-soft hover:text-portal-text"}`}
        >
          {item.label}
          {item.count === undefined ? null : (
            <span className="ml-1 opacity-75">{item.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
