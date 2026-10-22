import assert from "node:assert/strict";
import test from "node:test";

import {
  MAPPING_REFRESH_PATHS,
  employeeAccessView,
  freeAccounts,
  freeEmployees,
  interpretMappingResponse,
  prepareLink,
  prepareUnlink,
} from "./employee-user-link.ts";

const accounts = [
  { id: 4, login: "maria", displayName: "Мария аккаунт", employeeId: 7 },
  { id: 8, login: "free", displayName: "Свободный", employeeId: null },
];

test("unlinked employee is not reported as forbidden or linked", () => {
  const view = employeeAccessView({ ok: true, accounts }, 9);
  assert.equal(view.state, "unlinked");
});

test("linked employee resolves the account without copying the HR name", () => {
  const view = employeeAccessView({ ok: true, accounts }, 7);
  assert.equal(view.state, "linked");
  if (view.state !== "linked") return;
  assert.equal(view.account.login, "maria");
  assert.equal(view.account.displayName, "Мария аккаунт");
  assert.equal("fullName" in view.account, false);
});

test("403 and a network failure are not an empty mapping", () => {
  assert.equal(
    employeeAccessView({ ok: false, status: 403, message: "нет прав" }, 7).state,
    "forbidden",
  );
  assert.equal(
    employeeAccessView({ ok: false, status: null, message: "сеть" }, 7).state,
    "unavailable",
  );
});

test("link and unlink commands keep only free ids and require confirmation", () => {
  const occupied = prepareLink({
    account: accounts[0],
    employeeId: 9,
    employeeOwnerAccountId: null,
    reason: "сверка",
  });
  assert.equal(occupied.ok, false);

  const linked = prepareLink({
    account: accounts[1],
    employeeId: 9,
    employeeOwnerAccountId: null,
    reason: "  Подтверждены ID  ",
  });
  assert.equal(linked.ok, true);
  if (!linked.ok) return;
  assert.deepEqual(linked.body, { employee_id: 9, reason: "Подтверждены ID" });

  const unconfirmed = prepareUnlink({
    accountId: 4,
    expectedEmployeeId: 7,
    reason: "ошибка",
    confirmed: false,
  });
  assert.equal(unconfirmed.ok, false);

  const unlink = prepareUnlink({
    accountId: 4,
    expectedEmployeeId: 7,
    reason: "ошибка сверки",
    confirmed: true,
  });
  assert.equal(unlink.ok, true);
  if (!unlink.ok) return;
  assert.deepEqual(unlink.body, {
    expected_employee_id: 7,
    reason: "ошибка сверки",
  });
});

test("conflict and network keep the selection; success refreshes both surfaces", () => {
  assert.equal(interpretMappingResponse(409, false).conflict, true);
  assert.equal(interpretMappingResponse(409, false).success, false);
  assert.equal(interpretMappingResponse(null, false).keepSelection, true);
  assert.equal(interpretMappingResponse(200, true).success, true);
  assert.ok(MAPPING_REFRESH_PATHS.includes("/settings/users"));
  assert.ok(MAPPING_REFRESH_PATHS.includes("/settings/organizations/employees"));
});

test("pickers offer only free accounts and free active employees", () => {
  assert.deepEqual(freeAccounts(accounts).map((row) => row.id), [8]);
  const employees = [
    { id: 7, fullName: "Мария Иванова", isActive: true },
    { id: 9, fullName: "Архив", isActive: false },
    { id: 11, fullName: "Свободный сотрудник", isActive: true },
  ];
  assert.deepEqual(
    freeEmployees(employees, accounts, false).map((row) => row.id),
    [11],
  );
  assert.deepEqual(
    freeEmployees(employees, accounts, true).map((row) => row.id),
    [9, 11],
  );
});
