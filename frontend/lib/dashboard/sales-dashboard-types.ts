import type {
  DealStatus,
  LeadStatus,
  OrderStatus,
  SalesSource,
  SalesTaskStatus,
  UserSummary,
} from "@/types/sales";

export const periodPresetLabels = {
  today: "Сегодня",
  yesterday: "Вчера",
  sevenDays: "7 дней",
  thirtyDays: "30 дней",
  currentMonth: "Текущий месяц",
  previousMonth: "Предыдущий месяц",
  currentQuarter: "Текущий квартал",
  currentYear: "Текущий год",
  custom: "Произвольный период",
} as const;

export type PeriodPreset = keyof typeof periodPresetLabels;
export type Department = "sales" | "production" | "design" | "management";
export type TrendTone = "positive" | "negative" | "neutral";

export type StatusFilter =
  | { entity: "all" }
  | { entity: "lead"; value: LeadStatus }
  | { entity: "deal"; value: DealStatus }
  | { entity: "order"; value: OrderStatus }
  | { entity: "task"; value: SalesTaskStatus };

export type DashboardFilters = {
  period: PeriodPreset;
  customStart: string;
  customEnd: string;
  source: SalesSource | "all";
  responsibleId: string | "all";
  department: Department | "all";
  status: StatusFilter;
  client: string;
};

type DashboardEntity = {
  id: string;
  clientName: string;
  source: SalesSource;
  responsible: UserSummary;
  department: Department;
  createdAt: string;
  updatedAt: string;
};

export type DashboardLead = DashboardEntity & {
  status: LeadStatus;
  amount: number;
  qualifiedAt?: string;
};

export type DashboardDeal = DashboardEntity & {
  status: DealStatus;
  amount: number;
  probability: number;
  wonAt?: string;
};

export type DashboardOrder = DashboardEntity & {
  status: OrderStatus;
  amount: number;
  orderedAt: string;
  dueAt: string;
  completedAt?: string;
};

export type DashboardTask = DashboardEntity & {
  status: SalesTaskStatus;
  dueAt: string;
  completedAt?: string;
};

export type DashboardClient = DashboardEntity & {
  name: string;
};

export type SalesDashboardData = {
  now: string;
  leads: DashboardLead[];
  deals: DashboardDeal[];
  orders: DashboardOrder[];
  tasks: DashboardTask[];
  clients: DashboardClient[];
  managers: UserSummary[];
};

export type DateRange = { start: Date; end: Date };

export type Kpi = {
  id: string;
  label: string;
  value: string;
  hint: string;
  change: number;
  tone: TrendTone;
};

export type FunnelStage = {
  label: string;
  count: number;
  transition: number;
  amount?: number;
};

export type DynamicsPoint = {
  label: string;
  leads: number;
  deals: number;
  orders: number;
  orderAmount: number;
};

export type SourceSummary = {
  source: SalesSource;
  leads: number;
  deals: number;
  orders: number;
  conversion: number;
  amount: number;
};

export type RecentActivity = {
  id: string;
  title: string;
  description: string;
  occurredAt: string;
  tone: "blue" | "emerald" | "amber" | "slate";
};

export type DashboardSnapshot = {
  range: DateRange;
  previousRange: DateRange;
  rangeLabel: string;
  validationError?: string;
  activeFilterLabels: string[];
  kpis: Kpi[];
  funnel: FunnelStage[];
  dynamics: DynamicsPoint[];
  sources: SourceSummary[];
  dealStatuses: Array<{ status: DealStatus; count: number; amount: number }>;
  orders: { new: number; active: number; ready: number; completed: number; overdue: number; amount: number };
  tasks: { today: number; overdue: number; upcoming: number; completed: number; byResponsible: Array<{ name: string; count: number }> };
  activity: RecentActivity[];
  empty: boolean;
};

export const defaultDashboardFilters: DashboardFilters = {
  period: "thirtyDays",
  customStart: "2026-06-17",
  customEnd: "2026-07-16",
  source: "all",
  responsibleId: "all",
  department: "all",
  status: { entity: "all" },
  client: "",
};
