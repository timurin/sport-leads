"use client";

import type { ReactNode } from "react";

export type CompactTabItem = {
  id: string;
  label: string;
  count?: number;
  icon?: ReactNode;
};

export function CompactTabs({
  items,
  value,
  onChange,
  label,
  size = "default",
  wrap = false,
  iconOnly = false,
  variant = "default",
  className = "",
}: {
  items: readonly CompactTabItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  size?: "compact" | "default";
  /** Prefer wrapping over horizontal scroll (order aside tabs). */
  wrap?: boolean;
  /** Show icons instead of text labels (label stays as title/aria). */
  iconOnly?: boolean;
  /** Soft UI pill track (sales boards `22.3`). Default chrome unchanged. */
  variant?: "default" | "pills";
  className?: string;
}) {
  const pills = variant === "pills";
  return (
    <div
      className={[
        "flex max-w-full",
        pills ? "gap-1 rounded-full bg-portal-surface-secondary p-0.5" : "gap-1.5",
        wrap || pills ? "flex-wrap" : "overflow-x-auto",
        className,
      ].join(" ")}
      role="tablist"
      aria-label={label}
    >
      {items.map((item) => {
        const selected = value === item.id;
        const tip =
          item.count === undefined ? item.label : `${item.label} (${item.count})`;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-label={tip}
            title={tip}
            onClick={() => onChange(item.id)}
            className={[
              "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-focus-ring",
              pills
                ? "h-[30px] rounded-full px-3 text-sm"
                : "rounded-portal-md",
              pills
                ? undefined
                : iconOnly
                  ? size === "compact"
                    ? "size-9"
                    : "size-10"
                  : size === "compact"
                    ? "px-2.5 py-1.5 text-portal-caption"
                    : "px-3.5 py-2 text-sm",
              pills
                ? selected
                  ? "bg-white text-portal-primary shadow-sm"
                  : "bg-transparent text-portal-muted hover:text-portal-text"
                : selected
                  ? "bg-portal-primary text-portal-primary-on"
                  : "bg-portal-surface-secondary text-portal-muted hover:bg-portal-primary-soft hover:text-portal-text",
            ].filter(Boolean).join(" ")}
          >
            {item.icon ? (
              <span
                className="inline-flex size-4 shrink-0 items-center justify-center [&>svg]:size-4"
                aria-hidden="true"
              >
                {item.icon}
              </span>
            ) : null}
            {iconOnly ? null : (
              <>
                {item.label}
                {item.count === undefined ? null : (
                  <span className="opacity-75">{item.count}</span>
                )}
              </>
            )}
            {iconOnly && item.count !== undefined && item.count > 0 ? (
              <span
                className={[
                  "absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none",
                  selected
                    ? "bg-white text-portal-primary"
                    : "bg-portal-primary text-portal-primary-on",
                ].join(" ")}
                aria-hidden="true"
              >
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
