export const leadStatuses = [
  "new",
  "contact",
  "qualification",
  "proposal",
  "waiting",
  "completed",
  "won",
  "unqualified",
] as const;

export const leadResults = ["converted", "rejected"] as const;

export const dealStatuses = [
  "preparing",
  "sent",
  "negotiation",
  "approval",
  "contract",
  "paid",
  "lost",
] as const;

export const orderStatuses = [
  "new",
  "confirmed",
  "production",
  "ready",
  "shipped",
  "completed",
  "cancelled",
] as const;

export const taskStatuses = [
  "planned",
  "today",
  "progress",
  "waiting",
  "done",
  "overdue",
] as const;

export const priorities = ["low", "medium", "high"] as const;
export const clientStatuses = ["new", "active", "paused"] as const;
export const salesSources = [
  "website",
  "referral",
  "vk",
  "phone",
  "email",
  "manual",
] as const;

export type LeadStatus = (typeof leadStatuses)[number];
export type LeadResult = (typeof leadResults)[number];
export type DealStatus = (typeof dealStatuses)[number];
export type OrderStatus = (typeof orderStatuses)[number];
export type SalesTaskStatus = (typeof taskStatuses)[number];
export type Priority = (typeof priorities)[number];
export type ClientStatus = (typeof clientStatuses)[number];
export type SalesSource = (typeof salesSources)[number];

export type UserSummary = {
  id: string;
  name: string;
  initials: string;
};

export type Lead = {
  id: string;
  status: LeadStatus;
  clientName: string;
  contact: string;
  city: string;
  sport: string;
  estimatedAmount: number;
  source: string;
  responsible: UserSummary;
  nextContact: string;
  priority: Priority;
  result?: LeadResult;
  completedAt?: string;
  completedBy?: UserSummary;
  convertedOrderId?: string;
  convertedOrderNumber?: string;
  rejectionReason?: string;
  rejectionComment?: string;
  productCategory?: string;
  quantity?: number;
  needDescription?: string;
  desiredDate?: string;
};

export type Deal = {
  id: string;
  status: DealStatus;
  title: string;
  clientName: string;
  amount: number;
  probability: number;
  expectedClose: string;
  responsible: UserSummary;
  sport: string;
  nextTask: string;
};

export type Order = {
  id: string;
  number: string;
  status: OrderStatus;
  clientName: string;
  productType: string;
  quantity: number;
  amount: number;
  readyDate: string;
  manager: UserSummary;
  paymentStatus: "unpaid" | "partial" | "paid" | "refunded";
};

export type SalesTask = {
  id: string;
  status: SalesTaskStatus;
  title: string;
  clientName: string;
  relatedEntity: string;
  dueAt: string;
  assignee: UserSummary;
  priority: Priority;
  type: string;
};

export type Client = {
  id: string;
  name: string;
  type: string;
  contact: string;
  phone: string;
  email: string;
  city: string;
  sport: string;
  ordersCount: number;
  salesAmount: number;
  lastContact: string;
  lastContactOrder: number;
  responsible: UserSummary;
  status: ClientStatus;
};

export type KanbanColumn<TStatus extends string> = {
  id: TStatus;
  title: string;
  accentClass: string;
};
