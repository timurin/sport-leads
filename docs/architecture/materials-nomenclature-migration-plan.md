# Materials → Nomenclature migration plan

**Code:** `SL-MATERIALS-NOM-MIGRATION-v1`  
**Date:** `2026-07-23`  
**Roadmap:** `4.6.1`–`4.6.4`  
**Decision:** `ADR-012`  
**Status:** approved for implementation (`4.6.1`)

## Goal

Make **materials a nomenclature type** (`MATERIAL`), not a second master catalog. Preserve articles. Do not copy stock balances onto nomenclature cards.

## Scope by roadmap item

| Item | Scope |
|---|---|
| `4.6.1` | This plan (approved) |
| `4.6.2` | Data copy + mapping table; freeze `/materials` mutations (no dual catalog writes) |
| `4.6.3` | Remove Materials nav; filter by `MATERIAL` on nomenclature |
| `4.6.4` | Delete `/materials` API, UI routes, and `materials` table — **done** (sibling; Alembic `a1b2c3d4e567`) |
| `4.6.5` | Stock fields stay for a future warehouse register — never on `Nomenclature` |

## Field mapping

| `materials` | `nomenclatures` | Notes |
|---|---|---|
| `article` | `article` | Exact preserve; unique key for match |
| `name` | `name` | Copied |
| `description` | `description` | Copied |
| `category` (text) | `category` (text) | Copied; `category_id` left `NULL` |
| `unit` (text) | `unit` (text) | Copied as-is |
| — | `storage_unit_id` | Best-effort match on `units_of_measure.symbol` / `code` (case-insensitive); else `NULL` |
| — | `nomenclature_type` | Always `MATERIAL` for **new** rows |
| — | `base_price` / `currency` | `0` / `RUB` |
| `is_active` | `is_active` | Copied |
| `balance`, `minimum_balance`, `warehouse` | **not copied** | Warehouse register later (`4.6.5`) |

## Article conflict policy

1. If no `nomenclatures.article` match → **insert** `MATERIAL` row; map `created_nomenclature = true`.
2. If article already exists → **do not overwrite** existing nomenclature fields/type; only record map (`created_nomenclature = false`). Article remains the shared identity.

## Tracking

Temporary table `materials_nomenclature_map`:

- `material_id` (PK, FK → `materials`)
- `nomenclature_id` (FK → `nomenclatures`, unique)
- `created_nomenclature` (bool) — whether upgrade inserted the row

Kept until `4.6.4` drops materials + map.

## Dual-write stop (`4.6.2`)

- Canonical writes: `/nomenclatures` only.
- `/materials` **GET** stays until `4.6.4` (read-only legacy).
- `/materials` **POST/PATCH/DELETE** return `410 Gone` with guidance to use nomenclature type `MATERIAL`.

## Downgrade

1. Delete `nomenclatures` rows with `map.created_nomenclature = true` (and no order-item FKs blocking — SET NULL / RESTRICT per existing schema).
2. Drop `materials_nomenclature_map`.
3. Leave `materials` table unchanged.

## Out of scope here

- Deleting materials table/API/UI (`4.6.4`)
- Warehouse register / balance migration (`4.6.5`)
- Full nomenclature list chrome parity (`4.7.1`–`4.7.4`)
