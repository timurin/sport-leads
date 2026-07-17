import assert from "node:assert/strict";
import test from "node:test";

import {
  getWebsiteHref,
  validateContactFields,
  validateCustomerFields,
} from "./lead-customer.ts";

test("validates optional customer contact fields and tax id", () => {
  assert.deepEqual(validateCustomerFields({ email: "", phone: "", taxId: "" }), {});
  assert.deepEqual(validateCustomerFields({
    email: "manager@example.test",
    phone: "+7 (900) 123-45-67",
    taxId: "1650123456",
  }), {});
  assert.equal(validateCustomerFields({ email: "wrong", phone: "abc", taxId: "123" }).email, "Введите корректный email.");
  assert.equal(validateCustomerFields({ email: "wrong", phone: "abc", taxId: "123" }).phone, "Используйте цифры, пробелы, +, скобки или дефисы.");
  assert.equal(validateCustomerFields({ email: "wrong", phone: "abc", taxId: "123" }).taxId, "ИНН должен содержать 10 или 12 цифр.");
});

test("requires a contact name and normalizes website links", () => {
  assert.equal(validateContactFields({ name: "", email: "", phone: "" }).name, "Укажите имя контактного лица.");
  assert.equal(getWebsiteHref("olimp-football.example"), "https://olimp-football.example");
  assert.equal(getWebsiteHref("https://olimp-football.example"), "https://olimp-football.example");
});
