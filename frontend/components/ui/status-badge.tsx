import type { ReactNode } from "react";

export type StatusBadgeTone = "neutral" | "primary" | "success" | "warning" | "danger";

export function StatusBadge({ children, tone = "neutral", size = "default", dot = false, className = "" }: {
  children: ReactNode;
  tone?: StatusBadgeTone;
  size?: "compact" | "default";
  dot?: boolean;
  className?: string;
}) {
  const tones = {
    neutral: "bg-portal-surface-secondary text-portal-text ring-portal-border",
    primary: "bg-portal-primary-soft text-portal-primary-hover ring-portal-primary/20",
    success: "bg-portal-success-soft text-portal-success ring-portal-success/20",
    warning: "bg-portal-warning-soft text-portal-warning ring-portal-warning/20",
    danger: "bg-portal-danger-soft text-portal-danger ring-portal-danger/20",
  }[tone];
  const sizes = {
    compact: "px-portal-2 py-0.5 text-portal-caption",
    default: "px-2.5 py-1 text-portal-meta",
  }[size];
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-portal-full font-semibold ring-1 ${tones} ${sizes} ${className}`}
    >
      {dot ? (
        <span
          className="mr-1.5 size-1.5 shrink-0 rounded-portal-full bg-current"
          aria-hidden="true"
        />
      ) : null}
      <span className="truncate">{children}</span>
    </span>
  );
}
