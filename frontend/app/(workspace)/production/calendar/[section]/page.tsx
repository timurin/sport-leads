import Link from "next/link";
import { notFound } from "next/navigation";

import { PageContent, PageLayout } from "@/components/layout/page-layout";
import { CalendarToolbar } from "@/components/production/calendar-toolbar";
import { CALENDAR_TOOLBAR } from "@/lib/production/calendar";

export default async function ProductionCalendarSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const entry = CALENDAR_TOOLBAR.find((item) => item.href === `/production/calendar/${section}`);
  if (!entry || entry.href === "/production/calendar") notFound();

  return (
    <PageLayout>
      <PageContent>
        <CalendarToolbar current={entry.href} />
        <div className="mt-4 space-y-4 rounded-xl border border-portal-border bg-portal-surface p-4">
          <h1 className="text-xl font-bold text-portal-text">{entry.title}</h1>
          <p className="text-sm text-portal-muted">
            Раздел ещё не реализован. Сейчас доступна недельная очередь производства.
          </p>
          <Link href="/production/calendar" className="inline-block text-sm font-medium text-portal-primary hover:underline">
            Открыть очередь / неделю
          </Link>
        </div>
      </PageContent>
    </PageLayout>
  );
}
