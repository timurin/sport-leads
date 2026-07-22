import type { RecentActivity as Activity } from "@/lib/dashboard/sales-dashboard-types";
import { ActivityTimeline, ActivityTimelineItem } from "@/components/ui/activity-timeline";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/ui/section-card";

const dots = {
  blue: "bg-portal-primary",
  emerald: "bg-portal-success",
  amber: "bg-portal-warning",
  slate: "bg-portal-muted",
} as const;

export function RecentActivity({ activity }: { activity: Activity[] }) {
  const formatter = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <SectionCard
      title="Последние события"
      description="Единая лента CRM-активности"
      className="xl:col-span-2"
    >
      {activity.length ? (
        <ActivityTimeline label="Последние события CRM">
          <div className="grid min-w-0 gap-x-portal-8 md:grid-cols-2">
            {activity.map((item) => (
              <ActivityTimelineItem
                key={item.id}
                marker={(
                  <span
                    className={`mt-0.5 size-2.5 rounded-portal-full ${dots[item.tone]}`}
                    aria-hidden="true"
                  />
                )}
                title={item.title}
                description={item.description}
                meta={(
                  <time dateTime={item.occurredAt}>
                    {formatter.format(new Date(item.occurredAt))}
                  </time>
                )}
              />
            ))}
          </div>
        </ActivityTimeline>
      ) : (
        <EmptyState title="Событий за период нет" size="compact" />
      )}
    </SectionCard>
  );
}
