import assert from "node:assert/strict";
import test from "node:test";

import {
  fromApiClientBankAccount,
  validateBankDraft,
  validateInn,
} from "./client-requisites.ts";

test("maps bank account and validates digits", () => {
  const row = fromApiClientBankAccount({
    id: 1,
    client_id: 3,
    bank_name: "Сбер",
    bik: "044525225",
    account_number: "40702810900000000001",
    corr_account: null,
    is_primary: true,
    sort_order: 0,
  });
  assert.equal(row.bankName, "Сбер");
  assert.equal(row.isPrimary, true);
  assert.equal(validateInn("7707083893"), null);
  assert.ok(validateInn("123"));
  assert.equal(
    validateBankDraft({
      bankName: "Сбер",
      bik: "044525225",
      accountNumber: "40702810900000000001",
      corrAccount: "",
      isPrimary: true,
    }),
    null,
  );
});
