import type {
  SalesInvoice,
  SalesQuotation,
} from "@/app/(workspace)/sales/orders/[orderId]/order-commercial-doc-actions";
import type { SalesOrderDetails, SalesOrderItem } from "@/lib/sales/order-details";

export type CommercialPrintBindingKey =
  | "sales_order"
  | "sales_quotation"
  | "sales_invoice";

export type CommercialPrintRequest = {
  binding_type: "model";
  binding_key: CommercialPrintBindingKey;
  output_format: "html";
  payload: Record<string, unknown>;
};

function toPrintableOrderLine(item: SalesOrderItem) {
  return {
    id: item.id,
    name: item.snapshotName,
    unit: item.unit,
    quantity: item.quantity,
    unit_price: item.unitPriceValue,
    discount_percent: item.discountPercent || null,
    discount_amount: item.discountAmount,
    amount_net: item.lineAmountValue,
    vat_amount: item.vatAmountValue,
    line_total: item.lineTotalValue,
    color: item.color || null,
    size_range: item.sizeRange || null,
    personalization: item.personalization || null,
  };
}

function toPrintableCommercialLine(
  item: SalesQuotation["items"][number] | SalesInvoice["items"][number],
) {
  return {
    id: item.id,
    name: item.snapshot_name,
    unit: item.unit,
    quantity: String(item.quantity),
    unit_price: String(item.unit_price),
    discount_percent:
      item.discount_percent === null || item.discount_percent === ""
        ? null
        : String(item.discount_percent),
    discount_amount: String(item.discount_amount),
    amount_net: String(item.line_amount),
    vat_amount: String(item.vat_amount),
    line_total: String(item.line_total),
  };
}

function buildCustomerPayload(order: SalesOrderDetails) {
  return {
    client_name: order.clientName,
    organization_name: order.organizationName,
    responsible_name: order.responsibleName,
    source_lead_id: order.leadId,
  };
}

function buildOrderTotalsPayload(order: SalesOrderDetails) {
  return {
    items_subtotal: order.itemsSubtotalValue,
    discount_percent: order.discountPercent || null,
    discount_amount: order.discountAmountValue,
    amount_net: order.amountNetValue,
    vat_amount: order.vatAmountValue,
    grand_total: order.amountValue,
  };
}

export function buildSalesOrderPrintRequest(
  order: SalesOrderDetails,
): CommercialPrintRequest {
  return {
    binding_type: "model",
    binding_key: "sales_order",
    output_format: "html",
    payload: {
      document_kind: "sales_order",
      document_id: Number(order.id),
      document_number: order.number,
      issued_at: order.updatedAtIso,
      currency_code: order.currencyCode,
      customer: buildCustomerPayload(order),
      order: {
        title: order.title,
        status: order.status,
        desired_date: order.desiredDate,
      },
      items: order.items.map(toPrintableOrderLine),
      totals: buildOrderTotalsPayload(order),
    },
  };
}

export function buildSalesQuotationPrintRequest(
  order: SalesOrderDetails,
  quotation: SalesQuotation,
): CommercialPrintRequest {
  return {
    binding_type: "model",
    binding_key: "sales_quotation",
    output_format: "html",
    payload: {
      document_kind: "sales_quotation",
      document_id: quotation.id,
      document_number: quotation.number,
      issued_at: quotation.updated_at,
      currency_code: quotation.currency_code,
      customer: buildCustomerPayload(order),
      order: {
        id: Number(order.id),
        number: order.number,
        title: order.title,
      },
      items: quotation.items.map(toPrintableCommercialLine),
      totals: {
        discount_percent:
          quotation.discount_percent === null || quotation.discount_percent === ""
            ? null
            : String(quotation.discount_percent),
        discount_amount: String(quotation.discount_amount),
        amount_net: String(quotation.amount_net),
        vat_amount: String(quotation.vat_amount),
        grand_total: String(quotation.amount),
      },
    },
  };
}

export function buildSalesInvoicePrintRequest(
  order: SalesOrderDetails,
  invoice: SalesInvoice,
): CommercialPrintRequest {
  return {
    binding_type: "model",
    binding_key: "sales_invoice",
    output_format: "html",
    payload: {
      document_kind: "sales_invoice",
      document_id: invoice.id,
      document_number: invoice.number,
      issued_at: invoice.updated_at,
      currency_code: invoice.currency_code,
      customer: buildCustomerPayload(order),
      order: {
        id: Number(order.id),
        number: order.number,
        title: order.title,
      },
      quotation_id: invoice.quotation_id,
      items: invoice.items.map(toPrintableCommercialLine),
      totals: {
        discount_percent:
          invoice.discount_percent === null || invoice.discount_percent === ""
            ? null
            : String(invoice.discount_percent),
        discount_amount: String(invoice.discount_amount),
        amount_net: String(invoice.amount_net),
        vat_amount: String(invoice.vat_amount),
        grand_total: String(invoice.amount),
      },
    },
  };
}
