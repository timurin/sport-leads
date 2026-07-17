import type { ReactNode } from "react";

export function EmptyState({ title, description, icon, action, size = "default", className = "" }: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  size?: "compact" | "default";
  className?: string;
}) {
  return <div className={`flex min-w-0 flex-col items-center justify-center rounded-[var(--portal-radius-md)] border border-dashed border-portal-border bg-portal-surface-secondary text-center ${size === "compact" ? "px-4 py-6" : "px-5 py-10"} ${className}`}>{icon ? <div className="mb-3 text-portal-muted">{icon}</div> : null}<p className="text-sm font-semibold text-portal-text">{title}</p>{description ? <p className="mt-1 max-w-lg text-sm leading-5 text-portal-muted">{description}</p> : null}{action ? <div className="mt-4">{action}</div> : null}</div>;
}
