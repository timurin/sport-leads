import type { ReactNode } from "react";

type PortalSize = "compact" | "default" | "spacious";

export function PageContent({ children, className = "", size = "default", width = "wide" }: {
  children: ReactNode;
  className?: string;
  size?: PortalSize;
  width?: "default" | "wide" | "full";
}) {
  const spacing = {
    compact: "p-portal-3 sm:p-portal-4",
    default: "p-portal-4 lg:p-portal-6",
    spacious: "p-portal-5 lg:p-portal-8",
  }[size];
  const maxWidth = { default: "max-w-7xl", wide: "max-w-[var(--portal-content-max)]", full: "max-w-none" }[width];
  return <div className={`mx-auto w-full min-w-0 ${maxWidth} ${spacing} ${className}`}>{children}</div>;
}

export function PageActions({ children, className = "", align = "end" }: {
  children: ReactNode;
  className?: string;
  align?: "start" | "end" | "between";
}) {
  const alignment = { start: "justify-start", end: "justify-start sm:justify-end", between: "justify-start sm:justify-between" }[align];
  return <div className={`flex min-w-0 flex-wrap items-center gap-portal-2 ${alignment} ${className}`}>{children}</div>;
}

export function ResponsiveGrid({ children, className = "", minItemWidth = "medium", gap = "default" }: {
  children: ReactNode;
  className?: string;
  minItemWidth?: "small" | "medium" | "large";
  gap?: "compact" | "default" | "spacious";
}) {
  const widthClass = { small: "portal-grid-small", medium: "portal-grid-medium", large: "portal-grid-large" }[minItemWidth];
  const gapClass = {
    compact: "gap-portal-2",
    default: "gap-portal-3",
    spacious: "gap-portal-4 lg:gap-portal-6",
  }[gap];
  return <div className={`grid min-w-0 ${widthClass} ${gapClass} ${className}`}>{children}</div>;
}
