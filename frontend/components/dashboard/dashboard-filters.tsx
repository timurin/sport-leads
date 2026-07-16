"use client";

import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { departmentLabels, salesSourceLabels } from "@/lib/dashboard/sales-dashboard";
import { defaultDashboardFilters, periodPresetLabels, type DashboardFilters, type SalesDashboardData, type StatusFilter } from "@/lib/dashboard/sales-dashboard-types";
import { salesSources } from "@/types/sales";

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: { entity: "all" }, label: "Все статусы" },
  { value: { entity: "lead", value: "new" }, label: "Лиды · Новые" },
  { value: { entity: "lead", value: "qualification" }, label: "Лиды · Квалификация" },
  { value: { entity: "lead", value: "won" }, label: "Лиды · Успешные" },
  { value: { entity: "deal", value: "negotiation" }, label: "Сделки · Переговоры" },
  { value: { entity: "deal", value: "approval" }, label: "Сделки · Согласование" },
  { value: { entity: "deal", value: "paid" }, label: "Сделки · Оплачено" },
  { value: { entity: "order", value: "production" }, label: "Заказы · Производство" },
  { value: { entity: "order", value: "ready" }, label: "Заказы · Готовы" },
  { value: { entity: "order", value: "completed" }, label: "Заказы · Завершены" },
  { value: { entity: "task", value: "today" }, label: "Задачи · Сегодня" },
  { value: { entity: "task", value: "overdue" }, label: "Задачи · Просрочены" },
  { value: { entity: "task", value: "done" }, label: "Задачи · Выполнены" },
];

const statusKey = (status: StatusFilter) => status.entity === "all" ? "all" : `${status.entity}:${status.value}`;
const fieldClass = "mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function DashboardFilters({ filters, data, activeLabels, validationError, onChange }: { filters: DashboardFilters; data: SalesDashboardData; activeLabels: string[]; validationError?: string; onChange: (filters: DashboardFilters) => void }) {
  const update = <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => onChange({ ...filters, [key]: value });
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div><h2 className="font-semibold text-slate-950">Фильтры аналитики</h2><div className="mt-2 flex flex-wrap gap-2">{activeLabels.map((label) => <span key={label} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{label}</span>)}</div></div>
        <Button type="button" onClick={() => onChange({ ...defaultDashboardFilters })}><RotateCcw size={15} /> Сбросить</Button>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <label className="text-xs font-medium text-slate-600">Период<select className={fieldClass} value={filters.period} onChange={(event) => update("period", event.target.value as DashboardFilters["period"])}>{Object.entries(periodPresetLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-xs font-medium text-slate-600">Источник<select className={fieldClass} value={filters.source} onChange={(event) => update("source", event.target.value as DashboardFilters["source"])}><option value="all">Все источники</option>{salesSources.map((source) => <option key={source} value={source}>{salesSourceLabels[source]}</option>)}</select></label>
        <label className="text-xs font-medium text-slate-600">Ответственный<select className={fieldClass} value={filters.responsibleId} onChange={(event) => update("responsibleId", event.target.value)}><option value="all">Все сотрудники</option>{data.managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name}</option>)}</select></label>
        <label className="text-xs font-medium text-slate-600">Подразделение<select className={fieldClass} value={filters.department} onChange={(event) => update("department", event.target.value as DashboardFilters["department"])}><option value="all">Все подразделения</option>{Object.entries(departmentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-xs font-medium text-slate-600">Статус<select className={fieldClass} value={statusKey(filters.status)} onChange={(event) => update("status", statusOptions.find((option) => statusKey(option.value) === event.target.value)?.value ?? { entity: "all" })}>{statusOptions.map((option) => <option key={statusKey(option.value)} value={statusKey(option.value)}>{option.label}</option>)}</select></label>
        <label className="text-xs font-medium text-slate-600 sm:col-span-2">Клиент<input className={fieldClass} value={filters.client} onChange={(event) => update("client", event.target.value)} placeholder="Название клиента" /></label>
      </div>
      {filters.period === "custom" ? <div className="mt-4 grid max-w-xl gap-4 sm:grid-cols-2"><label className="text-xs font-medium text-slate-600">Дата начала<input type="date" className={fieldClass} value={filters.customStart} onChange={(event) => update("customStart", event.target.value)} /></label><label className="text-xs font-medium text-slate-600">Дата окончания<input type="date" className={fieldClass} value={filters.customEnd} onChange={(event) => update("customEnd", event.target.value)} /></label></div> : null}
      {validationError ? <p className="mt-3 text-sm font-medium text-red-600">{validationError}</p> : null}
    </section>
  );
}
