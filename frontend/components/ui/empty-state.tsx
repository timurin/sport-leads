import type { ReactNode } from "react";

export function EmptyState({ title, description, icon, action, size = "default", className = "" }: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  size?: "compact" | "default";
  className?: string;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col items-center justify-center rounded-portal-md border border-dashed border-portal-border bg-portal-surface-secondary text-center ${size === "compact" ? "px-portal-4 py-portal-6" : "px-portal-5 py-portal-10"} ${className}`}
    >
      {icon ? <div className="mb-portal-3 text-portal-muted">{icon}</div> : null}
      <p className="text-portal-body font-semibold text-portal-text">{title}</p>
      {description ? (
        <p className="mt-1 max-w-lg text-portal-body leading-5 text-portal-muted">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-portal-4">{action}</div> : null}
    </div>
  );
}
