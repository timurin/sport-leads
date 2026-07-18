import assert from "node:assert/strict";
import test from "node:test";

import { fromApiLeadListItem } from "./lead-list-mapping.ts";

const baseLead = {
  id: 42,
  status: "qualification",
  result: null,
  customer_type: "company",
  company_name: "ООО Спорт Лига",
  tax_id: "1655000000",
  website: "sport.example",
  contact_name: "Legacy contact",
  phone: null,
  email: null,
  city: "Казань",
  region: "Татарстан",
  address: null,
  customer_comment: null,
  source: "website",
  responsible_id: 7,
  sport: "Футбол",
  product_category: "Игровая форма",
  need_description: "Форма для команды",
  estimated_quantity: 25,
  estimated_amount: "250000.00",
  desired_date: "2026-09-15",
  completed_at: null,
  completed_by_id: null,
  converted_order_id: null,
  rejection_reason_id: null,
  rejection_comment: null,
  created_at: "2026-07-17T10:00:00Z",
  updated_at: "2026-07-17T11:00:00Z",
  contacts: [{
    id: 5,
    lead_id: 42,
    name: "Анна Смирнова",
    position: null,
    phone: null,
    email: null,
    preferred_channel: "email",
    is_primary: true,
    created_at: "2026-07-17T10:00:00Z",
    updated_at: "2026-07-17T10:00:00Z",
  }],
};

test("maps an active API lead to the workspace lead model", () => {
  assert.deepEqual(fromApiLeadListItem(baseLead), {
    id: "42",
    status: "qualification",
    clientName: "ООО Спорт Лига",
    contact: "Анна Смирнова",
    city: "Казань",
    sport: "Футбол",
    estimatedAmount: 250000,
    source: "website",
    responsible: { id: "7", name: "Сотрудник #7", initials: "#7" },
    nextContact: "Не запланирован",
    priority: "medium",
    result: undefined,
    completedAt: undefined,
    completedBy: undefined,
    convertedOrderId: undefined,
    convertedOrderNumber: undefined,
    rejectionReason: undefined,
    rejectionComment: undefined,
    productCategory: "Игровая форма",
    quantity: 25,
    needDescription: "Форма для команды",
    desiredDate: "2026-09-15",
  });
});

test("maps completed converted and rejected API leads", () => {
  const converted = fromApiLeadListItem({
    ...baseLead,
    status: "completed",
    result: "converted",
    completed_at: "2026-07-18T12:00:00Z",
    completed_by_id: 3,
    converted_order_id: 1001,
  });
  assert.equal(converted.status, "completed");
  assert.equal(converted.result, "converted");
  assert.equal(converted.convertedOrderId, "1001");
  assert.equal(converted.convertedOrderNumber, "#1001");
  assert.deepEqual(converted.completedBy, { id: "3", name: "Сотрудник #3", initials: "#3" });

  const rejected = fromApiLeadListItem({
    ...baseLead,
    status: "completed",
    result: "rejected",
    rejection_reason_id: 2,
    rejection_comment: "Не целевой клиент",
  });
  assert.equal(rejected.result, "rejected");
  assert.equal(rejected.rejectionReason, "Причина #2");
  assert.equal(rejected.rejectionComment, "Не целевой клиент");
});
