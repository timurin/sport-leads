import type { LeadTask, LeadTaskType, Priority, UserSummary } from "@/types/sales";
import { leadTaskTypes, priorities } from "@/types/sales";

export type ApiLeadTask = {
  id: number;
  lead_id: number;
  title: string;
  task_type: string;
  priority: string;
  description: string | null;
  result: string | null;
  status: string;
  due_at: string | null;
  assigned_to_id: number | null;
  assigned_to_name: string | null;
  created_by_id: number | null;
  created_by_name: string | null;
  created_at: string;
  completed_at: string | null;
};

export type ApiSalesUser = {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
};

export type LeadTaskMutationInput = {
  title: string;
  type: LeadTaskType;
  priority: Priority;
  description?: string;
  dueAt: string;
  assignedToId: string;
};

function asTaskType(value: string): LeadTaskType {
  return (leadTaskTypes as readonly string[]).includes(value)
    ? (value as LeadTaskType)
    : "other";
}

function asPriority(value: string): Priority {
  return (priorities as readonly string[]).includes(value)
    ? (value as Priority)
    : "medium";
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function userSummary(id: number | null, name: string | null, fallbackId: string): UserSummary {
  if (id !== null) {
    const displayName = name ?? `Сотрудник #${id}`;
    return { id: String(id), name: displayName, initials: initialsFromName(displayName) };
  }
  const displayName = name ?? "Не назначен";
  return { id: fallbackId, name: displayName, initials: initialsFromName(displayName) };
}

export function fromApiLeadTask(task: ApiLeadTask): LeadTask {
  const dueAt = task.due_at ?? task.created_at;
  return {
    id: String(task.id),
    leadId: String(task.lead_id),
    title: task.title,
    type: asTaskType(task.task_type),
    status: task.status === "open" ? "open" : "completed",
    priority: asPriority(task.priority),
    assignedTo: userSummary(task.assigned_to_id, task.assigned_to_name, "unassigned"),
    dueAt,
    description: task.description ?? undefined,
    result: task.result ?? undefined,
    createdAt: task.created_at,
    completedAt: task.completed_at ?? undefined,
    createdBy: userSummary(task.created_by_id, task.created_by_name, "system"),
  };
}

export function fromApiSalesUser(user: ApiSalesUser): UserSummary {
  return { id: String(user.id), name: user.name, initials: initialsFromName(user.name) };
}

export function toApiLeadTaskPayload(input: LeadTaskMutationInput) {
  const assignedToId = /^\d+$/.test(input.assignedToId) ? Number(input.assignedToId) : null;
  return {
    title: input.title,
    task_type: input.type,
    priority: input.priority,
    description: input.description ?? null,
    due_at: input.dueAt,
    assigned_to_id: assignedToId,
  };
}
