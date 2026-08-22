/** WorkTask client types + presentation (ADR-028 / Stage 23.3). */

export type WorkTaskStatus = "open" | "in_progress" | "done" | "cancelled";

export type WorkTaskAnchorType = "lead" | "sales_order" | "production_order";

/** Slim list DTO from GET /work-tasks (no completed_at / messages). */
export type ApiWorkTaskListItem = {
  id: number;
  title: string;
  status: WorkTaskStatus | string;
  production_stage_id: number | null;
  production_stage_name: string | null;
  board_stage_id: number | null;
  board_stage_name: string | null;
  created_by_platform_user_id: number | null;
  created_by_display_name: string | null;
  responsible_platform_user_id: number | null;
  responsible_display_name: string | null;
  executor_platform_user_id: number | null;
  executor_display_name: string | null;
  lead_id: number | null;
  sales_order_id: number | null;
  production_order_id: number | null;
  due_at: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkTaskSalesOrderSummary = {
  id: number;
  number: string;
  client_company_name: string | null;
  status: string;
  amount: string | null;
  currency_code: string;
  desired_date: string | null;
};

/** Detail GET /work-tasks/{id} (fat relative to list; still no messages array). */
export type ApiWorkTask = {
  id: number;
  title: string;
  status: WorkTaskStatus | string;
  production_stage_id: number | null;
  production_stage_name: string | null;
  board_stage_id: number | null;
  board_stage_name: string | null;
  created_by_platform_user_id: number | null;
  created_by_display_name: string | null;
  responsible_platform_user_id: number | null;
  responsible_display_name: string | null;
  executor_platform_user_id: number | null;
  executor_display_name: string | null;
  lead_id: number | null;
  sales_order_id: number | null;
  sales_order_summary?: WorkTaskSalesOrderSummary | null;
  production_order_id: number | null;
  due_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type OrderSummaryView = {
  id: number;
  number: string;
  clientCompanyName: string | null;
  status: string;
  amount: string | null;
  currencyCode: string;
  desiredDate: string | null;
};

export type WorkTaskListView = "list" | "kanban";

export type WorkTaskListFilters = {
  status?: string;
  anchor_type?: WorkTaskAnchorType | string;
  production_stage_id?: number;
  responsible_platform_user_id?: number;
  executor_platform_user_id?: number;
  view?: WorkTaskListView;
};

export type WorkTaskListItem = {
  id: string;
  title: string;
  status: WorkTaskStatus | string;
  statusLabel: string;
  workshopLabel: string;
  boardStageId: number | null;
  boardStageLabel: string;
  createdByLabel: string;
  responsibleLabel: string;
  executorLabel: string;
  objectLabel: string;
  objectHref: string | null;
  href: string;
  dueLabel: string;
  dueAt: string | null;
  dueSoon: boolean;
  overdue: boolean;
  orderSummary?: OrderSummaryView | null;
};

export type WorkTaskBoardStage = {
  id: number;
  name: string;
  sort_order: number;
  is_active: boolean;
};

export const workTaskStatusLabels: Record<WorkTaskStatus, string> = {
  open: "Открыта",
  in_progress: "В работе",
  done: "Выполнена",
  cancelled: "Отменена",
};

export const workTaskAnchorTypeLabels: Record<WorkTaskAnchorType, string> = {
  lead: "Лид",
  sales_order: "Заказ",
  production_order: "Производственный заказ",
};

export function workTaskStatusLabel(status: string): string {
  if (status in workTaskStatusLabels) {
    return workTaskStatusLabels[status as WorkTaskStatus];
  }
  return status;
}

function formatDue(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeZone: "Europe/Moscow",
  }).format(date);
}

/** Due within next 24h (inclusive of overdue). */
export function isWorkTaskDueSoon(dueAt: string | null | undefined): boolean {
  if (!dueAt) return false;
  const due = new Date(dueAt).getTime();
  if (Number.isNaN(due)) return false;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  return due - now <= dayMs;
}

export function isWorkTaskOverdue(dueAt: string | null | undefined): boolean {
  if (!dueAt) return false;
  const due = new Date(dueAt).getTime();
  if (Number.isNaN(due)) return false;
  return due < Date.now();
}

function userLabel(
  name: string | null | undefined,
  id: number | null | undefined,
  empty: string,
): string {
  const trimmed = name?.trim();
  if (trimmed) return trimmed;
  if (id == null) return empty;
  return `Пользователь #${id}`;
}

function objectFromAnchors(task: {
  lead_id: number | null;
  sales_order_id: number | null;
  production_order_id: number | null;
}): { objectLabel: string; objectHref: string | null } {
  if (task.lead_id != null) {
    return {
      objectLabel: `Лид #${task.lead_id}`,
      objectHref: `/sales/leads/${task.lead_id}`,
    };
  }
  if (task.sales_order_id != null) {
    return {
      objectLabel: `Заказ #${task.sales_order_id}`,
      objectHref: `/sales/orders/${task.sales_order_id}`,
    };
  }
  if (task.production_order_id != null) {
    return {
      objectLabel: `ПО #${task.production_order_id}`,
      objectHref: `/production/orders/${task.production_order_id}`,
    };
  }
  return { objectLabel: "Без объекта", objectHref: null };
}

function mapOrderSummary(
  summary: WorkTaskSalesOrderSummary | null | undefined,
): OrderSummaryView | null {
  if (!summary) return null;
  return {
    id: summary.id,
    number: summary.number,
    clientCompanyName: summary.client_company_name,
    status: summary.status,
    amount: summary.amount,
    currencyCode: summary.currency_code,
    desiredDate: summary.desired_date,
  };
}

export function fromApiWorkTaskListItem(task: ApiWorkTaskListItem): WorkTaskListItem {
  const { objectLabel, objectHref } = objectFromAnchors(task);
  return {
    id: String(task.id),
    title: task.title,
    status: task.status,
    statusLabel: workTaskStatusLabel(task.status),
    workshopLabel:
      task.production_stage_name?.trim() ||
      (task.production_stage_id == null
        ? "Цех не назначен"
        : `Цех #${task.production_stage_id}`),
    boardStageId: task.board_stage_id ?? null,
    boardStageLabel:
      task.board_stage_name?.trim() ||
      (task.board_stage_id == null ? "Без стадии" : `Стадия #${task.board_stage_id}`),
    createdByLabel: userLabel(
      task.created_by_display_name,
      task.created_by_platform_user_id,
      "Не указан",
    ),
    responsibleLabel: userLabel(
      task.responsible_display_name,
      task.responsible_platform_user_id,
      "Не назначен",
    ),
    executorLabel: userLabel(
      task.executor_display_name,
      task.executor_platform_user_id,
      "Не назначен",
    ),
    objectLabel,
    objectHref,
    href: `/sales/tasks/${task.id}`,
    dueLabel: formatDue(task.due_at),
    dueAt: task.due_at,
    dueSoon: isWorkTaskDueSoon(task.due_at),
    overdue: isWorkTaskOverdue(task.due_at),
  };
}

/** Detail mapper with embeds when API provides them. */
export function fromApiWorkTask(task: ApiWorkTask): WorkTaskListItem {
  const { objectLabel, objectHref } = objectFromAnchors(task);
  return {
    id: String(task.id),
    title: task.title,
    status: task.status,
    statusLabel: workTaskStatusLabel(task.status),
    workshopLabel:
      task.production_stage_name?.trim() ||
      (task.production_stage_id == null
        ? "Цех не назначен"
        : `Цех #${task.production_stage_id}`),
    boardStageId: task.board_stage_id ?? null,
    boardStageLabel:
      task.board_stage_name?.trim() ||
      (task.board_stage_id == null ? "Без стадии" : `Стадия #${task.board_stage_id}`),
    createdByLabel: userLabel(
      task.created_by_display_name,
      task.created_by_platform_user_id,
      "Не указан",
    ),
    responsibleLabel: userLabel(
      task.responsible_display_name,
      task.responsible_platform_user_id,
      "Не назначен",
    ),
    executorLabel: userLabel(
      task.executor_display_name,
      task.executor_platform_user_id,
      "Не назначен",
    ),
    objectLabel,
    objectHref,
    href: `/sales/tasks/${task.id}`,
    dueLabel: formatDue(task.due_at),
    dueAt: task.due_at,
    dueSoon: isWorkTaskDueSoon(task.due_at),
    overdue: isWorkTaskOverdue(task.due_at),
    orderSummary: mapOrderSummary(task.sales_order_summary),
  };
}

export function buildWorkTasksListHref(filters: WorkTaskListFilters): string {
  const query = new URLSearchParams();
  if (filters.status) query.set("status", filters.status);
  if (filters.anchor_type) query.set("anchor_type", filters.anchor_type);
  if (filters.production_stage_id != null) {
    query.set("production_stage_id", String(filters.production_stage_id));
  }
  if (filters.responsible_platform_user_id != null) {
    query.set(
      "responsible_platform_user_id",
      String(filters.responsible_platform_user_id),
    );
  }
  if (filters.executor_platform_user_id != null) {
    query.set(
      "executor_platform_user_id",
      String(filters.executor_platform_user_id),
    );
  }
  if (filters.view && filters.view !== "list") {
    query.set("view", filters.view);
  }
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return `/sales/tasks${suffix}`;
}

export function parseWorkTaskListFilters(
  params: Record<string, string | string[] | undefined>,
): WorkTaskListFilters {
  const one = (key: string): string | undefined => {
    const raw = params[key];
    if (Array.isArray(raw)) return raw[0];
    return raw;
  };
  const intOrUndef = (raw: string | undefined): number | undefined => {
    if (!raw) return undefined;
    const n = Number(raw);
    return Number.isSafeInteger(n) && n >= 1 ? n : undefined;
  };
  const status = one("status")?.trim() || undefined;
  const anchor_type = one("anchor_type")?.trim() || undefined;
  const viewRaw = one("view")?.trim().toLowerCase();
  const view: WorkTaskListView | undefined =
    viewRaw === "kanban" ? "kanban" : viewRaw === "list" ? "list" : undefined;
  return {
    status,
    anchor_type,
    production_stage_id: intOrUndef(one("production_stage_id")),
    responsible_platform_user_id: intOrUndef(one("responsible_platform_user_id")),
    executor_platform_user_id: intOrUndef(one("executor_platform_user_id")),
    view,
  };
}

export function resolveWorkTasksView(
  filters: Pick<WorkTaskListFilters, "view">,
): WorkTaskListView {
  return filters.view === "kanban" ? "kanban" : "list";
}

export function isWorkTaskMessageMine(
  authorPlatformUserId: number,
  viewerUserId: number | null | undefined,
): boolean {
  return viewerUserId != null && authorPlatformUserId === viewerUserId;
}

export function groupTasksByBoardStage(
  tasks: WorkTaskListItem[],
  stages: WorkTaskBoardStage[],
): Array<{ stage: WorkTaskBoardStage | null; tasks: WorkTaskListItem[] }> {
  const byId = new Map<number | null, WorkTaskListItem[]>();
  for (const stage of stages) {
    byId.set(stage.id, []);
  }
  byId.set(null, []);
  for (const task of tasks) {
    const key =
      task.boardStageId != null && byId.has(task.boardStageId)
        ? task.boardStageId
        : null;
    byId.get(key)!.push(task);
  }
  const columns: Array<{
    stage: WorkTaskBoardStage | null;
    tasks: WorkTaskListItem[];
  }> = stages.map((stage) => ({
    stage,
    tasks: byId.get(stage.id) ?? [],
  }));
  const unassigned = byId.get(null) ?? [];
  if (unassigned.length > 0) {
    columns.push({ stage: null, tasks: unassigned });
  }
  return columns;
}

export type WorkTaskCreateDraft = {
  title: string;
  anchor_type: WorkTaskAnchorType | "";
  anchor_id: string;
  production_stage_id: string;
  responsible_platform_user_id: string;
  executor_platform_user_id: string;
};

export type WorkTaskCreatePayload = {
  title: string;
  lead_id?: number;
  sales_order_id?: number;
  production_order_id?: number;
  production_stage_id?: number;
  responsible_platform_user_id?: number;
  executor_platform_user_id?: number;
};

export function emptyWorkTaskCreateDraft(): WorkTaskCreateDraft {
  return {
    title: "",
    anchor_type: "",
    anchor_id: "",
    production_stage_id: "",
    responsible_platform_user_id: "",
    executor_platform_user_id: "",
  };
}

function optionalPositiveInt(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isSafeInteger(n) && n >= 1 ? n : undefined;
}

export function validateWorkTaskCreateDraft(
  draft: WorkTaskCreateDraft,
): string | null {
  if (!draft.title.trim()) return "Укажите название задачи";
  if (draft.title.trim().length > 255) {
    return "Название не длиннее 255 символов";
  }
  if (
    draft.anchor_type !== "lead" &&
    draft.anchor_type !== "sales_order" &&
    draft.anchor_type !== "production_order"
  ) {
    return "Выберите тип объекта (лид, заказ или ПО)";
  }
  const anchorId = optionalPositiveInt(draft.anchor_id);
  if (anchorId == null) return "Выберите объект привязки";
  if (draft.production_stage_id.trim() && optionalPositiveInt(draft.production_stage_id) == null) {
    return "Некорректный цех";
  }
  if (
    draft.responsible_platform_user_id.trim() &&
    optionalPositiveInt(draft.responsible_platform_user_id) == null
  ) {
    return "Некорректный ответственный";
  }
  if (
    draft.executor_platform_user_id.trim() &&
    optionalPositiveInt(draft.executor_platform_user_id) == null
  ) {
    return "Некорректный исполнитель";
  }
  return null;
}

export function workTaskCreateDraftToPayload(
  draft: WorkTaskCreateDraft,
): WorkTaskCreatePayload {
  const anchorId = optionalPositiveInt(draft.anchor_id)!;
  const payload: WorkTaskCreatePayload = {
    title: draft.title.trim(),
  };
  if (draft.anchor_type === "lead") payload.lead_id = anchorId;
  if (draft.anchor_type === "sales_order") payload.sales_order_id = anchorId;
  if (draft.anchor_type === "production_order") {
    payload.production_order_id = anchorId;
  }
  const stageId = optionalPositiveInt(draft.production_stage_id);
  if (stageId != null) payload.production_stage_id = stageId;
  const responsibleId = optionalPositiveInt(draft.responsible_platform_user_id);
  if (responsibleId != null) payload.responsible_platform_user_id = responsibleId;
  const executorId = optionalPositiveInt(draft.executor_platform_user_id);
  if (executorId != null) payload.executor_platform_user_id = executorId;
  return payload;
}

export type ApiWorkTaskAttachment = {
  id: number;
  message_id: number;
  mime_type: string;
  size_bytes: number;
  original_filename: string;
  created_at: string;
};

export type ApiWorkTaskMessage = {
  id: number;
  work_task_id: number;
  author_platform_user_id: number;
  author_display_name: string | null;
  body: string;
  created_at: string;
  attachments: ApiWorkTaskAttachment[];
};

export type WorkTaskMessageView = {
  id: string;
  authorPlatformUserId: number;
  authorLabel: string;
  body: string;
  createdLabel: string;
  createdAt: string;
  attachments: Array<{
    id: string;
    filename: string;
    sizeLabel: string;
    mimeType: string;
    isImage: boolean;
    href: string;
  }>;
};

function formatMessageWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Moscow",
  }).format(date);
}

function formatAttachmentSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export const WORK_TASK_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const WORK_TASK_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export function workTaskAttachmentFileHref(
  taskId: number | string,
  attachmentId: number | string,
): string {
  return `/api/work-tasks/${taskId}/attachments/${attachmentId}/file`;
}

export function validateWorkTaskComposer(input: {
  body: string;
  file: File | null;
}): string | null {
  const text = input.body.trim();
  const file = input.file;
  if (!text && !file) {
    return "Введите текст или прикрепите изображение";
  }
  if (text.length > 5000) {
    return "Сообщение не длиннее 5000 символов";
  }
  if (file) {
    if (file.size <= 0) return "Файл пустой";
    if (file.size > WORK_TASK_IMAGE_MAX_BYTES) {
      return "Изображение не больше 10 МБ";
    }
    if (!WORK_TASK_IMAGE_MIMES.has(file.type)) {
      return "Допустимы jpeg, png, webp, gif";
    }
  }
  return null;
}

export function fromApiWorkTaskMessage(
  message: ApiWorkTaskMessage,
): WorkTaskMessageView {
  const taskId = message.work_task_id;
  return {
    id: String(message.id),
    authorPlatformUserId: message.author_platform_user_id,
    authorLabel:
      message.author_display_name?.trim() ||
      `Пользователь #${message.author_platform_user_id}`,
    body: message.body ?? "",
    createdLabel: formatMessageWhen(message.created_at),
    createdAt: message.created_at,
    attachments: (message.attachments ?? []).map((item) => ({
      id: String(item.id),
      filename: item.original_filename,
      sizeLabel: formatAttachmentSize(item.size_bytes),
      mimeType: item.mime_type,
      isImage: WORK_TASK_IMAGE_MIMES.has(item.mime_type),
      href: workTaskAttachmentFileHref(taskId, item.id),
    })),
  };
}
