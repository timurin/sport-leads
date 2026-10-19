import { calendarOperationStatusLabel } from "./production-state-label.ts";

export type CalendarStatusOption = { value: string; label: string };

const PRIMARY_STATUS_OPTIONS: CalendarStatusOption[] = [
  { value: "pending", label: "Запланирована" },
  { value: "in_progress", label: "В работе" },
  { value: "completed", label: "Завершена" },
];

const PRIMARY_STATUS_VALUES = new Set(PRIMARY_STATUS_OPTIONS.map((item) => item.value));

export function calendarStatusFilterOptions(
  assignments: ReadonlyArray<{ operation_status?: string | null }>,
): CalendarStatusOption[] {
  const extras: CalendarStatusOption[] = [];
  const seen = new Set<string>();
  for (const assignment of assignments) {
    const status = assignment.operation_status;
    if (!status || PRIMARY_STATUS_VALUES.has(status) || seen.has(status)) continue;
    seen.add(status);
    const label = calendarOperationStatusLabel({
      operationStatus: status as "pending" | "in_progress" | "completed" | "skipped",
    });
    extras.push({ value: status, label: label || status });
  }
  return [...PRIMARY_STATUS_OPTIONS, ...extras];
}

export function filterCalendarAssignments<T extends { operation_status?: string | null }>(
  assignments: readonly T[],
  selected: readonly string[],
): T[] {
  if (selected.length === 0) return [...assignments];
  const allowed = new Set(selected);
  return assignments.filter((item) => item.operation_status != null && allowed.has(item.operation_status));
}

export function toggleCalendarStatus(
  selected: readonly string[],
  status: string,
  optionValues: readonly string[],
): string[] {
  const next = selected.includes(status)
    ? selected.filter((item) => item !== status)
    : [...selected, status];
  if (next.length === 0) return [];
  if (optionValues.length > 0 && optionValues.every((item) => next.includes(item))) return [];
  return next;
}

export function calendarStatusFilterSummary(
  selected: readonly string[],
  options: readonly CalendarStatusOption[],
): string {
  if (selected.length === 0) return "Все статусы";
  const labels = options.filter((item) => selected.includes(item.value)).map((item) => item.label);
  if (labels.length === 0) return "Все статусы";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} + ${labels[1]}`;
  return calendarStatusCountLabel(labels.length);
}

export function calendarStatusCountLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} статус`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} статуса`;
  return `${count} статусов`;
}
