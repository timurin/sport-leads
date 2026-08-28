export type PurchaseOrderStatus = "draft" | "ordered" | "cancelled";

export type ApiPurchaseOrderListItem = {
  id: number;
  number: string;
  supplier_id: number;
  supplier_name: string;
  status: PurchaseOrderStatus;
  expected_date: string | null;
  warehouse_id: number | null;
  total_amount: string;
  currency: string;
  created_at: string;
  updated_at: string;
};

export type ApiPurchaseOrderLine = {
  id: number;
  purchase_order_id: number;
  nomenclature_id: number;
  nomenclature_name: string;
  quantity: string;
  unit_price: string;
  line_amount: string;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

export type ApiPurchaseOrderDetail = {
  id: number;
  number: string;
  supplier_id: number;
  supplier_name: string;
  status: PurchaseOrderStatus;
  expected_date: string | null;
  warehouse_id: number | null;
  warehouse_name: string | null;
  notes: string | null;
  currency: string;
  total_amount: string;
  ordered_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  lines: ApiPurchaseOrderLine[];
};

export type PurchaseOrderListView = {
  id: number;
  number: string;
  supplierId: number;
  supplierName: string;
  status: PurchaseOrderStatus;
  expectedDate: string;
  totalAmount: string;
  currency: string;
};

export type PurchaseOrderLineView = {
  id: number;
  nomenclatureId: number;
  nomenclatureName: string;
  quantity: string;
  unitPrice: string;
  lineAmount: string;
  comment: string;
};

export type PurchaseOrderDetailView = {
  id: number;
  number: string;
  supplierId: number;
  supplierName: string;
  status: PurchaseOrderStatus;
  expectedDate: string;
  warehouseId: number | null;
  warehouseName: string;
  notes: string;
  currency: string;
  totalAmount: string;
  orderedAt: string;
  cancelledAt: string;
  lines: PurchaseOrderLineView[];
};

export type PurchaseOrderCreateDraft = {
  supplierId: string;
  expectedDate: string;
  warehouseId: string;
  notes: string;
};

export function emptyPurchaseOrderDraft(): PurchaseOrderCreateDraft {
  return {
    supplierId: "",
    expectedDate: "",
    warehouseId: "",
    notes: "",
  };
}

export function mapPurchaseOrderListItem(
  item: ApiPurchaseOrderListItem,
): PurchaseOrderListView {
  return {
    id: item.id,
    number: item.number,
    supplierId: item.supplier_id,
    supplierName: item.supplier_name,
    status: item.status,
    expectedDate: item.expected_date ?? "",
    totalAmount: item.total_amount,
    currency: item.currency,
  };
}

export function mapPurchaseOrderDetail(
  item: ApiPurchaseOrderDetail,
): PurchaseOrderDetailView {
  return {
    id: item.id,
    number: item.number,
    supplierId: item.supplier_id,
    supplierName: item.supplier_name,
    status: item.status,
    expectedDate: item.expected_date ?? "",
    warehouseId: item.warehouse_id,
    warehouseName: item.warehouse_name ?? "",
    notes: item.notes ?? "",
    currency: item.currency,
    totalAmount: item.total_amount,
    orderedAt: item.ordered_at ?? "",
    cancelledAt: item.cancelled_at ?? "",
    lines: item.lines.map((line) => ({
      id: line.id,
      nomenclatureId: line.nomenclature_id,
      nomenclatureName: line.nomenclature_name,
      quantity: line.quantity,
      unitPrice: line.unit_price,
      lineAmount: line.line_amount,
      comment: line.comment ?? "",
    })),
  };
}

export function purchaseOrderMatchesQuery(
  item: PurchaseOrderListView,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    item.number.toLowerCase().includes(q) ||
    item.supplierName.toLowerCase().includes(q)
  );
}

export function purchaseOrderStatusLabel(status: PurchaseOrderStatus): string {
  switch (status) {
    case "draft":
      return "Черновик";
    case "ordered":
      return "Заказан";
    case "cancelled":
      return "Отменён";
    default:
      return status;
  }
}

export function purchaseOrderStatusTone(
  status: PurchaseOrderStatus,
): "neutral" | "warning" | "success" | "danger" {
  switch (status) {
    case "draft":
      return "neutral";
    case "ordered":
      return "warning";
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

export function formatMoneyRub(amount: string): string {
  const value = Number(amount);
  if (Number.isNaN(value)) return `${amount} ₽`;
  return `${value.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ₽`;
}
