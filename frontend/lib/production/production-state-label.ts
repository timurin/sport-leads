/** Same status words for the current workshop on Kanban and the current calendar row. */

export function currentWorkshopStatusLabel(input: {
  lifecycleStatus?: string | null;
  workshopState?: string | null;
}): string {
  const workshop = input.workshopState;
  const lifecycle = input.lifecycleStatus;
  if (workshop === "in_progress") return "В работе";
  if (workshop === "completed" || lifecycle === "completed") return "Завершён";
  if (lifecycle === "planned") return "Запланирована";
  if (lifecycle === "cancelled") return "Отменена";
  if (lifecycle === "draft") return "Черновик";
  return "Ожидает";
}

export function calendarOperationStatusLabel(input: {
  operationStatus?: "pending" | "in_progress" | "completed" | "skipped" | null;
  operationState?: "current" | "future" | "completed" | null;
  lifecycleStatus?: string | null;
  workshopState?: string | null;
}): string {
  if (input.operationStatus === "in_progress") return "В работе";
  if (input.operationStatus === "pending") return "Запланирована";
  if (input.operationStatus === "completed") return "Завершено";
  if (input.operationStatus === "skipped") return "Пропущена";
  if (input.operationState === "completed") return "Завершено";
  if (input.operationState === "future") return "План";
  if (input.operationState === "current") {
    return currentWorkshopStatusLabel({
      lifecycleStatus: input.lifecycleStatus,
      workshopState: input.workshopState,
    });
  }
  return "";
}
