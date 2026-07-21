import type { ReactNode } from "react";

/** Page density → outer padding on `PageContent`. */
export type PageDensity = "compact" | "default" | "spacious";

/** Max-width variant on `PageContent` (never a fixed page width). */
export type PageContentWidth = "default" | "wide" | "full";

type ClassNameProps = {
  className?: string;
};

/**
 * Page shell root inside AppShell `[data-app-shell-main]`.
 * Horizontal frame only — no `h-screen` / page-level `overflow-y-auto`.
 *
 * Canonical composition:
 * `AppShell` → `PageLayout` → (`PageToolbar`) → `PageContent` → body
 */
export function PageLayout({
  children,
  className = "",
}: {
  children: ReactNode;
} & ClassNameProps) {
  return (
    <div data-page-layout className={`min-w-0 w-full ${className}`}>
      {children}
    </div>
  );
}

const PAGE_CONTENT_PADDING: Record<PageDensity, string> = {
  compact: "p-portal-3 sm:p-portal-4",
  default: "p-portal-4 lg:p-portal-6",
  spacious: "p-portal-5 lg:p-portal-8",
};

const PAGE_CONTENT_MAX_WIDTH: Record<PageContentWidth, string> = {
  default: "max-w-portal-default",
  wide: "max-w-portal-max",
  full: "max-w-none",
};

/**
 * Primary page body container: width + outer padding.
 * Defaults: `size="default"`, `width="wide"` (platform catalog/list pages).
 */
export function PageContent({
  children,
  className = "",
  size = "default",
  width = "wide",
}: {
  children: ReactNode;
  size?: PageDensity;
  width?: PageContentWidth;
} & ClassNameProps) {
  return (
    <div
      data-page-content
      data-page-content-size={size}
      data-page-content-width={width}
      className={`mx-auto w-full min-w-0 ${PAGE_CONTENT_MAX_WIDTH[width]} ${PAGE_CONTENT_PADDING[size]} ${className}`}
    >
      {children}
    </div>
  );
}

/** Action-row alignment for `PageActions` (`DS-PAGE-03`). */
export type PageActionsAlign = "start" | "end" | "between";

/**
 * Wrappable page/section action group.
 * Prefer `CreateMenu` for multi-entity create; `ActionMenu` for overflow icon menus.
 * Contract: `DS-PAGE-03`.
 */
export function PageActions({
  children,
  className = "",
  align = "end",
}: {
  children: ReactNode;
  align?: PageActionsAlign;
} & ClassNameProps) {
  const alignment = {
    start: "justify-start",
    end: "justify-start sm:justify-end",
    between: "justify-start sm:justify-between",
  }[align];

  return (
    <div
      data-page-actions
      data-page-actions-align={align}
      className={`flex min-w-0 flex-wrap items-center gap-portal-2 ${alignment} ${className}`}
    >
      {children}
    </div>
  );
}

export function ResponsiveGrid({
  children,
  className = "",
  minItemWidth = "medium",
  gap = "default",
}: {
  children: ReactNode;
  minItemWidth?: "small" | "medium" | "large";
  gap?: PageDensity;
} & ClassNameProps) {
  const widthClass = {
    small: "portal-grid-small",
    medium: "portal-grid-medium",
    large: "portal-grid-large",
  }[minItemWidth];
  const gapClass = {
    compact: "gap-portal-2",
    default: "gap-portal-3",
    spacious: "gap-portal-4 lg:gap-portal-6",
  }[gap];

  return (
    <div
      data-responsive-grid
      className={`grid min-w-0 ${widthClass} ${gapClass} ${className}`}
    >
      {children}
    </div>
  );
}
