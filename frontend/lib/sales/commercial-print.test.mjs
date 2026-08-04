import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSalesInvoicePrintRequest,
  buildSalesOrderPrintRequest,
  buildSalesQuotationPrintRequest,
} from "./commercial-print.ts";

const order = {
  id: "12",
  number: "SO-2026-000012",
  title: "Комплект формы",
  status: "Подтверждён",
  leadId: "7",
  clientName: "ФК Вектор",
  organizationName: "ООО Спорт",
  responsibleName: "Мария",
  currencyCode: "RUB",
  updatedAtIso: "2026-08-02T10:00:00Z",
  desiredDate: "15 августа 2026",
  itemsSubtotalValue: "10000",
  discountPercent: "5",
  discountAmountValue: "500",
  amountNetValue: "9500",
  vatAmountValue: "1900",
  amountValue: "11400",
  items: [
    {
      id: 1,
      snapshotName: "Джерси",
      unit: "шт",
      quantity: "10",
      unitPriceValue: "1000",
      discountPercent: "5",
      discountAmountValue: "500",
      lineAmountValue: "9500",
      vatAmountValue: "1900",
      lineTotalValue: "11400",
      color: "синий",
      sizeRange: "S-XL",
      personalization: "№10",
    },
  ],
} ;

test("buildSalesOrderPrintRequest uses model binding and order totals payload", () => {
  const request = buildSalesOrderPrintRequest(order);

  assert.equal(request.binding_type, "model");
  assert.equal(request.binding_key, "sales_order");
  assert.equal(request.output_format, "html");
  assert.equal(request.payload.document_number, "SO-2026-000012");
  assert.equal(request.payload.customer.client_name, "ФК Вектор");
  assert.equal(request.payload.totals.grand_total, "11400");
  assert.equal(request.payload.items[0].name, "Джерси");
});

test("buildSalesQuotationPrintRequest snapshots quotation items", () => {
  const quotation = {
    id: 3,
    number: "КП-12-001",
    status: "draft",
    currency_code: "RUB",
    discount_percent: "5",
    discount_amount: "500",
    vat_amount: "1900",
    amount: "11400",
    amount_net: "9500",
    updated_at: "2026-08-02T11:00:00Z",
    items: [
      {
        id: 9,
        snapshot_name: "Джерси",
        unit: "шт",
        quantity: "10",
        unit_price: "1000",
        discount_percent: "5",
        discount_amount: "500",
        line_amount: "9500",
        vat_amount: "1900",
        line_total: "11400",
      },
    ],
  };

  const request = buildSalesQuotationPrintRequest(order, quotation);

  assert.equal(request.binding_key, "sales_quotation");
  assert.equal(request.payload.document_id, 3);
  assert.equal(request.payload.order.number, "SO-2026-000012");
  assert.equal(request.payload.items[0].line_total, "11400");
});

test("buildSalesInvoicePrintRequest carries quotation reference when present", () => {
  const invoice = {
    id: 4,
    number: "СЧ-12-001",
    quotation_id: 3,
    status: "draft",
    currency_code: "RUB",
    discount_percent: null,
    discount_amount: "0",
    vat_amount: "1900",
    amount: "11400",
    amount_net: "9500",
    updated_at: "2026-08-02T12:00:00Z",
    items: [
      {
        id: 10,
        snapshot_name: "Джерси",
        unit: "шт",
        quantity: "10",
        unit_price: "1000",
        discount_percent: null,
        discount_amount: "0",
        line_amount: "9500",
        vat_amount: "1900",
        line_total: "11400",
      },
    ],
  };

  const request = buildSalesInvoicePrintRequest(order, invoice);

  assert.equal(request.binding_key, "sales_invoice");
  assert.equal(request.payload.quotation_id, 3);
  assert.equal(request.payload.items[0].discount_percent, null);
});
