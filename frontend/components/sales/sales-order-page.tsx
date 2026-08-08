"use client";

import {
  ClipboardList,
  ChevronDown,
  ChevronRight,
  FileText,
  ListTodo,
  MessageSquare,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ComplexEntityCard } from "@/components/entity/complex-entity-card";
import { PageContent, PageLayout } from "@/components/layout/page-layout";
import { HostWorkTasksPanel } from "@/components/sales/host-work-tasks-panel";
import { LeadActivityTimeline } from "@/components/sales/lead-activity-timeline";
import { OrderCollaborationPanel } from "@/components/sales/order-collaboration-panel";
import { OrderClientNeedDetails } from "@/components/sales/order-client-need-details";
import { SalesOrderDocumentsTree } from "@/components/sales/sales-order-documents-tree";
import { SalesOrderHeader } from "@/components/sales/sales-order-header";
import { SalesOrderItemsUnfDemo } from "@/components/sales/sales-order-items-unf-demo";
import { SalesOrderMetrics } from "@/components/sales/sales-order-metrics";
import { SalesOrderTechCardsPanel } from "@/components/sales/sales-order-tech-cards-panel";
import {
  WorkTaskCreateDrawer,
  type WorkTaskAnchorOption,
} from "@/components/sales/work-task-create-drawer";
import type {
  SalesInvoice,
  SalesQuotation,
} from "@/app/(workspace)/sales/orders/[orderId]/order-commercial-doc-actions";
import { Button } from "@/components/ui/button";
import { CompactTabs } from "@/components/ui/compact-tabs";
import { mockCurrentUser, salesManagers } from "@/lib/demo-data/sales";
import { getNotePermissions, isInternalNote, sortLeadActivities } from "@/lib/sales/lead-activity";
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
import type { WorkTaskListItem } from "@/lib/work-tasks";
import type { LeadActivity, LeadMessage, OrderStatus } from "@/types/sales";

type AsideTab = "finance" | "info" | "chat" | "notes" | "tasks";

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
  const label = collapsed ? "Развернуть" : "Свернуть";
  return (
    <Button
      type="button"
      size="compact"
      variant="secondary"
      title={label}
      aria-label={label}
      onClick={onToggle}
    >
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
  workTasks: initialWorkTasks = [],
  workTasksError = null,
  workTaskStages = [],
  workTaskUsers = [],
  viewerUserId = null,
}: {
  order: SalesOrderDetails;
  activities: LeadActivity[];
  sourceLead: SalesOrderSourceLead | null;
  nomenclature: Nomenclature[];
  nomenclatureCategories: NomenclatureCategory[];
  vatRates: VatRate[];
  quotations?: SalesQuotation[];
  invoices?: SalesInvoice[];
  workTasks?: WorkTaskListItem[];
  workTasksError?: string | null;
  workTaskStages?: WorkTaskAnchorOption[];
  workTaskUsers?: WorkTaskAnchorOption[];
  viewerUserId?: number | null;
}) {
  const [order, setOrder] = useState(initialOrder);
  const [activities, setActivities] = useState(() => cloneActivities(initialActivities));
  const [messages] = useState(() => cloneMessages(sourceLead?.messages ?? []));
  const [workTasks, setWorkTasks] = useState(initialWorkTasks);
  const [workTaskCreateOpen, setWorkTaskCreateOpen] = useState(false);
  const [viewMode, setViewMode] = useState<OrderCardViewMode>("all");
  const visibility = getOrderCardSectionVisibility(viewMode);

  useEffect(() => {
    setWorkTasks(initialWorkTasks);
  }, [initialWorkTasks]);

  /** Keep line items / totals in sync after router.refresh() without wiping local need/status edits. */
  const orderItemsServerKey = useMemo(
    () =>
      [
        initialOrder.id,
        initialOrder.updatedAtIso,
        initialOrder.amountValue,
        initialOrder.itemsSubtotalValue,
        initialOrder.vatAmountValue,
        initialOrder.amountNetValue,
        initialOrder.discountAmountValue,
        initialOrder.discountPercent,
        initialOrder.items.map((item) => item.id).join(","),
      ].join("|"),
    [initialOrder],
  );
  const [syncedItemsServerKey, setSyncedItemsServerKey] = useState(orderItemsServerKey);
  if (order.id !== initialOrder.id) {
    setOrder(initialOrder);
    setSyncedItemsServerKey(orderItemsServerKey);
  } else if (syncedItemsServerKey !== orderItemsServerKey) {
    setSyncedItemsServerKey(orderItemsServerKey);
    setOrder((current) => ({
      ...current,
      items: initialOrder.items,
      itemCount: initialOrder.itemCount,
      amount: initialOrder.amount,
      amountValue: initialOrder.amountValue,
      itemsSubtotal: initialOrder.itemsSubtotal,
      itemsSubtotalValue: initialOrder.itemsSubtotalValue,
      discountPercent: initialOrder.discountPercent,
      discountAmount: initialOrder.discountAmount,
      discountAmountValue: initialOrder.discountAmountValue,
      vatAmount: initialOrder.vatAmount,
      vatAmountValue: initialOrder.vatAmountValue,
      amountNet: initialOrder.amountNet,
      amountNetValue: initialOrder.amountNetValue,
      updatedAtIso: initialOrder.updatedAtIso,
    }));
  }

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
  const openTasksCount = useMemo(
    () =>
      workTasks.filter(
        (task) => task.status === "open" || task.status === "in_progress",
      ).length,
    [workTasks],
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
  const [asideTab, setAsideTab] = useState<AsideTab>("finance");
  const isAllMode = viewMode === "all";
  const itemsCollapsed = isAllMode && !sectionOpen.items;
  const techCardsCollapsed = isAllMode && !sectionOpen.techCards;
  const historyCollapsed = isAllMode && !sectionOpen.history;

  useEffect(() => {
    if (viewMode === "all" || viewMode === "items") setAsideTab("finance");
  }, [viewMode]);

  function toggleSection(key: keyof typeof sectionOpen) {
    setSectionOpen((current) => ({ ...current, [key]: !current[key] }));
  }

  const notesPanel = (
    <div className="lead-notes-card min-w-0 overflow-hidden rounded-portal-md border border-portal-border bg-portal-surface" id="order-workspace-panel-notes">
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
  );

  const tasksPanel = (
    <div id="order-workspace-panel-tasks">
      <HostWorkTasksPanel
        embedded
        compact
        title="Задачи"
        tasks={workTasks}
        loadError={workTasksError}
        viewerUserId={viewerUserId}
        onAdd={() => setWorkTaskCreateOpen(true)}
      />
    </div>
  );

  return (
    <PageLayout>
      <div
        data-lead-workspace
        data-complex-entity-card-page
        data-order-workspace
        className="sl-design-v1 w-full min-w-0 bg-portal-page text-portal-text"
      >
        <SalesOrderHeader order={order} onStatusChange={handleStatusChange} />

        <PageContent size="compact" width="full" className="lead-page-container">
          <div
            className="mb-2 flex min-w-0 flex-wrap gap-2"
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
                  title={option.label}
                  onClick={() => setViewMode(option.id)}
                  className="h-8 cursor-pointer px-3 text-xs"
                >
                  {option.label}
                </Button>
              );
            })}
          </div>

          <ComplexEntityCard>
            <div className="order-v1-layout">
              <div className="order-v1-main">
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
                    onItemsChange={(nextItems) => {
                      setOrder((current) => ({
                        ...current,
                        items: nextItems,
                        itemCount: nextItems.length,
                      }));
                    }}
                    onItemCreated={(item) => {
                      setOrder((current) => {
                        if (current.items.some((entry) => entry.id === item.id)) return current;
                        const nextItems = [...current.items, item];
                        return { ...current, items: nextItems, itemCount: nextItems.length };
                      });
                    }}
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

              <aside
                className={`order-v1-aside ${sectionClass(visibility.metrics)}`}
                aria-label="Финансы и коммуникации заказа"
              >
                <div className="min-w-0 rounded-portal-lg border border-portal-border bg-portal-surface p-portal-3 shadow-portal-card">
                  <CompactTabs
                    label="Боковая панель заказа"
                    size="default"
                    wrap
                    iconOnly
                    value={asideTab}
                    onChange={(id) => setAsideTab(id as AsideTab)}
                    className="order-aside-tabs"
                    items={[
                      { id: "finance", label: "Финансы", icon: <Wallet /> },
                      { id: "info", label: "Основные сведения", icon: <FileText /> },
                      { id: "chat", label: "Переписка", icon: <MessageSquare /> },
                      { id: "notes", label: "Заметки", icon: <ClipboardList /> },
                      {
                        id: "tasks",
                        label: "Задачи",
                        icon: <ListTodo />,
                        count: openTasksCount || undefined,
                      },
                    ]}
                  />
                  <div className="mt-3 min-w-0">
                    {asideTab === "finance" ? (
                      <SalesOrderMetrics orderId={order.id} metrics={metrics} variant="slim" />
                    ) : null}
                    {asideTab === "info" ? (
                      <OrderClientNeedDetails
                        compact
                        order={order}
                        sourceLeadContactName={sourceLead?.contactName}
                        sourceLeadMessageCount={sourceLead ? messages.length : undefined}
                        onSaved={(next) => setOrder(next)}
                      />
                    ) : null}
                    {asideTab === "chat" ? (
                      <div
                        id="order-workspace-panel-communication"
                        className="order-card-comms min-w-0 overflow-hidden rounded-portal-md border border-portal-border"
                      >
                        <OrderCollaborationPanel
                          embedded
                          orderId={order.id}
                          title="Внутренняя переписка"
                        />
                      </div>
                    ) : null}
                    {asideTab === "notes" ? notesPanel : null}
                    {asideTab === "tasks" ? tasksPanel : null}
                  </div>
                </div>
              </aside>
            </div>
          </ComplexEntityCard>
        </PageContent>
      </div>
      <WorkTaskCreateDrawer
        open={workTaskCreateOpen}
        onClose={() => setWorkTaskCreateOpen(false)}
        stages={workTaskStages}
        users={workTaskUsers}
        lockedAnchor={{
          type: "sales_order",
          id: Number(order.id),
          label: `Заказ ${order.number}`,
        }}
        navigateOnCreate={false}
        onCreated={(task) => {
          setWorkTasks((current) => [task, ...current]);
          setWorkTaskCreateOpen(false);
          setAsideTab("tasks");
        }}
      />
    </PageLayout>
  );
}
