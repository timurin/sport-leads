/**
 * Pure audit display helpers (no Next runtime) — ADR-025 / 17.1.3.3.
 */

export type AuditEvent = {
  id: number;
  occurred_at: string;
  actor_platform_user_id: number | null;
  actor_login: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  request_id?: string | null;
  payload?: Record<string, unknown> | null;
  source: string;
};

const ACTION_LABELS: Record<string, string> = {
  "size_grid.create": "Создание сетки",
  "size_grid.update": "Изменение реквизитов",
  "size_grid.delete": "Удаление сетки",
  "size_grid.row.create": "Добавление строки размера",
  "size_grid.row.update": "Изменение строки размера",
  "size_grid.row.delete": "Удаление строки размера",
  "role.assign": "Назначение роли",
  "role.revoke": "Снятие роли",
  "shop.stage.complete": "Завершение этапа цеха",
  "shop.stage.rollback_kanban": "Откат этапа (канбан)",
  "stage_executors.put": "Обновление исполнителей этапа",
};

export function formatAuditAction(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function formatAuditActor(event: AuditEvent): string {
  return event.actor_login?.trim() || "Система";
}

export function auditEventsSummary(count: number): string {
  if (count === 0) return "записей нет";
  if (count === 1) return "1 запись";
  if (count < 5) return `${count} записи`;
  return `${count} записей`;
}
