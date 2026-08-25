# ADR-024 — Platform roles and permissions

**Status:** принято (`2026-08-01`)  
**Date:** `2026-08-01`  
**Roadmap:** Stage `17.1.2.1` (contract); feeds `17.1.2.2`–`17.1.2.8`  
**Depends on:** ADR-023 (`PlatformUser` / session)  
**Evidence:** `docs/tasks/v0.9.0-stage-17.1.2-roles-permissions.md`

## Контекст

После `17.1.1` любой вошедший `PlatformUser` видит весь workspace. Нужны роли и коды прав для:

- мутаций size-grid (`17.1.2.4`);
- shop kanban DnD / stage transitions (`17.1.2.7`);
- назначения ролей (`17.1.2.5`);
- позже — stage executors (`17.1.2.8`).

`SalesUser` остаётся CRM-справочником, не RBAC.

## Решение

### 1. Сущности

| Сущность | Роль |
|----------|------|
| **PlatformUser** | Учётка входа (ADR-023); M:N с Role |
| **Role** | Именованный набор прав (`code`, `name`, `is_system`) |
| **Permission** | Атомарный код права (`code`, `description`) |
| **role_permissions** | M:N Role ↔ Permission |
| **platform_user_roles** | M:N PlatformUser ↔ Role |

Effective permissions = ∪ permissions всех ролей пользователя. Нет прямого user→permission в MVP.

### 2. MVP permission codes

| Code | Meaning | First consumer |
|------|---------|----------------|
| `size_grids.write` | Create/update/delete size grids and rows | `17.1.2.4` |
| `shop.kanban.transition` | Complete / rollback-kanban stage moves | `17.1.2.7` |
| `admin.roles.assign` | Assign/revoke roles on PlatformUser | `17.1.2.5` |
| `sewing_cabinet.read_own` | Own sewing cabinet | `24.1.1` |
| `sewing_cabinet.read_any` | Any sewer cabinet + sewer list | `24.1.1` |
| `sewing_cabinet.write` | Take / release / complete sewing work ledger | `24.1.1` |

Catalog is seed-extensible; new modules add codes via migration seed, not free-text.

### 3. Seed roles (MVP)

| Role code | Permissions |
|-----------|-------------|
| `admin` | all catalog codes (including sewing cabinet) |
| `catalog_editor` | `size_grids.write` |
| `shop_operator` | `shop.kanban.transition` |
| `sewer` | `sewing_cabinet.read_own` + `sewing_cabinet.write` |
| `company_lead` | `sewing_cabinet.read_any` + `sewing_cabinet.write` |
| `technologist` | `sewing_cabinet.read_any` + `sewing_cabinet.write` |
| `shop_master` | `sewing_cabinet.read_any` + `sewing_cabinet.write` |

Bootstrap admin user (empty DB / `AUTH_BOOTSTRAP_*`) receives role `admin`.

### 4. Enforcement

- Helper / FastAPI dependency: `require_permission("code")`.
- Missing session → **401**; authenticated without permission → **403**.
- **Deny-by-default** for registered protected writes only (not every ERP POST yet).
- Reads of size-grids / catalogs stay open to any authenticated workspace user (FE gate) until a dedicated read ACL ships.
- Unauthenticated API on still-public domain routes remains as today until a later global protect pass; FE gate already blocks workspace UI.
- **Amend `2026-08-24` (Stage `24.1.2`):** a session with `sewing_cabinet.read_own` and **without** `sewing_cabinet.read_any` is a restricted sewer. HTTP middleware allows only `/auth/*`, health/docs, and `/sewing-cabinet*` (ledger API in `24.2`). Other API paths return **403**. Nav composition is filtered the same way; DS-SHELL visuals stay unchanged.

### 5. `/auth/me` extension

Response adds:

```json
{
  "roles": ["admin"],
  "permissions": ["size_grids.write", "shop.kanban.transition", "admin.roles.assign"]
}
```

### 6. Out of scope (MVP RBAC core)

- Field-level / row-level ACL
- OAuth scopes
- Separate Admin app shell (Stage 18 owns Administration chrome; role assign UI may live under `/settings/users`)

Per-stage executor directory (`17.1.2.8`) is a follow-on: table `platform_user_stage_access` + `GET /shop-stage-executors` with **role_fallback** (`shop_operator`/`admin`) until the directory is filled.

**Amend `2026-08-24` (Stage `24` / ADR-029 / `24.1.1`):** catalog now includes `sewing_cabinet.read_own` / `read_any` / `write` and roles `sewer` / `company_lead` / `technologist` / `shop_master`. Seed: `ensure_rbac_seed` + Alembic `z0a1b2c3d456`. `shop_operator` stays kanban-only. Restricted shell for `read_own` without `read_any` is `24.1.2`.
## Последствия

- `17.1.2.2` creates tables + seeds permissions/roles + links bootstrap admin.
- `17.1.2.3` ships `require_permission` + first protected write(s) (role assignment API and/or stubs).
- `17.1.2.4` / `17.1.2.7` bind concrete endpoints to codes.
- ADR-023 §6 remains valid: auth = who; this ADR = what.

## Evidence

- Roadmap: `17.1.2.1`
- Task: `docs/tasks/v0.9.0-stage-17.1.2-roles-permissions.md`
