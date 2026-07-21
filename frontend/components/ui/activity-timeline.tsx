import type { ReactNode } from "react";

type ActivityTimelineProps = {
  children: ReactNode;
  label?: string;
  className?: string;
};

type ActivityTimelineItemProps = {
  marker?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  className?: string;
};

/**
 * Presentational activity feed shell (`DS-TIMELINE-01`).
 * Domain filters/permissions stay in lead timeline.
 */
export function ActivityTimeline({
  children,
  label = "Лента событий",
  className = "",
}: ActivityTimelineProps) {
  return (
    <div
      role="feed"
      aria-label={label}
      className={`min-w-0 ${className}`}
    >
      {children}
    </div>
  );
}

export function ActivityTimelineItem({
  marker,
  title,
  description,
  meta,
  className = "",
}: ActivityTimelineItemProps) {
  return (
    <article
      className={[
        "flex gap-portal-3 border-b border-portal-border py-portal-3 last:border-b-0",
        className,
      ].join(" ")}
    >
      {marker ? <div className="mt-1.5 shrink-0">{marker}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="text-portal-body font-medium text-portal-text">{title}</div>
        {description ? (
          <div className="mt-0.5 truncate text-portal-body text-portal-muted">
            {description}
          </div>
        ) : null}
        {meta ? (
          <div className="mt-1 text-portal-caption text-portal-muted">{meta}</div>
        ) : null}
      </div>
    </article>
  );
}
