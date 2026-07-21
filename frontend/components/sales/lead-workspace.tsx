"use client";

import { FilterX, Search, Settings2 } from "lucide-react";
import { useMemo, useState } from "react";

import { KanbanBoard } from "@/components/kanban/kanban-board";
import type { KanbanColumnData } from "@/components/kanban/kanban-types";
import {
  LeadCompletionDialog,
  leadRejectionReasons,
  type LeadOrderDraft,
  type RejectionReasonOption,
} from "@/components/sales/lead-completion-dialog";
import { LeadCreateDialog } from "@/components/sales/lead-create-dialog";
import { LeadStageSettingsDialog } from "@/components/sales/lead-stage-settings-dialog";
import { Button } from "@/components/ui/button";
import { PageToolbar } from "@/components/ui/page-header";
import {
  convertLead as convertApiLeadAction,
  rejectLead as rejectApiLeadAction,
  updateLeadStatus,
} from "@/app/(workspace)/sales/leads/[leadId]/lead-header-actions";
import { createLead as createApiLeadAction } from "@/app/(workspace)/sales/leads/lead-create-actions";
import { saveLeadStageConfiguration } from "@/app/(workspace)/sales/leads/lead-stage-actions";
import { salesManagers } from "@/lib/demo-data/sales";
import {
  getLeadStagePersistenceDecision,
  resolveLeadStageAfterPersistence,
} from "@/lib/sales/lead-stage-persistence";
import {
  getActiveLeadStages,
  getDefaultLeadStages,
  sortLeadStages,
  type LeadStageConfig,
} from "@/lib/sales/lead-stages";
import type { Lead } from "@/types/sales";

type LeadView = "active" | "converted" | "rejected" | "all";
type WorkspaceLead = Lead & { stageId: string };

const systemDefinitions = [
  { id: "converted", title: "Успешно завершён", accentClass: "bg-emerald-500" },
  { id: "rejected", title: "Отказ", accentClass: "bg-red-500" },
] as const;

const defaultStageIds = new Set(getDefaultLeadStages().map((stage) => stage.id));

function normalizeLead(lead: Lead, index: number): WorkspaceLead {
  if (lead.status === "won") {
    return {
      ...lead,
      stageId: "proposal",
      status: "completed",
      result: "converted",
      completedAt: "15 июля 2026",
      completedBy: lead.responsible,
      convertedOrderId: `order-demo-${index}`,
      convertedOrderNumber: `№${1060 + index}`,
    };
  }

  if (lead.status === "unqualified") {
    return {
      ...lead,
      stageId: "qualification",
      status: "completed",
      result: "rejected",
      completedAt: "14 июля 2026",
      completedBy: lead.responsible,
      rejectionReason: index % 2 ? "Другое" : "Нет бюджета",
      rejectionComment: index % 2 ? "Клиент вернётся к обсуждению позже" : undefined,
    };
  }

  const stageId = lead.stageId ?? (lead.status === "proposal" && index % 2
    ? "waiting"
    : defaultStageIds.has(lead.status) ? lead.status : "new");

  return { ...lead, stageId };
}
function boardStatus(lead: WorkspaceLead): string {
  if (lead.result === "converted") {
    return "converted";
  }

  if (lead.result === "rejected") {
    return "rejected";
  }

  return lead.stageId;
}

export function LeadWorkspace({
  initialLeads,
  initialStages,
  dataOrigin,
  loadError,
}: {
  initialLeads: Lead[];
  initialStages: LeadStageConfig[];
  dataOrigin: "api" | "demo";
  loadError?: string;
}) {
  const [leads, setLeads] = useState<WorkspaceLead[]>(() => initialLeads.map(normalizeLead));
  const [stages, setStages] = useState<LeadStageConfig[]>(() => sortLeadStages(initialStages));
  const [view, setView] = useState<LeadView>("active");
  const [query, setQuery] = useState("");
  const [responsible, setResponsible] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [completionError, setCompletionError] = useState<string | null>(null);

  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) ?? null;
  const completed = leads.filter((lead) => lead.status === "completed");
  const converted = completed.filter((lead) => lead.result === "converted");
  const activeStages = useMemo(() => getActiveLeadStages(stages), [stages]);
  const activeStageIds = useMemo(
    () => new Set(activeStages.map((stage) => stage.id)),
    [activeStages],
  );
  const responsibleOptions = useMemo(() => {
    const names = new Set([
      ...salesManagers.map((manager) => manager.name),
      ...leads.map((lead) => lead.responsible.name),
    ]);
    return [...names].filter(Boolean).sort((first, second) => first.localeCompare(second, "ru"));
  }, [leads]);
  const stageLeadCounts = useMemo(
    () => leads.reduce<Record<string, number>>((counts, lead) => {
      if (lead.status !== "completed") {
        counts[lead.stageId] = (counts[lead.stageId] ?? 0) + 1;
      }

      return counts;
    }, {}),
    [leads],
  );

  const columns = useMemo<KanbanColumnData<string>[]>(() => {
    const workingDefinitions = (view === "active" || view === "all")
      ? activeStages.map(({ id, title, accentClass }) => ({ id, title, accentClass }))
      : [];
    const resultDefinitions = systemDefinitions.filter((definition) => (
      view === "all"
      || (view === "converted" && definition.id === "converted")
      || (view === "rejected" && definition.id === "rejected")
    ));

    return [...workingDefinitions, ...resultDefinitions].map((definition) => ({
      ...definition,
      cards: leads
        .filter((lead) => boardStatus(lead) === definition.id)
        .map((lead) => ({
          id: lead.id,
          status: definition.id,
          title: lead.clientName,
          href: `/sales/leads/${lead.id}`,
          subtitle: `${lead.contact} · ${lead.city}`,
          amount: `${new Intl.NumberFormat("ru-RU").format(lead.estimatedAmount)} ₽`,
          badge: lead.result === "converted"
            ? { label: "Конвертирован", tone: "emerald" as const }
            : lead.result === "rejected"
              ? { label: "Отказ", tone: "red" as const }
              : undefined,
          responsible: lead.responsible.name,
          nextAction: lead.status === "completed" ? lead.completedAt : lead.nextContact,
          details: [
            { label: "Спорт", value: lead.sport },
            {
              label: lead.result === "converted"
                ? "Заказ"
                : lead.result === "rejected" ? "Причина" : "Источник",
              value: lead.convertedOrderNumber ?? lead.rejectionReason ?? lead.source,
            },
          ],
          filters: { responsible: lead.responsible.name },
          metricValues: { amount: lead.estimatedAmount },
          draggable: lead.status !== "completed",
          actionLabel: lead.status === "completed"
            ? (lead.result === "converted" ? "Открыть заказ" : "Подробнее")
            : "Завершить лид",
        })),
    }));
  }, [activeStages, leads, view]);

  async function convertLead(leadId: string, draft: LeadOrderDraft) {
    setCompletionError(null);
    const result = await convertApiLeadAction(leadId, draft);
    if (!result.ok) {
      setCompletionError(result.message);
      return result;
    }

    setLeads((current) => current.map((lead) => (
      lead.id === leadId
        ? {
            ...lead,
            status: "completed",
            result: "converted",
            completedAt: "Сохранено backend",
            completedBy: lead.responsible,
            convertedOrderId: result.orderId,
            convertedOrderNumber: result.orderNumber,
            productCategory: draft.productCategory,
            quantity: draft.quantity,
            needDescription: draft.description,
            desiredDate: draft.desiredDate,
            estimatedAmount: draft.amount,
          }
        : lead
    )));
    setRevision((value) => value + 1);
    return result;
  }

  async function rejectLead(leadId: string, reason: RejectionReasonOption, comment: string) {
    setCompletionError(null);
    const result = await rejectApiLeadAction(leadId, reason, comment);
    if (!result.ok) {
      setCompletionError(result.message);
      return result;
    }

    setLeads((current) => current.map((lead) => (
      lead.id === leadId
        ? {
            ...lead,
            status: "completed",
            result: "rejected",
            completedAt: "16 июля 2026, 18:00",
            completedBy: lead.responsible,
            rejectionReason: reason.name,
            rejectionComment: comment || undefined,
          }
        : lead
    )));
    setRevision((value) => value + 1);
    return result;
  }

  async function createLead(draft: Parameters<typeof createApiLeadAction>[0]) {
    const result = await createApiLeadAction(draft);
    if (result.ok) {
      setLeads((current) => [normalizeLead(result.lead, current.length), ...current]);
      setView("active");
      setRevision((value) => value + 1);
    }
    return result;
  }

  async function saveStages(
    nextStages: LeadStageConfig[],
    transfers: Readonly<Record<string, string>>,
  ): Promise<string | null> {
    const orderedStages = sortLeadStages(nextStages);
    const result = await saveLeadStageConfiguration(orderedStages, transfers);
    if (!result.ok) {
      return result.message;
    }

    setLeads((current) => current.map((lead) => (
      transfers[lead.stageId] ? { ...lead, stageId: transfers[lead.stageId] } : lead
    )));
    setStages(result.stages);
    setRevision((value) => value + 1);
    setSettingsOpen(false);
    return null;
  }

  async function resetStages(
    transfers: Readonly<Record<string, string>>,
  ): Promise<string | null> {
    const defaults = getDefaultLeadStages();
    const result = await saveLeadStageConfiguration(defaults, transfers);
    if (!result.ok) {
      return result.message;
    }

    setLeads((current) => current.map((lead) => (
      transfers[lead.stageId] ? { ...lead, stageId: transfers[lead.stageId] } : lead
    )));
    setStages(result.stages);
    setRevision((value) => value + 1);
    setSettingsOpen(false);
    return null;
  }

  const metricItems: Array<[string, string | number]> = [
    ["Всего лидов", leads.length],
    ["Завершено", completed.length],
    ["Конвертировано", converted.length],
    [
      "Конверсия завершённых",
      `${completed.length ? Math.round(converted.length / completed.length * 100) : 0}%`,
    ],
  ];

  return (
    <div>
      <PageToolbar
        start={(
          <>
            {(["active", "converted", "rejected", "all"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setView(item)}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  view === item
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {item === "active"
                  ? "Активные"
                  : item === "converted" ? "Успешные" : item === "rejected" ? "Отказы" : "Все"}
              </button>
            ))}
            <Button type="button" onClick={() => setSettingsOpen(true)}>
              <Settings2 size={16} />
              Настроить стадии
            </Button>
            <label className="flex h-10 min-w-56 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 lg:max-w-sm">
              <Search size={17} className="text-slate-400" />
              <span className="sr-only">Поиск</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск: лиды"
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
              />
            </label>
            <select
              value={responsible}
              onChange={(event) => setResponsible(event.target.value)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
            >
              <option value="">Ответственный: все</option>
              {responsibleOptions.map((managerName) => <option key={managerName}>{managerName}</option>)}
            </select>
            {query || responsible ? (
              <Button onClick={() => { setQuery(""); setResponsible(""); }}>
                <FilterX size={16} />
                Сбросить
              </Button>
            ) : null}
          </>
        )}
        end={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            Создать лид
          </Button>
        }
      />

      {loadError ? (
        <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800 lg:px-6" role="alert">
          {loadError}
        </div>
      ) : dataOrigin === "api" ? (
        <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800 lg:px-6">
          Лиды загружены из backend.
        </div>
      ) : null}

      <section
        className="grid gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:grid-cols-2 lg:px-6 xl:grid-cols-4"
        aria-label="Показатели"
      >
        {metricItems.map(([label, value]) => (
          <article key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <strong className="mt-1 block text-xl text-slate-950">{value}</strong>
          </article>
        ))}
      </section>

      <div className="p-4 lg:p-6">
        {moveError ? (
          <div className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800" role="alert">
            {moveError}
          </div>
        ) : null}
        {completionError ? (
          <div className="mb-4 border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800" role="alert">
            {completionError}
          </div>
        ) : null}
        <KanbanBoard
          key={`${view}-${revision}`}
          columns={columns}
          query={query}
          selectedFilters={{ responsible }}
          onCardSelect={setSelectedLeadId}
          onMove={(move) => {
            if (!activeStageIds.has(move.targetColumnId)) {
              return;
            }

            const currentLead = leads.find((lead) => lead.id === move.cardId);
            if (!currentLead) {
              return;
            }

            const previousStage = currentLead.stageId;
            const decision = getLeadStagePersistenceDecision(
              currentLead.id,
              previousStage,
              move.targetColumnId,
              dataOrigin,
            );
            if (!decision.shouldPersist) {
              if (decision.reason === "unchanged") {
                return;
              }
              setLeads((current) => current.map((lead) => (
                lead.id === move.cardId ? { ...lead, stageId: move.targetColumnId } : lead
              )));
              setRevision((value) => value + 1);
              return;
            }

            setMoveError(null);
            setLeads((current) => current.map((lead) => (
              lead.id === move.cardId ? { ...lead, stageId: move.targetColumnId } : lead
            )));
            setRevision((value) => value + 1);

            void updateLeadStatus(currentLead.id, move.targetColumnId).then((result) => {
              if (result.ok) {
                return;
              }

              setLeads((current) => current.map((lead) => (
                lead.id === move.cardId && lead.stageId === move.targetColumnId
                  ? {
                      ...lead,
                      stageId: resolveLeadStageAfterPersistence(previousStage, move.targetColumnId, false),
                    }
                  : lead
              )));
              setRevision((value) => value + 1);
              setMoveError(`Не удалось сохранить стадию лида: ${result.message}`);
            }).catch(() => {
              setLeads((current) => current.map((lead) => (
                lead.id === move.cardId && lead.stageId === move.targetColumnId
                  ? { ...lead, stageId: previousStage }
                  : lead
              )));
              setRevision((value) => value + 1);
              setMoveError("Не удалось связаться с backend. Изменение стадии отменено.");
            });
          }}
        />
      </div>

      <LeadCompletionDialog
        key={selectedLead?.id ?? "closed"}
        lead={selectedLead}
        reasons={leadRejectionReasons}
        onClose={() => setSelectedLeadId(null)}
        onConvert={convertLead}
        onReject={rejectLead}
      />
      {createOpen ? <LeadCreateDialog onClose={() => setCreateOpen(false)} onCreate={createLead} /> : null}
      {settingsOpen ? (
        <LeadStageSettingsDialog
          stages={stages}
          leadCounts={stageLeadCounts}
          onClose={() => setSettingsOpen(false)}
          onSave={saveStages}
          onReset={resetStages}
        />
      ) : null}
    </div>
  );
}
