/**
 * Platform users + roles admin helpers (ADR-024 / 17.1.2.5 / 21.2–21.3).
 */

export type PlatformUserInviteStatus = "active" | "invited" | "pending";

export type PlatformUserAdmin = {
  id: number;
  login: string;
  display_name: string;
  is_active: boolean;
  sales_user_id: number | null;
  email: string | null;
  phone: string | null;
  department: string | null;
  position: string | null;
  manager_platform_user_id: number | null;
  language: string;
  invite_status: PlatformUserInviteStatus | string;
  last_activity_at: string | null;
  roles: string[];
  permissions: string[];
};

export type RoleCatalogItem = {
  id: number;
  code: string;
  name: string;
  is_system: boolean;
  permissions: string[];
};

export type PlatformUserListStatus =
  | "all"
  | "active"
  | "inactive"
  | "invited"
  | "pending";

export type PlatformUserInviteDraft = {
  login: string;
  display_name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  temporary_password: string;
  role_codes: string[];
};

export type PlatformUserProfileSectionId =
  | "contact"
  | "document"
  | "extra"
  | "about"
  | "security";

export const ROLE_LABELS: Record<string, string> = {
  admin: "Администратор",
  catalog_editor: "Редактор каталога",
  shop_operator: "Оператор цеха",
  sewer: "Швея",
  company_lead: "Руководитель компании",
  technologist: "Технолог",
  shop_master: "Мастер цеха",
};

export const LANGUAGE_LABELS: Record<string, string> = {
  ru: "Русский",
  en: "English",
};

export function roleLabel(code: string): string {
  return ROLE_LABELS[code] ?? code;
}

export function languageLabel(code: string | null | undefined): string {
  const normalized = (code || "ru").trim().toLowerCase() || "ru";
  return LANGUAGE_LABELS[normalized] ?? normalized;
}

export function userHasRole(
  user: Pick<PlatformUserAdmin, "roles">,
  roleCode: string,
): boolean {
  return user.roles.includes(roleCode);
}

export function emptyInviteDraft(): PlatformUserInviteDraft {
  return {
    login: "",
    display_name: "",
    email: "",
    phone: "",
    department: "",
    position: "",
    temporary_password: "",
    role_codes: [],
  };
}

export function validateInviteDraft(
  draft: PlatformUserInviteDraft,
): string | null {
  if (!draft.login.trim()) return "Укажите логин";
  if (!draft.display_name.trim()) return "Укажите отображаемое имя";
  const password = draft.temporary_password.trim();
  if (password && password.length < 8) {
    return "Временный пароль — минимум 8 символов (или оставьте пустым)";
  }
  return null;
}

export function filterPlatformUsers(
  users: PlatformUserAdmin[],
  query: string,
  status: PlatformUserListStatus = "all",
): PlatformUserAdmin[] {
  const needle = query.trim().toLocaleLowerCase("ru");
  return users.filter((user) => {
    if (status === "active") {
      if (!user.is_active || (user.invite_status || "active") !== "active") {
        return false;
      }
    }
    if (status === "inactive" && user.is_active) return false;
    if (status === "invited" && user.invite_status !== "invited") return false;
    if (status === "pending" && user.invite_status !== "pending") return false;
    if (!needle) return true;
    const haystack = [
      String(user.id),
      user.login,
      user.display_name,
      user.email ?? "",
      user.phone ?? "",
      user.department ?? "",
      ...user.roles.map((role) => roleLabel(role)),
    ]
      .join(" ")
      .toLocaleLowerCase("ru");
    return haystack.includes(needle);
  });
}

export function formatLoginHandle(login: string | null | undefined): string {
  const trimmed = (login ?? "").trim();
  if (!trimmed) return "";
  return trimmed.includes("@") ? trimmed : `@${trimmed}`;
}

export type PasswordChangeMode = "self" | "admin";

export type PasswordChangeDraft = {
  current_password: string;
  new_password: string;
  confirm_password: string;
};

export function emptyPasswordChangeDraft(): PasswordChangeDraft {
  return {
    current_password: "",
    new_password: "",
    confirm_password: "",
  };
}

export function validatePasswordChangeDraft(
  draft: PasswordChangeDraft,
  mode: PasswordChangeMode,
): string | null {
  if (mode === "self" && !draft.current_password) {
    return "Укажите текущий пароль";
  }
  const next = draft.new_password;
  if (next.length < 8) {
    return "Новый пароль — минимум 8 символов";
  }
  if (next !== draft.confirm_password) {
    return "Пароли не совпадают";
  }
  if (mode === "self" && draft.current_password === next) {
    return "Новый пароль совпадает с текущим";
  }
  return null;
}

export function userInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toLocaleUpperCase("ru");
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toLocaleUpperCase("ru");
}

export function formatUserActivity(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function userStatusLabel(user: PlatformUserAdmin): string {
  if (!user.is_active) return "Отключён";
  if (user.invite_status === "invited") return "Приглашён";
  if (user.invite_status === "pending") return "Ожидает";
  return "Активен";
}

export function userStatusTone(
  user: PlatformUserAdmin,
): "success" | "warning" | "neutral" {
  if (!user.is_active) return "neutral";
  if (user.invite_status === "invited" || user.invite_status === "pending") {
    return "warning";
  }
  return "success";
}

export function sortRolesByCode(roles: RoleCatalogItem[]): RoleCatalogItem[] {
  return [...roles].sort((a, b) => a.code.localeCompare(b.code));
}

export type PlatformUserProfileDraft = {
  display_name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  manager_platform_user_id: string;
  language: string;
  is_active: boolean;
};

export function profileDraftFromUser(
  user: PlatformUserAdmin,
): PlatformUserProfileDraft {
  return {
    display_name: user.display_name ?? "",
    email: user.email ?? "",
    phone: user.phone ?? "",
    department: user.department ?? "",
    position: user.position ?? "",
    manager_platform_user_id:
      user.manager_platform_user_id != null
        ? String(user.manager_platform_user_id)
        : "",
    language: user.language || "ru",
    is_active: user.is_active,
  };
}

export function validateProfileDraft(
  draft: PlatformUserProfileDraft,
): string | null {
  if (!draft.display_name.trim()) return "Укажите отображаемое имя";
  const managerRaw = draft.manager_platform_user_id.trim();
  if (managerRaw && !/^\d+$/.test(managerRaw)) {
    return "Руководитель: укажите id пользователя или очистите поле";
  }
  if (!draft.language.trim()) return "Укажите язык";
  return null;
}

export function profileDraftToPayload(
  draft: PlatformUserProfileDraft,
): {
  display_name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  position: string | null;
  manager_platform_user_id: number | null;
  language: string;
  is_active: boolean;
} {
  const managerRaw = draft.manager_platform_user_id.trim();
  return {
    display_name: draft.display_name.trim(),
    email: draft.email.trim() || null,
    phone: draft.phone.trim() || null,
    department: draft.department.trim() || null,
    position: draft.position.trim() || null,
    manager_platform_user_id: managerRaw ? Number(managerRaw) : null,
    language: draft.language.trim() || "ru",
    is_active: draft.is_active,
  };
}

export function displayOrDash(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

export function resolveManagerDisplayName(
  users: Array<Pick<PlatformUserAdmin, "id" | "display_name" | "login">>,
  managerId: number | null | undefined,
): string {
  if (managerId == null) return "—";
  const manager = users.find((user) => user.id === managerId);
  if (!manager) return `ID ${managerId}`;
  return manager.display_name.trim() || manager.login;
}

export function formatRoleSummary(user: Pick<PlatformUserAdmin, "roles">): string {
  if (!user.roles.length) return "Роли не назначены";
  return user.roles.map((code) => roleLabel(code)).join(", ");
}

/** Readable permission labels (ADR-024 MVP catalog). */
export const PERMISSION_LABELS: Record<string, string> = {
  "size_grids.write": "Размерные сетки: создание и изменение",
  "shop.kanban.transition": "Цех: переходы канбана",
  "admin.roles.assign": "Админ: назначение ролей пользователям",
  "audit.read": "Аудит: просмотр событий",
  "system_settings.write": "Система: настройки платформы",
  "platform_directories.write": "Справочники платформы: изменение",
  "print_forms.write": "Печатные формы: реестр",
  "sewing_cabinet.read_own": "Кабинет швеи: свой кабинет",
  "sewing_cabinet.read_any": "Кабинет швеи: все кабинеты",
  "sewing_cabinet.write": "Кабинет швеи: взять / отказаться / закрыть",
};

export const MODULE_LABELS: Record<string, string> = {
  size_grids: "Каталог / размерные сетки",
  shop: "Производство / цех",
  admin: "Администрирование",
  audit: "Аудит",
  system_settings: "Системные настройки",
  platform_directories: "Справочники платформы",
  print_forms: "Печатные формы",
  sewing_cabinet: "Кабинет швеи",
  other: "Прочее",
};

export type AccessMatrixPermissionRow = {
  code: string;
  label: string;
  moduleKey: string;
  moduleLabel: string;
  grantedByRole: Record<string, boolean>;
};

export type AccessMatrix = {
  roleCodes: string[];
  rows: AccessMatrixPermissionRow[];
  modules: Array<{
    key: string;
    label: string;
    rows: AccessMatrixPermissionRow[];
  }>;
};

export function permissionLabel(code: string): string {
  return PERMISSION_LABELS[code] ?? code;
}

export function permissionModuleKey(code: string): string {
  const dot = code.indexOf(".");
  if (dot <= 0) return "other";
  return code.slice(0, dot);
}

export function permissionModuleLabel(code: string): string {
  const key = permissionModuleKey(code);
  return MODULE_LABELS[key] ?? key;
}

/** Role × permission matrix derived from catalog (no per-user overrides). */
export function buildAccessMatrix(roles: RoleCatalogItem[]): AccessMatrix {
  const sortedRoles = sortRolesByCode(roles);
  const roleCodes = sortedRoles.map((role) => role.code);
  const permissionCodes = [
    ...new Set(sortedRoles.flatMap((role) => role.permissions ?? [])),
  ].sort((a, b) => a.localeCompare(b));

  const rows: AccessMatrixPermissionRow[] = permissionCodes.map((code) => {
    const grantedByRole: Record<string, boolean> = {};
    for (const role of sortedRoles) {
      grantedByRole[role.code] = (role.permissions ?? []).includes(code);
    }
    const moduleKey = permissionModuleKey(code);
    return {
      code,
      label: permissionLabel(code),
      moduleKey,
      moduleLabel: permissionModuleLabel(code),
      grantedByRole,
    };
  });

  const moduleOrder = [...new Set(rows.map((row) => row.moduleKey))].sort(
    (a, b) =>
      (MODULE_LABELS[a] ?? a).localeCompare(MODULE_LABELS[b] ?? b, "ru"),
  );

  const modules = moduleOrder.map((key) => ({
    key,
    label: MODULE_LABELS[key] ?? key,
    rows: rows.filter((row) => row.moduleKey === key),
  }));

  return { roleCodes, rows, modules };
}

/** Effective permissions for a user via assigned roles (union). */
export function effectivePermissionsForUser(
  user: Pick<PlatformUserAdmin, "roles" | "permissions">,
  roles: RoleCatalogItem[],
): string[] {
  if (user.permissions?.length) {
    return [...user.permissions].sort((a, b) => a.localeCompare(b));
  }
  const fromRoles = new Set<string>();
  for (const code of user.roles) {
    const role = roles.find((item) => item.code === code);
    for (const perm of role?.permissions ?? []) {
      fromRoles.add(perm);
    }
  }
  return [...fromRoles].sort((a, b) => a.localeCompare(b));
}

export function groupPermissionsByModule(
  permissionCodes: string[],
): Array<{ key: string; label: string; codes: string[] }> {
  const byKey = new Map<string, string[]>();
  for (const code of permissionCodes) {
    const key = permissionModuleKey(code);
    const list = byKey.get(key) ?? [];
    list.push(code);
    byKey.set(key, list);
  }
  return [...byKey.entries()]
    .sort((a, b) =>
      (MODULE_LABELS[a[0]] ?? a[0]).localeCompare(
        MODULE_LABELS[b[0]] ?? b[0],
        "ru",
      ),
    )
    .map(([key, codes]) => ({
      key,
      label: MODULE_LABELS[key] ?? key,
      codes: [...codes].sort((a, b) => a.localeCompare(b)),
    }));
}
