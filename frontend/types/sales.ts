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

export const priorities = ["low", "medium", "high", "urgent"] as const;
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

export const communicationChannels = [
  "phone",
  "email",
  "telegram",
  "whatsapp",
  "vk",
  "unspecified",
] as const;

export type CommunicationChannel = (typeof communicationChannels)[number];
export type LeadMessageChannel = Exclude<CommunicationChannel, "unspecified"> | "website" | "internal";
export type LeadMessageDirection = "incoming" | "outgoing";
export type LeadMessageStatus = "draft" | "sending" | "sent" | "delivered" | "read" | "failed";

export type LeadMessageAttachment = {
  id: string;
  name: string;
  type?: string;
  size?: number;
};

export type LeadMessage = {
  id: string;
  leadId: string;
  channel: LeadMessageChannel;
  direction: LeadMessageDirection;
  text: string;
  author?: UserSummary;
  senderName?: string;
  recipientName?: string;
  sentAt: string;
  status?: LeadMessageStatus;
  externalId?: string;
  attachments?: LeadMessageAttachment[];
  isMock?: boolean;
};
export type LeadCustomerType = "person" | "sole_proprietor" | "company";

export type LeadContact = {
  id: string;
  name: string;
  position?: string;
  phone?: string;
  email?: string;
  messenger?: string;
  preferredChannel: CommunicationChannel;
  isPrimary: boolean;
};

export type LeadCustomer = {
  type?: LeadCustomerType;
  organizationName?: string;
  website?: string;
  city?: string;
  region?: string;
  address?: string;
  taxId?: string;
  comment?: string;
  contacts: LeadContact[];
};

export const leadDirections = [
  "Спортивная форма",
  "Корпоративная одежда",
  "Массовое производство",
  "Индивидуальный пошив",
  "Другое",
] as const;

export const sports = [
  "Футбол",
  "Мини-футбол",
  "Волейбол",
  "Баскетбол",
  "Хоккей",
  "Регби",
  "Бег",
  "Лёгкая атлетика",
  "Фитнес",
  "Киберспорт",
  "Мультиспорт",
  "Другое",
] as const;

export const productCategories = [
  "Игровая форма",
  "Тренировочная форма",
  "Разминочная одежда",
  "Верхняя одежда",
  "Корпоративная одежда",
  "Аксессуары",
  "Другое",
] as const;

export const productTypes = [
  "Футболка",
  "Майка",
  "Шорты",
  "Брюки",
  "Легинсы",
  "Толстовка",
  "Ветровка",
  "Куртка",
  "Спортивный костюм",
  "Игровой комплект",
  "Тренировочный комплект",
  "Манишка",
  "Поло",
  "Другое",
] as const;

export const deliveryMethods = [
  "Самовывоз",
  "Транспортная компания",
  "Курьер",
  "Почта",
  "Не определено",
] as const;

export type LeadCommercialDetailsData = {
  direction?: (typeof leadDirections)[number];
  sport?: (typeof sports)[number];
  productCategory?: (typeof productCategories)[number];
  productType?: (typeof productTypes)[number];
  needDescription?: string;
  estimatedQuantity?: number;
  kitQuantity?: number;
  sizeComment?: string;
  preliminaryBudget?: number;
  discountPercent?: number;
  plannedOrderDate?: string;
  desiredReadyDate?: string;
  eventDate?: string;
  deliveryCity?: string;
  deliveryAddress?: string;
  deliveryMethod?: (typeof deliveryMethods)[number];
  deliveryComment?: string;
  campaign?: string;
  utmDescription?: string;
  priority?: Priority;
};

export const leadActivityTypes = [
  "lead_created",
  "status_changed",
  "responsible_changed",
  "comment_added",
  "task_created",
  "task_updated",
  "task_completed",
  "incoming_call",
  "outgoing_call",
  "incoming_message",
  "outgoing_message",
  "email_received",
  "email_sent",
  "file_attached",
  "customer_updated",
  "commercial_updated",
  "order_created",
  "deal_created",
  "lead_closed",
] as const;

export type LeadActivityType = (typeof leadActivityTypes)[number];
export type LeadActivityDirection = "incoming" | "outgoing";
export type LeadActivityChannel = "phone" | "email" | "telegram" | "whatsapp" | "vk" | "website" | "internal";

export type LeadActivityAttachment = {
  id: string;
  name: string;
  mediaType: string;
  sizeLabel?: string;
};

export type LeadActivity = {
  id: string;
  type: LeadActivityType;
  occurredAt: string;
  author?: {
    id: string;
    name: string;
  };
  title: string;
  description?: string;
  direction?: LeadActivityDirection;
  channel?: LeadActivityChannel;
  metadata?: Record<string, string | number | boolean>;
  attachments?: LeadActivityAttachment[];
  isSystem?: boolean;
  updatedAt?: string;
  isPinned?: boolean;
  mentionedUserIds?: string[];
};

export const leadTaskTypes = [
  "call",
  "message",
  "email",
  "send_proposal",
  "clarify_sizes",
  "receive_design",
  "approve_design",
  "check_payment",
  "meeting",
  "other",
] as const;

export type LeadTaskType = (typeof leadTaskTypes)[number];
export type LeadTaskStatus = "open" | "completed";

export type LeadTask = {
  id: string;
  leadId: string;
  title: string;
  type: LeadTaskType;
  status: LeadTaskStatus;
  priority: Priority;
  assignedTo: UserSummary;
  dueAt: string;
  description?: string;
  result?: string;
  createdAt: string;
  completedAt?: string;
  createdBy: UserSummary;
};

export type Lead = {
  id: string;
  status: LeadStatus;
  stageId?: string;
  clientName: string;
  contact: string;
  city: string;
  sport: string;
  estimatedAmount: number;
  probability?: number;
  customer?: LeadCustomer;
  commercial?: LeadCommercialDetailsData;
  activities?: LeadActivity[];
  tasks?: LeadTask[];
  messages?: LeadMessage[];
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
