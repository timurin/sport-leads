# Sewing Operations — Domain Contract

**Code:** `SL-SEWING-OPERATIONS-DOMAIN-v1`  
**Date:** `2026-07-22`  
**Roadmap:** `6.3.1`  
**Boundary ADR:** `ADR-014` (amended)  
**UI template:** `DS-PT-02-CATALOG` (etalon `/settings/catalogs/product-models`)

## 1. Source of truth

`SewingOperation` — плоский справочник операций пошива в группе «База лекал».

**Заменяет** ранее планируемый `PatternSet` / маршрут «Лекала» (`/settings/catalogs/patterns`). Комплекты файлов лекал, версии и 1:1 связь модель→лекала **не входят** в Stage 6.

## 2. Fields

| Field | Type | Rules |
|---|---|---|
| `id` | PK | Surrogate key |
| `name` | string | Required; trim; non-empty; **globally unique** |
| `cost` | `Numeric(14,2)` | Required; `≥ 0`; money-safe `Decimal` |
| `duration_seconds` | `Integer` | Required; `≥ 0`; normative execution time in seconds (`6.3.8`) |
| `created_at` / `updated_at` | timestamptz | Timezone-aware |

No status, versions, files, or nesting.

## 3. Boundaries

| Concept | Relation |
|---|---|
| `AssemblyOperationLine` | Copy-on-pick from catalog: snapshot `operation_name` + `cost` + `duration_seconds`; optional `sewing_operation_id` (`6.3.6`). Catalog price/time changes do not rewrite existing variant lines. |
| `ProductModel` | No `pattern_set_id`; sewing ops are **not** children of a model |
| Stage 8 shop routing | Separate execution contour; does not replace this catalog |

## 4. UI / API

- Route: `/settings/catalogs/sewing_operations`
- API prefix: `/sewing-operations`
- List chrome: same PT-02 catalog pattern as product-models (toolbar, search, CreateDrawer, inline edit)
