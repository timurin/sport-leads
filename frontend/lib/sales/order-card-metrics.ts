import type { SalesOrderDetails, SalesOrderItem } from "@/lib/sales/order-details";
import type { OrderPaymentStatus } from "@/lib/sales/order-details";
import type { OrderStatus } from "@/types/sales";

export type OrderCardMetricsModel = {
  amountLabel: string;
  amountValue: number;
  currencyCode: string;
  itemsSubtotalLabel: string;
  itemsSubtotalValue: number;
  discountPercent: string;
  discountAmountLabel: string;
  discountAmountValue: number;
  vatAmountLabel: string;
  vatAmountValue: number;
  amountNetLabel: string;
  amountNetValue: number;
  itemCount: number;
  unitsPlanned: number;
  daysInWork: number;
  createdAtLabel: string;
  lastActivityLabel: string;
  desiredDateLabel: string;
  activityCount: number;
  communicationCount: number;
  openTasksCount: number;
  sewingCostValue: number;
  sewingCostLabel: string;
  sewingCostSource: "items" | "demo";
  marginPercent: number;
  paymentStatus: OrderPaymentStatus;
  paymentLabel: string;
  paidPercent: number;
  paidAmountLabel: string;
  paidAmountValue: string;
  productionPercent: number;
  productionLabel: string;
  slaDaysLeft: number | null;
  slaLabel: string;
  slaTone: "default" | "success" | "warning" | "danger";
  /** Margin / sewing fallback still demo-enriched until costing ships. */
  isDemoEnriched: boolean;
};

/** Compact mirror of demo qty fallback when order has no lines. */
const DEMO_ORDER_METRICS = [
  { amount: 530000, quantity: 44 },
  { amount: 940000, quantity: 120 },
  { amount: 760000, quantity: 90 },
  { amount: 1240000, quantity: 140 },
  { amount: 320000, quantity: 32 },
  { amount: 480000, quantity: 60 },
  { amount: 185000, quantity: 24 },
  { amount: 215000, quantity: 38 },
  { amount: 290000, quantity: 36 },
  { amount: 80000, quantity: 18 },
] as const;

const currencyFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

const paymentLabels: Record<OrderPaymentStatus, string> = {
  unpaid: "Не оплачен",
  partial: "Частично оплачен",
  paid: "Оплачен",
};

const productionByStatus: Record<OrderStatus, { percent: number; label: string }> = {
  new: { percent: 8, label: "Ожидает подтверждения" },
  confirmed: { percent: 22, label: "Подготовка к запуску" },
  production: { percent: 58, label: "В производстве" },
  ready: { percent: 88, label: "Готов к отгрузке" },
  shipped: { percent: 96, label: "Отгружен" },
  completed: { percent: 100, label: "Завершён" },
  cancelled: { percent: 0, label: "Отменён" },
};

function parseMoney(value: string): number {
  const normalized = value.replace(/[^\d,.-]/g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

/** Live 0–100% fill for the order payment scale while the paid-amount field is typed. */
export function paidPercentFromDraft(paidAmountDraft: string, orderAmount: number): number {
  if (!(orderAmount > 0)) return 0;
  const paid = Number(String(paidAmountDraft).trim().replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(paid) || paid <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((paid / orderAmount) * 100)));
}

function parseQuantity(value: string): number {
  const amount = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function sumSewingFromItems(items: SalesOrderItem[]): number {
  return items.reduce((total, item) => {
    const unitCost = parseMoney(item.assemblyVariantTotalCost || "0");
    const qty = parseQuantity(item.quantity) || 1;
    return total + unitCost * qty;
  }, 0);
}

function pickDemoOrder(orderId: string) {
  const numeric = Number(orderId);
  const index = Number.isFinite(numeric)
    ? Math.abs(Math.trunc(numeric)) % DEMO_ORDER_METRICS.length
    : [...orderId].reduce((sum, char) => sum + char.charCodeAt(0), 0) % DEMO_ORDER_METRICS.length;
  return DEMO_ORDER_METRICS[index] ?? DEMO_ORDER_METRICS[0];
}

function computeSla(desiredDateLabel: string, daysInWork: number): Pick<OrderCardMetricsModel, "slaDaysLeft" | "slaLabel" | "slaTone"> {
  if (!desiredDateLabel || desiredDateLabel === "Не указана") {
    return { slaDaysLeft: null, slaLabel: "Срок не задан", slaTone: "default" };
  }
  const windowDays = 21;
  const left = Math.max(-14, windowDays - daysInWork);
  if (left < 0) {
    return { slaDaysLeft: left, slaLabel: `Просрочка ${Math.abs(left)} дн.`, slaTone: "danger" };
  }
  if (left <= 3) {
    return { slaDaysLeft: left, slaLabel: `Осталось ${left} дн.`, slaTone: "warning" };
  }
  return { slaDaysLeft: left, slaLabel: `Осталось ${left} дн.`, slaTone: "success" };
}

export function buildOrderCardMetrics({
  order,
  daysInWork,
  lastActivityLabel,
  activityCount,
  communicationCount,
  openTasksCount,
}: {
  order: SalesOrderDetails;
  daysInWork: number;
  lastActivityLabel: string;
  activityCount: number;
  communicationCount: number;
  openTasksCount: number;
}): OrderCardMetricsModel {
  const demo = pickDemoOrder(order.id);
  const hasApiAmount = order.amountValue.trim() !== "";
  const amountFromOrder = hasApiAmount
    ? Number(String(order.amountValue).replace(",", "."))
    : parseMoney(order.amount);
  const amountValue =
    hasApiAmount && Number.isFinite(amountFromOrder)
      ? amountFromOrder
      : parseMoney(order.amount) > 0
        ? parseMoney(order.amount)
        : demo.amount;
  const amountLabel =
    hasApiAmount && Number.isFinite(amountFromOrder)
      ? order.amount
      : parseMoney(order.amount) > 0
        ? order.amount
        : currencyFormatter.format(demo.amount);

  const itemsSubtotalValue = Number(
    String(order.itemsSubtotalValue || "0").replace(",", "."),
  );
  const itemsSubtotalLabel =
    Number.isFinite(itemsSubtotalValue) && itemsSubtotalValue >= 0
      ? order.itemsSubtotal
      : amountLabel;
  const discountAmountValue = Number(
    String(order.discountAmountValue || "0").replace(",", "."),
  );
  const vatAmountValue = Number(String(order.vatAmountValue || "0").replace(",", "."));
  const amountNetValue = Number(String(order.amountNetValue || "0").replace(",", "."));

  const sewingFromItems = sumSewingFromItems(order.items);
  const sewingCostSource: "items" | "demo" = sewingFromItems > 0 ? "items" : "demo";
  const sewingCostValue = sewingFromItems > 0
    ? sewingFromItems
    : Math.round(amountValue * 0.18);

  const materialsDemo = Math.round(amountValue * 0.42);
  const marginValue = Math.max(0, amountValue - sewingCostValue - materialsDemo);
  const marginPercent = amountValue > 0 ? Math.round((marginValue / amountValue) * 100) : 0;

  const paymentStatus = order.paymentStatus;
  const paidAmountRaw = Number(String(order.paidAmountValue || "0").replace(",", "."));
  const paidAmountValueNum = Number.isFinite(paidAmountRaw) ? paidAmountRaw : 0;
  const paidPercent =
    paymentStatus === "paid"
      ? 100
      : paymentStatus === "unpaid" || amountValue <= 0
        ? 0
        : Math.min(99, Math.max(1, Math.round((paidAmountValueNum / amountValue) * 100)));
  const paidAmountLabel = currencyFormatter.format(paidAmountValueNum);

  const production = productionByStatus[order.statusCode];
  const unitsFromItems = order.items.reduce((sum, item) => sum + (parseQuantity(item.quantity) || 0), 0);
  const unitsPlanned = unitsFromItems > 0 ? unitsFromItems : demo.quantity;
  const sla = computeSla(order.desiredDate, daysInWork);

  return {
    amountLabel,
    amountValue,
    currencyCode: order.currencyCode || "RUB",
    itemsSubtotalLabel:
      Number.isFinite(itemsSubtotalValue) ? itemsSubtotalLabel : amountLabel,
    itemsSubtotalValue: Number.isFinite(itemsSubtotalValue)
      ? itemsSubtotalValue
      : amountValue,
    discountPercent: order.discountPercent,
    discountAmountLabel: order.discountAmount,
    discountAmountValue: Number.isFinite(discountAmountValue)
      ? discountAmountValue
      : 0,
    vatAmountLabel: order.vatAmount,
    vatAmountValue: Number.isFinite(vatAmountValue) ? vatAmountValue : 0,
    amountNetLabel: order.amountNet,
    amountNetValue: Number.isFinite(amountNetValue) ? amountNetValue : 0,
    itemCount: order.itemCount,
    unitsPlanned,
    daysInWork,
    createdAtLabel: order.createdAt,
    lastActivityLabel,
    desiredDateLabel: order.desiredDate,
    activityCount,
    communicationCount,
    openTasksCount,
    sewingCostValue,
    sewingCostLabel: currencyFormatter.format(sewingCostValue),
    sewingCostSource,
    marginPercent,
    paymentStatus,
    paymentLabel: paymentLabels[paymentStatus],
    paidPercent,
    paidAmountLabel,
    paidAmountValue: order.paidAmountValue || "0",
    productionPercent: production.percent,
    productionLabel: production.label,
    ...sla,
    isDemoEnriched: sewingCostSource === "demo",
  };
}
