import type { ReactNode } from "react";

import { PageActions } from "@/components/layout/page-layout";

type CardSize = "compact" | "default" | "spacious";

export function SectionCard({ children, title, description, actions, footer, size = "default", className = "" }: {
  children: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  size?: CardSize;
  className?: string;
}) {
  const padding = { compact: "p-3", default: "p-4", spacious: "p-5 sm:p-6" }[size];
  return (
    <section className={`min-w-0 rounded-[var(--portal-radius-lg)] border border-portal-border bg-portal-surface shadow-[var(--portal-shadow-card)] ${className}`}>
      {title || description || actions ? <header className={`flex min-w-0 flex-col gap-3 border-b border-portal-border ${padding} sm:flex-row sm:items-start sm:justify-between`}><div className="min-w-0">{title ? <h2 className="font-semibold text-portal-text">{title}</h2> : null}{description ? <p className="mt-1 text-sm text-portal-muted">{description}</p> : null}</div>{actions ? <PageActions>{actions}</PageActions> : null}</header> : null}
      <div className={padding}>{children}</div>
      {footer ? <footer className={`border-t border-portal-border ${padding}`}>{footer}</footer> : null}
    </section>
  );
}

export function InfoCard({ label, value, detail, icon, className = "" }: {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return <article className={`flex min-w-0 gap-3 rounded-[var(--portal-radius-lg)] border border-portal-border bg-portal-surface p-3 shadow-[var(--portal-shadow-sm)] ${className}`}>{icon ? <span className="shrink-0 text-portal-muted">{icon}</span> : null}<div className="min-w-0"><p className="text-xs font-medium text-portal-muted">{label}</p><div className="mt-1 font-semibold text-portal-text">{value}</div>{detail ? <div className="mt-1 text-xs text-portal-muted">{detail}</div> : null}</div></article>;
}

export function MetricCard({ label, value, detail, tone = "default", size = "default", className = "" }: {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "default" | "primary" | "success" | "warning" | "danger";
  size?: CardSize;
  className?: string;
}) {
  const valueColor = { default: "text-portal-text", primary: "text-portal-primary", success: "text-portal-success", warning: "text-portal-warning", danger: "text-portal-danger" }[tone];
  const padding = { compact: "px-3 py-2.5", default: "px-4 py-3", spacious: "p-5" }[size];
  return <article className={`min-w-0 rounded-[var(--portal-radius-lg)] border border-portal-border bg-portal-surface ${padding} shadow-[var(--portal-shadow-sm)] ${className}`}><p className="text-xs font-medium text-portal-muted">{label}</p><strong className={`mt-1 block text-xl ${valueColor}`}>{value}</strong>{detail ? <p className="mt-1 text-xs text-portal-muted">{detail}</p> : null}</article>;
}
