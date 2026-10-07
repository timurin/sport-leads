export type CalendarStage = { id: number; name: string; code: string };
export type CalendarSource = {
  id: number; number: string; order_number: string;
  nomenclature_name: string | null; quantity: string;
};
export type CalendarAssignment = {
  id: number; technical_card_id: number; technical_card_number: string;
  order_number: string; nomenclature_name: string | null; quantity: string;
  production_stage_id: number; production_stage_name: string;
  planned_date: string;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  position: number; note: string | null;
};
export type CalendarBoard = { assignments: CalendarAssignment[]; stages: CalendarStage[] };
export type CalendarInput = {
  technical_card_id?: number; production_stage_id: number;
  planned_date: string; position: number; note: string | null;
};
export type CalendarCreateInput = {
  technical_card_id: number;
  planned_date: string;
  note: string | null;
};
export type SourceSearchState = "idle" | "searching" | "results" | "empty" | "error";

export function calendarDate(value: string | undefined): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + "T12:00:00");
  return Number.isNaN(date.getTime()) || localDate(date) !== value ? null : value;
}

export function calendarAssignmentId(value: string | undefined): number | null {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

export function calendarWeekPath(date: string): string {
  return "/production/calendar?" + new URLSearchParams({ date });
}

export function calendarPlanningPath(date: string, assignmentId?: number): string {
  const query = new URLSearchParams({ date });
  if (assignmentId !== undefined) query.set("assignment", String(assignmentId));
  return "/production/calendar/planning?" + query;
}

export function calendarBoardPath(date: string): string {
  const days = weekDays(date);
  return "/board?" + new URLSearchParams({ from: days[0], to: days[6] });
}

export function calendarCreateInput(technicalCardId: number, plannedDate: string, note: string): CalendarCreateInput {
  const trimmed = note.trim();
  return { technical_card_id: technicalCardId, planned_date: plannedDate, note: trimmed ? trimmed : null };
}

export function readCreatedAssignment(body: unknown): CalendarAssignment {
  if (!body || typeof body !== "object") throw new Error("Ответ API не содержит назначение");
  const row = body as CalendarAssignment;
  if (!Number.isInteger(row.id) || row.id <= 0 || !Number.isInteger(row.production_stage_id) || row.production_stage_id <= 0) {
    throw new Error("Ответ API не содержит назначенную стадию");
  }
  if (typeof row.production_stage_name !== "string" || !row.production_stage_name.trim()) {
    throw new Error("Ответ API не содержит назначенную стадию");
  }
  if (!Number.isInteger(row.position) || row.position < 0) throw new Error("Ответ API не содержит позицию очереди");
  if (typeof row.planned_date !== "string" || !row.planned_date) throw new Error("Ответ API не содержит дату");
  return row;
}

export function acceptCreatedAssignment(board: CalendarBoard, created: CalendarAssignment): CalendarBoard {
  return {
    stages: board.stages,
    assignments: [...board.assignments.filter((row) => row.id !== created.id), created],
  };
}

export async function enqueueAssignment(
  request: <T>(path: string, init?: RequestInit) => Promise<T>,
  input: CalendarCreateInput,
): Promise<CalendarAssignment> {
  const payload: CalendarCreateInput = {
    technical_card_id: input.technical_card_id,
    planned_date: input.planned_date,
    note: input.note,
  };
  return readCreatedAssignment(await request<unknown>("/assignments", {
    method: "POST",
    body: JSON.stringify(payload),
  }));
}

export function calendarErrorMessage(reason: unknown, fallback: string): string {
  if (reason instanceof TypeError) return "Не удалось связаться с календарём";
  if (!(reason instanceof Error) || !reason.message) return fallback;
  const status = reason.message.match(/^Ошибка календаря \((\d+)\)$/);
  if (!status) return reason.message;
  if (status[1] === "404") return "Техническая карта или назначение не найдены (404)";
  if (status[1] === "422") return "Данные очереди не прошли проверку (422)";
  if (status[1] === "500" || status[1] === "502" || status[1] === "503") return `Сервис очереди недоступен (${status[1]})`;
  return reason.message;
}

export function calendarSourceLabel(source: CalendarSource): string {
  return [source.number, source.order_number, source.nomenclature_name?.trim() || "Изделие", source.quantity + " шт."].join(" · ");
}

export function sourceSearchState(input: { query: string; loading: boolean; error: string; count: number }): SourceSearchState {
  if (!input.query.trim()) return "idle";
  if (input.loading) return "searching";
  if (input.error) return "error";
  return input.count ? "results" : "empty";
}

export function calendarAssignmentInput(assignment: CalendarAssignment): CalendarInput {
  return {
    production_stage_id: assignment.production_stage_id,
    planned_date: assignment.planned_date,
    position: assignment.position,
    note: assignment.note,
  };
}

export async function calendarRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch("/api/production-calendar" + path, {
    ...init, cache: "no-store", credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (!response.ok) {
    let message = "Ошибка календаря (" + response.status + ")";
    try {
      const body = await response.json();
      if (typeof body.detail === "string") message = body.detail;
      else if (Array.isArray(body.detail)) message = body.detail.map((item: { msg: string }) => item.msg).join("; ");
    } catch { /* HTTP status remains visible. */ }
    throw new Error(message);
  }
  return response.status === 204 ? undefined as T : await response.json() as T;
}

export function localDate(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export function weekDays(anchor: string): string[] {
  const date = new Date(anchor + "T12:00:00");
  date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(date);
    day.setDate(day.getDate() + index);
    return localDate(day);
  });
}

export function shiftWeek(anchor: string, direction: number): string {
  const date = new Date(anchor + "T12:00:00");
  date.setDate(date.getDate() + direction * 7);
  return localDate(date);
}

export function assignmentsFor(assignments: CalendarAssignment[], stageId: number, day: string): CalendarAssignment[] {
  return assignments.filter((item) => item.production_stage_id === stageId && item.planned_date === day)
    .sort((left, right) => left.position - right.position || left.id - right.id);
}

export const CALENDAR_TOOLBAR = [
  { id: "production-calendar-week", title: "Календарь", href: "/production/calendar" },
  { id: "production-calendar-planning", title: "Ручное планирование", href: "/production/calendar/planning" },
  { id: "production-calendar-capacity", title: "Мощности", href: "/production/calendar/capacity" },
  { id: "production-calendar-dashboard", title: "Дашборд", href: "/production/calendar/dashboard" },
  { id: "production-calendar-deviations", title: "Центр отклонений", href: "/production/calendar/deviations" },
] as const;

export function stickerLabel(item: { order_number: string; technical_card_number: string }): string {
  const order = item.order_number.trim();
  const card = item.technical_card_number.trim();
  if (!order) return card;
  if (!card || order === card || order.endsWith("/" + card)) return order;
  return order + "/" + card;
}

export function assignmentRange(item: CalendarAssignment): { start: string; end: string } {
  const start = item.planned_start_date || item.planned_date;
  const end = item.planned_end_date || start;
  return end < start ? { start, end: start } : { start, end };
}

export type WeekSticker = {
  assignment: CalendarAssignment;
  startIndex: number;
  endIndex: number;
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
};

export function weekStickers(assignments: CalendarAssignment[], stageId: number, days: string[]): WeekSticker[] {
  if (days.length !== 7) return [];
  const weekStart = days[0];
  const weekEnd = days[6];
  const rows: WeekSticker[] = [];
  for (const item of assignments) {
    if (item.production_stage_id !== stageId) continue;
    const range = assignmentRange(item);
    if (range.end < weekStart || range.start > weekEnd) continue;
    const visibleStart = range.start < weekStart ? weekStart : range.start;
    const visibleEnd = range.end > weekEnd ? weekEnd : range.end;
    const startIndex = days.indexOf(visibleStart);
    const endIndex = days.indexOf(visibleEnd);
    if (startIndex < 0 || endIndex < 0 || endIndex < startIndex) continue;
    rows.push({
      assignment: item,
      startIndex,
      endIndex,
      lane: 0,
      continuesBefore: range.start < weekStart,
      continuesAfter: range.end > weekEnd,
    });
  }
  rows.sort((left, right) => left.startIndex - right.startIndex || left.endIndex - right.endIndex
    || left.assignment.position - right.assignment.position || left.assignment.id - right.assignment.id);
  const laneEnds: number[] = [];
  for (const row of rows) {
    const free = laneEnds.findIndex((end) => end < row.startIndex);
    if (free < 0) {
      row.lane = laneEnds.length;
      laneEnds.push(row.endIndex);
    } else {
      row.lane = free;
      laneEnds[free] = row.endIndex;
    }
  }
  return rows;
}

export function stageStickerTone(stage: { code: string; name: string }): string {
  const code = stage.code.toLowerCase();
  const name = stage.name.toLowerCase();
  if (code === "launch_preparation" || name.includes("подготов")) return "launch";
  if (code === "design" || name.includes("дизайн")) return "design";
  if (code === "print" || name.includes("печат")) return "print";
  if (code === "cutting" || name.includes("раскрой")) return "cutting";
  if (code === "sewing" || name.includes("пошив")) return "sewing";
  if (code === "packaging" || name.includes("упаков") || name.includes("вто")) return "packaging";
  if (code === "quality" || name.includes("контрол")) return "quality";
  if (code === "ready_to_ship" || name.includes("отгруз")) return "ready";
  return "launch";
}
