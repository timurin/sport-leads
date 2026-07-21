import type { ReactNode } from "react";

type FilterToolbarProps = {
  children: ReactNode;
  className?: string;
  /** Accessible name for the filter group */
  label?: string;
  /** page strip (default) vs card-local filters */
  variant?: "strip" | "card";
};

/**
 * In-page filter row (`DS-FILTER-01`).
 * Prefer `Input`/`Select`/`Button` from form controls and actions.
 */
export function FilterToolbar({
  children,
  className = "",
  label = "Фильтры",
  variant = "strip",
}: FilterToolbarProps) {
  return (
    <div
      role="search"
      aria-label={label}
      className={[
        "flex flex-wrap items-center gap-portal-2",
        variant === "strip"
          ? "border-b border-portal-border bg-portal-surface px-portal-4 py-portal-3 lg:px-portal-6"
          : "rounded-portal-lg border border-portal-border bg-portal-surface p-portal-3 shadow-portal-card",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}
