import type { LeadActivity, LeadActivityType } from "@/types/sales";

export type ApiLeadEventType =
  | "lead_created"
  | "lead_status_changed"
  | "lead_converted"
  | "lead_rejected"
  | "order_created"
  | "comment_added"
  | "task_created"
  | "task_completed";

export type ApiLeadEvent = {
  id: number;
  lead_id: number;
  order_id: number | null;
  event_type: ApiLeadEventType;
  actor_id: number | null;
  message: string | null;
  created_at: string;
};

const eventPresentation: Record<ApiLeadEventType, { type: LeadActivityType; title: string }> = {
  lead_created: { type: "lead_created", title: "Лид создан" },
  lead_status_changed: { type: "status_changed", title: "Статус лида обновлён" },
  lead_converted: { type: "lead_closed", title: "Лид конвертирован" },
  lead_rejected: { type: "lead_closed", title: "Лид отклонён" },
  order_created: { type: "order_created", title: "Создан заказ" },
  comment_added: { type: "comment_added", title: "Добавлен комментарий" },
  task_created: { type: "task_created", title: "Создана задача" },
  task_completed: { type: "task_completed", title: "Задача завершена" },
};

export function fromApiLeadEvent(event: ApiLeadEvent): LeadActivity {
  const presentation = eventPresentation[event.event_type];
  return {
    id: `backend-event-${event.id}`,
    type: presentation.type,
    occurredAt: event.created_at,
    author: event.actor_id === null
      ? undefined
      : { id: String(event.actor_id), name: `Сотрудник #${event.actor_id}` },
    title: presentation.title,
    description: event.message ?? undefined,
    metadata: event.order_id === null ? undefined : { orderId: event.order_id },
    isSystem: true,
  };
}
