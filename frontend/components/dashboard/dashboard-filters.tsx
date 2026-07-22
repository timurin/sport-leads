"use client";

import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { InlineAlert } from "@/components/ui/inline-alert";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { departmentLabels, salesSourceLabels } from "@/lib/dashboard/sales-dashboard";
import {
  defaultDashboardFilters,
  periodPresetLabels,
  type DashboardFilters,
  type SalesDashboardData,
  type StatusFilter,
} from "@/lib/dashboard/sales-dashboard-types";
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

const statusKey = (status: StatusFilter) =>
  status.entity === "all" ? "all" : `${status.entity}:${status.value}`;

export function DashboardFilters({
  filters,
  data,
  activeLabels,
  validationError,
  onChange,
}: {
  filters: DashboardFilters;
  data: SalesDashboardData;
  activeLabels: string[];
  validationError?: string;
  onChange: (filters: DashboardFilters) => void;
}) {
  const update = <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <SectionCard
      title="Фильтры аналитики"
      actions={(
        <Button type="button" variant="secondary" size="compact" onClick={() => onChange({ ...defaultDashboardFilters })}>
          <RotateCcw size={15} /> Сбросить
        </Button>
      )}
    >
      {activeLabels.length ? (
        <div className="mb-portal-4 flex flex-wrap gap-portal-2">
          {activeLabels.map((label) => (
            <StatusBadge key={label} tone="primary" size="compact">
              {label}
            </StatusBadge>
          ))}
        </div>
      ) : null}
      <div className="grid min-w-0 gap-portal-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <Field label="Период">
          <Select
            value={filters.period}
            onChange={(event) => update("period", event.target.value as DashboardFilters["period"])}
          >
            {Object.entries(periodPresetLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Источник">
          <Select
            value={filters.source}
            onChange={(event) => update("source", event.target.value as DashboardFilters["source"])}
          >
            <option value="all">Все источники</option>
            {salesSources.map((source) => (
              <option key={source} value={source}>
                {salesSourceLabels[source]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ответственный">
          <Select
            value={filters.responsibleId}
            onChange={(event) => update("responsibleId", event.target.value)}
          >
            <option value="all">Все сотрудники</option>
            {data.managers.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Подразделение">
          <Select
            value={filters.department}
            onChange={(event) => update("department", event.target.value as DashboardFilters["department"])}
          >
            <option value="all">Все подразделения</option>
            {Object.entries(departmentLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Статус">
          <Select
            value={statusKey(filters.status)}
            onChange={(event) =>
              update(
                "status",
                statusOptions.find((option) => statusKey(option.value) === event.target.value)?.value ?? {
                  entity: "all",
                },
              )
            }
          >
            {statusOptions.map((option) => (
              <option key={statusKey(option.value)} value={statusKey(option.value)}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Клиент" className="sm:col-span-2">
          <Input
            value={filters.client}
            onChange={(event) => update("client", event.target.value)}
            placeholder="Название клиента"
          />
        </Field>
      </div>
      {filters.period === "custom" ? (
        <div className="mt-portal-4 grid max-w-xl min-w-0 gap-portal-4 sm:grid-cols-2">
          <Field label="Дата начала">
            <Input
              type="date"
              value={filters.customStart}
              onChange={(event) => update("customStart", event.target.value)}
            />
          </Field>
          <Field label="Дата окончания">
            <Input
              type="date"
              value={filters.customEnd}
              onChange={(event) => update("customEnd", event.target.value)}
            />
          </Field>
        </div>
      ) : null}
      {validationError ? (
        <InlineAlert tone="danger" className="mt-portal-3">
          {validationError}
        </InlineAlert>
      ) : null}
    </SectionCard>
  );
}
