import type { ReactNode } from "react";

type EntityPanelProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  filter?: ReactNode;
  children: ReactNode;
  embedded?: boolean;
  compact?: boolean;
  className?: string;
};

/**
 * Side / card panel chrome for tasks, notes, history (`DS-PANEL-01`).
 */
export function EntityPanel({
  title,
  description,
  actions,
  filter,
  children,
  embedded = false,
  compact = false,
  className = "",
}: EntityPanelProps) {
  return (
    <section
      className={[
        "min-w-0",
        embedded
          ? compact
            ? "p-portal-3"
            : "p-portal-4 sm:p-portal-5"
          : "rounded-portal-lg border border-portal-border bg-portal-surface p-portal-4 sm:p-portal-5 shadow-portal-card",
        className,
      ].join(" ")}
    >
      <div className="flex flex-col gap-portal-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2
            className={[
              compact ? "text-portal-body font-bold" : "text-portal-body font-semibold",
              "text-portal-text",
            ].join(" ")}
          >
            {title}
          </h2>
          {description && !compact ? (
            <p className="mt-1 text-portal-body text-portal-muted">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {filter ? <div className="mt-portal-4">{filter}</div> : null}
      <div className={compact ? "mt-portal-3 min-w-0" : "mt-portal-4 min-w-0"}>{children}</div>
    </section>
  );
}
