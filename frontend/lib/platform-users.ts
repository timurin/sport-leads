/**
 * Platform users + roles admin helpers (ADR-024 / 17.1.2.5).
 */

export type PlatformUserAdmin = {
  id: number;
  login: string;
  display_name: string;
  is_active: boolean;
  sales_user_id: number | null;
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

export const ROLE_LABELS: Record<string, string> = {
  admin: "Администратор",
  catalog_editor: "Редактор каталога",
  shop_operator: "Оператор цеха",
};

export function roleLabel(code: string): string {
  return ROLE_LABELS[code] ?? code;
}

export function userHasRole(
  user: Pick<PlatformUserAdmin, "roles">,
  roleCode: string,
): boolean {
  return user.roles.includes(roleCode);
}

export function filterPlatformUsers(
  users: PlatformUserAdmin[],
  query: string,
): PlatformUserAdmin[] {
  const needle = query.trim().toLocaleLowerCase("ru");
  if (!needle) return users;
  return users.filter(
    (user) =>
      user.login.toLocaleLowerCase("ru").includes(needle) ||
      user.display_name.toLocaleLowerCase("ru").includes(needle) ||
      user.roles.some((role) =>
        roleLabel(role).toLocaleLowerCase("ru").includes(needle),
      ),
  );
}

export function sortRolesByCode(roles: RoleCatalogItem[]): RoleCatalogItem[] {
  return [...roles].sort((a, b) => a.code.localeCompare(b.code));
}
