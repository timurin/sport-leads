"use client";

import { ExternalLink, Mail, MessageCircle, PhoneCall, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ComplexEntityCard } from "@/components/entity/complex-entity-card";
import { PageActions, PageContent, PageLayout, ResponsiveGrid } from "@/components/layout/page-layout";
import { LeadActivityTimeline } from "@/components/sales/lead-activity-timeline";
import { LeadCommunicationPanel, type LeadMessageDraft } from "@/components/sales/lead-communication-panel";
import { SalesOrderItemsUnfDemo } from "@/components/sales/sales-order-items-unf-demo";
import { SalesOrderHeader } from "@/components/sales/sales-order-header";
import { Button } from "@/components/ui/button";
import { CompactTabs } from "@/components/ui/compact-tabs";
import { DataList } from "@/components/ui/data-list";
import { EntityLink } from "@/components/ui/entity-link";
import { MetricCard, SectionCard } from "@/components/ui/section-card";
import { mockCurrentUser, salesManagers } from "@/lib/demo-data/sales";
import { getNotePermissions, isInternalNote, sortLeadActivities } from "@/lib/sales/lead-activity";
import { formatAttachmentSize, leadMessageChannelLabels } from "@/lib/sales/lead-message";
import type { Nomenclature } from "@/lib/nomenclature";
import type { SalesOrderDetails, SalesOrderSourceLead } from "@/lib/sales/order-details";
import {
  orderStatusPresentation,
} from "@/lib/sales/order-list-api";
import type { VatRate } from "@/lib/vat-rates";
import type { LeadActivity, LeadMessage, OrderStatus } from "@/types/sales";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Moscow",
});

const workspaceTabs = [
  { id: "communication", label: "Коммуникации" },
  { id: "history", label: "История" },
  { id: "notes", label: "Заметки" },
  { id: "items", label: "Товары, услуги" },
] as const;

type WorkspaceTab = (typeof workspaceTabs)[number]["id"];

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function createLocalId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function cloneActivities(activities: LeadActivity[]): LeadActivity[] {
  return activities.map((activity) => ({
    ...activity,
    author: activity.author ? { ...activity.author } : undefined,
    metadata: activity.metadata ? { ...activity.metadata } : undefined,
    attachments: activity.attachments?.map((attachment) => ({ ...attachment })),
    mentionedUserIds: activity.mentionedUserIds ? [...activity.mentionedUserIds] : undefined,
  }));
}

function cloneMessages(messages: LeadMessage[]): LeadMessage[] {
  return messages.map((message) => ({
    ...message,
    author: message.author ? { ...message.author } : undefined,
    attachments: message.attachments?.map((attachment) => ({ ...attachment })),
  }));
}

/** PT-06 lead-like composition for customer order card (owner visual transfer from Lead Card). */
export function SalesOrderPage({
  order: initialOrder,
  activities: initialActivities,
  sourceLead,
  nomenclature,
  vatRates,
}: {
  order: SalesOrderDetails;
  activities: LeadActivity[];
  sourceLead: SalesOrderSourceLead | null;
  nomenclature: Nomenclature[];
  vatRates: VatRate[];
}) {
  const [order, setOrder] = useState(initialOrder);
  const [activities, setActivities] = useState(() => cloneActivities(initialActivities));
  const [messages, setMessages] = useState(() => cloneMessages(sourceLead?.messages ?? []));
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("communication");

  useEffect(() => {
    setOrder(initialOrder);
  }, [initialOrder]);

  const primaryContact = sourceLead?.primaryContact
    ?? sourceLead?.customer.contacts.find((contact) => contact.isPrimary);
  const preferredChannel = primaryContact?.preferredChannel && primaryContact.preferredChannel !== "unspecified"
    ? leadMessageChannelLabels[primaryContact.preferredChannel]
    : "Не указано";
  const lastActivityAt = useMemo(() => {
    const sorted = sortLeadActivities(activities);
    return sorted[0]?.occurredAt ?? order.updatedAtIso;
  }, [activities, order.updatedAtIso]);
  const daysInWork = Math.max(
    0,
    Math.ceil((new Date(lastActivityAt).getTime() - new Date(order.createdAtIso).getTime()) / 86_400_000),
  );
  const communicationCount = activities.filter((activity) => (
    activity.type === "incoming_message"
    || activity.type === "outgoing_message"
    || activity.type === "email_sent"
    || activity.type === "email_received"
    || activity.type === "incoming_call"
    || activity.type === "outgoing_call"
    || activity.type === "comment_added"
  )).length + messages.length;

  function openWorkspaceSection(tab: WorkspaceTab) {
    setWorkspaceTab(tab);
    window.requestAnimationFrame(() => {
      document.getElementById(`order-workspace-panel-${tab}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById(`order-workspace-tab-${tab}`)?.focus({ preventScroll: true });
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
    window.requestAnimationFrame(() => document.getElementById(`order-workspace-tab-${targetTab}`)?.focus());
  }

  function addComment(text: string, mentionedUserIds: string[]) {
    const occurredAt = new Date().toISOString();
    const activity: LeadActivity = {
      id: createLocalId("order-activity"),
      type: "comment_added",
      occurredAt,
      author: { id: mockCurrentUser.id, name: mockCurrentUser.name },
      title: "Добавлена внутренняя заметка",
      description: text,
      channel: "internal",
      isPinned: false,
      mentionedUserIds: [...mentionedUserIds],
    };
    setActivities((current) => [activity, ...current]);
  }

  function editNote(noteId: string, text: string, mentionedUserIds: string[]) {
    const updatedAt = new Date().toISOString();
    setActivities((current) => {
      const note = current.find((activity) => activity.id === noteId);
      if (!note || !getNotePermissions(note, mockCurrentUser.id).canEdit) return current;
      return current.map((activity) => (activity.id === noteId
        ? { ...activity, description: text, updatedAt, mentionedUserIds: [...mentionedUserIds] }
        : activity));
    });
  }

  function deleteNote(noteId: string) {
    setActivities((current) => {
      const note = current.find((activity) => activity.id === noteId);
      if (!note || !getNotePermissions(note, mockCurrentUser.id).canDelete) return current;
      return current.filter((activity) => activity.id !== noteId);
    });
  }

  function toggleNotePin(noteId: string) {
    setActivities((current) => current.map((activity) => (
      activity.id === noteId && isInternalNote(activity)
        ? { ...activity, isPinned: !activity.isPinned }
        : activity
    )));
  }

  function sendMessage(draft: LeadMessageDraft) {
    const sentAt = new Date().toISOString();
    const messageId = createLocalId("order-message");
    const message: LeadMessage = {
      id: messageId,
      leadId: order.leadId,
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
      id: createLocalId("order-activity"),
      type: draft.channel === "email" ? "email_sent" : "outgoing_message",
      occurredAt: sentAt,
      author: { id: mockCurrentUser.id, name: mockCurrentUser.name },
      title: draft.channel === "email" ? "Отправлено письмо клиенту" : "Отправлено сообщение клиенту",
      description: draft.text || "Сообщение содержит вложение.",
      direction: "outgoing",
      channel: draft.channel,
      metadata: { messageId, orderId: order.id },
      attachments: draft.attachments.map((attachment) => ({
        id: attachment.id,
        name: attachment.name,
        mediaType: attachment.type || "Файл",
        sizeLabel: formatAttachmentSize(attachment.size),
      })),
    };
    setMessages((current) => [...current, message]);
    setActivities((current) => [activity, ...current]);
  }

  function handleStatusChange(status: OrderStatus) {
    const occurredAt = new Date().toISOString();
    setOrder((current) => ({
      ...current,
      statusCode: status,
      status: orderStatusPresentation[status].label,
      updatedAtIso: occurredAt,
    }));
    setActivities((current) => [{
      id: createLocalId("order-activity"),
      type: "status_changed",
      occurredAt,
      author: { id: mockCurrentUser.id, name: mockCurrentUser.name },
      title: "Статус заказа изменён",
      description: `Статус обновлён: ${orderStatusPresentation[status].label}.`,
      isSystem: true,
      metadata: { orderId: order.id },
    }, ...current]);
  }

  return (
    <PageLayout>
      <div data-lead-workspace data-complex-entity-card-page data-order-workspace className="w-full min-w-0 bg-portal-page text-portal-text">
        <SalesOrderHeader
          order={order}
          lastActivityAtLabel={formatDate(lastActivityAt)}
          onWrite={() => openWorkspaceSection("communication")}
          onStatusChange={handleStatusChange}
        />

        <PageContent size="compact" width="full" className="lead-page-container">
          <ComplexEntityCard>
            <div className="lead-main-grid grid min-w-0 gap-4">
              <div className="lead-left-column min-w-0 space-y-3">
                <ResponsiveGrid minItemWidth="large" gap="default" className="lead-reference-grid">
                  <SectionCard title="Основные сведения" size="compact" className="min-w-0">
                    <DataList
                      columns={2}
                      items={[
                        { id: "client", label: "Клиент", value: order.clientName },
                        { id: "organization", label: "Организация", value: order.organizationName },
                        { id: "responsible", label: "Ответственный", value: order.responsibleName },
                        { id: "amount", label: "Сумма", value: order.amount },
                        { id: "desiredDate", label: "Желаемая дата", value: order.desiredDate },
                        { id: "source", label: "Источник", value: order.source },
                        { id: "category", label: "Категория", value: order.productCategory },
                        { id: "sport", label: "Вид спорта", value: order.sport },
                        { id: "quantity", label: "Количество", value: order.quantity },
                      ]}
                    />
                  </SectionCard>
                  <SectionCard
                    title="Исходный лид и описание"
                    description="Коммуникации с клиентом продолжаются в контексте исходного лида."
                    size="compact"
                    className="min-w-0"
                  >
                    <EntityLink href={order.sourceLeadHref} className="text-portal-body">
                      Открыть исходный лид <ExternalLink size={15} aria-hidden="true" />
                    </EntityLink>
                    <p className="mt-3 whitespace-pre-wrap text-portal-body leading-6 text-portal-muted">
                      {order.description}
                    </p>
                    {sourceLead ? (
                      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div>
                          <dt className="text-[11px] text-slate-500">Контакт лида</dt>
                          <dd className="mt-1 text-sm font-semibold text-slate-900">{sourceLead.contactName}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] text-slate-500">Сообщений в карточке</dt>
                          <dd className="mt-1 text-sm font-semibold text-slate-900">{messages.length}</dd>
                        </div>
                      </dl>
                    ) : null}
                  </SectionCard>
                </ResponsiveGrid>

                <SectionCard title="Ключевые метрики заказа" size="compact">
                  <ResponsiveGrid minItemWidth="small" gap="compact" className="lead-metrics-grid">
                    <MetricCard label="Сумма заказа" value={order.amount} tone="success" size="compact" />
                    <MetricCard label="Позиций" value={String(order.itemCount)} size="compact" />
                    <MetricCard label="Последняя активность" value={formatDate(lastActivityAt)} size="compact" />
                    <MetricCard label="Желаемая дата" value={order.desiredDate} size="compact" />
                    <MetricCard label="Дней в работе" value={`${daysInWork} дн.`} detail={`с ${order.createdAt}`} size="compact" />
                    <MetricCard
                      label="Касания / события"
                      value={String(activities.length)}
                      detail={communicationCount ? `${communicationCount} коммуникаций` : "история лида и заказа"}
                      size="compact"
                    />
                  </ResponsiveGrid>
                </SectionCard>

                <div className="lg:hidden">
                  <CompactTabs
                    label="Рабочие разделы заказа"
                    size="compact"
                    items={workspaceTabs.map(({ id, label }) => ({ id, label }))}
                    value={workspaceTab}
                    onChange={(id) => openWorkspaceSection(id as WorkspaceTab)}
                  />
                </div>

                <nav id="order-workspace-sections-heading" className="sr-only" aria-label="Рабочие разделы заказа">
                  {workspaceTabs.map(({ id, label }) => (
                    <button
                      key={id}
                      id={`order-workspace-tab-${id}`}
                      type="button"
                      aria-current={workspaceTab === id ? "page" : undefined}
                      onClick={() => openWorkspaceSection(id)}
                      onKeyDown={(event) => moveWorkspaceTab(event, id)}
                    >
                      {label}
                    </button>
                  ))}
                </nav>

                <div
                  id="order-workspace-panel-items"
                  className={`min-w-0 ${workspaceTab === "items" ? "block" : "hidden"} lg:block`}
                >
                  <SalesOrderItemsUnfDemo
                    orderId={order.id}
                    items={order.items}
                    nomenclature={nomenclature}
                    vatRates={vatRates}
                    documentTotal={order.amount}
                  />
                </div>

                <div className="lead-bottom-grid grid min-w-0 items-start gap-3">
                  <div
                    id="order-workspace-panel-history"
                    className={`lead-history-card min-w-0 rounded-portal-lg border border-portal-border bg-portal-surface shadow-portal-card ${workspaceTab === "history" ? "block" : "hidden"} lg:block`}
                  >
                    <LeadActivityTimeline
                      embedded
                      compact
                      mode="history"
                      activities={activities}
                      currentUser={mockCurrentUser}
                      managers={salesManagers}
                      onAddComment={addComment}
                      onEditNote={editNote}
                      onDeleteNote={deleteNote}
                      onTogglePin={toggleNotePin}
                    />
                  </div>
                  <div
                    id="order-workspace-panel-notes"
                    className={`lead-notes-card min-w-0 rounded-portal-lg border border-portal-border bg-portal-surface shadow-portal-card ${workspaceTab === "notes" ? "block" : "hidden"} lg:block`}
                  >
                    <LeadActivityTimeline
                      embedded
                      compact
                      mode="notes"
                      activities={activities}
                      currentUser={mockCurrentUser}
                      managers={salesManagers}
                      onAddComment={addComment}
                      onEditNote={editNote}
                      onDeleteNote={deleteNote}
                      onTogglePin={toggleNotePin}
                    />
                  </div>
                </div>
              </div>

              <aside
                id="order-workspace-panel-communication"
                data-lead-communication-column
                className={`lead-communication-column min-w-0 self-start overflow-hidden rounded-portal-lg border border-portal-border bg-portal-surface shadow-portal-card ${workspaceTab === "communication" ? "block" : "hidden"} lg:block`}
              >
                <LeadCommunicationPanel
                  embedded
                  messages={messages}
                  primaryContact={primaryContact}
                  customerWebsite={sourceLead?.customer.website}
                  onSend={sendMessage}
                  customerSummary={(
                    <div className="flex h-full min-w-0 flex-col p-3.5">
                      <h3 className="text-sm font-bold text-portal-text">Карточка клиента</h3>
                      <dl className="mt-4 space-y-4">
                        <div>
                          <dt className="text-[11px] text-slate-500">Клиент заказа</dt>
                          <dd className="mt-1 text-sm font-semibold text-slate-900">{order.clientName}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] text-slate-500">Основной контакт</dt>
                          <dd className="mt-1 text-sm font-semibold text-slate-900">
                            {primaryContact?.name ?? sourceLead?.contactName ?? "Не указан"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] text-slate-500">Предпочтительный канал</dt>
                          <dd className="mt-1 text-sm font-semibold text-blue-700">{preferredChannel}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] text-slate-500">Событий в истории</dt>
                          <dd className="mt-1 text-sm font-semibold text-slate-900">{activities.length}</dd>
                        </div>
                      </dl>
                      <div className="mt-auto space-y-2 pt-5">
                        {primaryContact?.phone ? (
                          <a
                            href={`tel:${primaryContact.phone}`}
                            className="flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <PhoneCall size={14} /> Позвонить
                          </a>
                        ) : null}
                        {primaryContact?.email ? (
                          <a
                            href={`mailto:${primaryContact.email}`}
                            className="flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Mail size={14} /> Написать email
                          </a>
                        ) : null}
                        <EntityLink
                          href={order.sourceLeadHref}
                          className="flex h-9 items-center justify-center rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Открыть исходный лид
                        </EntityLink>
                      </div>
                    </div>
                  )}
                />
                <PageActions className="border-t border-portal-border bg-portal-surface-secondary p-3" align="start">
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => openWorkspaceSection("communication")}
                    className="h-9 basis-[calc(50%-0.25rem)] px-2 sm:basis-auto"
                  >
                    <MessageCircle size={15} /> Написать
                  </Button>
                  <Button
                    type="button"
                    onClick={() => openWorkspaceSection("notes")}
                    className="h-9 basis-[calc(50%-0.25rem)] px-2 sm:basis-auto"
                  >
                    <Plus size={15} /> Заметка
                  </Button>
                  {primaryContact?.phone ? (
                    <a
                      href={`tel:${primaryContact.phone}`}
                      className="inline-flex h-9 basis-[calc(50%-0.25rem)] items-center justify-center gap-2 rounded-[var(--portal-radius-md)] border border-portal-border bg-portal-surface px-2 text-sm font-medium text-portal-text hover:bg-portal-surface-secondary sm:basis-auto"
                    >
                      <PhoneCall size={15} /> Позвонить
                    </a>
                  ) : (
                    <Button type="button" disabled className="h-9 basis-[calc(50%-0.25rem)] px-2 sm:basis-auto">
                      <PhoneCall size={15} /> Позвонить
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={() => openWorkspaceSection("history")}
                    className="h-9 basis-[calc(50%-0.25rem)] px-2 sm:basis-auto"
                  >
                    История
                  </Button>
                </PageActions>
              </aside>
            </div>
          </ComplexEntityCard>
        </PageContent>
      </div>
    </PageLayout>
  );
}
