import type { ReactNode } from "react";

import { PageActions } from "@/components/layout/page-layout";

export type PageToolbarProps = {
  /** Left: search, filters, view toggles, status chips */
  start?: ReactNode;
  /** Right: primary/secondary page actions */
  end?: ReactNode;
  className?: string;
};

/**
 * Page-level toolbar (not Platform Topbar / DS-SHELL-02).
 * Functional controls for the current page — no page title/description.
 * Contract: `DS-PAGE-02` (`docs/design-system/shell-page-header-standardization.md`).
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
      data-page-toolbar
      className={[
        "border-b border-portal-border bg-portal-surface px-portal-4 py-portal-3 sm:px-portal-6",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex min-w-0 flex-col gap-portal-3 sm:flex-row sm:items-center sm:justify-between sm:gap-portal-4">
        <div className="flex min-w-0 w-full flex-1 flex-col items-stretch gap-portal-2 md:flex-row md:flex-wrap md:items-center">
          {start}
        </div>

        {end ? (
          <PageActions align="end" className="w-full sm:w-auto sm:shrink-0 [&>*]:w-full sm:[&>*]:w-auto">
            {end}
          </PageActions>
        ) : null}
      </div>
    </div>
  );
}

type PageHeaderProps = {
  /** @deprecated Ignored — titles belong in page body / EntityHeader if needed */
  title?: string;
  /** @deprecated Ignored */
  description?: string;
  /** @deprecated Prefer `end` on PageToolbar */
  actions?: ReactNode;
  start?: ReactNode;
  end?: ReactNode;
  /** @deprecated Ignored — toolbar padding is fixed by DS-PAGE-02 */
  size?: "compact" | "default" | "spacious";
  className?: string;
};

/**
 * @deprecated Use `PageToolbar`. Kept as a compatibility alias for roadmap name `PageHeader`.
 */
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
