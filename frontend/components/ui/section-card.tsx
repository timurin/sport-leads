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
  const padding = { compact: "p-portal-3", default: "p-portal-4", spacious: "p-portal-5 sm:p-portal-6" }[size];
  return (
    <section className={`min-w-0 rounded-portal-lg border border-portal-border bg-portal-surface shadow-portal-card ${className}`}>
      {title || description || actions ? <header className={`flex min-w-0 flex-col gap-portal-3 border-b border-portal-border ${padding} sm:flex-row sm:items-start sm:justify-between`}><div className="min-w-0">{title ? <h2 className="text-portal-section font-semibold text-portal-text">{title}</h2> : null}{description ? <p className="mt-1 text-portal-body text-portal-muted">{description}</p> : null}</div>{actions ? <PageActions>{actions}</PageActions> : null}</header> : null}
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
  return <article className={`flex min-w-0 gap-portal-3 rounded-portal-lg border border-portal-border bg-portal-surface p-portal-3 shadow-portal-sm ${className}`}>{icon ? <span className="shrink-0 text-portal-muted">{icon}</span> : null}<div className="min-w-0"><p className="text-portal-caption font-medium text-portal-muted">{label}</p><div className="mt-1 font-semibold text-portal-text">{value}</div>{detail ? <div className="mt-1 text-portal-caption text-portal-muted">{detail}</div> : null}</div></article>;
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
  const padding = { compact: "px-portal-3 py-2.5", default: "px-portal-4 py-portal-3", spacious: "p-portal-5" }[size];
  return <article className={`min-w-0 rounded-portal-lg border border-portal-border bg-portal-surface ${padding} shadow-portal-sm ${className}`}><p className="text-portal-caption font-medium text-portal-muted">{label}</p><strong className={`mt-1 block text-xl ${valueColor}`}>{value}</strong>{detail ? <p className="mt-1 text-portal-caption text-portal-muted">{detail}</p> : null}</article>;
}
