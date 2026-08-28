# Platform directories registry (Stage 18.2.1)

**Code:** `SL-PLATFORM-DIRECTORIES-v1`  
**Date:** `2026-08-02`  
**Roadmap:** `18.2.1` (feeds `18.2.2`–`18.2.4`)  
**Placement:** `docs/architecture/administration-placement.md`

## Purpose

Контракт **реестра** кросс-модульных справочников под Администрированием и домен первой живой записи (**Города**).

## Registry entry (logical)

| Field | Notes |
|-------|--------|
| `code` | Stable slug, e.g. `cities` |
| `title` | RU label for hub/nav |
| `description` | One-line purpose |
| `list_path` | `/settings/platform-directories/{code}` |
| `api_prefix` | e.g. `/platform-directories/cities` |
| `status` | `planned` \| `live` \| `deprecated` |
| `write_permission` | MVP: `platform_directories.write` |

MVP registry is **code-defined** (frontend lib + backend module constant). DB table for registry metadata is out of scope until multiple live directories need admin toggles.

## Registry MVP

| code | title | status | Notes |
|------|-------|--------|-------|
| `cities` | Города | `live` in `18.2.2`/`18.2.3` | Geography for leads/orders/UI suggestions |
| `contractors` | Контрагенты | `planned` | Hub stub only — do **not** implement here; procurement SoT = Stage `13` `Supplier` (ADR-033 / `SL-SUPPLIER-v1`); CRM buyers stay `Client` |

## City entity contract

| Field | Type | Rules |
|-------|------|--------|
| `id` | int PK | |
| `name` | string(120) | required; unique case-insensitive |
| `region` | string(120) nullable | optional oblast/krai label |
| `is_active` | bool | default true; inactive hidden from default pickers |
| `sort_order` | int | default 0 |
| `created_at` / `updated_at` | timestamptz | |

No soft-delete in MVP — deactivate via `is_active=false`. No merge/dedupe API in MVP.

## API sketch (`18.2.2`)

- `GET /platform-directories` → registry list (no auth beyond session)
- `GET/POST /platform-directories/cities`
- `GET/PATCH/DELETE /platform-directories/cities/{id}`
- Writes require `platform_directories.write`

## UI sketch (`18.2.3`)

- Hub lists registry (`live` + `planned` badges)
- Cities: `DS-PT-02-CATALOG` list + `DS-PT-05` card
- Redirect `/settings/catalogs/cities` → platform cities list

## Out of scope

- Moving warehouses / VAT / UoM / product-models into this registry
- Print-form templates (`18.3`)
- Global ops journal (`18.4` → v1.00)

## Evidence

- Task: `docs/tasks/v0.9.0-stage-18.2.1-platform-directories-contract.md`
