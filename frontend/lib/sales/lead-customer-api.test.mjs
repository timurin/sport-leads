import assert from "node:assert/strict";
import test from "node:test";

import {
  fromApiLeadCustomer,
  toApiLeadCustomerPayload,
  validateLeadCustomerProfile,
} from "./lead-customer-api.ts";

test("maps persisted customer profile fields from the lead API", () => {
  assert.deepEqual(fromApiLeadCustomer({
    customer_type: "company",
    company_name: "ООО Спорт Лига",
    tax_id: "1655000000",
    website: "sport.example",
    city: "Нижний Новгород",
    region: "Нижегородская область",
    address: "ул. Центральная, 1",
    customer_comment: "Работают только по договору.",
  }), {
    type: "company",
    organizationName: "ООО Спорт Лига",
    taxId: "1655000000",
    website: "sport.example",
    city: "Нижний Новгород",
    region: "Нижегородская область",
    address: "ул. Центральная, 1",
    comment: "Работают только по договору.",
  });
});

test("normalizes empty customer profile values to explicit API nulls", () => {
  assert.deepEqual(toApiLeadCustomerPayload({
    type: undefined,
    organizationName: " ",
    taxId: "",
    website: " ",
    city: "",
    region: " ",
    address: "",
    comment: " ",
  }), {
    customer_type: null,
    company_name: null,
    tax_id: null,
    website: null,
    city: null,
    region: null,
    address: null,
    customer_comment: null,
  });
});

test("validates untrusted customer profile mutation input", () => {
  assert.match(validateLeadCustomerProfile(null), /формат/);
  assert.match(validateLeadCustomerProfile({ type: "unknown" }), /Тип/);
  assert.equal(validateLeadCustomerProfile({ type: "person", taxId: "123456789012" }), undefined);
  assert.match(validateLeadCustomerProfile({ taxId: "123" }), /ИНН/);
  assert.match(validateLeadCustomerProfile({ organizationName: "x".repeat(256) }), /профиля/);
  assert.match(validateLeadCustomerProfile({ comment: 1 }), /Комментарий/);
});
