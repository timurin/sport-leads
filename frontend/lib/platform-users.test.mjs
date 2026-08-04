import assert from "node:assert/strict";
import test from "node:test";

import {
  filterPlatformUsers,
  roleLabel,
  sortRolesByCode,
  userHasRole,
} from "../lib/platform-users.ts";

test("roleLabel falls back to code", () => {
  assert.equal(roleLabel("admin"), "Администратор");
  assert.equal(roleLabel("custom"), "custom");
});

test("userHasRole and filterPlatformUsers", () => {
  const users = [
    {
      id: 1,
      login: "admin",
      display_name: "Administrator",
      is_active: true,
      sales_user_id: null,
      roles: ["admin"],
      permissions: [],
    },
    {
      id: 2,
      login: "editor",
      display_name: "Каталог",
      is_active: true,
      sales_user_id: null,
      roles: ["catalog_editor"],
      permissions: [],
    },
  ];
  assert.equal(userHasRole(users[0], "admin"), true);
  assert.equal(userHasRole(users[0], "catalog_editor"), false);
  assert.equal(filterPlatformUsers(users, "катал").length, 1);
  assert.equal(filterPlatformUsers(users, "admin").length, 1);
});

test("sortRolesByCode sorts alphabetically", () => {
  const sorted = sortRolesByCode([
    { id: 2, code: "shop_operator", name: "S", is_system: true, permissions: [] },
    { id: 1, code: "admin", name: "A", is_system: true, permissions: [] },
  ]);
  assert.deepEqual(
    sorted.map((role) => role.code),
    ["admin", "shop_operator"],
  );
});
