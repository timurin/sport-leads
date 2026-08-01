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
| `cost` | `Numeric(14,2)` | Required; `≥ 0`; money-safe `Decimal`; unit price per one operation |
| `quantity_per_item` | `Integer` | Required; `≥ 1`; how many times the operation runs on one finished item (`6.3.9`); line sum = `cost × quantity_per_item` |
| `duration_seconds` | `Integer` | Required; `≥ 0`; normative execution time in seconds for one operation (`6.3.8`) |
| `work_center_ids` | M:N → `WorkCenter` | Optional; only equipment with `ProductionStage.code = sewing` (Пошив); `6.3.10` |
| `created_at` / `updated_at` | timestamptz | Timezone-aware |

No status, versions, files, or nesting. Equipment links are catalog metadata only (not copied to assembly/order/TC snapshots in `6.3.10`).

## 3. Boundaries

| Concept | Relation |
|---|---|
| `AssemblyOperationLine` | Copy-on-pick from catalog: snapshot `operation_name` + `cost` + `quantity_per_item` + `duration_seconds`; optional `sewing_operation_id` (`6.3.6` / `6.3.9`). Catalog price/qty/time changes do not rewrite existing variant lines. Variant total = Σ (`cost × quantity_per_item`). |
| `ProductModel` | No `pattern_set_id`; sewing ops are **not** children of a model |
| `WorkCenter` | Compatible sewing-shop equipment via M:N (`6.3.10`); candidates must belong to цех Пошив (`code=sewing`) |
| Stage 8 shop routing / TC | Separate execution contour; routing/TC `work_center_id` (`11.1.2`) is **not** this catalog link |

## 4. UI / API

- Route: `/settings/catalogs/sewing_operations`
- API prefix: `/sewing-operations`
- List chrome: same PT-02 catalog pattern as product-models (toolbar, search, CreateDrawer, inline edit)
- Equipment multi-select on create/edit (`6.3.10.4`)

## Amendment (`6.3.10`, `2026-07-31`)

M:N equipment binding for sewing-ops catalog; filter WorkCenter by production stage Пошив. Task: `docs/tasks/v0.9.0-stage-6.3.10-sewing-op-equipment.md`.

**Shipped:** Alembic `d1e2f3a4b567`; API `work_center_ids` + sewing-stage gate; UI multi-select; regressions `6.3.10.5`. Not copied into assembly/order/TC snapshots.
