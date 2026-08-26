/**
 * Pure auth mapping helpers (no Next runtime) — ADR-023 / 17.1.1.3.
 */

import type { UserSummary } from "@/types/sales";

export const SESSION_COOKIE_NAME = "sl_session";

export type PlatformUserMe = {
  id: number;
  login: string;
  display_name: string;
  is_active: boolean;
  sales_user_id: number | null;
  roles?: string[];
  permissions?: string[];
};

export const PERM_SIZE_GRIDS_WRITE = "size_grids.write";
export const PERM_ADMIN_ROLES_ASSIGN = "admin.roles.assign";
export const PERM_SHOP_KANBAN_TRANSITION = "shop.kanban.transition";
export const PERM_AUDIT_READ = "audit.read";
export const PERM_SYSTEM_SETTINGS_WRITE = "system_settings.write";
export const PERM_PLATFORM_DIRECTORIES_WRITE = "platform_directories.write";
export const PERM_PRINT_FORMS_WRITE = "print_forms.write";
export const PERM_SEWING_CABINET_READ_OWN = "sewing_cabinet.read_own";
export const PERM_SEWING_CABINET_READ_ANY = "sewing_cabinet.read_any";
export const PERM_SEWING_CABINET_WRITE = "sewing_cabinet.write";
export const PERM_LEADS_CARD_FIELDS_MANAGE = "leads.card_fields.manage";

export const SEWING_CABINET_OWN_HREF = "/production/sewing-cabinet";

export function hasPermission(
  user: PlatformUserMe | null | undefined,
  code: string,
): boolean {
  return Boolean(user?.permissions?.includes(code));
}

export function permissionsIndicateSewingCabinetRestricted(
  permissions: readonly string[] | undefined,
): boolean {
  const perms = permissions ?? [];
  return (
    perms.includes(PERM_SEWING_CABINET_READ_OWN) &&
    !perms.includes(PERM_SEWING_CABINET_READ_ANY)
  );
}

export function isSewingCabinetRestricted(
  user: PlatformUserMe | null | undefined,
): boolean {
  return permissionsIndicateSewingCabinetRestricted(user?.permissions);
}

export function isSewingCabinetOwnPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === SEWING_CABINET_OWN_HREF) return true;
  return path.startsWith("/production/scan/");
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

/** Map `/auth/me` to CRM UserSummary. Prefer linked SalesUser id for author_id FKs. */
export function platformUserToSummary(user: PlatformUserMe): UserSummary {
  const id =
    user.sales_user_id != null ? String(user.sales_user_id) : `pu:${user.id}`;
  return {
    id,
    name: user.display_name,
    initials: initialsFromName(user.display_name),
  };
}
