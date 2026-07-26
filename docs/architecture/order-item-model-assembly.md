# Order-item model and assembly-variant snapshots

**Code:** `SL-ORDER-ITEM-MODEL-ASSEMBLY-v1`  
**Date:** `2026-07-26`  
**Roadmap:** `3.2.5.1` (storage `3.2.5.2`, rules `3.2.5.3`, UI `3.2.5.4`)  
**Boundary ADR:** `ADR-014` §4–§5  
**Parent domain:** `docs/architecture/product-model-domain.md` §5.2  
**Task:** `docs/tasks/v0.9.0-stage-3.2.5-order-item-model-assembly.md`

## 1. Purpose

Зафиксировать связи и immutable-снимки модели изделия / варианта сборки на **позиции заказа покупателя** (`SalesOrderItem`). Stage 6 владеет каталогом; Stage 3 — коммерческим выбором и persistence снимков.

Catalog edits must not rewrite historical order lines. Stage 7 specifications copy assembly operation lines from the **order-item snapshot**, not from live `AssemblyVariant` masters.

## 2. Selection chain

```
Nomenclature (PRODUCT)
  → ProductModel ∈ available-models whitelist
      → autofill: article, size_type, name
      → AssemblyVariant ∈ active variants of that model
          → snapshot: variant name, total_cost, operation lines
```

`NomenclatureVariant` (цвет / характеристики, ADR-010) остаётся **отдельным** шагом и не заменяет модель лекал.

Manual lines without `nomenclature_id` are **out of this contour** (model/variant fields stay null).

## 3. Existing baseline (do not replace)

Partial columns already on `sales_order_items` (VAT/UNF slice; not yet ADR-014-complete):

| Column | Role |
|--------|------|
| `product_model_id` | Nullable live FK → `product_models.id`, `ON DELETE SET NULL` |
| `product_model_article` | Immutable snapshot of `ProductModel.article` |
| `product_model_name` | Immutable display snapshot of `ProductModel.name` |

`3.2.5.2+` **extends** this baseline; does not invent a second model path or rename existing columns.

## 4. Storage contract (`3.2.5.2`)

### 4.1 Live links on `sales_order_items`

| Column | Type | Rules |
|--------|------|-------|
| `product_model_id` | FK nullable | Exists; keep |
| `assembly_variant_id` | FK → `assembly_variants.id`, nullable, `ON DELETE SET NULL` | Add |

### 4.2 Denormalized snapshots on `sales_order_items`

| Column | Type | Rules |
|--------|------|-------|
| `product_model_article` | `String(100)` nullable | Exists; server-filled from master on select |
| `product_model_name` | `String(255)` nullable | Exists; display snapshot |
| `product_model_size_type` | enum string nullable (`men` \| `women` \| `kids`) | **Add**; autofill from `ProductModel.size_type` |
| `assembly_variant_name` | `String(255)` nullable | **Add**; from `AssemblyVariant.name` |
| `assembly_variant_total_cost` | `Numeric(14,2)` nullable | **Add**; Σ operation line costs at selection time |

`assembly_variant_total_cost` is an **informational** sewing-package snapshot. It does **not** replace or auto-set commercial `unit_price` / `line_amount` in `3.2.5`.

### 4.3 Operation-line snapshot child table (MVP)

**Entity:** `SalesOrderItemAssemblyOperationSnapshot`  
**Table:** `sales_order_item_assembly_operation_snapshots`

Mirrors the relational child pattern of `SalesOrderItemVariantSnapshot` (nomenclature characteristics). Do **not** store assembly lines as JSON on the parent.

| Column | Type | Rules |
|--------|------|-------|
| `id` | PK | Surrogate |
| `order_item_id` | FK → `sales_order_items.id`, `ON DELETE CASCADE` | Required; index |
| `sequence` | `Integer` ≥ 1 | Unique per `(order_item_id, sequence)` |
| `operation_name` | `String(255)` | Snapshot from `AssemblyOperationLine.operation_name` |
| `cost` | `Numeric(14,2)` ≥ 0 | Snapshot; money-safe `Decimal` |
| `duration_seconds` | `Integer` ≥ 0 | Snapshot from master line |
| `sewing_operation_id` | FK → `sewing_operations.id`, nullable, `ON DELETE SET NULL` | Optional catalog trace only |

Relationship on `SalesOrderItem`: `assembly_operation_snapshots` with `cascade="all, delete-orphan"`, ordered by `sequence, id`.

**Write rules:**

- On select / change of `assembly_variant_id`: replace all child rows from the variant’s current `AssemblyOperationLine` set (copy-on-pick).
- When `assembly_variant_id` is cleared: delete all child rows.
- Catalog edits to sewing ops / variant lines **never** rewrite existing order-item snapshots.

### 4.4 Naming: two “variant” concepts

| Concept | Storage | Meaning |
|---------|---------|---------|
| Nomenclature characteristics | `sales_order_item_variant_snapshots` / `variant_snapshots` | ADR-010 SKU options |
| Assembly package lines | `sales_order_item_assembly_operation_snapshots` / `assembly_operation_snapshots` | ADR-014 sewing package |

API/schema field names must keep this distinction explicit.

## 5. Service rules (`3.2.5.3` — shipped; UI in `3.2.5.4`)

Aligned with ADR-014 §5. Enforced in the sales-order-item service (not UI-only).

| Whitelist on PRODUCT nomenclature | Rule |
|-----------------------------------|------|
| **Empty** | `product_model_id` / `assembly_variant_id` optional (nullable). Order allowed before pattern-base setup. |
| **Non-empty** | `product_model_id` **required** and ∈ whitelist for that nomenclature. |
| Model has ≥1 **active** assembly variant | `assembly_variant_id` **required** and belongs to the selected model. **Not soft-optional** — Stage 7 Spec and Stage 9 TC copy assembly operations from this snapshot. |
| Model has zero active variants | `assembly_variant_id` optional until variants are configured. |
| Any | Model outside whitelist → reject. Variant of another model → reject. |
| New selection | Inactive `ProductModel` / inactive `AssemblyVariant` cannot be newly selected. |
| Snapshots | Server authoritative: fill article / name / size_type / variant name / total / op lines from masters. Do not trust client-supplied snapshot totals or names when an id is present. |
| Immutability | After write, catalog changes do not mutate stored snapshots. Clearing/changing model or variant replaces snapshots for that line only. |

**UI behaviour (`3.2.5.4`, locked):** assembly-variant field is **hidden** until a model is selected; when a model is selected, show that model’s **active** variants only. Soft-optional when active variants exist is forbidden.

## 6. Autofill

When the manager selects a model from the whitelist:

1. Set `product_model_id`
2. Copy `article` → `product_model_article`
3. Copy `name` → `product_model_name`
4. Copy `size_type` → `product_model_size_type`
5. Clear previous `assembly_variant_*` and assembly operation snapshots (model change invalidates variant)

When the manager selects an assembly variant:

1. Set `assembly_variant_id`
2. Copy `name` → `assembly_variant_name`
3. Set `assembly_variant_total_cost` = Σ line costs
4. Replace assembly operation snapshot rows

Changing nomenclature clears model + variant + both snapshot sets (or re-validates if the same model remains in the new whitelist — service decides; default safe behavior: clear).

## 7. Out of scope for this contract

- ~~Alembic / SQLAlchemy implementation (`3.2.5.2`)~~ — shipped `j1k2l3m4n567`
- ~~Pydantic schemas and service code (`3.2.5.3`)~~ — shipped; smoke `tests/test_order_item_model_assembly.py`
- ~~Order-item UI flow (`3.2.5.4`)~~ — shipped: hide without model; active variants; required when ≥1 active (Spec/TC)
- Lead commercial model picker (`3.2.5.7` note: reuse same `ProductModel` id space; no second master)
- Stage 7 specification copy mechanics (consumes this snapshot)
- Stage 8 shop routings
- Binding sewing package cost into commercial pricing

## 8. Checkpoint (`3.2.5.1`–`3.2.5.6`)

| Criterion | Status |
|-----------|--------|
| Relation + snapshot field list explicit | Yes — §3–§4 |
| Op-line snapshot as child table (not JSON) | Yes — §4.3 |
| ADR-014 empty/non-empty whitelist policy locked | Yes — §5 |
| Variant required when model has active variants (Spec/TC) | Yes — §5; not soft-optional |
| UI hide/show + required rules for `3.2.5.4` locked | Yes — §5 UI note |
| Frontend selection flow (`3.2.5.4`) | Yes — UnfDemo + payload/mapper |
| Regression: whitelist / foreign reject / snapshot immutability (`3.2.5.5`) | Yes — `tests/test_order_item_model_assembly.py` |
| Owner visual (`3.2.5.6`) | Yes — owner OK `2026-07-26` |
| Distinction from nomenclature `variant_snapshots` | Yes — §4.4 |
| Extends existing `product_model_*` baseline | Yes — §3 |
| Nullable storage + migration | Yes — Alembic `j1k2l3m4n567` |
| Schemas + service whitelist/variant + server snapshots | Yes — `3.2.5.3` |

**Next:** `3.2.5.7` documentation checkpoint (lead reuse notes if applicable).
