"use server";

import { sessionAuthHeaders } from "@/lib/auth/api-headers";
import {
  fromApiWorkTask,
  fromApiWorkTaskListItem,
  fromApiWorkTaskMessage,
  type ApiWorkTask,
  type ApiWorkTaskListItem,
  type ApiWorkTaskMessage,
  type WorkTaskCreatePayload,
  type WorkTaskListFilters,
  type WorkTaskListItem,
  type WorkTaskMessageView,
} from "@/lib/work-tasks";

const apiBaseUrl = () =>
  (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

async function readError(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as
    | { detail?: string | Array<{ msg?: string }> }
    | null;
  if (typeof payload?.detail === "string") return payload.detail;
  if (Array.isArray(payload?.detail) && payload.detail[0]?.msg) {
    return String(payload.detail[0].msg);
  }
  return `${fallback} (${response.status})`;
}

export async function listWorkTasks(
  filters: WorkTaskListFilters = {},
): Promise<ActionResult<WorkTaskListItem[]>> {
  const headers = await sessionAuthHeaders();
  if (!headers.Cookie) {
    return { ok: false, message: "Нужна авторизация платформы для списка задач." };
  }
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
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  const response = await fetch(`${apiBaseUrl()}/work-tasks${suffix}`, {
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response, "Не удалось загрузить задачи") };
  }
  const rows = (await response.json()) as ApiWorkTaskListItem[];
  return { ok: true, data: rows.map(fromApiWorkTaskListItem) };
}

export async function getWorkTask(
  taskId: number,
): Promise<ActionResult<WorkTaskListItem>> {
  const headers = await sessionAuthHeaders();
  if (!headers.Cookie) {
    return { ok: false, message: "Нужна авторизация платформы." };
  }
  const response = await fetch(`${apiBaseUrl()}/work-tasks/${taskId}`, {
    headers,
    cache: "no-store",
  });
  if (response.status === 404) {
    return { ok: false, message: "Задача не найдена." };
  }
  if (!response.ok) {
    return { ok: false, message: await readError(response, "Не удалось загрузить задачу") };
  }
  const row = (await response.json()) as ApiWorkTask;
  return { ok: true, data: fromApiWorkTask(row) };
}

export async function listWorkTaskFilterUsers(): Promise<
  ActionResult<Array<{ id: number; label: string }>>
> {
  const headers = await sessionAuthHeaders();
  if (!headers.Cookie) {
    return { ok: false, message: "Нужна авторизация платформы." };
  }
  const response = await fetch(`${apiBaseUrl()}/platform-users?limit=500`, {
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    return {
      ok: false,
      message: await readError(response, "Не удалось загрузить пользователей"),
    };
  }
  const body = (await response.json()) as {
    items: Array<{ id: number; display_name: string; login: string }>;
  };
  return {
    ok: true,
    data: body.items.map((user) => ({
      id: user.id,
      label: user.display_name?.trim() || user.login,
    })),
  };
}

export async function createWorkTask(
  payload: WorkTaskCreatePayload,
): Promise<ActionResult<WorkTaskListItem>> {
  const headers = await sessionAuthHeaders();
  if (!headers.Cookie) {
    return { ok: false, message: "Нужна авторизация платформы." };
  }
  const response = await fetch(`${apiBaseUrl()}/work-tasks`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) {
    return { ok: false, message: await readError(response, "Не удалось создать задачу") };
  }
  const row = (await response.json()) as ApiWorkTask;
  return { ok: true, data: fromApiWorkTask(row) };
}

export async function listWorkTaskMessages(
  taskId: number,
): Promise<ActionResult<WorkTaskMessageView[]>> {
  const headers = await sessionAuthHeaders();
  if (!headers.Cookie) {
    return { ok: false, message: "Нужна авторизация платформы." };
  }
  const response = await fetch(`${apiBaseUrl()}/work-tasks/${taskId}/messages`, {
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    return {
      ok: false,
      message: await readError(response, "Не удалось загрузить сообщения"),
    };
  }
  const rows = (await response.json()) as ApiWorkTaskMessage[];
  return { ok: true, data: rows.map(fromApiWorkTaskMessage) };
}

export async function listLeadWorkTasks(
  leadId: number,
): Promise<ActionResult<WorkTaskListItem[]>> {
  const headers = await sessionAuthHeaders();
  if (!headers.Cookie) {
    return { ok: false, message: "Нужна авторизация платформы для задач." };
  }
  const response = await fetch(`${apiBaseUrl()}/leads/${leadId}/work-tasks`, {
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    return {
      ok: false,
      message: await readError(response, "Не удалось загрузить задачи лида"),
    };
  }
  const rows = (await response.json()) as ApiWorkTaskListItem[];
  return { ok: true, data: rows.map(fromApiWorkTaskListItem) };
}

export async function listOrderWorkTasks(
  orderId: number,
): Promise<ActionResult<WorkTaskListItem[]>> {
  const headers = await sessionAuthHeaders();
  if (!headers.Cookie) {
    return { ok: false, message: "Нужна авторизация платформы для задач." };
  }
  const response = await fetch(`${apiBaseUrl()}/orders/${orderId}/work-tasks`, {
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    return {
      ok: false,
      message: await readError(response, "Не удалось загрузить задачи заказа"),
    };
  }
  const rows = (await response.json()) as ApiWorkTaskListItem[];
  return { ok: true, data: rows.map(fromApiWorkTaskListItem) };
}

export async function listProductionOrderWorkTasks(
  productionOrderId: number,
): Promise<ActionResult<WorkTaskListItem[]>> {
  const headers = await sessionAuthHeaders();
  if (!headers.Cookie) {
    return { ok: false, message: "Нужна авторизация платформы для задач." };
  }
  const response = await fetch(
    `${apiBaseUrl()}/production-orders/${productionOrderId}/work-tasks`,
    {
      headers,
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return {
      ok: false,
      message: await readError(
        response,
        "Не удалось загрузить задачи производственного заказа",
      ),
    };
  }
  const rows = (await response.json()) as ApiWorkTaskListItem[];
  return { ok: true, data: rows.map(fromApiWorkTaskListItem) };
}

export async function createWorkTaskMessage(
  taskId: number,
  input: { body: string; file?: File | null },
): Promise<ActionResult<WorkTaskMessageView>> {
  const headers = await sessionAuthHeaders();
  if (!headers.Cookie) {
    return { ok: false, message: "Нужна авторизация платформы." };
  }
  const form = new FormData();
  form.append("body", input.body ?? "");
  if (input.file) {
    form.append("file", input.file);
  }
  const response = await fetch(`${apiBaseUrl()}/work-tasks/${taskId}/messages`, {
    method: "POST",
    headers,
    body: form,
    cache: "no-store",
  });
  if (!response.ok) {
    return {
      ok: false,
      message: await readError(response, "Не удалось отправить сообщение"),
    };
  }
  const row = (await response.json()) as ApiWorkTaskMessage;
  return { ok: true, data: fromApiWorkTaskMessage(row) };
}
