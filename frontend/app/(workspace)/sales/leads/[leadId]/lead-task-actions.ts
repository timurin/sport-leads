"use server";

import { fromApiLeadEvent, type ApiLeadEvent } from "@/lib/sales/lead-history";
import {
  fromApiLeadTask,
  toApiLeadTaskPayload,
  type ApiLeadTask,
  type LeadTaskMutationInput,
} from "@/lib/sales/lead-task-api";
import type { LeadActivity, LeadTask } from "@/types/sales";

export type LeadTaskActionResult =
  | { ok: true; tasks: LeadTask[]; activities: LeadActivity[]; message: string }
  | { ok: false; message: string };

function apiBaseUrl() {
  return (process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
}

function validId(value: string) {
  return /^\d+$/.test(value);
}

async function errorMessage(response: Response) {
  try {
    const body = await response.json() as { detail?: string | Array<{ msg?: string }> };
    if (typeof body.detail === "string") {
      return body.detail;
    }
    if (Array.isArray(body.detail)) {
      return body.detail.map((item) => item.msg).filter(Boolean).join(" ");
    }
  } catch {
    // Keep a stable status fallback for empty / non-JSON bodies.
  }
  return `Backend отклонил запрос (${response.status}).`;
}

async function reloadLeadTaskState(leadId: string): Promise<LeadTaskActionResult> {
  const [tasksResponse, historyResponse] = await Promise.all([
    fetch(`${apiBaseUrl()}/leads/${leadId}/tasks`, { cache: "no-store" }),
    fetch(`${apiBaseUrl()}/leads/${leadId}/history`, { cache: "no-store" }),
  ]);
  if (!tasksResponse.ok) {
    return { ok: false, message: await errorMessage(tasksResponse) };
  }
  if (!historyResponse.ok) {
    return { ok: false, message: await errorMessage(historyResponse) };
  }
  const tasks = (await tasksResponse.json() as ApiLeadTask[]).map(fromApiLeadTask);
  const activities = (await historyResponse.json() as ApiLeadEvent[]).map(fromApiLeadEvent);
  return { ok: true, tasks, activities, message: "Задачи обновлены." };
}

export async function saveLeadTask(
  leadId: string,
  taskId: string | null,
  input: LeadTaskMutationInput,
): Promise<LeadTaskActionResult> {
  if (!validId(leadId) || (taskId !== null && !validId(taskId)) || !input.title.trim()) {
    return { ok: false, message: "Проверьте данные задачи и повторите попытку." };
  }

  try {
    const endpoint = taskId === null
      ? `${apiBaseUrl()}/leads/${leadId}/tasks`
      : `${apiBaseUrl()}/leads/${leadId}/tasks/${taskId}`;
    const response = await fetch(endpoint, {
      method: taskId === null ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toApiLeadTaskPayload(input)),
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, message: await errorMessage(response) };
    }
    const result = await reloadLeadTaskState(leadId);
    return result.ok
      ? {
        ...result,
        message: taskId === null ? "Задача создана." : "Задача обновлена.",
      }
      : result;
  } catch {
    return { ok: false, message: "Не удалось связаться с backend. Изменения не сохранены." };
  }
}

export async function completeLeadTask(
  leadId: string,
  taskId: string,
  resultText?: string,
): Promise<LeadTaskActionResult> {
  if (!validId(leadId) || !validId(taskId)) {
    return { ok: false, message: "Некорректный идентификатор задачи." };
  }
  try {
    const response = await fetch(`${apiBaseUrl()}/leads/${leadId}/tasks/${taskId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result: resultText ?? null }),
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, message: await errorMessage(response) };
    }
    const result = await reloadLeadTaskState(leadId);
    return result.ok ? { ...result, message: "Задача завершена." } : result;
  } catch {
    return { ok: false, message: "Не удалось связаться с backend. Задача не завершена." };
  }
}

export async function reopenLeadTask(
  leadId: string,
  taskId: string,
): Promise<LeadTaskActionResult> {
  if (!validId(leadId) || !validId(taskId)) {
    return { ok: false, message: "Некорректный идентификатор задачи." };
  }
  try {
    const response = await fetch(`${apiBaseUrl()}/leads/${leadId}/tasks/${taskId}/reopen`, {
      method: "POST",
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, message: await errorMessage(response) };
    }
    const result = await reloadLeadTaskState(leadId);
    return result.ok ? { ...result, message: "Задача открыта повторно." } : result;
  } catch {
    return { ok: false, message: "Не удалось связаться с backend. Задача не открыта." };
  }
}

export async function rescheduleLeadTask(
  leadId: string,
  taskId: string,
  dueAt: string,
): Promise<LeadTaskActionResult> {
  if (!validId(leadId) || !validId(taskId) || !dueAt) {
    return { ok: false, message: "Некорректные данные переноса срока." };
  }
  try {
    const response = await fetch(`${apiBaseUrl()}/leads/${leadId}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ due_at: dueAt }),
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, message: await errorMessage(response) };
    }
    const result = await reloadLeadTaskState(leadId);
    return result.ok ? { ...result, message: "Срок задачи обновлён." } : result;
  } catch {
    return { ok: false, message: "Не удалось связаться с backend. Срок не изменён." };
  }
}

export async function deleteLeadTask(
  leadId: string,
  taskId: string,
): Promise<LeadTaskActionResult> {
  if (!validId(leadId) || !validId(taskId)) {
    return { ok: false, message: "Некорректный идентификатор задачи." };
  }
  try {
    const response = await fetch(`${apiBaseUrl()}/leads/${leadId}/tasks/${taskId}`, {
      method: "DELETE",
      cache: "no-store",
    });
    if (!response.ok) {
      return { ok: false, message: await errorMessage(response) };
    }
    const result = await reloadLeadTaskState(leadId);
    return result.ok ? { ...result, message: "Задача удалена." } : result;
  } catch {
    return { ok: false, message: "Не удалось связаться с backend. Задача не удалена." };
  }
}
