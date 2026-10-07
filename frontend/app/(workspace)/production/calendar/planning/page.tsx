import { PageLayout } from "@/components/layout/page-layout";
import { CalendarManualScheduling } from "@/components/production/calendar-manual-scheduling";
import { calendarAssignmentId, calendarDate, localDate } from "@/lib/production/calendar";

export default async function CalendarPlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; assignment?: string }>;
}) {
  const query = await searchParams;
  const date = calendarDate(query.date) ?? localDate(new Date());
  const assignmentId = calendarAssignmentId(query.assignment);
  return (
    <PageLayout>
      <CalendarManualScheduling
        key={`${date}:${query.assignment ?? "list"}`}
        date={date}
        assignmentId={assignmentId}
        invalidAssignment={query.assignment !== undefined && assignmentId === null}
      />
    </PageLayout>
  );
}
