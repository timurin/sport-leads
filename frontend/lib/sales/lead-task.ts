import type { LeadTask, LeadTaskType, Priority } from "@/types/sales";

export type LeadTaskFilter = "open" | "completed" | "all";

export const leadTaskTypeLabels: Record<LeadTaskType, string> = {
  call: "Позвонить",
  message: "Написать",
  email: "Email",
  send_proposal: "Отправить предложение",
  clarify_sizes: "Уточнить размеры",
  receive_design: "Получить макет",
  approve_design: "Согласовать дизайн",
  check_payment: "Проверить оплату",
  meeting: "Встреча",
  other: "Другое",
};

export const priorityLabels: Record<Priority, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  urgent: "Срочный",
};

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Moscow",
});
const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/Moscow",
});
const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;

function timestamp(value?: string) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function moscowDateKey(value: string) {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? "" : new Date(parsed + MOSCOW_OFFSET_MS).toISOString().slice(0, 10);
}

export function createTaskDueAt(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return undefined;
  }
  const result = new Date(`${date}T${time}:00+03:00`);
  if (Number.isNaN(result.getTime())) {
    return undefined;
  }
  const shifted = new Date(result.getTime() + MOSCOW_OFFSET_MS).toISOString();
  return shifted.slice(0, 10) === date && shifted.slice(11, 16) === time
    ? result.toISOString()
    : undefined;
}

export function getTaskFormDateTime(value: string) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return { date: "", time: "12:00" };
  }
  const shifted = new Date(parsed + MOSCOW_OFFSET_MS).toISOString();
  return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) };
}

export function formatTaskDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Срок не указан"
    : `${dateFormatter.format(date).replace(/\s*г\.$/, "")}, ${timeFormatter.format(date)}`;
}

export function isTaskOverdue(task: LeadTask, referenceAt: string) {
  return task.status === "open" && timestamp(task.dueAt) < timestamp(referenceAt);
}

export function getTaskTimingLabel(task: LeadTask, referenceAt: string) {
  if (task.status === "completed") {
    return "Завершено";
  }
  if (isTaskOverdue(task, referenceAt)) {
    return "Просрочено";
  }
  const dueDate = moscowDateKey(task.dueAt);
  const referenceDate = moscowDateKey(referenceAt);
  if (dueDate && dueDate === referenceDate) {
    return "Сегодня";
  }
  const nextDay = new Date(`${referenceDate}T00:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return dueDate && dueDate === nextDay.toISOString().slice(0, 10) ? "Завтра" : "Запланировано";
}

export function sortLeadTasks(tasks: ReadonlyArray<LeadTask>, filter: LeadTaskFilter, referenceAt: string) {
  const open = tasks
    .filter((task) => task.status === "open")
    .map((task, index) => ({ task, index }))
    .sort((left, right) => Number(isTaskOverdue(right.task, referenceAt)) - Number(isTaskOverdue(left.task, referenceAt))
      || timestamp(left.task.dueAt) - timestamp(right.task.dueAt)
      || left.index - right.index)
    .map(({ task }) => task);
  const completed = tasks
    .filter((task) => task.status === "completed")
    .map((task, index) => ({ task, index }))
    .sort((left, right) => timestamp(right.task.completedAt) - timestamp(left.task.completedAt) || left.index - right.index)
    .map(({ task }) => task);

  return filter === "open" ? open : filter === "completed" ? completed : [...open, ...completed];
}

export function getNearestLeadTask(tasks: ReadonlyArray<LeadTask>, referenceAt: string) {
  return sortLeadTasks(tasks, "open", referenceAt)[0] ?? null;
}

export function rescheduleTaskDueAt(dueAt: string, referenceAt: string, days: number) {
  const due = getTaskFormDateTime(dueAt);
  const reference = getTaskFormDateTime(referenceAt);
  if (!due.date || !reference.date) {
    return dueAt;
  }
  const targetDate = new Date(`${reference.date}T00:00:00Z`);
  targetDate.setUTCDate(targetDate.getUTCDate() + days);
  return createTaskDueAt(targetDate.toISOString().slice(0, 10), due.time) ?? dueAt;
}
