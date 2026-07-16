import { formatRange, buildDateRange, isWithin, previousDateRange, rangeDays } from "./date-range";
import {
  periodPresetLabels,
  type DashboardFilters,
  type DashboardSnapshot,
  type DateRange,
  type DynamicsPoint,
  type Kpi,
  type SalesDashboardData,
  type SourceSummary,
  type TrendTone,
} from "./sales-dashboard-types";
import type { SalesSource } from "@/types/sales";

export const salesSourceLabels: Record<SalesSource, string> = {
  website: "Сайт",
  referral: "Рекомендация",
  vk: "VK",
  phone: "Телефон",
  email: "Email",
  manual: "Ручной ввод",
};

export const departmentLabels = {
  sales: "Продажи",
  production: "Производство",
  design: "Дизайн",
  management: "Руководство",
} as const;

const currency = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("ru-RU");

function percent(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 10) / 10 : 0;
}

function conversion(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : percent((numerator / denominator) * 100);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function trend(current: number, previous: number): { change: number; tone: TrendTone } {
  if (previous === 0) return { change: current === 0 ? 0 : 100, tone: current === 0 ? "neutral" : "positive" };
  const change = percent(((current - previous) / Math.abs(previous)) * 100);
  return { change, tone: change > 0 ? "positive" : change < 0 ? "negative" : "neutral" };
}

function commonMatch(
  entity: { source: SalesSource; responsible: { id: string }; department: string; clientName: string },
  filters: DashboardFilters,
): boolean {
  return (filters.source === "all" || entity.source === filters.source)
    && (filters.responsibleId === "all" || entity.responsible.id === filters.responsibleId)
    && (filters.department === "all" || entity.department === filters.department)
    && (!filters.client || entity.clientName.toLocaleLowerCase("ru-RU").includes(filters.client.toLocaleLowerCase("ru-RU")));
}

function filterData(data: SalesDashboardData, filters: DashboardFilters, range: DateRange) {
  return {
    leads: data.leads.filter((item) => commonMatch(item, filters) && isWithin(item.createdAt, range) && (filters.status.entity !== "lead" || item.status === filters.status.value)),
    deals: data.deals.filter((item) => commonMatch(item, filters) && isWithin(item.createdAt, range) && (filters.status.entity !== "deal" || item.status === filters.status.value)),
    orders: data.orders.filter((item) => commonMatch(item, filters) && isWithin(item.orderedAt, range) && (filters.status.entity !== "order" || item.status === filters.status.value)),
    tasks: data.tasks.filter((item) => commonMatch(item, filters) && isWithin(item.createdAt, range) && (filters.status.entity !== "task" || item.status === filters.status.value)),
    clients: data.clients.filter((item) => commonMatch(item, filters) && isWithin(item.createdAt, range)),
  };
}

type FilteredData = ReturnType<typeof filterData>;

function metricValues(filtered: FilteredData, now: Date) {
  const qualifiedLeads = filtered.leads.filter((lead) => ["qualification", "proposal", "won"].includes(lead.status)).length;
  const activeDeals = filtered.deals.filter((deal) => !["paid", "lost"].includes(deal.status));
  const activeDealAmount = sum(activeDeals.map((deal) => deal.amount));
  const orderAmount = sum(filtered.orders.map((order) => order.amount));
  const completedOrders = filtered.orders.filter((order) => order.status === "completed").length;
  const completedLeads = filtered.leads.filter((lead) => lead.result && lead.completedAt);
  const convertedLeads = completedLeads.filter((lead) => lead.result === "converted");
  const rejectedLeads = completedLeads.filter((lead) => lead.result === "rejected");
  const completionHours = completedLeads.map((lead) => (
    (new Date(lead.completedAt!).getTime() - new Date(lead.createdAt).getTime()) / 3_600_000
  )).filter((value) => value >= 0);
  return {
    totalLeads: filtered.leads.length,
    completedLeads: completedLeads.length,
    convertedLeads: convertedLeads.length,
    rejectedLeads: rejectedLeads.length,
    incomingConversion: conversion(convertedLeads.length, filtered.leads.length),
    completedConversion: conversion(convertedLeads.length, completedLeads.length),
    averageCompletionHours: completionHours.length ? sum(completionHours) / completionHours.length : 0,
    newLeads: filtered.leads.filter((lead) => lead.status === "new").length,
    qualifiedLeads,
    activeDeals: activeDeals.length,
    activeDealAmount,
    orders: filtered.orders.length,
    orderAmount,
    clients: filtered.clients.length,
    overdueTasks: filtered.tasks.filter((task) => task.status !== "done" && new Date(task.dueAt) < now).length,
    averageOrder: filtered.orders.length ? orderAmount / filtered.orders.length : 0,
    forecast: sum(activeDeals.map((deal) => deal.amount * deal.probability / 100)),
    completedOrders,
  };
}

function buildKpis(current: ReturnType<typeof metricValues>, previous: ReturnType<typeof metricValues>): Kpi[] {
  const definitions = [
    ["totalLeads", "Всего создано лидов", number.format(current.totalLeads), "Входящие лиды за период"],
    ["completedLeads", "Завершено лидов", number.format(current.completedLeads), "Оба результата завершения"],
    ["convertedLeads", "Успешно конвертировано", number.format(current.convertedLeads), "Создан заказ покупателя"],
    ["rejectedLeads", "Отказов", number.format(current.rejectedLeads), "С зафиксированной причиной"],
    ["incomingConversion", "Конверсия всех лидов", `${current.incomingConversion}%`, "Конвертировано / создано"],
    ["completedConversion", "Конверсия завершённых", `${current.completedConversion}%`, "Конвертировано / завершено"],
    ["averageCompletionHours", "Среднее время завершения", `${number.format(Math.round(current.averageCompletionHours))} ч`, "От создания до результата"],
    ["newLeads", "Новые лиды", number.format(current.newLeads), "Созданы за период"],
    ["qualifiedLeads", "Квалифицированные лиды", number.format(current.qualifiedLeads), "Готовы к продаже"],
    ["activeDeals", "Активные сделки", number.format(current.activeDeals), "Без проигранных и оплаченных"],
    ["activeDealAmount", "Сумма активных сделок", currency.format(current.activeDealAmount), "Потенциал в работе"],
    ["orders", "Заказы", number.format(current.orders), "Созданы за период"],
    ["orderAmount", "Сумма заказов", currency.format(current.orderAmount), "Выручка по заказам"],
    ["clients", "Новые клиенты", number.format(current.clients), "Добавлены за период"],
    ["overdueTasks", "Просроченные задачи", number.format(current.overdueTasks), "Требуют внимания"],
    ["averageOrder", "Средний чек", currency.format(current.averageOrder), "По заказам периода"],
    ["forecast", "Прогноз выручки", currency.format(current.forecast), "С учётом вероятности"],
  ] as const;
  return definitions.map(([id, label, value, hint]) => {
    const comparison = trend(current[id], previous[id]);
    const tone = id === "overdueTasks" && comparison.tone !== "neutral"
      ? comparison.tone === "positive" ? "negative" : "positive"
      : comparison.tone;
    return { id, label, value, hint, change: comparison.change, tone };
  });
}

function bucketStart(date: Date, granularity: "day" | "week" | "month"): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (granularity === "week") result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  if (granularity === "month") result.setDate(1);
  return result;
}

function addBucket(date: Date, granularity: "day" | "week" | "month"): Date {
  const result = new Date(date);
  if (granularity === "day") result.setDate(result.getDate() + 1);
  if (granularity === "week") result.setDate(result.getDate() + 7);
  if (granularity === "month") result.setMonth(result.getMonth() + 1);
  return result;
}

function dynamics(filtered: FilteredData, range: DateRange): DynamicsPoint[] {
  const days = rangeDays(range);
  const granularity = days <= 31 ? "day" : days <= 180 ? "week" : "month";
  const buckets = new Map<string, DynamicsPoint>();
  const labelFormat = new Intl.DateTimeFormat("ru-RU", granularity === "month" ? { month: "short" } : { day: "2-digit", month: "short" });
  for (let cursor = bucketStart(range.start, granularity); cursor <= range.end; cursor = addBucket(cursor, granularity)) {
    const key = cursor.toISOString().slice(0, 10);
    buckets.set(key, { label: labelFormat.format(cursor), leads: 0, deals: 0, orders: 0, orderAmount: 0 });
  }
  const add = (dateIso: string, field: "leads" | "deals" | "orders", amount = 0) => {
    const key = bucketStart(new Date(dateIso), granularity).toISOString().slice(0, 10);
    const point = buckets.get(key);
    if (point) {
      point[field] += 1;
      point.orderAmount += amount;
    }
  };
  filtered.leads.forEach((item) => add(item.createdAt, "leads"));
  filtered.deals.forEach((item) => add(item.createdAt, "deals"));
  filtered.orders.forEach((item) => add(item.orderedAt, "orders", item.amount));
  return [...buckets.values()];
}

function sourceSummaries(filtered: FilteredData): SourceSummary[] {
  return (Object.keys(salesSourceLabels) as SalesSource[]).map((source) => {
    const leads = filtered.leads.filter((item) => item.source === source).length;
    const deals = filtered.deals.filter((item) => item.source === source).length;
    const sourceOrders = filtered.orders.filter((item) => item.source === source);
    const converted = filtered.leads.filter((item) => item.source === source && item.result === "converted").length;
    const rejected = filtered.leads.filter((item) => item.source === source && item.result === "rejected").length;
    return { source, leads, deals, orders: sourceOrders.length, converted, rejected, conversion: conversion(converted, leads), amount: sum(sourceOrders.map((item) => item.amount)) };
  });
}

function activeFilterLabels(filters: DashboardFilters, data: SalesDashboardData): string[] {
  const labels = [`Период: ${periodPresetLabels[filters.period]}`];
  if (filters.source !== "all") labels.push(`Источник: ${salesSourceLabels[filters.source]}`);
  if (filters.responsibleId !== "all") labels.push(`Ответственный: ${data.managers.find((manager) => manager.id === filters.responsibleId)?.name ?? "—"}`);
  if (filters.department !== "all") labels.push(`Подразделение: ${departmentLabels[filters.department]}`);
  if (filters.status.entity !== "all") labels.push(`Статус: ${filters.status.entity} / ${filters.status.value}`);
  if (filters.client) labels.push(`Клиент: ${filters.client}`);
  return labels;
}

export function createSalesDashboardSnapshot(data: SalesDashboardData, filters: DashboardFilters): DashboardSnapshot {
  const built = buildDateRange(filters.period, data.now, filters.customStart, filters.customEnd);
  const range = built.range;
  const previousRange = previousDateRange(range);
  const current = filterData(data, filters, range);
  const previous = filterData(data, filters, previousRange);
  const now = new Date(data.now);
  const currentMetrics = metricValues(current, now);
  const previousMetrics = metricValues(previous, now);
  const qualified = current.leads.filter((lead) => ["qualification", "proposal", "won"].includes(lead.status));
  const approval = current.deals.filter((deal) => ["approval", "contract", "paid"].includes(deal.status));
  const stages = [
    { label: "Новые лиды", count: current.leads.length, amount: sum(current.leads.map((item) => item.amount)) },
    { label: "Квалифицированы", count: qualified.length, amount: sum(qualified.map((item) => item.amount)) },
    { label: "Сделки", count: current.deals.length, amount: sum(current.deals.map((item) => item.amount)) },
    { label: "Согласование", count: approval.length, amount: sum(approval.map((item) => item.amount)) },
    { label: "Заказы", count: current.orders.length, amount: sum(current.orders.map((item) => item.amount)) },
    { label: "Завершено", count: currentMetrics.completedOrders, amount: sum(current.orders.filter((item) => item.status === "completed").map((item) => item.amount)) },
  ];
  const activity = [
    ...current.leads.map((item, index) => ({ id: `lead-${item.id}`, title: index % 2 ? "Изменён статус лида" : "Создан лид", description: item.clientName, occurredAt: item.updatedAt, tone: "blue" as const })),
    ...current.deals.map((item) => ({ id: `deal-${item.id}`, title: "Создана сделка", description: item.clientName, occurredAt: item.updatedAt, tone: "emerald" as const })),
    ...current.orders.map((item) => ({ id: `order-${item.id}`, title: "Создан заказ", description: item.clientName, occurredAt: item.updatedAt, tone: "amber" as const })),
    ...current.tasks.map((item, index) => ({ id: `task-${item.id}`, title: index % 3 === 0 ? "Выполнен звонок" : index % 3 === 1 ? "Назначена задача" : "Добавлен комментарий", description: item.clientName, occurredAt: item.updatedAt, tone: "slate" as const })),
  ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 8);

  const today = new Date(data.now).toDateString();
  const rejectionReasonCounts = new Map<string, number>();
  current.leads.filter((lead) => lead.result === "rejected").forEach((lead) => {
    const reason = lead.rejectionReason ?? "Не указана";
    rejectionReasonCounts.set(reason, (rejectionReasonCounts.get(reason) ?? 0) + 1);
  });
  return {
    range,
    previousRange,
    rangeLabel: formatRange(range),
    validationError: built.error,
    activeFilterLabels: activeFilterLabels(filters, data),
    kpis: buildKpis(currentMetrics, previousMetrics),
    funnel: stages.map((stage, index) => ({ ...stage, transition: index === 0 ? 100 : conversion(stage.count, stages[index - 1].count) })),
    dynamics: dynamics(current, range),
    sources: sourceSummaries(current),
    rejectionReasons: [...rejectionReasonCounts].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    dealStatuses: [...new Set(data.deals.map((deal) => deal.status))].map((status) => ({ status, count: current.deals.filter((deal) => deal.status === status).length, amount: sum(current.deals.filter((deal) => deal.status === status).map((deal) => deal.amount)) })),
    orders: {
      new: current.orders.filter((item) => item.status === "new").length,
      active: current.orders.filter((item) => ["confirmed", "production", "shipped"].includes(item.status)).length,
      ready: current.orders.filter((item) => item.status === "ready").length,
      completed: current.orders.filter((item) => item.status === "completed").length,
      overdue: current.orders.filter((item) => !["completed", "cancelled"].includes(item.status) && new Date(item.dueAt) < now).length,
      amount: sum(current.orders.map((item) => item.amount)),
    },
    tasks: {
      today: current.tasks.filter((item) => new Date(item.dueAt).toDateString() === today && item.status !== "done").length,
      overdue: current.tasks.filter((item) => item.status !== "done" && new Date(item.dueAt) < now).length,
      upcoming: current.tasks.filter((item) => item.status !== "done" && new Date(item.dueAt) > now).length,
      completed: current.tasks.filter((item) => item.status === "done").length,
      byResponsible: data.managers.map((manager) => ({ name: manager.name, count: current.tasks.filter((item) => item.responsible.id === manager.id).length })),
    },
    activity,
    empty: current.leads.length + current.deals.length + current.orders.length + current.tasks.length + current.clients.length === 0,
  };
}

export { currency };
