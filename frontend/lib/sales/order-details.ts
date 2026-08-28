import type {
  DesignApprovalStatus,
} from "@/app/(workspace)/sales/orders/[orderId]/order-design-approval-actions";
import type {
  MaterialReserveStatus,
  OrderPaymentStatus,
} from "@/app/(workspace)/sales/orders/[orderId]/order-execution-actions";
import type { LeadContact, LeadCustomer, LeadMessage, LeadTask, OrderStatus } from "@/types/sales";

export const designApprovalStatusLabels: Record<DesignApprovalStatus, string> = {
  not_required: "Не требуется",
  pending: "Ожидает",
  in_review: "На согласовании",
  approved: "Согласован",
  rejected: "Отклонён",
};

export const designApprovalStatuses: DesignApprovalStatus[] = [
  "not_required",
  "pending",
  "in_review",
  "approved",
  "rejected",
];

export const materialReserveStatusLabels: Record<MaterialReserveStatus, string> = {
  not_required: "Не требуется",
  pending: "Ожидает",
  reserved: "Зарезервирован",
};

export const materialReserveStatuses: MaterialReserveStatus[] = [
  "not_required",
  "pending",
  "reserved",
];

export const orderPaymentStatusLabels: Record<OrderPaymentStatus, string> = {
  unpaid: "Не оплачен",
  partial: "Частично",
  paid: "Оплачен",
};

export const orderPaymentStatuses: OrderPaymentStatus[] = ["unpaid", "partial", "paid"];

export type { DesignApprovalStatus, MaterialReserveStatus, OrderPaymentStatus };

export type ApiSalesOrderDetails = {
  id: number;
  number: string;
  lead_id: number | null;
  client_id: number;
  organization_id: number | null;
  organization_name: string | null;
  status: OrderStatus;
  design_approval_status?: string | null;
  payment_status?: string | null;
  paid_amount?: number | string | null;
  material_reserve_status?: string | null;
  responsible_id: number | null;
  responsible_name: string | null;
  client_name: string | null;
  title: string;
  description: string | null;
  product_category: string | null;
  sport: string | null;
  quantity: number | null;
  amount: number | string | null;
  discount_percent?: number | string | null;
  discount_amount?: number | string | null;
  vat_amount?: number | string | null;
  currency_code?: string | null;
  items_subtotal?: number | string | null;
  amount_net?: number | string | null;
  desired_date: string | null;
  tech_cards_planned_count?: number | null;
  source: string | null;
  created_at: string;
  updated_at: string;
  items: ApiSalesOrderItem[];
};

export type ApiSalesOrderItem = {
  id: number;
  order_id: number;
  nomenclature_id: number | null;
  nomenclature_variant_id: number | null;
  product_model_id: number | null;
  product_model_article: string | null;
  product_model_name: string | null;
  product_model_size_type: "men" | "women" | "kids" | null;
  assembly_variant_id: number | null;
  assembly_variant_name: string | null;
  assembly_variant_total_cost: number | string | null;
  routing_template_id: number | null;
  routing_template_name: string | null;
  vat_rate_id: number | null;
  vat_rate_percent: number | string | null;
  price_includes_vat?: boolean;
  vat_amount?: number | string | null;
  line_total?: number | string | null;
  variant_snapshots: {
    characteristic_id: number;
    characteristic_code: string;
    characteristic_name: string;
    option_id: number;
    option_code: string;
    option_label: string;
  }[];
  position: number;
  snapshot_name: string;
  size_range: string | null;
  personalization: string | null;
  color: string | null;
  unit: string;
  quantity: number | string;
  unit_price: number | string;
  gross_amount: number | string;
  discount_percent: number | string | null;
  discount_amount: number | string;
  line_amount: number | string;
  created_at: string;
  updated_at: string;
};

/** Same event contract as lead history; order `/history` returns lead ∪ order events. */
export type ApiSalesOrderEvent = {
  id: number;
  lead_id: number | null;
  order_id: number | null;
  event_type:
    | "lead_created"
    | "lead_status_changed"
    | "lead_converted"
    | "lead_rejected"
    | "order_created"
    | "order_status_changed"
    | "comment_added"
    | "task_created"
    | "task_completed";
  actor_id: number | null;
  message: string | null;
  created_at: string;
};

const statusLabels: Record<OrderStatus, string> = {
  new: "Новый",
  confirmed: "Подтверждён",
  production: "В производстве",
  ready: "Готов",
  shipped: "Отгружен",
  completed: "Завершён",
  cancelled: "Отменён",
};

const currencyFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const historyTitles: Record<ApiSalesOrderEvent["event_type"], string> = {
  lead_created: "Лид создан",
  lead_status_changed: "Статус лида обновлён",
  lead_converted: "Лид конвертирован",
  lead_rejected: "Лид отклонён",
  order_created: "Заказ создан",
  order_status_changed: "Статус заказа изменён",
  comment_added: "Добавлен комментарий",
  task_created: "Создана задача",
  task_completed: "Задача завершена",
};

export type SalesOrderDetails = {
  id: string;
  number: string;
  title: string;
  status: string;
  statusCode: OrderStatus;
  designApprovalStatus: DesignApprovalStatus;
  paymentStatus: OrderPaymentStatus;
  paidAmountValue: string;
  materialReserveStatus: MaterialReserveStatus;
  leadId: string | null;
  clientId: string;
  clientName: string;
  organizationId: string | null;
  organizationName: string;
  responsibleId: string | null;
  responsibleName: string;
  amount: string;
  createdAt: string;
  createdAtIso: string;
  updatedAtIso: string;
  desiredDate: string;
  /** ISO date `YYYY-MM-DD` or empty for editors (`20.4.2`). */
  desiredDateValue: string;
  /** Soft planned TC count (Stage 28); null = unset. */
  techCardsPlannedCount: number | null;
  source: string;
  sourceValue: string;
  sourceLeadHref: string | null;
  clientHref: string;
  organizationHref: string | null;
  description: string;
  descriptionValue: string;
  productCategory: string;
  productCategoryValue: string;
  sport: string;
  sportValue: string;
  quantity: string;
  quantityValue: string;
  itemCount: number;
  /** Raw order total after order-level discount (API `amount`). */
  amountValue: string;
  /** ISO 4217 currency code (MVP default RUB). */
  currencyCode: string;
  /** Formatted sum of line_amount before order discount. */
  itemsSubtotal: string;
  itemsSubtotalValue: string;
  /** Order-level discount % (`null`/empty = none). */
  discountPercent: string;
  discountAmount: string;
  discountAmountValue: string;
  vatAmount: string;
  vatAmountValue: string;
  amountNet: string;
  amountNetValue: string;
  items: SalesOrderItem[];
};

export type SalesOrderItem = {
  id: number;
  nomenclatureId: number | null;
  nomenclatureVariantId: number | null;
  productModelId: number | null;
  productModelArticle: string;
  productModelName: string;
  productModelSizeType: "men" | "women" | "kids" | "";
  assemblyVariantId: number | null;
  assemblyVariantName: string;
  assemblyVariantTotalCost: string;
  routingTemplateId: number | null;
  routingTemplateName: string;
  vatRateId: number | null;
  vatRatePercent: string;
  priceIncludesVat: boolean;
  vatAmount: string;
  vatAmountValue: string;
  lineTotal: string;
  lineTotalValue: string;
  variantSnapshots: ApiSalesOrderItem["variant_snapshots"];
  snapshotName: string;
  sizeRange: string;
  personalization: string;
  color: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  unitPriceValue: string;
  grossAmount: string;
  discountPercent: string;
  discountAmount: string;
  lineAmount: string;
  lineAmountValue: string;
};

export type SalesOrderHistoryItem = {
  id: string;
  title: string;
  message: string;
  occurredAt: string;
};

export type SalesOrderSourceLead = {
  id: string;
  contactName: string;
  customer: LeadCustomer;
  messages: LeadMessage[];
  primaryContact?: LeadContact;
  tasks: LeadTask[];
  taskReferenceAt: string;
};

function formatCurrency(value: number | string | null): string {
  if (value === null) return "Не указана";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Не указана";
  return currencyFormatter.format(amount);
}

function formatDate(value: string | null): string {
  if (!value) return "Не указана";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? "Не указана" : dateFormatter.format(date);
}

export function fromApiSalesOrderEvent(event: ApiSalesOrderEvent): SalesOrderHistoryItem {
  return {
    id: `backend-event-${event.id}`,
    title: historyTitles[event.event_type],
    message: event.message ?? "Изменение сохранено в истории заказа.",
    occurredAt: event.created_at,
  };
}

export function fromApiSalesOrder(order: ApiSalesOrderDetails): SalesOrderDetails {
  const items = order.items ?? [];
  const itemsSubtotalRaw =
    order.items_subtotal ??
    items.reduce((sum, item) => sum + (Number(item.line_amount) || 0), 0);
  const discountAmountRaw = order.discount_amount ?? 0;
  const vatAmountRaw = order.vat_amount ?? 0;
  const amountNetRaw =
    order.amount_net ??
    (order.amount == null ? 0 : Number(order.amount) - Number(vatAmountRaw));
  return {
    id: String(order.id),
    number: order.number,
    title: order.title || "Заказ без наименования",
    status: statusLabels[order.status],
    statusCode: order.status,
    designApprovalStatus:
      (order.design_approval_status as DesignApprovalStatus | null | undefined)
      ?? "not_required",
    paymentStatus:
      (order.payment_status as OrderPaymentStatus | null | undefined) ?? "unpaid",
    paidAmountValue:
      order.paid_amount == null || order.paid_amount === ""
        ? "0"
        : String(order.paid_amount),
    materialReserveStatus:
      (order.material_reserve_status as MaterialReserveStatus | null | undefined)
      ?? "not_required",
    leadId: order.lead_id == null ? null : String(order.lead_id),
    clientId: String(order.client_id),
    clientName: order.client_name ?? `Клиент #${order.client_id}`,
    organizationId: order.organization_id === null ? null : String(order.organization_id),
    organizationName: order.organization_name ?? "Организация не назначена",
    responsibleId: order.responsible_id === null ? null : String(order.responsible_id),
    responsibleName: order.responsible_name ?? (order.responsible_id === null ? "Не назначен" : `Сотрудник #${order.responsible_id}`),
    amount: formatCurrency(order.amount),
    amountValue: order.amount == null ? "" : String(order.amount),
    currencyCode: (order.currency_code || "RUB").toUpperCase(),
    itemsSubtotal: formatCurrency(itemsSubtotalRaw),
    itemsSubtotalValue: String(itemsSubtotalRaw),
    discountPercent:
      order.discount_percent == null || order.discount_percent === ""
        ? ""
        : String(order.discount_percent),
    discountAmount: formatCurrency(discountAmountRaw),
    discountAmountValue: String(discountAmountRaw),
    vatAmount: formatCurrency(vatAmountRaw),
    vatAmountValue: String(vatAmountRaw),
    amountNet: formatCurrency(amountNetRaw),
    amountNetValue: String(amountNetRaw),
    createdAt: formatDate(order.created_at),
    createdAtIso: order.created_at,
    updatedAtIso: order.updated_at,
    desiredDate: formatDate(order.desired_date),
    desiredDateValue: order.desired_date ?? "",
    techCardsPlannedCount:
      order.tech_cards_planned_count == null ? null : Number(order.tech_cards_planned_count),
    source: order.source ?? "Не указан",
    sourceValue: order.source ?? "",
    sourceLeadHref:
      order.lead_id == null ? null : `/sales/leads/${order.lead_id}`,
    clientHref: `/sales/clients/${order.client_id}`,
    organizationHref: order.organization_id === null ? null : `/settings/organizations/${order.organization_id}`,
    description: order.description ?? "Описание пока не добавлено.",
    descriptionValue: order.description ?? "",
    productCategory: order.product_category ?? "Не указана",
    productCategoryValue: order.product_category ?? "",
    sport: order.sport ?? "Не указан",
    sportValue: order.sport ?? "",
    quantity: order.quantity === null ? "Не указано" : `${order.quantity} ед.`,
    quantityValue: order.quantity === null ? "" : String(order.quantity),
    itemCount: items.length,
    items: items.map(fromApiSalesOrderItem),
  };
}

export function fromApiSalesOrderItem(item: ApiSalesOrderItem): SalesOrderItem {
  const lineTotalRaw = item.line_total ?? item.line_amount;
  return {
    id: item.id,
    nomenclatureId: item.nomenclature_id,
    nomenclatureVariantId: item.nomenclature_variant_id,
    productModelId: item.product_model_id ?? null,
    productModelArticle: item.product_model_article ?? "",
    productModelName: item.product_model_name ?? "",
    productModelSizeType: item.product_model_size_type ?? "",
    assemblyVariantId: item.assembly_variant_id ?? null,
    assemblyVariantName: item.assembly_variant_name ?? "",
    assemblyVariantTotalCost:
      item.assembly_variant_total_cost == null
        ? ""
        : String(item.assembly_variant_total_cost),
    routingTemplateId: item.routing_template_id ?? null,
    routingTemplateName: item.routing_template_name ?? "",
    vatRateId: item.vat_rate_id ?? null,
    vatRatePercent: item.vat_rate_percent == null ? "" : String(item.vat_rate_percent),
    priceIncludesVat: item.price_includes_vat !== false,
    vatAmount: formatCurrency(item.vat_amount ?? 0),
    vatAmountValue: String(item.vat_amount ?? 0),
    lineTotal: formatCurrency(lineTotalRaw),
    lineTotalValue: String(lineTotalRaw),
    variantSnapshots: item.variant_snapshots ?? [],
    snapshotName: item.snapshot_name,
    sizeRange: item.size_range ?? "",
    personalization: item.personalization ?? "",
    color: item.color ?? "",
    unit: item.unit,
    quantity: String(item.quantity),
    unitPrice: formatCurrency(item.unit_price),
    unitPriceValue: String(item.unit_price),
    grossAmount: formatCurrency(item.gross_amount),
    discountPercent: item.discount_percent === null ? "" : String(item.discount_percent),
    discountAmount: formatCurrency(item.discount_amount),
    lineAmount: formatCurrency(item.line_amount),
    lineAmountValue: String(item.line_amount),
  };
}

export type OrderDetailsResult =
  | { kind: "found"; order: SalesOrderDetails }
  | { kind: "not-found" }
  | { kind: "error"; message: string };

export async function getOrderDetails(orderId: string): Promise<OrderDetailsResult> {
  if (!/^\d+$/.test(orderId)) return { kind: "not-found" };
  const apiUrl = process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000";
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/orders/${orderId}`, { cache: "no-store" });
  if (response.status === 404) return { kind: "not-found" };
  if (!response.ok) {
    return { kind: "error", message: `Не удалось загрузить заказ из backend (${response.status}).` };
  }
  return { kind: "found", order: fromApiSalesOrder(await response.json() as ApiSalesOrderDetails) };
}

export type OrderHistoryResult =
  | { kind: "found"; events: ApiSalesOrderEvent[]; history: SalesOrderHistoryItem[] }
  | { kind: "not-found" }
  | { kind: "error"; message: string };

export async function getOrderHistory(orderId: string): Promise<OrderHistoryResult> {
  if (!/^\d+$/.test(orderId)) return { kind: "not-found" };
  const apiUrl = process.env.SPORT_LEADS_API_URL ?? "http://127.0.0.1:8000";
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/orders/${orderId}/history`, { cache: "no-store" });
  if (response.status === 404) return { kind: "not-found" };
  if (!response.ok) {
    return { kind: "error", message: `Не удалось загрузить историю заказа из backend (${response.status}).` };
  }
  const events = await response.json() as ApiSalesOrderEvent[];
  return {
    kind: "found",
    events,
    history: events.map(fromApiSalesOrderEvent),
  };
}
