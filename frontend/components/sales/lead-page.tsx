"use client";

import {
  Plus,
} from "lucide-react";
import { useEffect, useState } from "react";

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
import { HostWorkTasksPanel } from "@/components/sales/host-work-tasks-panel";
import { OrderCollaborationPanel } from "@/components/sales/order-collaboration-panel";
import { WorkTaskCreateDrawer, type WorkTaskAnchorOption } from "@/components/sales/work-task-create-drawer";
import { ComplexEntityCard } from "@/components/entity/complex-entity-card";
import { PageContent, PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { CompactTabs } from "@/components/ui/compact-tabs";

import { getNotePermissions, isInternalNote } from "@/lib/sales/lead-activity";
import { formatCurrency } from "@/lib/sales/lead-commercial";
import type { LeadDetails } from "@/lib/sales/lead-details";
import { convertLead, rejectLead } from "@/app/(workspace)/sales/leads/[leadId]/lead-header-actions";
import {
  createLeadNote as createLeadNoteAction,
  deleteLeadNote as deleteLeadNoteAction,
  toggleLeadNotePin as toggleLeadNotePinAction,
  updateLeadNote as updateLeadNoteAction,
} from "@/app/(workspace)/sales/leads/[leadId]/lead-note-actions";
import { sendLeadMessage as sendLeadMessageAction } from "@/app/(workspace)/sales/leads/[leadId]/lead-message-actions";
import { leadMessageToActivity } from "@/lib/sales/lead-message-api";
import type { LeadFinalActionId } from "@/lib/sales/lead-final-actions";
import type { LeadStageConfig } from "@/lib/sales/lead-stages";
import { formatAttachmentSize } from "@/lib/sales/lead-message";
import type { WorkTaskListItem } from "@/lib/work-tasks";
import type { Lead, LeadActivity, LeadMessage, Priority } from "@/types/sales";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Moscow",
});
const mobileTabs = [
  { id: "communication", label: "Коммуникации" },
  { id: "customer", label: "Клиент" },
  { id: "interest", label: "Интерес" },
] as const;
type MobileTab = (typeof mobileTabs)[number]["id"];
const feedTabs = [
  { id: "communication", label: "Коммуникация" },
  { id: "tasks", label: "Задачи" },
  { id: "notes", label: "Заметки" },
  { id: "history", label: "История" },
] as const;
type FeedTab = (typeof feedTabs)[number]["id"];

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
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
    taskManagers: lead.taskManagers.map((manager) => ({ ...manager })),
    currentActor: { ...lead.currentActor },
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

function createLocalActivityId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `lead-activity-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
  workTasks: initialWorkTasks = [],
  workTasksError = null,
  workTaskStages = [],
  workTaskUsers = [],
  viewerUserId = null,
}: {
  lead: LeadDetails;
  stages: LeadStageConfig[];
  workTasks?: WorkTaskListItem[];
  workTasksError?: string | null;
  workTaskStages?: WorkTaskAnchorOption[];
  workTaskUsers?: WorkTaskAnchorOption[];
  viewerUserId?: number | null;
}) {
  const [lead, setLead] = useState<LeadDetails>(() => cloneLead(initialLead));
  const [mobileTab, setMobileTab] = useState<MobileTab>("communication");
  const [feedTab, setFeedTab] = useState<FeedTab>("communication");
  const [completionMode, setCompletionMode] = useState<LeadCompletionMode | null>(null);
  const [noteActionError, setNoteActionError] = useState("");
  const [workTasks, setWorkTasks] = useState(initialWorkTasks);
  const [workTaskCreateOpen, setWorkTaskCreateOpen] = useState(false);
  const taskManagers = lead.taskManagers;
  const currentActor = lead.currentActor;
  const taskPersistent = true;
  const noteManagers = taskManagers;

  useEffect(() => {
    setWorkTasks(initialWorkTasks);
  }, [initialWorkTasks]);

  function applyPersistedActivities(activities: LeadActivity[]) {
    const occurredAt = activities.reduce((latest, activity) => {
      const stamp = Date.parse(activity.occurredAt);
      const latestStamp = Date.parse(latest);
      if (Number.isNaN(stamp)) return latest;
      if (Number.isNaN(latestStamp) || stamp > latestStamp) return activity.occurredAt;
      return latest;
    }, new Date().toISOString());
    setLead((current) => ({
      ...current,
      activities: activities.map((activity) => ({
        ...activity,
        author: activity.author ? { ...activity.author } : undefined,
        metadata: activity.metadata ? { ...activity.metadata } : undefined,
        attachments: activity.attachments?.map((attachment) => ({ ...attachment })),
        mentionedUserIds: activity.mentionedUserIds ? [...activity.mentionedUserIds] : undefined,
      })),
      lastActivityAt: occurredAt,
      taskReferenceAt: occurredAt,
    }));
  }

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
    if (taskPersistent) {
      void createLeadNoteAction(lead.id, text, mentionedUserIds, currentActor.id).then((result) => {
        if (!result.ok) {
          setNoteActionError(result.message);
          return;
        }
        applyPersistedActivities(result.activities);
        setNoteActionError("");
      });
      return;
    }
    const occurredAt = new Date().toISOString();
    const activity: LeadActivity = {
      id: createLocalActivityId(),
      type: "comment_added",
      occurredAt,
      author: { id: currentActor.id, name: currentActor.name },
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
    if (taskPersistent) {
      void updateLeadNoteAction(lead.id, noteId, text, mentionedUserIds).then((result) => {
        if (!result.ok) {
          setNoteActionError(result.message);
          return;
        }
        applyPersistedActivities(result.activities);
        setNoteActionError("");
      });
      return;
    }
    const updatedAt = new Date().toISOString();
    setLead((current) => {
      const note = current.activities.find((activity) => activity.id === noteId);
      if (!note || !getNotePermissions(note, currentActor.id).canEdit) {
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
    if (taskPersistent) {
      void deleteLeadNoteAction(lead.id, noteId).then((result) => {
        if (!result.ok) {
          setNoteActionError(result.message);
          return;
        }
        applyPersistedActivities(result.activities);
        setNoteActionError("");
      });
      return;
    }
    setLead((current) => {
      const note = current.activities.find((activity) => activity.id === noteId);
      if (!note || !getNotePermissions(note, currentActor.id).canDelete) {
        return current;
      }
      return { ...current, activities: current.activities.filter((activity) => activity.id !== noteId) };
    });
  }

  function toggleNotePin(noteId: string) {
    if (taskPersistent) {
      void toggleLeadNotePinAction(lead.id, noteId).then((result) => {
        if (!result.ok) {
          setNoteActionError(result.message);
          return;
        }
        applyPersistedActivities(result.activities);
        setNoteActionError("");
      });
      return;
    }
    setLead((current) => ({
      ...current,
      activities: current.activities.map((activity) => activity.id === noteId && isInternalNote(activity)
        ? { ...activity, isPinned: !activity.isPinned }
        : activity),
    }));
  }

  async function sendMessage(draft: LeadMessageDraft): Promise<string | null> {
    if (taskPersistent) {
      const result = await sendLeadMessageAction(lead.id, {
        channel: draft.channel,
        text: draft.text,
        recipientName: draft.recipientName,
        authorId: currentActor.id,
        attachments: draft.attachments,
      });
      if (!result.ok) return result.message;
      const messageActivities = result.messages.map(leadMessageToActivity);
      const occurredAt = result.messages.at(-1)?.sentAt ?? new Date().toISOString();
      setLead((current) => ({
        ...current,
        messages: result.messages.map((message) => ({
          ...message,
          author: message.author ? { ...message.author } : undefined,
          attachments: message.attachments?.map((attachment) => ({ ...attachment })),
        })),
        activities: [
          ...current.activities.filter((activity) => !activity.id.startsWith("message-")),
          ...messageActivities,
        ],
        lastActivityAt: occurredAt,
      }));
      return null;
    }

    const sentAt = new Date().toISOString();
    const messageId = createLocalMessageId();
    const message: LeadMessage = {
      id: messageId,
      leadId: lead.id,
      channel: draft.channel,
      direction: "outgoing",
      text: draft.text,
      author: { ...currentActor },
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
      author: { id: currentActor.id, name: currentActor.name },
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
    return null;
  }

  function openWorkspaceSection(tab: MobileTab | FeedTab) {
    if (tab === "communication" || tab === "customer" || tab === "interest") {
      setMobileTab(tab);
    }
    if (tab === "communication" || tab === "tasks" || tab === "notes" || tab === "history") {
      setFeedTab(tab);
    }
    window.requestAnimationFrame(() => {
      document.getElementById(`lead-workspace-panel-${tab}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById(`lead-workspace-tab-${tab}`)?.focus({ preventScroll: true });
    });
  }

  function moveMobileTab(event: React.KeyboardEvent<HTMLButtonElement>, currentTab: MobileTab) {
    const currentIndex = mobileTabs.findIndex((tab) => tab.id === currentTab);
    const targetIndex = event.key === "ArrowRight"
      ? (currentIndex + 1) % mobileTabs.length
      : event.key === "ArrowLeft"
        ? (currentIndex - 1 + mobileTabs.length) % mobileTabs.length
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? mobileTabs.length - 1
            : -1;
    if (targetIndex < 0) return;
    event.preventDefault();
    const targetTab = mobileTabs[targetIndex].id;
    setMobileTab(targetTab);
    window.requestAnimationFrame(() => document.getElementById(`lead-workspace-tab-${targetTab}`)?.focus());
  }

  const nearestWorkTask =
    workTasks.find((task) => task.status === "open" || task.status === "in_progress") ??
    null;
  const primaryContact = lead.customer.contacts.find((contact) => contact.isPrimary);
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
    nextContact: nearestWorkTask && nearestWorkTask.dueLabel !== "—"
      ? nearestWorkTask.dueLabel
      : "Не запланирован",
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
    <PageLayout>
    <div data-lead-workspace data-complex-entity-card-page className="sl-design-v1 w-full min-w-0 bg-portal-page text-portal-text">
      <LeadHeader
        key={`${lead.id}-${lead.status}-${lead.stageId ?? "final"}`}
        lead={lead}
        initialStages={stages}
        managers={taskManagers}
        lastActivityAtLabel={formatDate(lead.lastActivityAt)}
        onAddTask={() => setWorkTaskCreateOpen(true)}
        onWrite={() => openWorkspaceSection("communication")}
        onFinalAction={openFinalAction}
      />

      <PageContent size="compact" width="full" className="lead-page-container">
        <ComplexEntityCard>
        <div className="lg:hidden mb-3">
          <CompactTabs
            label="Разделы карточки лида"
            size="compact"
            items={mobileTabs.map(({ id, label }) => ({ id, label }))}
            value={mobileTab}
            onChange={(id) => openWorkspaceSection(id as MobileTab)}
          />
        </div>
        <nav className="sr-only" aria-label="Разделы карточки лида">
          {mobileTabs.map(({ id, label }) => (
            <button
              key={id}
              id={`lead-workspace-tab-${id}`}
              type="button"
              aria-current={mobileTab === id ? "page" : undefined}
              onClick={() => openWorkspaceSection(id)}
              onKeyDown={(event) => moveMobileTab(event, id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="lead-main-grid grid min-w-0 gap-4">
          <div
            className={`lead-left-column min-w-0 space-y-3 ${mobileTab === "customer" || mobileTab === "interest" ? "block" : "hidden"} lg:block`}
          >
            <div className="flex flex-wrap gap-2" aria-label="Ключевые показатели">
              <span className="rounded-full border border-portal-border bg-portal-surface px-3 py-1 text-xs font-semibold text-portal-text">
                Сумма {formatCurrency(lead.estimatedAmount)}
              </span>
              <span className="rounded-full border border-portal-border bg-portal-surface px-3 py-1 text-xs font-semibold text-portal-text">
                Следующий контакт: {nearestWorkTask && nearestWorkTask.dueLabel !== "—" ? nearestWorkTask.dueLabel : "не запланирован"}
              </span>
              <span className="rounded-full border border-portal-border bg-portal-surface px-3 py-1 text-xs font-semibold text-portal-text">
                Касаний: {lead.activities.length}
              </span>
            </div>

            <details
              id="lead-reference-panel-customer"
              open
              className={`min-w-0 rounded-portal-lg border border-portal-border bg-portal-surface shadow-portal-card ${mobileTab === "interest" ? "hidden lg:block" : ""}`}
            >
              <summary className="cursor-pointer px-3.5 py-2.5 text-sm font-semibold text-portal-text">
                Клиент и контакты
              </summary>
              <LeadCustomerDetails
                embedded
                compact
                customer={lead.customer}
                leadId={lead.id}
                contactPersistence="api"
                onCustomerChange={updateCustomer}
              />
            </details>

            <details
              id="lead-reference-panel-commercial"
              className={`min-w-0 rounded-portal-lg border border-portal-border bg-portal-surface shadow-portal-card ${mobileTab === "customer" ? "hidden lg:block" : ""}`}
            >
              <summary className="cursor-pointer px-3.5 py-2.5 text-sm font-semibold text-portal-text">
                Интерес
              </summary>
              <LeadCommercialDetails
                embedded
                compact
                hideQuantity
                commercial={lead.commercial}
                source={lead.source}
                estimatedAmount={lead.estimatedAmount}
                probability={lead.probability}
                leadId={lead.id}
                persistence="api"
                onChange={updateCommercial}
              />
            </details>
          </div>

          <aside
            id="lead-workspace-panel-communication"
            data-lead-communication-column
            className={`lead-communication-column min-w-0 self-start overflow-hidden rounded-portal-lg border border-portal-border bg-portal-surface shadow-portal-card ${mobileTab === "communication" ? "block" : "hidden"} lg:block`}
          >
            <CompactTabs
              label="Лента лида"
              size="compact"
              items={feedTabs.map(({ id, label }) => ({ id, label }))}
              value={feedTab}
              onChange={(id) => setFeedTab(id as FeedTab)}
            />
            {feedTab === "communication" ? (
              <LeadCommunicationPanel
                embedded
                persistent={taskPersistent}
                messages={lead.messages}
                primaryContact={primaryContact}
                customerWebsite={lead.customer.website}
                onSend={sendMessage}
              />
            ) : null}
            {feedTab === "tasks" ? (
              <div id="lead-workspace-panel-tasks" className="lead-tasks-card min-w-0">
                <HostWorkTasksPanel
                  embedded
                  compact
                  tasks={workTasks}
                  loadError={workTasksError}
                  viewerUserId={viewerUserId}
                  onAdd={() => setWorkTaskCreateOpen(true)}
                />
              </div>
            ) : null}
            {feedTab === "notes" ? (
              <div id="lead-workspace-panel-notes" className="lead-notes-card min-w-0">
                {noteActionError ? <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">{noteActionError}</p> : null}
                <LeadActivityTimeline
                  embedded
                  compact
                  mode="notes"
                  activities={lead.activities}
                  currentUser={currentActor}
                  managers={noteManagers}
                  allowAllNoteActions={taskPersistent}
                  onAddComment={addComment}
                  onEditNote={editNote}
                  onDeleteNote={deleteNote}
                  onTogglePin={toggleNotePin}
                />
              </div>
            ) : null}
            {feedTab === "history" ? (
              <div id="lead-workspace-panel-history" className="lead-history-card min-w-0">
                <LeadActivityTimeline
                  embedded
                  compact
                  mode="history"
                  activities={lead.activities}
                  currentUser={currentActor}
                  managers={noteManagers}
                  allowAllNoteActions={taskPersistent}
                  onAddComment={addComment}
                  onEditNote={editNote}
                  onDeleteNote={deleteNote}
                  onTogglePin={toggleNotePin}
                />
              </div>
            ) : null}
            <div className="border-t border-portal-border">
              <OrderCollaborationPanel
                embedded
                leadId={lead.id}
                title="Внутренняя переписка"
              />
            </div>
          </aside>
        </div>
        </ComplexEntityCard>
      </PageContent>

      <WorkTaskCreateDrawer
        open={workTaskCreateOpen}
        onClose={() => setWorkTaskCreateOpen(false)}
        stages={workTaskStages}
        users={workTaskUsers}
        lockedAnchor={{
          type: "lead",
          id: Number(lead.id),
          label: `Лид #${lead.id}`,
        }}
        navigateOnCreate={false}
        onCreated={(task) => {
          setWorkTasks((current) => [task, ...current]);
          setWorkTaskCreateOpen(false);
          setFeedTab("tasks");
          setMobileTab("communication");
        }}
      />
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
    </PageLayout>
  );
}
