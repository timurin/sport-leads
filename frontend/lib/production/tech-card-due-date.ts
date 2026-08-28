/** Calendar helpers for tech-card due date (Stage 26.3.8). ISO dates are calendar days. */

export const WEEKDAY_LABELS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

export const MONTH_LABELS_RU = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
] as const;

export type IsoDateParts = { year: number; month: number; day: number };

export type CalendarCell = { iso: string | null; day: number | null };

export function parseIsoDate(value: string | null | undefined): IsoDateParts | null {
  if (!value?.trim()) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function toIsoDate(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function mondayIndex(year: number, month: number, day: number): number {
  const utcDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (utcDay + 6) % 7;
}

export function monthGrid(year: number, month: number): CalendarCell[] {
  const lead = mondayIndex(year, month, 1);
  const last = daysInMonth(year, month);
  const cells: CalendarCell[] = [];
  for (let i = 0; i < lead; i += 1) {
    cells.push({ iso: null, day: null });
  }
  for (let day = 1; day <= last; day += 1) {
    cells.push({ iso: toIsoDate(year, month, day), day });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ iso: null, day: null });
  }
  return cells;
}

export function clampIsoToMonth(
  iso: string | null,
  year: number,
  month: number,
): string | null {
  if (!iso) return null;
  const parsed = parseIsoDate(iso);
  const last = daysInMonth(year, month);
  const day = parsed ? Math.min(parsed.day, last) : 1;
  return toIsoDate(year, month, day);
}

export function yearOptions(centerYear: number, nowYear: number): number[] {
  const start = Math.min(centerYear, nowYear) - 2;
  const end = Math.max(centerYear, nowYear) + 5;
  const years: number[] = [];
  for (let year = start; year <= end; year += 1) {
    years.push(year);
  }
  return years;
}
