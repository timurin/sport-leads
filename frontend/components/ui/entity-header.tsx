import type { ReactNode } from "react";

import { PageActions } from "@/components/layout/page-layout";

export function EntityHeader({ title, eyebrow, description, meta, status, actions, size = "default", className = "" }: {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  size?: "compact" | "default" | "spacious";
  className?: string;
}) {
  const titleClass = { compact: "text-xl", default: "text-2xl", spacious: "text-3xl" }[size];
  return (
    <div className={`flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between ${className}`}>
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1 text-xs font-semibold text-portal-muted">{eyebrow}</div> : null}
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <h1 className={`${titleClass} min-w-0 font-semibold tracking-tight text-portal-text`}>{title}</h1>
          {status}
        </div>
        {description ? <div className="mt-1 text-sm leading-5 text-portal-muted">{description}</div> : null}
        {meta ? <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-portal-muted">{meta}</div> : null}
      </div>
      {actions ? <PageActions className="lg:shrink-0">{actions}</PageActions> : null}
    </div>
  );
}
