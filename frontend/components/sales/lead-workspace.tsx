"use client";

import { FilterX, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { KanbanBoard } from "@/components/kanban/kanban-board";
import type { KanbanColumnData } from "@/components/kanban/kanban-types";
import { LeadCompletionDialog, type LeadOrderDraft, type RejectionReasonOption } from "@/components/sales/lead-completion-dialog";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { leads as demoLeads, salesManagers } from "@/lib/demo-data/sales";
import type { Lead } from "@/types/sales";

type LeadView = "active" | "converted" | "rejected" | "all";
type BoardStatus = "new" | "contact" | "qualification" | "proposal" | "waiting" | "converted" | "rejected";

const reasons: RejectionReasonOption[] = [
  ["unreachable", "Не выходит на связь", "Клиент", false], ["changed_mind", "Передумал", "Клиент", false],
  ["no_budget", "Нет бюджета", "Клиент", false], ["postponed", "Отложил заказ", "Клиент", false],
  ["competitor", "Выбрал конкурента", "Клиент", true], ["high_price", "Высокая цена", "Цена и условия", false],
  ["bad_timing", "Не устроили сроки", "Цена и условия", false], ["bad_payment_terms", "Не устроили условия оплаты", "Цена и условия", false],
  ["bad_delivery", "Не устроила доставка", "Цена и условия", false], ["unsupported_product", "Не производим нужный товар", "Производство", false],
  ["small_run", "Недостаточный тираж", "Производство", false], ["impossible_deadline", "Невозможный срок", "Производство", false],
  ["technical_limit", "Нет технической возможности", "Производство", false], ["duplicate", "Дубликат", "Качество лида", false],
  ["spam", "Спам", "Качество лида", false], ["mistaken_request", "Ошибочное обращение", "Качество лида", false],
  ["not_target", "Нецелевой клиент", "Качество лида", false],
  ["other", "Другое", "Качество лида", true],
].map(([id, name, category, requiresComment]) => ({ id, name, category, requiresComment })) as RejectionReasonOption[];

const definitions: Array<{ id: BoardStatus; title: string; accentClass: string }> = [
  { id: "new", title: "Новый", accentClass: "bg-blue-500" },
  { id: "contact", title: "Первичный контакт", accentClass: "bg-cyan-500" },
  { id: "qualification", title: "Квалификация", accentClass: "bg-violet-500" },
  { id: "proposal", title: "Предложение", accentClass: "bg-amber-500" },
  { id: "waiting", title: "Ожидание решения", accentClass: "bg-orange-500" },
  { id: "converted", title: "Успешно завершён", accentClass: "bg-emerald-500" },
  { id: "rejected", title: "Отказ", accentClass: "bg-red-500" },
];

function normalizeLead(lead: Lead, index: number): Lead {
  if (lead.status === "won") return { ...lead, status: "completed", result: "converted", completedAt: "15 июля 2026", completedBy: lead.responsible, convertedOrderId: `order-demo-${index}`, convertedOrderNumber: `№${1060 + index}` };
  if (lead.status === "unqualified") return { ...lead, status: "completed", result: "rejected", completedAt: "14 июля 2026", completedBy: lead.responsible, rejectionReason: index % 2 ? "Другое" : "Нет бюджета", rejectionComment: index % 2 ? "Клиент вернётся к обсуждению позже" : undefined };
  return lead.status === "proposal" && index % 2 ? { ...lead, status: "waiting" } : { ...lead };
}

function boardStatus(lead: Lead): BoardStatus {
  if (lead.result === "converted") return "converted";
  if (lead.result === "rejected") return "rejected";
  return lead.status as BoardStatus;
}

export function LeadWorkspace() {
  const [leads, setLeads] = useState<Lead[]>(() => demoLeads.map(normalizeLead));
  const [view, setView] = useState<LeadView>("active");
  const [query, setQuery] = useState("");
  const [responsible, setResponsible] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) ?? null;
  const completed = leads.filter((lead) => lead.status === "completed");
  const converted = completed.filter((lead) => lead.result === "converted");
  const columns = useMemo<KanbanColumnData<BoardStatus>[]>(() => definitions.filter((column) => {
    if (view === "active") return !["converted", "rejected"].includes(column.id);
    if (view === "converted") return column.id === "converted";
    if (view === "rejected") return column.id === "rejected";
    return true;
  }).map((definition) => ({
    ...definition,
    cards: leads.filter((lead) => boardStatus(lead) === definition.id).map((lead) => ({
      id: lead.id, status: definition.id, title: lead.clientName, subtitle: `${lead.contact} · ${lead.city}`,
      amount: `${new Intl.NumberFormat("ru-RU").format(lead.estimatedAmount)} ₽`,
      badge: lead.result === "converted" ? { label: "Конвертирован", tone: "emerald" as const } : lead.result === "rejected" ? { label: "Отказ", tone: "red" as const } : undefined,
      responsible: lead.responsible.name, nextAction: lead.status === "completed" ? lead.completedAt : lead.nextContact,
      details: [{ label: "Спорт", value: lead.sport }, { label: lead.result === "converted" ? "Заказ" : lead.result === "rejected" ? "Причина" : "Источник", value: lead.convertedOrderNumber ?? lead.rejectionReason ?? lead.source }],
      filters: { responsible: lead.responsible.name }, metricValues: { amount: lead.estimatedAmount },
      draggable: lead.status !== "completed", actionLabel: lead.status === "completed" ? (lead.result === "converted" ? "Открыть заказ" : "Подробнее") : "Завершить лид",
    })),
  })), [leads, view]);

  function convertLead(leadId: string, draft: LeadOrderDraft) {
    const sequence = 1101 + converted.length;
    setLeads((current) => current.map((lead) => lead.id === leadId ? { ...lead, status: "completed", result: "converted", completedAt: "16 июля 2026, 18:00", completedBy: lead.responsible, convertedOrderId: `order-${sequence}`, convertedOrderNumber: `№${sequence}`, productCategory: draft.productCategory, quantity: draft.quantity, needDescription: draft.description, desiredDate: draft.desiredDate, estimatedAmount: draft.amount } : lead));
    setRevision((value) => value + 1);
  }

  function rejectLead(leadId: string, reason: RejectionReasonOption, comment: string) {
    setLeads((current) => current.map((lead) => lead.id === leadId ? { ...lead, status: "completed", result: "rejected", completedAt: "16 июля 2026, 18:00", completedBy: lead.responsible, rejectionReason: reason.name, rejectionComment: comment || undefined } : lead));
    setRevision((value) => value + 1);
  }

  const metricItems: Array<[string, string | number]> = [["Всего лидов", leads.length], ["Завершено", completed.length], ["Конвертировано", converted.length], ["Конверсия завершённых", `${completed.length ? Math.round(converted.length / completed.length * 100) : 0}%`]];

  return (
    <div>
      <PageHeader title="Лиды" description="Первичные обращения: от рабочей стадии до заказа покупателя или зафиксированного отказа" />
      <section className="grid gap-3 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:grid-cols-2 lg:px-6 xl:grid-cols-4" aria-label="Показатели">{metricItems.map(([label, value]) => <article key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><p className="text-xs font-medium text-slate-500">{label}</p><strong className="mt-1 block text-xl text-slate-950">{value}</strong></article>)}</section>
      <div className="border-b border-slate-200 bg-white px-4 py-3 lg:px-6"><div className="flex flex-wrap gap-2">{(["active", "converted", "rejected", "all"] as const).map((item) => <button key={item} type="button" onClick={() => setView(item)} className={`rounded-lg px-3 py-2 text-sm font-medium ${view === item ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{item === "active" ? "Активные" : item === "converted" ? "Успешные" : item === "rejected" ? "Отказы" : "Все"}</button>)}</div><div className="mt-3 flex flex-wrap gap-2"><label className="flex h-10 min-w-56 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 lg:max-w-sm"><Search size={17} className="text-slate-400" /><span className="sr-only">Поиск</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск: лиды" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label><select value={responsible} onChange={(event) => setResponsible(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="">Ответственный: все</option>{salesManagers.map((manager) => <option key={manager.id}>{manager.name}</option>)}</select>{query || responsible ? <Button onClick={() => { setQuery(""); setResponsible(""); }}><FilterX size={16} />Сбросить</Button> : null}</div></div>
      <div className="p-4 lg:p-6"><KanbanBoard key={`${view}-${revision}`} columns={columns} query={query} selectedFilters={{ responsible }} onCardSelect={setSelectedLeadId} onMove={(move) => { if (["new", "contact", "qualification", "proposal", "waiting"].includes(move.targetColumnId)) setLeads((current) => current.map((lead) => lead.id === move.cardId ? { ...lead, status: move.targetColumnId as Lead["status"] } : lead)); }} /></div>
      <LeadCompletionDialog key={selectedLead?.id ?? "closed"} lead={selectedLead} reasons={reasons} onClose={() => setSelectedLeadId(null)} onConvert={convertLead} onReject={rejectLead} />
    </div>
  );
}
