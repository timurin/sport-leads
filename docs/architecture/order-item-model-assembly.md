# Order-item model, assembly-variant, and routing snapshots

**Code:** `SL-ORDER-ITEM-MODEL-ASSEMBLY-v1`  
**Date:** `2026-07-26` (routing amend `2026-07-27`)  
**Roadmap:** `3.2.5.1` (storage `3.2.5.2`, rules `3.2.5.3`, UI `3.2.5.4`); routing strategy `3.2.7.1` (storage/rules `3.2.7.2`, UI `3.2.7.3`)  
**Boundary ADR:** `ADR-014` §4–§5; shop routing `ADR-017`  
**Parent domain:** `docs/architecture/product-model-domain.md` §5.2 / §7  
**Tasks:** `docs/tasks/v0.9.0-stage-3.2.5-order-item-model-assembly.md`; `docs/tasks/v0.9.0-stage-3.2.7-order-item-routing.md`

## 1. Purpose

Зафиксировать связи и immutable-снимки модели изделия / варианта сборки / **пресета маршрута** на **позиции заказа покупателя** (`SalesOrderItem`). Stage 6 владеет каталогом моделей и whitelist маршрутов (`6.1.17`); Stage 8 — master `ShopRoutingTemplate`; Stage 3 — коммерческим выбором и persistence снимков.

Catalog edits must not rewrite historical order lines. Stage 7 specifications copy assembly operation lines from the **order-item snapshot**, not from live `AssemblyVariant` masters. Stage 9 TC generate prefers the **order-item routing snapshot** over model `default_routing_template_id` alone.

## 2. Selection chain

```
Nomenclature (PRODUCT)
  → ProductModel ∈ available-models whitelist
      → autofill: article, size_type, name
      → AssemblyVariant ∈ active variants of that model
          → snapshot: variant name, total_cost, operation lines
      → ShopRoutingTemplate ∈ model routing whitelist (6.1.17)
          → snapshot: routing_template_id, routing_template_name
```

`NomenclatureVariant` (цвет / характеристики, ADR-010) остаётся **отдельным** шагом и не заменяет модель лекал.

Manual lines without `nomenclature_id` are **out of this contour** (model/variant/routing fields stay null).

## 3. Existing baseline (do not replace)

Partial columns already on `sales_order_items` (VAT/UNF slice; not yet ADR-014-complete):

| Column | Role |
|--------|------|
| `product_model_id` | Nullable live FK → `product_models.id`, `ON DELETE SET NULL` |
| `product_model_article` | Immutable snapshot of `ProductModel.article` |
| `product_model_name` | Immutable display snapshot of `ProductModel.name` |

`3.2.5.2+` **extends** this baseline; does not invent a second model path or rename existing columns. `3.2.7.2` adds routing columns on the same parent row (no second document).

## 4. Storage contract (`3.2.5.2` + `3.2.7.2`)

### 4.1 Live links on `sales_order_items`

| Column | Type | Rules |
|--------|------|-------|
| `product_model_id` | FK nullable | Exists; keep |
| `assembly_variant_id` | FK → `assembly_variants.id`, nullable, `ON DELETE SET NULL` | Add (`3.2.5.2`) |
| `routing_template_id` | FK → `shop_routing_templates.id`, nullable, `ON DELETE SET NULL` | **Add (`3.2.7.2`)** |

### 4.2 Denormalized snapshots on `sales_order_items`

| Column | Type | Rules |
|--------|------|-------|
| `product_model_article` | `String(100)` nullable | Exists; server-filled from master on select |
| `product_model_name` | `String(255)` nullable | Exists; display snapshot |
| `product_model_size_type` | enum string nullable (`men` \| `women` \| `kids`) | **Add**; autofill from `ProductModel.size_type` |
| `assembly_variant_name` | `String(255)` nullable | **Add**; from `AssemblyVariant.name` |
| `assembly_variant_total_cost` | `Numeric(14,2)` nullable | **Add**; Σ operation line costs at selection time |
| `routing_template_name` | `String(255)` nullable | **Add (`3.2.7.2`)**; from `ShopRoutingTemplate.name` at selection time |

`assembly_variant_total_cost` is an **informational** sewing-package snapshot. It does **not** replace or auto-set commercial `unit_price` / `line_amount` in `3.2.5`.

`routing_template_name` is display-only for order/TC headers. Stage sequences are **not** denormalized onto the order item — TC generate / apply-routing reads live template stage lines (or a TC-owned snapshot per ADR-016) using the stored `routing_template_id`.

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

API/schema field names must keep this distinction explicit. **Routing** is a third concept (`routing_template_*`) — not a “variant”.

### 4.5 Routing snapshot strategy (`3.2.7.1` — locked; storage in `3.2.7.2`)

| Field | Role |
|-------|------|
| `routing_template_id` | Live FK → `shop_routing_templates.id`, nullable, `ON DELETE SET NULL` |
| `routing_template_name` | Immutable display snapshot of template name at selection time |

**Locked decisions:**

1. **Whitelist-only source:** selectable templates = active `ProductModelRoutingLink` rows for the selected model (`6.1.17`). Do **not** offer the full global `/shop-routings` catalog as the order picker source.
2. **Parent-row snapshot (not child table):** id + name only on `SalesOrderItem`. No order-item clone of routing stage lines or operation norms.
3. **Server-authoritative fill:** on select/change of `routing_template_id`, copy `ShopRoutingTemplate.name` → `routing_template_name`. Client-supplied name must not override when an id is present.
4. **Immutability:** catalog renames / stage-line edits do **not** mutate stored `routing_template_name` (or id) on historical lines. Clearing/changing model clears or revalidates routing for that line only.
5. **TC generate preference:** when `routing_template_id` is set on the order item, generate/apply-routing uses that id; otherwise fall back to model `default_routing_template_id` (still subject to whitelist rules in `8.2.3.7+`).
6. **Norms stay on the model:** `ProductModelOperationNorm` is a plan hint on the model+routing link — **not** copied onto the order item in `3.2.7`. TC planned material qty may read norms later (`9.3.4`).

## 5. Service rules (`3.2.5.3` shipped; routing `3.2.7.2`)

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

**Model routing whitelist (`6.1.17`) — mirror assembly require rule (`3.2.7.2`):**

| Model routing whitelist | Rule |
|-------------------------|------|
| Empty (0 active links) | `routing_template_id` optional (nullable). |
| ≥1 active link | `routing_template_id` **required** and ∈ that model’s active whitelist. **Not soft-optional.** |
| Any | Routing not on selected model’s whitelist → reject. |
| New selection | Inactive template / inactive link cannot be newly selected. |
| Snapshots | Server fills `routing_template_name` from master when id is set. Client name ignored when id present. |
| Model change | Clearing/changing `product_model_id` clears routing snapshot (or revalidates only if the same template remains on the new model’s whitelist — default safe behavior: **clear**). |
| Assembly change | Changing `assembly_variant_id` does **not** by itself clear routing (routing is model-scoped, not variant-scoped). |

**UI behaviour (`3.2.5.4`, locked):** assembly-variant field is **hidden** until a model is selected; when a model is selected, show that model’s **active** variants only. Soft-optional when active variants exist is forbidden.

**UI behaviour (`3.2.7.3`, locked):** routing select appears **after** model (alongside / after assembly variant per selection chain); **hidden** without model; options = active model routing links only. Soft-optional when whitelist non-empty is forbidden.

## 6. Autofill

When the manager selects a model from the whitelist:

1. Set `product_model_id`
2. Copy `article` → `product_model_article`
3. Copy `name` → `product_model_name`
4. Copy `size_type` → `product_model_size_type`
5. Clear previous `assembly_variant_*` and assembly operation snapshots (model change invalidates variant)
6. Clear previous `routing_template_*` (model change invalidates routing) — or, in `3.2.7.2+`, optionally prefill from `ProductModel.default_routing_template_id` **only if** that default ∈ the model’s active whitelist

When the manager selects an assembly variant:

1. Set `assembly_variant_id`
2. Copy `name` → `assembly_variant_name`
3. Set `assembly_variant_total_cost` = Σ line costs
4. Replace assembly operation snapshot rows

When the manager selects a routing template (`3.2.7.2+`):

1. Set `routing_template_id` (must ∈ model whitelist)
2. Copy template `name` → `routing_template_name`
3. Do **not** copy stage lines or operation norms onto the order item

Changing nomenclature clears model + variant + routing + both assembly snapshot sets (or re-validates if the same model remains in the new whitelist — service decides; default safe behavior: clear).

## 7. Out of scope for this contract

- ~~Alembic / SQLAlchemy implementation (`3.2.5.2`)~~ — shipped `j1k2l3m4n567`
- ~~Pydantic schemas and service code (`3.2.5.3`)~~ — shipped; smoke `tests/test_order_item_model_assembly.py`
- ~~Order-item UI flow (`3.2.5.4`)~~ — shipped: hide without model; active variants; required when ≥1 active (Spec/TC)
- Lead commercial model picker (`3.2.5.7` note: reuse same `ProductModel` id space; no second master)
- Stage 7 specification copy mechanics (consumes assembly snapshot)
- Model routing whitelist / norms CRUD (`6.1.17`) — dependency SoT; not re-implemented here
- Global shop-routing catalog CRUD (`/settings/catalogs/routings`)
- Copying routing stage lines or `ProductModelOperationNorm` onto the order item
- Wire generate / apply-routing whitelist enforcement (`8.2.3.7`–`8.2.3.8`) — consumer of this snapshot
- Binding sewing package cost into commercial pricing
- Alembic / schemas / UI for routing (`3.2.7.2`–`3.2.7.3`) — next microtasks after this strategy lock

## 8. Checkpoint (`3.2.5.1`–`3.2.5.6`; routing strategy `3.2.7.1`)

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
| Routing snapshot fields + whitelist-only strategy (`3.2.7.1`) | Yes — §2 / §4.5 / §5 / §6 |
| Routing migration + enforce rules (`3.2.7.2`) | Yes — Alembic `q8r9s0t1u234`; `_resolve_routing_snapshot`; smoke `test_order_item_routing_3_2_7.py` |
| Routing UI (`3.2.7.3`) | Yes — UnfDemo column «Маршрут»; whitelist-only; hidden without model |
| Routing regression (`3.2.7.4`) | Yes — `tests/test_order_item_routing_3_2_7.py` |
| Routing owner visual (`3.2.7.5`) | Yes — owner OK `2026-07-27` |
| Order-item selection smoke (`3.2.6`) | Yes — `test_order_item_model_selection_smoke_3_2_6.py`; no P0/P1 |

**Next:** commercial contour → `9.3.4` (TC plan/fact materials) or remaining Stage 9/11 items.
