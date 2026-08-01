"use client";

import { ExternalLink, ChevronDown, ChevronRight, Mail, MessageCircle, PhoneCall, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { ComplexEntityCard } from "@/components/entity/complex-entity-card";
import { PageActions, PageContent, PageLayout } from "@/components/layout/page-layout";
import { LeadActivityTimeline } from "@/components/sales/lead-activity-timeline";
import { LeadCommunicationPanel, type LeadMessageDraft } from "@/components/sales/lead-communication-panel";
import { SalesOrderDocumentsTree } from "@/components/sales/sales-order-documents-tree";
import { OrderDesignApprovalField } from "@/components/sales/order-design-approval-field";
import { OrderMaterialReserveField } from "@/components/sales/order-material-reserve-field";
import { SalesOrderHeader } from "@/components/sales/sales-order-header";
import { SalesOrderItemsUnfDemo } from "@/components/sales/sales-order-items-unf-demo";
import { SalesOrderMetrics } from "@/components/sales/sales-order-metrics";
import { SalesOrderTechCardsPanel } from "@/components/sales/sales-order-tech-cards-panel";
import type {
  SalesInvoice,
  SalesQuotation,
} from "@/app/(workspace)/sales/orders/[orderId]/order-commercial-doc-actions";
import { Button } from "@/components/ui/button";
import { DataList } from "@/components/ui/data-list";
import { EmptyState } from "@/components/ui/empty-state";
import { EntityLink } from "@/components/ui/entity-link";
import { SectionCard } from "@/components/ui/section-card";
import { mockCurrentUser, salesManagers } from "@/lib/demo-data/sales";
import { getNotePermissions, isInternalNote, sortLeadActivities } from "@/lib/sales/lead-activity";
import { formatAttachmentSize, leadMessageChannelLabels } from "@/lib/sales/lead-message";
import {
  formatTaskDate,
  getTaskTimingLabel,
  leadTaskTypeLabels,
  sortLeadTasks,
} from "@/lib/sales/lead-task";
import type { Nomenclature, NomenclatureCategory } from "@/lib/nomenclature";
import { buildOrderCardMetrics } from "@/lib/sales/order-card-metrics";
import {
  getOrderCardSectionVisibility,
  orderCardViewModeOptions,
  type OrderCardViewMode,
} from "@/lib/sales/order-card-view-mode";
import type { SalesOrderDetails, SalesOrderSourceLead } from "@/lib/sales/order-details";
import { orderStatusPresentation } from "@/lib/sales/order-list-api";
import type { VatRate } from "@/lib/vat-rates";
import type { LeadActivity, LeadMessage, LeadTask, OrderStatus } from "@/types/sales";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Moscow",
});

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

function cloneTasks(tasks: LeadTask[]): LeadTask[] {
  return tasks.map((task) => ({
    ...task,
    assignedTo: { ...task.assignedTo },
    createdBy: { ...task.createdBy },
  }));
}

function sectionClass(visible: boolean) {
  return visible ? "block" : "hidden";
}

function CollapseToggleButton({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <Button type="button" size="compact" variant="secondary" onClick={onToggle}>
      {collapsed ? (
        <>
          <ChevronRight className="size-4" aria-hidden="true" />
          Развернуть
        </>
      ) : (
        <>
          <ChevronDown className="size-4" aria-hidden="true" />
          Свернуть
        </>
      )}
    </Button>
  );
}

/** Stage 3.5 order card: compact header, view filters, PT-06-like body. */
export function SalesOrderPage({
  order: initialOrder,
  activities: initialActivities,
  sourceLead,
  nomenclature,
  nomenclatureCategories,
  vatRates,
  quotations = [],
  invoices = [],
}: {
  order: SalesOrderDetails;
  activities: LeadActivity[];
  sourceLead: SalesOrderSourceLead | null;
  nomenclature: Nomenclature[];
  nomenclatureCategories: NomenclatureCategory[];
  vatRates: VatRate[];
  quotations?: SalesQuotation[];
  invoices?: SalesInvoice[];
}) {
  const [order, setOrder] = useState(initialOrder);
  const [activities, setActivities] = useState(() => cloneActivities(initialActivities));
  const [messages, setMessages] = useState(() => cloneMessages(sourceLead?.messages ?? []));
  const [tasks] = useState(() => cloneTasks(sourceLead?.tasks ?? []));
  const [viewMode, setViewMode] = useState<OrderCardViewMode>("all");
  const visibility = getOrderCardSectionVisibility(viewMode);
  const taskReferenceAt = sourceLead?.taskReferenceAt ?? order.updatedAtIso;

  if (order.id !== initialOrder.id) {
    setOrder(initialOrder);
  }

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
  const visibleTasks = useMemo(
    () => sortLeadTasks(tasks, "open", taskReferenceAt).slice(0, 6),
    [taskReferenceAt, tasks],
  );
  const openTasksCount = useMemo(
    () => tasks.filter((task) => task.status === "open").length,
    [tasks],
  );
  const metrics = useMemo(() => buildOrderCardMetrics({
    order,
    daysInWork,
    lastActivityLabel: formatDate(lastActivityAt),
    activityCount: activities.length,
    communicationCount,
    openTasksCount,
  }), [activities.length, communicationCount, daysInWork, lastActivityAt, openTasksCount, order]);

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

  const [sectionOpen, setSectionOpen] = useState({
    items: true,
    techCards: true,
    history: false,
  });
  const isAllMode = viewMode === "all";
  const itemsCollapsed = isAllMode && !sectionOpen.items;
  const techCardsCollapsed = isAllMode && !sectionOpen.techCards;
  const historyCollapsed = isAllMode && !sectionOpen.history;

  function toggleSection(key: keyof typeof sectionOpen) {
    setSectionOpen((current) => ({ ...current, [key]: !current[key] }));
  }

  const topVisibleCount = [
    visibility.info,
    visibility.metrics,
    visibility.communication,
  ].filter(Boolean).length;
  const topGridClass =
    topVisibleCount <= 1
      ? "grid min-w-0 grid-cols-1 gap-3"
      : visibility.info && visibility.metrics && visibility.communication
        ? "order-card-top-triple grid min-w-0 gap-3"
        : "order-card-top-pair grid min-w-0 gap-3";
  const midVisibleCount = [visibility.comments, visibility.tasks].filter(Boolean).length;
  const midGridClass =
    midVisibleCount <= 1
      ? "grid min-w-0 grid-cols-1 gap-3"
      : "order-card-mid-pair grid min-w-0 gap-3";

  const communicationBlock = (
    <aside
      id="order-workspace-panel-communication"
      data-lead-communication-column
      className={`order-card-comms lead-communication-column min-w-0 self-start overflow-hidden rounded-portal-lg border border-portal-border bg-portal-surface shadow-portal-card ${sectionClass(visibility.communication)}`}
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
                <dd className="mt-1 text-sm font-semibold text-slate-900">
                  <EntityLink href={order.clientHref}>{order.clientName}</EntityLink>
                </dd>
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
          onClick={() => setViewMode("communication")}
          className="h-9 basis-[calc(50%-0.25rem)] px-2 sm:basis-auto"
        >
          <MessageCircle size={15} /> Написать
        </Button>
        <Button
          type="button"
          onClick={() => setViewMode("all")}
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
      </PageActions>
    </aside>
  );

  return (
    <PageLayout>
      <div data-lead-workspace data-complex-entity-card-page data-order-workspace className="w-full min-w-0 bg-portal-page text-portal-text">
        <SalesOrderHeader order={order} onStatusChange={handleStatusChange} />

        <PageContent size="compact" width="full" className="lead-page-container">
          <div
            className="mb-3 flex min-w-0 flex-wrap gap-2"
            role="toolbar"
            aria-label="Фильтры разделов заказа"
          >
            {orderCardViewModeOptions.map((option) => {
              const active = viewMode === option.id;
              return (
                <Button
                  key={option.id}
                  type="button"
                  variant={active ? "primary" : "secondary"}
                  aria-pressed={active}
                  onClick={() => setViewMode(option.id)}
                  className="h-8 px-3 text-xs"
                >
                  {option.label}
                </Button>
              );
            })}
          </div>

          <ComplexEntityCard>
            <div className="grid min-w-0 gap-3">
              <div className={`${topGridClass} ${sectionClass(visibility.info || visibility.metrics || visibility.communication)}`}>
                <SectionCard
                  title="Основные сведения"
                  size="compact"
                  className={`min-w-0 ${sectionClass(visibility.info)}`}
                >
                  <DataList
                    columns={2}
                    items={[
                      {
                        id: "client",
                        label: "Клиент",
                        value: (
                          <EntityLink href={order.clientHref} className="text-portal-body">
                            {order.clientName}
                          </EntityLink>
                        ),
                      },
                      {
                        id: "organization",
                        label: "Организация",
                        value: order.organizationHref ? (
                          <EntityLink href={order.organizationHref} className="text-portal-body">
                            {order.organizationName}
                          </EntityLink>
                        ) : order.organizationName,
                      },
                      { id: "responsible", label: "Ответственный", value: order.responsibleName },
                      {
                        id: "designApproval",
                        label: "Дизайн",
                        value: (
                          <OrderDesignApprovalField
                            orderId={order.id}
                            value={order.designApprovalStatus}
                          />
                        ),
                      },
                      {
                        id: "materialReserve",
                        label: "Резерв",
                        value: (
                          <OrderMaterialReserveField
                            orderId={order.id}
                            value={order.materialReserveStatus}
                          />
                        ),
                      },
                      { id: "itemsSubtotal", label: "Сумма позиций", value: order.itemsSubtotal },
                      {
                        id: "orderDiscount",
                        label: "Скидка заказа",
                        value: order.discountPercent
                          ? `${order.discountPercent}% (−${order.discountAmount})`
                          : "нет",
                      },
                      { id: "amountNet", label: "Без НДС", value: order.amountNet },
                      { id: "vatAmount", label: "НДС", value: order.vatAmount },
                      { id: "currency", label: "Валюта", value: order.currencyCode },
                      { id: "amount", label: "Итого", value: order.amount },
                      { id: "desiredDate", label: "Желаемая дата", value: order.desiredDate },
                      { id: "source", label: "Источник", value: order.source },
                      { id: "category", label: "Категория", value: order.productCategory },
                      { id: "sport", label: "Вид спорта", value: order.sport },
                      { id: "quantity", label: "Количество", value: order.quantity },
                    ]}
                  />
                  <div className="mt-4 border-t border-portal-border pt-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Исходный лид</p>
                    <EntityLink href={order.sourceLeadHref} className="mt-1 inline-flex items-center gap-1 text-portal-body">
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
                  </div>
                </SectionCard>

                <SectionCard
                  title="Ключевые метрики заказа"
                  description="Живые поля заказа: оплата и резерв — sales-маркеры; маржа/себестоимость до полного costing остаются оценочными."
                  size="compact"
                  className={`min-w-0 ${sectionClass(visibility.metrics)}`}
                >
                  <SalesOrderMetrics orderId={order.id} metrics={metrics} />
                </SectionCard>

                {communicationBlock}
              </div>

              <div className={`${midGridClass} ${sectionClass(visibility.comments || visibility.tasks)}`}>
                <div
                  id="order-workspace-panel-notes"
                  className={`lead-notes-card min-w-0 rounded-portal-lg border border-portal-border bg-portal-surface shadow-portal-card ${sectionClass(visibility.comments)}`}
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

                <SectionCard
                  title="Задачи по заказу"
                  description="Задачи исходного лида (LeadTask). Управление — в карточке лида."
                  size="compact"
                  className={`min-w-0 ${sectionClass(visibility.tasks)}`}
                >
                  {visibleTasks.length === 0 ? (
                    <EmptyState
                      title="Нет открытых задач"
                      description="Для API-лидов задачи появятся после persistent tasks (1.2.4). Пока можно открыть исходный лид."
                      action={(
                        <EntityLink href={order.sourceLeadHref} className="inline-flex items-center gap-1 text-sm font-medium text-portal-primary">
                          Открыть исходный лид <ExternalLink size={14} aria-hidden="true" />
                        </EntityLink>
                      )}
                    />
                  ) : (
                    <ul className="divide-y divide-portal-border">
                      {visibleTasks.map((task) => (
                        <li key={task.id} className="py-3 first:pt-0 last:pb-0">
                          <p className="text-xs font-medium text-slate-500">{leadTaskTypeLabels[task.type]}</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{task.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatTaskDate(task.dueAt)} · {getTaskTimingLabel(task, taskReferenceAt)} · {task.assignedTo.name}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </SectionCard>
              </div>

              <div
                id="order-workspace-panel-items"
                className={`min-w-0 ${sectionClass(visibility.items)}`}
              >
                <SalesOrderItemsUnfDemo
                  orderId={order.id}
                  items={order.items}
                  nomenclature={nomenclature}
                  nomenclatureCategories={nomenclatureCategories}
                  vatRates={vatRates}
                  documentTotal={order.amount}
                  collapsed={itemsCollapsed}
                  headerActions={
                    isAllMode ? (
                      <CollapseToggleButton
                        collapsed={itemsCollapsed}
                        onToggle={() => toggleSection("items")}
                      />
                    ) : undefined
                  }
                />
              </div>

              <div
                id="order-workspace-panel-tech-cards"
                className={`min-w-0 ${sectionClass(visibility.techCards)}`}
              >
                <SalesOrderTechCardsPanel
                  order={order}
                  collapsed={techCardsCollapsed}
                  headerActions={
                    isAllMode ? (
                      <CollapseToggleButton
                        collapsed={techCardsCollapsed}
                        onToggle={() => toggleSection("techCards")}
                      />
                    ) : undefined
                  }
                />
              </div>

              <div
                id="order-workspace-panel-history"
                className={`lead-history-card min-w-0 rounded-portal-lg border border-portal-border bg-portal-surface shadow-portal-card ${sectionClass(visibility.history)}`}
              >
                <LeadActivityTimeline
                  embedded
                  compact
                  mode="history"
                  collapsed={historyCollapsed}
                  actions={
                    isAllMode ? (
                      <CollapseToggleButton
                        collapsed={historyCollapsed}
                        onToggle={() => toggleSection("history")}
                      />
                    ) : undefined
                  }
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
                id="order-workspace-panel-documents"
                className={`min-w-0 ${sectionClass(visibility.documents)}`}
              >
                <SalesOrderDocumentsTree
                  order={order}
                  quotations={quotations}
                  invoices={invoices}
                />
              </div>
            </div>
          </ComplexEntityCard>
        </PageContent>
      </div>
    </PageLayout>
  );
}
