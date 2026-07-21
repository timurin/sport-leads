import type { ReactNode } from "react";

import { PageActions } from "@/components/layout/page-layout";

type PageToolbarProps = {
  /** Left side: search, filters, view toggles */
  start?: ReactNode;
  /** Right side: primary/secondary actions (add, delete, …) */
  end?: ReactNode;
  className?: string;
};

/**
 * Page-level toolbar (not Platform Topbar).
 * Holds functional controls for the current page — no page title/description.
 */
export function PageToolbar({
  start,
  end,
  className = "",
}: PageToolbarProps) {
  if (!start && !end) {
    return null;
  }

  return (
    <div
      className={[
        "border-b border-portal-border bg-portal-surface px-4 py-3 sm:px-6",
        className,
      ].join(" ")}
    >
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {start}
        </div>

        {end ? (
          <PageActions align="end" className="sm:shrink-0">
            {end}
          </PageActions>
        ) : null}
      </div>
    </div>
  );
}

type PageHeaderProps = {
  /** @deprecated Ignored — titles belong on the page body if needed */
  title?: string;
  /** @deprecated Ignored */
  description?: string;
  /** @deprecated Prefer `end` on PageToolbar */
  actions?: ReactNode;
  start?: ReactNode;
  end?: ReactNode;
  size?: "compact" | "default" | "spacious";
  className?: string;
};

/** @deprecated Use `PageToolbar` — title/description removed by product request. */
export function PageHeader({
  actions,
  start,
  end,
  className,
}: PageHeaderProps) {
  return (
    <PageToolbar
      start={start}
      end={end ?? actions}
      className={className}
    />
  );
}
