import type { DateRange, PeriodPreset } from "./sales-dashboard-types";

const DAY = 86_400_000;

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function endOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999);
}

function addDays(value: Date, days: number): Date {
  return new Date(value.getTime() + days * DAY);
}

export function buildDateRange(
  preset: PeriodPreset,
  nowIso: string,
  customStart: string,
  customEnd: string,
): { range: DateRange; error?: string } {
  const now = startOfDay(new Date(nowIso));
  if (preset === "custom") {
    const start = startOfDay(new Date(`${customStart}T00:00:00`));
    const end = endOfDay(new Date(`${customEnd}T00:00:00`));
    if (!customStart || !customEnd || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return { range: { start: now, end: endOfDay(now) }, error: "Укажите обе даты периода" };
    }
    if (start > end) {
      return { range: { start: now, end: endOfDay(now) }, error: "Дата начала должна быть раньше даты окончания" };
    }
    return { range: { start, end } };
  }

  if (preset === "today") return { range: { start: now, end: endOfDay(now) } };
  if (preset === "yesterday") {
    const yesterday = addDays(now, -1);
    return { range: { start: yesterday, end: endOfDay(yesterday) } };
  }
  if (preset === "sevenDays") return { range: { start: addDays(now, -6), end: endOfDay(now) } };
  if (preset === "thirtyDays") return { range: { start: addDays(now, -29), end: endOfDay(now) } };
  if (preset === "currentMonth") return { range: { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfDay(now) } };
  if (preset === "previousMonth") {
    return { range: { start: new Date(now.getFullYear(), now.getMonth() - 1, 1), end: endOfDay(new Date(now.getFullYear(), now.getMonth(), 0)) } };
  }
  if (preset === "currentQuarter") {
    return { range: { start: new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1), end: endOfDay(now) } };
  }
  return { range: { start: new Date(now.getFullYear(), 0, 1), end: endOfDay(now) } };
}

export function previousDateRange(range: DateRange): DateRange {
  const duration = range.end.getTime() - range.start.getTime() + 1;
  return {
    start: new Date(range.start.getTime() - duration),
    end: new Date(range.start.getTime() - 1),
  };
}

export function isWithin(dateIso: string, range: DateRange): boolean {
  const value = new Date(dateIso).getTime();
  return value >= range.start.getTime() && value <= range.end.getTime();
}

export function rangeDays(range: DateRange): number {
  return Math.max(1, Math.ceil((range.end.getTime() - range.start.getTime()) / DAY));
}

export function formatRange(range: DateRange): string {
  const format = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric" });
  return `${format.format(range.start)} — ${format.format(range.end)}`;
}
