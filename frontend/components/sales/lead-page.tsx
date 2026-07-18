"use client";

import {
  Mail,
  MessageCircle,
  PhoneCall,
  Plus,
  ShoppingBag,
} from "lucide-react";
import { useRef, useState } from "react";

import { LeadActivityTimeline } from "@/components/sales/lead-activity-timeline";
import {
  LeadCompletionDialog,
  leadRejectionReasons,
  type LeadCompletionMode,
  type LeadOrderDraft,
  type RejectionReasonOption,
} from "@/components/sales/lead-completion-dialog";
import { LeadHeader } from "@/components/sales/lead-header";
import { LeadCommercialDetails } from "@/components/sales/lead-commercial-details";
import { LeadCommunicationPanel, type LeadMessageDraft } from "@/components/sales/lead-communication-panel";
import { LeadCustomerDetails } from "@/components/sales/lead-customer-details";
import { LeadTaskCompleteDialog, LeadTaskDeleteDialog, LeadTaskEditDialog, type LeadTaskDraft } from "@/components/sales/lead-task-dialog";
import { LeadTasks } from "@/components/sales/lead-tasks";
import { PageActions, PageContent, ResponsiveGrid } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { mockCurrentUser, salesManagers } from "@/lib/demo-data/sales";
import { getNotePermissions, isInternalNote } from "@/lib/sales/lead-activity";
import { formatCurrency } from "@/lib/sales/lead-commercial";
import type { LeadDetails } from "@/lib/sales/lead-details";
import { convertLead, rejectLead } from "@/app/(workspace)/sales/leads/[leadId]/lead-header-actions";
import type { LeadFinalActionId } from "@/lib/sales/lead-final-actions";
import type { LeadStageConfig } from "@/lib/sales/lead-stages";
import { formatAttachmentSize, leadMessageChannelLabels } from "@/lib/sales/lead-message";
import { formatTaskDate, getNearestLeadTask, rescheduleTaskDueAt, type LeadTaskFilter } from "@/lib/sales/lead-task";
import type { Lead, LeadActivity, LeadMessage, LeadTask, Priority } from "@/types/sales";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Moscow",
});
const workspaceTabs = [
  { id: "communication", label: "Коммуникации" },
  { id: "history", label: "История" },
  { id: "notes", label: "Заметки" },
  { id: "tasks", label: "Задачи" },
] as const;
type WorkspaceTab = (typeof workspaceTabs)[number]["id"];
const referenceTabs = [
  { id: "customer", label: "Клиент и контакты" },
  { id: "commercial", label: "Коммерческие параметры" },
] as const;
type ReferenceTab = (typeof referenceTabs)[number]["id"];

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function KeyMetric({ label, value, detail, prominent = false }: { label: string; value: string; detail?: string; prominent?: boolean }) {
  return (
    <dl className="min-w-0 rounded-[var(--portal-radius-md)] border border-portal-border bg-portal-surface-secondary px-3 py-3 shadow-[var(--portal-shadow-sm)]">
      <dt className="text-[11px] font-medium leading-4 text-portal-muted">{label}</dt>
      <dd className={`mt-1.5 break-words font-bold ${prominent ? "text-lg text-portal-success" : "text-base text-portal-text"}`} title={value}>{value}</dd>
      {detail ? <dd className="mt-0.5 break-words text-xs text-portal-muted" title={detail}>{detail}</dd> : null}
    </dl>
  );
}

function cloneLead(lead: LeadDetails): LeadDetails {
  return {
    ...lead,
    commercial: { ...lead.commercial },
    activities: lead.activities.map((activity) => ({
      ...activity,
      author: activity.author ? { ...activity.author } : undefined,
      metadata: activity.metadata ? { ...activity.metadata } : undefined,
      attachments: activity.attachments?.map((attachment) => ({ ...attachment })),
      mentionedUserIds: activity.mentionedUserIds ? [...activity.mentionedUserIds] : undefined,
    })),
    tasks: lead.tasks.map((task) => ({
      ...task,
      assignedTo: { ...task.assignedTo },
      createdBy: { ...task.createdBy },
    })),
    messages: lead.messages.map((message) => ({
      ...message,
      author: message.author ? { ...message.author } : undefined,
      attachments: message.attachments?.map((attachment) => ({ ...attachment })),
    })),
    customer: {
      ...lead.customer,
      contacts: lead.customer.contacts.map((contact) => ({ ...contact })),
    },
  };
}

type TaskDialogState =
  | { kind: "edit"; task: LeadTask | null }
  | { kind: "complete"; task: LeadTask }
  | { kind: "delete"; task: LeadTask }
  | null;

function createLocalActivityId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `lead-activity-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createLocalTaskId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `lead-task-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createLocalMessageId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `lead-message-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function LeadPage({
  lead: initialLead,
  stages,
}: {
  lead: LeadDetails;
  stages: LeadStageConfig[];
}) {
  const [lead, setLead] = useState<LeadDetails>(() => cloneLead(initialLead));
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("communication");
  const [referenceTab, setReferenceTab] = useState<ReferenceTab>("customer");
  const [taskDialog, setTaskDialog] = useState<TaskDialogState>(null);
  const [completionMode, setCompletionMode] = useState<LeadCompletionMode | null>(null);
  const [taskFilter, setTaskFilter] = useState<LeadTaskFilter>("open");
  const taskDialogTriggerRef = useRef<HTMLElement | null>(null);

  function updateCustomer(customer: LeadDetails["customer"]) {
    const primaryContact = customer.contacts.find((contact) => contact.isPrimary);
    const occurredAt = new Date().toISOString();
    const activity: LeadActivity = {
      id: createLocalActivityId(),
      type: "customer_updated",
      occurredAt,
      author: { id: "user-2", name: "Мария Иванова" },
      title: "Данные клиента обновлены",
      description: primaryContact
        ? `Актуальный основной контакт: ${primaryContact.name}.`
        : "Обновлены данные клиента и список контактов.",
      isSystem: true,
    };

    setLead((current) => ({
      ...current,
      lastActivityAt: occurredAt,
      contactName: primaryContact?.name ?? current.contactName,
      activities: [activity, ...current.activities],
      customer: {
        ...customer,
        contacts: customer.contacts.map((contact) => ({ ...contact })),
      },
    }));
  }

  function updateCommercial({
    commercial,
    source,
    estimatedAmount,
    probability,
  }: Pick<LeadDetails, "commercial" | "source" | "estimatedAmount" | "probability">) {
    const occurredAt = new Date().toISOString();
    const activityId = createLocalActivityId();
    setLead((current) => {
      const changes: string[] = [];
      if (current.estimatedAmount !== estimatedAmount) {
        changes.push(`Сумма: ${formatCurrency(current.estimatedAmount)} → ${formatCurrency(estimatedAmount)}.`);
      }
      if (current.probability !== probability) {
        const previousProbability = current.probability === null ? "не указана" : `${current.probability}%`;
        const nextProbability = probability === null ? "не указана" : `${probability}%`;
        changes.push(`Вероятность: ${previousProbability} → ${nextProbability}.`);
      }
      if (current.source !== source) {
        changes.push(`Источник: ${current.source ?? "не указан"} → ${source ?? "не указан"}.`);
      }
      const activity: LeadActivity = {
        id: activityId,
        type: "commercial_updated",
        occurredAt,
        author: { id: "user-2", name: "Мария Иванова" },
        title: "Коммерческие параметры обновлены",
        description: changes.length ? changes.join(" ") : "Обновлены параметры потребности и будущего заказа.",
        isSystem: true,
      };
      return {
        ...current,
        commercial: { ...commercial },
        source,
        estimatedAmount,
        probability,
        lastActivityAt: occurredAt,
        activities: [activity, ...current.activities],
      };
    });
  }

  function addComment(text: string, mentionedUserIds: string[]) {
    const occurredAt = new Date().toISOString();
    const activity: LeadActivity = {
      id: createLocalActivityId(),
      type: "comment_added",
      occurredAt,
      author: { id: mockCurrentUser.id, name: mockCurrentUser.name },
      title: "Добавлена внутренняя заметка",
      description: text,
      channel: "internal",
      isPinned: false,
      mentionedUserIds: [...mentionedUserIds],
    };
    setLead((current) => ({
      ...current,
      lastActivityAt: occurredAt,
      activities: [activity, ...current.activities],
    }));
  }

  function editNote(noteId: string, text: string, mentionedUserIds: string[]) {
    const updatedAt = new Date().toISOString();
    setLead((current) => {
      const note = current.activities.find((activity) => activity.id === noteId);
      if (!note || !getNotePermissions(note, mockCurrentUser.id).canEdit) {
        return current;
      }
      return {
        ...current,
        lastActivityAt: updatedAt,
        activities: current.activities.map((activity) => activity.id === noteId
          ? { ...activity, description: text, updatedAt, mentionedUserIds: [...mentionedUserIds] }
          : activity),
      };
    });
  }

  function deleteNote(noteId: string) {
    setLead((current) => {
      const note = current.activities.find((activity) => activity.id === noteId);
      if (!note || !getNotePermissions(note, mockCurrentUser.id).canDelete) {
        return current;
      }
      return { ...current, activities: current.activities.filter((activity) => activity.id !== noteId) };
    });
  }

  function toggleNotePin(noteId: string) {
    setLead((current) => ({
      ...current,
      activities: current.activities.map((activity) => activity.id === noteId && isInternalNote(activity)
        ? { ...activity, isPinned: !activity.isPinned }
        : activity),
    }));
  }

  function openTaskDialog(dialog: Exclude<TaskDialogState, null>, trigger: HTMLElement) {
    taskDialogTriggerRef.current = trigger;
    setTaskDialog(dialog);
  }

  function closeTaskDialog() {
    setTaskDialog(null);
    window.requestAnimationFrame(() => {
      const trigger = taskDialogTriggerRef.current;
      if (trigger?.isConnected) trigger.focus();
      else document.getElementById("lead-tasks-heading")?.focus();
    });
  }

  function taskActivity(id: string, type: "task_created" | "task_updated" | "task_completed", title: string, description: string, occurredAt: string): LeadActivity {
    return {
      id,
      type,
      occurredAt,
      author: { id: mockCurrentUser.id, name: mockCurrentUser.name },
      title,
      description,
      isSystem: true,
    };
  }

  function saveTask(existingTask: LeadTask | null, draft: LeadTaskDraft) {
    const assignedTo = salesManagers.find((manager) => manager.id === draft.assignedToId);
    if (!assignedTo) return;
    const occurredAt = new Date().toISOString();
    const activityId = createLocalActivityId();
    const newTaskId = existingTask ? null : createLocalTaskId();
    setLead((current) => {
      if (existingTask) {
        const tasks = current.tasks.map((task) => task.id === existingTask.id
          ? {
            ...task,
            title: draft.title,
            type: draft.type,
            priority: draft.priority,
            assignedTo: { ...assignedTo },
            dueAt: draft.dueAt,
            description: draft.description,
          }
          : task);
        const activity = taskActivity(activityId, "task_updated", "Задача обновлена", `Обновлена задача «${draft.title}». Новый срок: ${formatTaskDate(draft.dueAt)}.`, occurredAt);
        return { ...current, tasks, activities: [activity, ...current.activities], lastActivityAt: occurredAt, taskReferenceAt: occurredAt };
      }
      if (!newTaskId) return current;
      const task: LeadTask = {
        id: newTaskId,
        leadId: current.id,
        title: draft.title,
        type: draft.type,
        status: "open",
        priority: draft.priority,
        assignedTo: { ...assignedTo },
        dueAt: draft.dueAt,
        description: draft.description,
        createdAt: occurredAt,
        createdBy: { ...mockCurrentUser },
      };
      const activity = taskActivity(activityId, "task_created", `Создана задача «${task.title}»`, `Срок: ${formatTaskDate(task.dueAt)}. Исполнитель: ${task.assignedTo.name}.`, occurredAt);
      return { ...current, tasks: [...current.tasks, task], activities: [activity, ...current.activities], lastActivityAt: occurredAt, taskReferenceAt: occurredAt };
    });
    closeTaskDialog();
  }

  function completeTask(taskId: string, result?: string) {
    const occurredAt = new Date().toISOString();
    const activityId = createLocalActivityId();
    setLead((current) => {
      const task = current.tasks.find((item) => item.id === taskId);
      if (!task || task.status !== "open") return current;
      const activity = taskActivity(activityId, "task_completed", `Завершена задача «${task.title}»`, result ? `Результат: ${result}` : "Задача отмечена выполненной.", occurredAt);
      return {
        ...current,
        tasks: current.tasks.map((item) => item.id === taskId ? { ...item, status: "completed", completedAt: occurredAt, result } : item),
        activities: [activity, ...current.activities],
        lastActivityAt: occurredAt,
        taskReferenceAt: occurredAt,
      };
    });
    closeTaskDialog();
  }

  function reopenTask(task: LeadTask) {
    const occurredAt = new Date().toISOString();
    const activity = taskActivity(createLocalActivityId(), "task_updated", `Задача «${task.title}» открыта повторно`, "Результат предыдущего выполнения очищен.", occurredAt);
    setLead((current) => ({
      ...current,
      tasks: current.tasks.map((item) => item.id === task.id ? { ...item, status: "open", completedAt: undefined, result: undefined } : item),
      activities: [activity, ...current.activities],
      lastActivityAt: occurredAt,
      taskReferenceAt: occurredAt,
    }));
  }

  function rescheduleTask(task: LeadTask, days: number) {
    const occurredAt = new Date().toISOString();
    const dueAt = rescheduleTaskDueAt(task.dueAt, occurredAt, days);
    const activity = taskActivity(createLocalActivityId(), "task_updated", `Срок задачи «${task.title}» перенесён`, `Новый срок: ${formatTaskDate(dueAt)}.`, occurredAt);
    setLead((current) => ({
      ...current,
      tasks: current.tasks.map((item) => item.id === task.id ? { ...item, dueAt } : item),
      activities: [activity, ...current.activities],
      lastActivityAt: occurredAt,
      taskReferenceAt: occurredAt,
    }));
  }

  function deleteTask(taskId: string) {
    setLead((current) => ({ ...current, tasks: current.tasks.filter((task) => task.id !== taskId) }));
    closeTaskDialog();
  }

  function sendMessage(draft: LeadMessageDraft) {
    const sentAt = new Date().toISOString();
    const messageId = createLocalMessageId();
    const message: LeadMessage = {
      id: messageId,
      leadId: lead.id,
      channel: draft.channel,
      direction: "outgoing",
      text: draft.text,
      author: { ...mockCurrentUser },
      recipientName: draft.recipientName,
      sentAt,
      status: "sent",
      attachments: draft.attachments.map((attachment) => ({ ...attachment })),
      isMock: true,
    };
    const activity: LeadActivity = {
      id: createLocalActivityId(),
      type: draft.channel === "email" ? "email_sent" : "outgoing_message",
      occurredAt: sentAt,
      author: { id: mockCurrentUser.id, name: mockCurrentUser.name },
      title: draft.channel === "email" ? "Отправлено письмо клиенту" : "Отправлено сообщение клиенту",
      description: draft.text || "Сообщение содержит вложение.",
      direction: "outgoing",
      channel: draft.channel,
      metadata: { messageId },
      attachments: draft.attachments.map((attachment) => ({
        id: attachment.id,
        name: attachment.name,
        mediaType: attachment.type || "Файл",
        sizeLabel: formatAttachmentSize(attachment.size),
      })),
    };
    setLead((current) => ({
      ...current,
      messages: [...current.messages, message],
      activities: [activity, ...current.activities],
      lastActivityAt: sentAt,
    }));
  }

  function openWorkspaceSection(tab: WorkspaceTab) {
    setWorkspaceTab(tab);
    window.requestAnimationFrame(() => {
      document.getElementById(`lead-workspace-panel-${tab}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById(`lead-workspace-tab-${tab}`)?.focus({ preventScroll: true });
    });
  }

  function openReferenceSection(tab: ReferenceTab) {
    setReferenceTab(tab);
    window.requestAnimationFrame(() => {
      document.getElementById(`lead-reference-panel-${tab}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById(`lead-reference-tab-${tab}`)?.focus({ preventScroll: true });
    });
  }

  function moveWorkspaceTab(event: React.KeyboardEvent<HTMLButtonElement>, currentTab: WorkspaceTab) {
    const currentIndex = workspaceTabs.findIndex((tab) => tab.id === currentTab);
    const targetIndex = event.key === "ArrowRight"
      ? (currentIndex + 1) % workspaceTabs.length
      : event.key === "ArrowLeft"
        ? (currentIndex - 1 + workspaceTabs.length) % workspaceTabs.length
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? workspaceTabs.length - 1
            : -1;
    if (targetIndex < 0) return;
    event.preventDefault();
    const targetTab = workspaceTabs[targetIndex].id;
    setWorkspaceTab(targetTab);
    window.requestAnimationFrame(() => document.getElementById(`lead-workspace-tab-${targetTab}`)?.focus());
  }

  function moveReferenceTab(event: React.KeyboardEvent<HTMLButtonElement>, currentTab: ReferenceTab) {
    const currentIndex = referenceTabs.findIndex((tab) => tab.id === currentTab);
    const targetIndex = event.key === "ArrowRight"
      ? (currentIndex + 1) % referenceTabs.length
      : event.key === "ArrowLeft"
        ? (currentIndex - 1 + referenceTabs.length) % referenceTabs.length
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? referenceTabs.length - 1
            : -1;
    if (targetIndex < 0) return;
    event.preventDefault();
    const targetTab = referenceTabs[targetIndex].id;
    setReferenceTab(targetTab);
    window.requestAnimationFrame(() => document.getElementById(`lead-reference-tab-${targetTab}`)?.focus());
  }

  const nearestTask = getNearestLeadTask(lead.tasks, lead.taskReferenceAt);
  const primaryContact = lead.customer.contacts.find((contact) => contact.isPrimary);
  const daysInWork = Math.max(0, Math.ceil((new Date(lead.taskReferenceAt).getTime() - new Date(lead.createdAt).getTime()) / 86_400_000));
  const preferredChannel = primaryContact?.preferredChannel && primaryContact.preferredChannel !== "unspecified"
    ? leadMessageChannelLabels[primaryContact.preferredChannel]
    : "Не указано";
  const completionLead: Lead = {
    id: lead.id,
    status: lead.status === "completed" ? "completed" : "new",
    stageId: lead.stageId,
    clientName: lead.customer.organizationName ?? lead.title,
    contact: lead.contactName,
    city: lead.customer.city ?? lead.commercial.deliveryCity ?? "Не указан",
    sport: lead.commercial.sport ?? "Не указан",
    estimatedAmount: lead.estimatedAmount ?? 0,
    source: lead.source ?? "Не указан",
    responsible: lead.responsible
      ? { ...lead.responsible, initials: lead.responsible.name.slice(0, 2).toUpperCase() }
      : { id: "unassigned", name: "Не назначен", initials: "—" },
    nextContact: nearestTask ? formatTaskDate(nearestTask.dueAt) : "Не запланирован",
    priority: (lead.commercial.priority ?? "medium") as Priority,
    result: lead.result,
    completedAt: lead.completedAt ? formatDate(lead.completedAt) : undefined,
    completedBy: lead.completedBy
      ? { ...lead.completedBy, initials: lead.completedBy.name.slice(0, 2).toUpperCase() }
      : undefined,
    convertedOrderId: lead.convertedOrderId,
    convertedOrderNumber: lead.convertedOrderNumber,
    rejectionReason: lead.rejectionReason,
    rejectionComment: lead.rejectionComment,
    productCategory: lead.commercial.productCategory,
    quantity: lead.commercial.estimatedQuantity,
    needDescription: lead.commercial.needDescription,
    desiredDate: lead.commercial.desiredReadyDate,
  };

  function openFinalAction(action: LeadFinalActionId) {
    setCompletionMode(action === "convert" ? "convert" : "reject");
  }

  async function convertDetailLead(leadId: string, draft: LeadOrderDraft) {
    const result = await convertLead(leadId, draft);
    if (!result.ok) {
      return result;
    }
    setLead((current) => ({
      ...current,
      status: "completed",
      stageId: undefined,
      statusLabel: "Завершён",
      result: "converted",
      completedAt: new Date().toISOString(),
      completedBy: current.responsible ?? undefined,
      convertedOrderId: result.orderId,
      convertedOrderNumber: result.orderNumber,
    }));
    return result;
  }

  async function rejectDetailLead(leadId: string, reason: RejectionReasonOption, comment: string) {
    const result = await rejectLead(leadId, reason, comment);
    if (!result.ok) {
      return result;
    }
    setLead((current) => ({
      ...current,
      status: "completed",
      stageId: undefined,
      statusLabel: "Завершён",
      result: "rejected",
      completedAt: new Date().toISOString(),
      completedBy: current.responsible ?? undefined,
      rejectionReason: reason.name,
      rejectionComment: comment || undefined,
    }));
    return result;
  }

  return (
    <div data-lead-workspace className="w-full min-w-0 bg-portal-page text-portal-text">
      <LeadHeader
        key={`${lead.id}-${lead.status}-${lead.stageId ?? "final"}`}
        lead={lead}
        initialStages={stages}
        lastActivityAtLabel={formatDate(lead.lastActivityAt)}
        onAddTask={(trigger) => openTaskDialog({ kind: "edit", task: null }, trigger)}
        onWrite={() => openWorkspaceSection("communication")}
        onFinalAction={openFinalAction}
      />

      <PageContent size="compact" width="full" className="lead-page-container">
        <div className="lead-main-grid grid min-w-0 gap-4">
          <div className="lead-left-column min-w-0 space-y-3">
            <nav className="sr-only" aria-label="Данные лида">
              {referenceTabs.map(({ id, label }) => <button key={id} id={`lead-reference-tab-${id}`} type="button" aria-current={referenceTab === id ? "page" : undefined} onClick={() => openReferenceSection(id)} onKeyDown={(event) => moveReferenceTab(event, id)} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${referenceTab === id ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-white hover:text-slate-800"}`}>{label}</button>)}
            </nav>

            <ResponsiveGrid minItemWidth="large" gap="default" className="lead-reference-grid">
              <div id="lead-reference-panel-customer" className="min-w-0 rounded-[var(--portal-radius-lg)] border border-portal-border bg-portal-surface shadow-[var(--portal-shadow-card)]">
                <LeadCustomerDetails
                  embedded
                  compact
                  customer={lead.customer}
                  leadId={lead.id}
                  contactPersistence={lead.dataOrigin === "api" ? "api" : "local"}
                  onCustomerChange={updateCustomer}
                />
              </div>
              <div id="lead-reference-panel-commercial" className="min-w-0 rounded-[var(--portal-radius-lg)] border border-portal-border bg-portal-surface shadow-[var(--portal-shadow-card)]">
                <LeadCommercialDetails
                  embedded
                  compact
                  commercial={lead.commercial}
                  source={lead.source}
                  estimatedAmount={lead.estimatedAmount}
                  probability={lead.probability}
                  leadId={lead.id}
                  persistence={lead.dataOrigin === "api" ? "api" : "local"}
                  onChange={updateCommercial}
                />
              </div>
            </ResponsiveGrid>

            <section className="min-w-0 rounded-[var(--portal-radius-lg)] border border-portal-border bg-portal-surface p-3 shadow-[var(--portal-shadow-card)]" aria-labelledby="lead-metrics-heading">
              <h2 id="lead-metrics-heading" className="text-sm font-bold text-portal-text">Ключевые метрики лида</h2>
              <ResponsiveGrid minItemWidth="small" gap="compact" className="lead-metrics-grid mt-2">
                <KeyMetric label="Вероятность конверсии" value={lead.probability === null ? "Не указана" : `${lead.probability}%`} />
                <KeyMetric label="Последний контакт" value={formatDate(lead.lastActivityAt)} />
                <KeyMetric label="Следующий контакт" value={nearestTask ? formatTaskDate(nearestTask.dueAt) : "Не запланирован"} detail={nearestTask?.title} />
                <KeyMetric label="Дней в работе" value={`${daysInWork} дн.`} detail={`с ${formatDate(lead.createdAt)}`} />
                <KeyMetric label="Количество касаний" value={String(lead.activities.length)} detail="событий в истории" />
                <KeyMetric label="Потенциальная сумма" value={formatCurrency(lead.estimatedAmount)} prominent />
              </ResponsiveGrid>
            </section>

            <nav id="lead-workspace-sections-heading" className="sr-only" aria-label="Рабочие разделы лида">
              {workspaceTabs.filter(({ id }) => id !== "communication").map(({ id, label }) => (
                <button key={id} id={`lead-workspace-tab-${id}`} type="button" aria-current={workspaceTab === id ? "page" : undefined} onClick={() => openWorkspaceSection(id)} onKeyDown={(event) => moveWorkspaceTab(event, id)} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${workspaceTab === id ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-white hover:text-slate-800"}`}>{label}</button>
              ))}
              <button id="lead-workspace-tab-communication" type="button" className="sr-only" onClick={() => openWorkspaceSection("communication")}>Коммуникации</button>
            </nav>

            <div className="lead-bottom-grid grid min-w-0 items-start gap-3">
              <div id="lead-workspace-panel-history" className="lead-history-card min-w-0 rounded-[var(--portal-radius-lg)] border border-portal-border bg-portal-surface shadow-[var(--portal-shadow-card)]"><LeadActivityTimeline embedded compact mode="history" activities={lead.activities} currentUser={mockCurrentUser} managers={salesManagers} onAddComment={addComment} onEditNote={editNote} onDeleteNote={deleteNote} onTogglePin={toggleNotePin} /></div>
              <div id="lead-workspace-panel-tasks" className="lead-tasks-card min-w-0 rounded-[var(--portal-radius-lg)] border border-portal-border bg-portal-surface shadow-[var(--portal-shadow-card)]"><LeadTasks embedded compact tasks={lead.tasks} referenceAt={lead.taskReferenceAt} filter={taskFilter} onFilterChange={setTaskFilter} onAdd={(trigger) => openTaskDialog({ kind: "edit", task: null }, trigger)} onEdit={(task, trigger) => openTaskDialog({ kind: "edit", task }, trigger)} onComplete={(task, trigger) => openTaskDialog({ kind: "complete", task }, trigger)} onDelete={(task, trigger) => openTaskDialog({ kind: "delete", task }, trigger)} onReopen={reopenTask} onReschedule={rescheduleTask} /></div>
              <div id="lead-workspace-panel-notes" className="lead-notes-card min-w-0 rounded-[var(--portal-radius-lg)] border border-portal-border bg-portal-surface shadow-[var(--portal-shadow-card)]"><LeadActivityTimeline embedded compact mode="notes" activities={lead.activities} currentUser={mockCurrentUser} managers={salesManagers} onAddComment={addComment} onEditNote={editNote} onDeleteNote={deleteNote} onTogglePin={toggleNotePin} /></div>
            </div>
          </div>

          <aside id="lead-workspace-panel-communication" data-lead-communication-column className="lead-communication-column min-w-0 self-start overflow-hidden rounded-[var(--portal-radius-lg)] border border-portal-border bg-portal-surface shadow-[var(--portal-shadow-card)]">
            <LeadCommunicationPanel
              embedded
              messages={lead.messages}
              primaryContact={primaryContact}
              customerWebsite={lead.customer.website}
              onSend={sendMessage}
              customerSummary={(
                <div className="flex h-full min-w-0 flex-col p-3.5">
                  <h3 className="text-sm font-bold text-portal-text">Карточка клиента</h3>
                  <dl className="mt-4 space-y-4">
                    <div><dt className="text-[11px] text-slate-500">Основной контакт</dt><dd className="mt-1 text-sm font-semibold text-slate-900">{primaryContact?.name ?? "Не указан"}</dd></div>
                    <div><dt className="text-[11px] text-slate-500">Предпочтительный канал</dt><dd className="mt-1 text-sm font-semibold text-blue-700">{preferredChannel}</dd></div>
                    <div><dt className="text-[11px] text-slate-500">Среднее время ответа</dt><dd className="mt-1 text-sm font-semibold text-slate-900">Не указано</dd></div>
                    <div><dt className="text-[11px] text-slate-500">Часовой пояс</dt><dd className="mt-1 text-sm font-semibold text-slate-900">Не указано</dd></div>
                  </dl>
                  <div className="mt-auto space-y-2 pt-5">
                    {primaryContact?.phone ? <a href={`tel:${primaryContact.phone}`} className="flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"><PhoneCall size={14} /> Позвонить</a> : null}
                    {primaryContact?.email ? <a href={`mailto:${primaryContact.email}`} className="flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Mail size={14} /> Написать email</a> : null}
                    <button type="button" onClick={() => openReferenceSection("customer")} className="h-9 w-full rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50">Открыть профиль клиента</button>
                  </div>
                </div>
              )}
            />
            <PageActions className="border-t border-portal-border bg-portal-surface-secondary p-3" align="start">
              <Button type="button" variant="primary" onClick={() => openWorkspaceSection("communication")} className="h-9 basis-[calc(50%-0.25rem)] px-2 sm:basis-auto"><MessageCircle size={15} /> Написать</Button>
              <Button type="button" onClick={(event) => openTaskDialog({ kind: "edit", task: null }, event.currentTarget)} className="h-9 basis-[calc(50%-0.25rem)] px-2 sm:basis-auto"><Plus size={15} /> Задача</Button>
              {primaryContact?.phone ? <a href={`tel:${primaryContact.phone}`} className="inline-flex h-9 basis-[calc(50%-0.25rem)] items-center justify-center gap-2 rounded-[var(--portal-radius-md)] border border-portal-border bg-portal-surface px-2 text-sm font-medium text-portal-text hover:bg-portal-surface-secondary sm:basis-auto"><PhoneCall size={15} /> Позвонить</a> : <Button type="button" disabled className="h-9 basis-[calc(50%-0.25rem)] px-2 sm:basis-auto"><PhoneCall size={15} /> Позвонить</Button>}
              <Button type="button" disabled title="Создание заказа будет доступно позже" className="h-9 basis-[calc(50%-0.25rem)] px-2 sm:basis-auto"><ShoppingBag size={15} /> Заказ</Button>
            </PageActions>
          </aside>
        </div>
      </PageContent>

      {taskDialog?.kind === "edit" ? (
        <LeadTaskEditDialog
          key={taskDialog.task?.id ?? "new-task"}
          task={taskDialog.task}
          referenceAt={lead.taskReferenceAt}
          managers={salesManagers}
          onClose={closeTaskDialog}
          onSave={(draft) => saveTask(taskDialog.task, draft)}
        />
      ) : null}
      {taskDialog?.kind === "complete" ? (
        <LeadTaskCompleteDialog task={taskDialog.task} onClose={closeTaskDialog} onConfirm={(result) => completeTask(taskDialog.task.id, result)} />
      ) : null}
      {taskDialog?.kind === "delete" ? (
        <LeadTaskDeleteDialog task={taskDialog.task} onClose={closeTaskDialog} onConfirm={() => deleteTask(taskDialog.task.id)} />
      ) : null}
      {completionMode ? (
        <LeadCompletionDialog
          key={`${lead.id}-${completionMode}`}
          lead={completionLead}
          reasons={leadRejectionReasons}
          initialMode={completionMode}
          onClose={() => setCompletionMode(null)}
          onConvert={convertDetailLead}
          onReject={rejectDetailLead}
        />
      ) : null}
    </div>
  );
}
