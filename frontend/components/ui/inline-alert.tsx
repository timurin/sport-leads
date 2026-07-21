import type { ReactNode } from "react";

type InlineAlertTone = "neutral" | "success" | "warning" | "danger";

const toneClasses: Record<InlineAlertTone, string> = {
  neutral:
    "border-portal-border bg-portal-surface-secondary text-portal-text",
  success:
    "border-portal-success/30 bg-portal-success-soft text-portal-success",
  warning:
    "border-portal-warning/30 bg-portal-warning-soft text-portal-warning",
  danger:
    "border-portal-danger/30 bg-portal-danger-soft text-portal-danger",
};

type InlineAlertProps = {
  children: ReactNode;
  tone?: InlineAlertTone;
  action?: ReactNode;
  className?: string;
  /** denser banner for toolbar strips */
  size?: "compact" | "default";
};

/**
 * Persistent in-page feedback (`DS-FEEDBACK-01`).
 * Prefer toast for transient success; use InlineAlert for errors that need retry/context.
 */
export function InlineAlert({
  children,
  tone = "danger",
  action,
  className = "",
  size = "default",
}: InlineAlertProps) {
  return (
    <div
      role="alert"
      className={[
        "rounded-portal-md border text-portal-body font-medium",
        toneClasses[tone],
        size === "compact" ? "px-portal-4 py-portal-2" : "px-portal-4 py-portal-3",
        action ? "flex flex-wrap items-center justify-between gap-portal-3" : "",
        className,
      ].join(" ")}
    >
      <div className="min-w-0">{children}</div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
