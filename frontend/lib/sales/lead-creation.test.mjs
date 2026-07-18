import assert from "node:assert/strict";
import test from "node:test";

import {
  LeadCreateValidationError,
  toLeadCreatePayload,
} from "./lead-creation.ts";

test("lead creation trims values and omits blank optional fields", () => {
  assert.deepEqual(toLeadCreatePayload({
    contactName: "  Анна Смирнова ",
    companyName: " СК Вектор ",
    phone: " ",
    email: " anna@example.com ",
    city: " Самара ",
    source: " manual ",
  }), {
    contact_name: "Анна Смирнова",
    company_name: "СК Вектор",
    email: "anna@example.com",
    city: "Самара",
    source: "manual",
  });
});

test("lead creation rejects missing contact and invalid email", () => {
  const base = { contactName: "", companyName: "", phone: "", email: "", city: "", source: "manual" };
  assert.throws(() => toLeadCreatePayload(base), LeadCreateValidationError);
  assert.throws(
    () => toLeadCreatePayload({ ...base, contactName: "Иван", email: "invalid" }),
    LeadCreateValidationError,
  );
});
