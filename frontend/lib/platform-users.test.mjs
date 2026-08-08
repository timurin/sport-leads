import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAccessMatrix,
  filterPlatformUsers,
  formatRoleSummary,
  formatUserActivity,
  formatLoginHandle,
  groupPermissionsByModule,
  languageLabel,
  permissionLabel,
  permissionModuleKey,
  profileDraftFromUser,
  profileDraftToPayload,
  resolveManagerDisplayName,
  roleLabel,
  sortRolesByCode,
  userHasRole,
  userInitials,
  userStatusLabel,
  validateInviteDraft,
  validatePasswordChangeDraft,
  validateProfileDraft,
  emptyPasswordChangeDraft,
} from "../lib/platform-users.ts";

function sampleUser(overrides = {}) {
  return {
    id: 1,
    login: "admin",
    display_name: "Administrator",
    is_active: true,
    sales_user_id: null,
    email: "admin@example.com",
    phone: null,
    department: "IT",
    position: null,
    manager_platform_user_id: null,
    language: "ru",
    invite_status: "active",
    last_activity_at: "2026-08-05T10:00:00Z",
    roles: ["admin"],
    permissions: [],
    ...overrides,
  };
}

test("roleLabel falls back to code", () => {
  assert.equal(roleLabel("admin"), "Администратор");
  assert.equal(roleLabel("custom"), "custom");
});

test("userHasRole and filterPlatformUsers", () => {
  const users = [
    sampleUser(),
    sampleUser({
      id: 2,
      login: "editor",
      display_name: "Каталог",
      is_active: false,
      email: null,
      department: null,
      invite_status: "active",
      last_activity_at: null,
      roles: ["catalog_editor"],
    }),
    sampleUser({
      id: 3,
      login: "newbie",
      display_name: "Новый",
      email: "new@example.com",
      department: "Sales",
      invite_status: "invited",
      last_activity_at: null,
      roles: [],
    }),
  ];
  assert.equal(userHasRole(users[0], "admin"), true);
  assert.equal(userHasRole(users[0], "catalog_editor"), false);
  assert.equal(filterPlatformUsers(users, "катал").length, 1);
  assert.equal(filterPlatformUsers(users, "admin").length, 1);
  assert.equal(filterPlatformUsers(users, "sales").length, 1);
  assert.equal(filterPlatformUsers(users, "", "active").length, 1);
  assert.equal(filterPlatformUsers(users, "", "inactive").length, 1);
  assert.equal(filterPlatformUsers(users, "", "invited").length, 1);
  assert.equal(filterPlatformUsers(users, "1", "all").length, 1);
  assert.equal(userInitials("Иван Петров"), "ИП");
  assert.equal(userStatusLabel(users[2]), "Приглашён");
  assert.match(formatUserActivity(users[0].last_activity_at), /\d/);
});

test("profile helpers: language, manager, roles", () => {
  assert.equal(languageLabel("ru"), "Русский");
  assert.equal(languageLabel("en"), "English");
  assert.equal(languageLabel("de"), "de");
  const users = [
    sampleUser({ id: 1, display_name: "Иван", login: "ivan" }),
    sampleUser({
      id: 2,
      display_name: "Пётр",
      login: "petr",
      manager_platform_user_id: 1,
    }),
  ];
  assert.equal(resolveManagerDisplayName(users, 1), "Иван");
  assert.equal(resolveManagerDisplayName(users, null), "—");
  assert.equal(resolveManagerDisplayName(users, 99), "ID 99");
  assert.equal(formatRoleSummary(users[0]), "Администратор");
  assert.equal(formatRoleSummary({ roles: [] }), "Роли не назначены");
});

test("profile draft validate and payload", () => {
  const draft = profileDraftFromUser(sampleUser({ manager_platform_user_id: 5 }));
  assert.equal(draft.manager_platform_user_id, "5");
  assert.equal(validateProfileDraft(draft), null);
  assert.equal(
    validateProfileDraft({ ...draft, display_name: "  " }),
    "Укажите отображаемое имя",
  );
  assert.equal(
    validateProfileDraft({ ...draft, manager_platform_user_id: "x" }),
    "Руководитель: укажите id пользователя или очистите поле",
  );
  assert.deepEqual(profileDraftToPayload(draft).manager_platform_user_id, 5);
  assert.equal(
    profileDraftToPayload({ ...draft, email: "  ", manager_platform_user_id: "" })
      .email,
    null,
  );
});

test("validateInviteDraft requires login and name", () => {
  assert.equal(
    validateInviteDraft({
      login: "",
      display_name: "A",
      email: "",
      phone: "",
      department: "",
      position: "",
      temporary_password: "",
      role_codes: [],
    }),
    "Укажите логин",
  );
  assert.equal(
    validateInviteDraft({
      login: "x",
      display_name: "A",
      email: "",
      phone: "",
      department: "",
      position: "",
      temporary_password: "short",
      role_codes: [],
    }),
    "Временный пароль — минимум 8 символов (или оставьте пустым)",
  );
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

test("buildAccessMatrix groups permissions by module", () => {
  const matrix = buildAccessMatrix([
    {
      id: 1,
      code: "admin",
      name: "Admin",
      is_system: true,
      permissions: ["admin.roles.assign", "size_grids.write"],
    },
    {
      id: 2,
      code: "catalog_editor",
      name: "Editor",
      is_system: true,
      permissions: ["size_grids.write"],
    },
  ]);
  assert.deepEqual(matrix.roleCodes, ["admin", "catalog_editor"]);
  assert.equal(permissionModuleKey("size_grids.write"), "size_grids");
  assert.match(permissionLabel("size_grids.write"), /сетк/i);
  const sizeRow = matrix.rows.find((row) => row.code === "size_grids.write");
  assert.equal(sizeRow?.grantedByRole.admin, true);
  assert.equal(sizeRow?.grantedByRole.catalog_editor, true);
  const adminRow = matrix.rows.find((row) => row.code === "admin.roles.assign");
  assert.equal(adminRow?.grantedByRole.catalog_editor, false);
  assert.ok(matrix.modules.some((module) => module.key === "size_grids"));
  const groups = groupPermissionsByModule([
    "admin.roles.assign",
    "size_grids.write",
  ]);
  assert.equal(groups.length, 2);
  assert.ok(groups.some((g) => g.key === "admin"));
});

test("formatLoginHandle skips @ when login is email", () => {
  assert.equal(formatLoginHandle("admin"), "@admin");
  assert.equal(formatLoginHandle("lm@mosmade.ru"), "lm@mosmade.ru");
  assert.equal(formatLoginHandle("  "), "");
});

test("validatePasswordChangeDraft self and admin", () => {
  assert.match(
    validatePasswordChangeDraft(emptyPasswordChangeDraft(), "self") ?? "",
    /текущий/i,
  );
  assert.equal(
    validatePasswordChangeDraft(
      {
        current_password: "old-pass-1",
        new_password: "new-pass-1",
        confirm_password: "new-pass-1",
      },
      "self",
    ),
    null,
  );
  assert.match(
    validatePasswordChangeDraft(
      {
        current_password: "",
        new_password: "short",
        confirm_password: "short",
      },
      "admin",
    ) ?? "",
    /8/i,
  );
  assert.equal(
    validatePasswordChangeDraft(
      {
        current_password: "",
        new_password: "new-pass-99",
        confirm_password: "new-pass-99",
      },
      "admin",
    ),
    null,
  );
});
