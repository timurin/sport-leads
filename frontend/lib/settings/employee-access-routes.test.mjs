import assert from "node:assert/strict";
import test from "node:test";

import {
  accessGroupHref,
  accessMatrixHref,
  accountExceptionHref,
  accountFilterApplies,
  employeeAccountLabel,
  employeeCardHref,
  employeesListHref,
  legacyEmployeeTarget,
  resolveUsersAlias,
} from "./employee-access-routes.ts";
import {
  groupApplyBody,
  interpretAccessFailure,
  membershipApplyBody,
  membershipRoleCodes,
  permissionLabel,
} from "./access-group-commands.ts";

test("canonical routes keep filters and do not reuse an account id as an employee", () => {
  assert.equal(
    employeesListHref({ q: "ива", status: "active", organizationId: "4" }),
    "/settings/employees?q=%D0%B8%D0%B2%D0%B0&status=active&organization_id=4",
  );
  assert.equal(employeeCardHref(7, "access"), "/settings/employees/7?tab=access");
  assert.equal(accessMatrixHref(7), "/settings/employees/7/access-matrix");
  assert.equal(accountExceptionHref(42), "/settings/employees/accounts/42");
  assert.notEqual(employeeCardHref(42), accountExceptionHref(42));
});

test("legacy employee and users aliases resolve to different ids", () => {
  assert.equal(
    legacyEmployeeTarget("7", { tab: "access", q: "ива" }),
    "/settings/employees/7?q=%D0%B8%D0%B2%D0%B0&tab=access",
  );
  assert.equal(legacyEmployeeTarget("nope", {}), null);
  assert.deepEqual(
    resolveUsersAlias({ canAssign: false, userId: "42", employeeId: 7, found: true }),
    { kind: "forbidden" },
  );
  assert.deepEqual(
    resolveUsersAlias({ canAssign: true, userId: null, employeeId: null, found: false }),
    { kind: "list" },
  );
  assert.deepEqual(
    resolveUsersAlias({ canAssign: true, userId: "42", employeeId: 7, found: true }),
    { kind: "employee", href: "/settings/employees/7?tab=access" },
  );
  assert.deepEqual(
    resolveUsersAlias({ canAssign: true, userId: "42", employeeId: null, found: true }),
    { kind: "account", href: "/settings/employees/accounts/42" },
  );
});

test("a missing account directory is not shown as no account", () => {
  assert.equal(
    employeeAccountLabel({ known: false, forbidden: true, account: null }),
    "Недостаточно прав",
  );
  assert.equal(
    employeeAccountLabel({ known: true, forbidden: false, account: null }),
    "Нет",
  );
  assert.equal(accountFilterApplies("unlinked", false), false);
  assert.equal(accountFilterApplies("unlinked", true), true);
});

test("membership keeps every selected group and a conflict keeps the draft", () => {
  const codes = membershipRoleCodes(["admin", "sewer"], "managers", true);
  assert.deepEqual(codes, ["admin", "sewer", "managers"]);
  const body = membershipApplyBody(codes, " сверка ", {
    revision: "rev",
    preview_fingerprint: "fp",
  });
  assert.deepEqual(body.role_codes, ["admin", "sewer", "managers"]);
  assert.equal(body.reason, "сверка");
  assert.equal(body.revision, "rev");
  const failure = interpretAccessFailure(409, "access_changed");
  assert.equal(failure.success, false);
  assert.equal(failure.conflict, true);
  assert.equal(failure.keepDraft, true);
  const group = groupApplyBody(
    { version: 2, name: " Менеджеры ", permissions: ["audit.read"], reason: "набор" },
    { revision: "rev", preview_fingerprint: "fp" },
  );
  assert.equal(group.name, "Менеджеры");
  assert.deepEqual(group.permissions, ["audit.read"]);
  assert.equal(permissionLabel("unknown.permission", ""), "unknown.permission");
  assert.equal(accessGroupHref("admin", 7).startsWith("/settings/employees/access-groups/admin"), true);
});
