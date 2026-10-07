import { CalendarWeeklyBoard } from "@/components/production/calendar-weekly-board";
import { PageLayout } from "@/components/layout/page-layout";
import { calendarAssignmentId, calendarDate } from "@/lib/production/calendar";

export default async function ProductionCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; saved?: string }>;
}) {
  const query = await searchParams;
  const date = calendarDate(query.date);
  return <PageLayout><CalendarWeeklyBoard key={date ?? "today"} initialDate={date} saved={calendarAssignmentId(query.saved) !== null} /></PageLayout>;
}

