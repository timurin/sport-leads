"use server";

import { sessionAuthHeaders } from "@/lib/auth/api-headers";

const apiBaseUrl = () =>
  (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

export type CollaborationMention = {
  id: number;
  mentioned_platform_user_id: number;
  mentioned_login_snapshot: string;
  created_at: string;
};

export type CollaborationMessage = {
  id: number;
  thread_id: number;
  sales_order_id: number;
  author_platform_user_id: number;
  author_login: string;
  author_display_name: string;
  body: string;
  technical_card_id: number | null;
  created_at: string;
  updated_at: string;
  mentions: CollaborationMention[];
};

export type CollaborationMicrotask = {
  id: number;
  sales_order_id: number;
  title: string;
  status: "open" | "done" | string;
  assignee_platform_user_id: number;
  assignee_login: string;
  assignee_display_name: string;
  created_by_platform_user_id: number;
  created_by_login: string;
  created_by_display_name: string;
  technical_card_id: number | null;
  source_message_id: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type CollaborationMentionCandidate = {
  id: number;
  login: string;
  display_name: string;
};

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

async function readError(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as
    | { detail?: string | Array<{ msg?: string }> }
    | null;
  if (typeof payload?.detail === "string") {
    if (
      payload.detail === "Not Found" &&
      (response.status === 404 || response.status === 405)
    ) {
      return `${fallback}: маршрут API не найден (перезапустите backend на :8000).`;
    }
    return payload.detail;
  }
  if (Array.isArray(payload?.detail) && payload.detail[0]?.msg) {
    return String(payload.detail[0].msg);
  }
  return `${fallback} (${response.status})`;
}

export async function listOrderCollaborationMessages(
  orderId: number | string,
  technicalCardId?: number | null,
): Promise<ActionResult<CollaborationMessage[]>> {
  const auth = await sessionAuthHeaders();
  const params = new URLSearchParams();
  if (technicalCardId != null) {
    params.set("technical_card_id", String(technicalCardId));
  }
  const query = params.toString();
  const response = await fetch(
    `${apiBaseUrl()}/orders/${orderId}/collaboration/messages${query ? `?${query}` : ""}`,
    { headers: { ...auth }, cache: "no-store" },
  );
  if (!response.ok) {
    return {
      ok: false,
      message: await readError(response, "Не удалось загрузить переписку"),
    };
  }
  return { ok: true, data: (await response.json()) as CollaborationMessage[] };
}

export async function createOrderCollaborationMessage(
  orderId: number | string,
  payload: { body: string; technical_card_id?: number | null },
): Promise<ActionResult<CollaborationMessage>> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(
    `${apiBaseUrl()}/orders/${orderId}/collaboration/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({
        body: payload.body,
        technical_card_id: payload.technical_card_id ?? null,
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return {
      ok: false,
      message: await readError(response, "Не удалось отправить сообщение"),
    };
  }
  return { ok: true, data: (await response.json()) as CollaborationMessage };
}

export async function listOrderCollaborationMicrotasks(
  orderId: number | string,
): Promise<ActionResult<CollaborationMicrotask[]>> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(
    `${apiBaseUrl()}/orders/${orderId}/collaboration/microtasks`,
    { headers: { ...auth }, cache: "no-store" },
  );
  if (!response.ok) {
    return {
      ok: false,
      message: await readError(response, "Не удалось загрузить микрозадачи"),
    };
  }
  return { ok: true, data: (await response.json()) as CollaborationMicrotask[] };
}

export async function createOrderCollaborationMicrotask(
  orderId: number | string,
  payload: {
    title: string;
    assignee_platform_user_id: number;
    technical_card_id?: number | null;
    source_message_id?: number | null;
  },
): Promise<ActionResult<CollaborationMicrotask>> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(
    `${apiBaseUrl()}/orders/${orderId}/collaboration/microtasks`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({
        title: payload.title,
        assignee_platform_user_id: payload.assignee_platform_user_id,
        technical_card_id: payload.technical_card_id ?? null,
        source_message_id: payload.source_message_id ?? null,
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return {
      ok: false,
      message: await readError(response, "Не удалось создать микрозадачу"),
    };
  }
  return { ok: true, data: (await response.json()) as CollaborationMicrotask };
}

export async function updateCollaborationMicrotaskStatus(
  microtaskId: number,
  status: "open" | "done",
): Promise<ActionResult<CollaborationMicrotask>> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(
    `${apiBaseUrl()}/collaboration/microtasks/${microtaskId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({ status }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return {
      ok: false,
      message: await readError(response, "Не удалось обновить микрозадачу"),
    };
  }
  return { ok: true, data: (await response.json()) as CollaborationMicrotask };
}

export async function listCollaborationMentionCandidates(
  query?: string,
): Promise<ActionResult<CollaborationMentionCandidate[]>> {
  const auth = await sessionAuthHeaders();
  const params = new URLSearchParams();
  if (query?.trim()) params.set("q", query.trim());
  const qs = params.toString();
  const response = await fetch(
    `${apiBaseUrl()}/collaboration/mention-candidates${qs ? `?${qs}` : ""}`,
    { headers: { ...auth }, cache: "no-store" },
  );
  if (!response.ok) {
    return {
      ok: false,
      message: await readError(response, "Не удалось загрузить пользователей"),
    };
  }
  return {
    ok: true,
    data: (await response.json()) as CollaborationMentionCandidate[],
  };
}

export async function listCollaborationMicrotaskTitleTemplates(): Promise<
  ActionResult<string[]>
> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(
    `${apiBaseUrl()}/collaboration/microtask-title-templates`,
    { headers: { ...auth }, cache: "no-store" },
  );
  if (!response.ok) {
    return {
      ok: false,
      message: await readError(response, "Не удалось загрузить шаблоны"),
    };
  }
  return { ok: true, data: (await response.json()) as string[] };
}

export type CollaborationNotification = {
  id: number;
  kind: string;
  title: string;
  body: string;
  sales_order_id: number;
  technical_card_id: number | null;
  source_message_id: number | null;
  microtask_id: number | null;
  actor_platform_user_id: number | null;
  created_at: string;
  read_at: string | null;
  deep_link: string;
};

export type CollaborationNotificationList = {
  items: CollaborationNotification[];
  unread_count: number;
};

export async function listCollaborationNotifications(options?: {
  unreadOnly?: boolean;
  limit?: number;
}): Promise<ActionResult<CollaborationNotificationList>> {
  const auth = await sessionAuthHeaders();
  const params = new URLSearchParams();
  if (options?.unreadOnly) params.set("unread_only", "true");
  if (options?.limit != null) params.set("limit", String(options.limit));
  const qs = params.toString();
  const response = await fetch(
    `${apiBaseUrl()}/collaboration/notifications${qs ? `?${qs}` : ""}`,
    { headers: { ...auth }, cache: "no-store" },
  );
  if (!response.ok) {
    return {
      ok: false,
      message: await readError(response, "Не удалось загрузить уведомления"),
    };
  }
  return {
    ok: true,
    data: (await response.json()) as CollaborationNotificationList,
  };
}

export async function markCollaborationNotificationRead(
  notificationId: number,
): Promise<ActionResult<CollaborationNotification>> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(
    `${apiBaseUrl()}/collaboration/notifications/${notificationId}/read`,
    { method: "POST", headers: { ...auth }, cache: "no-store" },
  );
  if (!response.ok) {
    return {
      ok: false,
      message: await readError(response, "Не удалось отметить прочитанным"),
    };
  }
  return {
    ok: true,
    data: (await response.json()) as CollaborationNotification,
  };
}

export async function markAllCollaborationNotificationsRead(): Promise<
  ActionResult<{ marked: number }>
> {
  const auth = await sessionAuthHeaders();
  const response = await fetch(
    `${apiBaseUrl()}/collaboration/notifications/read-all`,
    { method: "POST", headers: { ...auth }, cache: "no-store" },
  );
  if (!response.ok) {
    return {
      ok: false,
      message: await readError(response, "Не удалось отметить все прочитанными"),
    };
  }
  return {
    ok: true,
    data: (await response.json()) as { marked: number },
  };
}
