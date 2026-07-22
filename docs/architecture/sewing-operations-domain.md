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
| `created_at` / `updated_at` | timestamptz | Timezone-aware |

No status, versions, files, or nesting.

## 3. Boundaries

| Concept | Relation |
|---|---|
| `AssemblyOperationLine` | MVP remains **inline** `operation_name` + `cost` on the variant (`6.1.12`). Optional FK / pick-from-catalog — later (`6.3.6`) |
| `ProductModel` | No `pattern_set_id`; sewing ops are **not** children of a model |
| Stage 8 shop routing | Separate execution contour; does not replace this catalog |

## 4. UI / API

- Route: `/settings/catalogs/sewing_operations`
- API prefix: `/sewing-operations`
- List chrome: same PT-02 catalog pattern as product-models (toolbar, search, CreateDrawer, inline edit)
