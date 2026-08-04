# Product Model — Domain Contract

**Code:** `SL-PRODUCT-MODEL-DOMAIN-v1`  
**Date:** `2026-07-22`  
**Roadmap:** `6.1.1`  
**Boundary ADR:** `ADR-014`  
**UI template:** PT-08 (`stage-6.0.3-pattern-base-pt-mapping.md`)

## 1. Source of truth

`ProductModel` — единственный master справочника моделей изделий («База лекал»).  
Не дублируется в номенклатуре, спецификации, ТК или Stage 8 routing.

**Плоское правило:** `1 ProductModel = 1 size_type = 1 article`.

Запрещены вложенные контуры «Мужские / Женские / Детские» внутри одной модели. Разный пол/возраст = **другая** запись модели.

## 2. Fields and lifecycle (`6.1.1.1`)

### 2.1 Core fields

| Field | Type | Rules |
|---|---|---|
| `id` | PK | Surrogate key |
| `article` | string | **Globally unique** among product models; trim; non-empty. Garment commercial article lives here (not on `Nomenclature`; field removed `4.7.11`). |
| `name` | string | Non-empty display name |
| `size_type` | enum | Derived from linked `SizeGrid.size_type` when a grid is selected; stored for filters |
| `description` | text, nullable | Free text |
| `patterns_path` | string, nullable | Путь к лекалам (card, 2 cols) — `6.1.10.6` |
| `constructor_name` | string, nullable | Конструктор (card, 1 col) — `6.1.10.6` |
| `patterns_created_on` | date, nullable | Дата создания лекал (card, 1 col) — `6.1.10.6` |
| `cover_image_url` | string, nullable | Optional cover/thumbnail URL (list + card preview; full media gallery later) |
| `folder_id` | FK → `ProductModelFolder`, nullable | `NULL` = root of catalog (`6.1.18`) |
| `sort_order` | integer | `≥ 0`; sibling order among models in the same folder (or root) |
| `status` | enum | See §4 (`draft` \| `active` \| `archived`) |
| `size_grid_id` | FK, nullable | Single UI field «Размерная сетка»; required before activate — see §3 |
| `created_at` / `updated_at` | timestamptz | Timezone-aware |

Money fields do **not** live on the model header. Assembly costs live on `AssemblyOperationLine` (`6.1.12`).

### 2.2 Lifecycle (catalog)

```
create → draft
  → activate → active
  → deactivate / archive → archived
  → (optional) reactivate archived → active (service rule in 6.1.5)
```

Default on create: `draft`.

### 2.3 ProductModelFolder (`6.1.18`)

Navigation folders for the product-models catalog list (parent/child), same pattern as sewing-ops folders (`6.3.11`). Folders are **not** snapshot targets and do **not** change the flat `1 model = 1 size_type = 1 article` rule.

| Field | Type | Rules |
|---|---|---|
| `id` | PK | Surrogate key |
| `name` | string | Required; trim; non-empty; **unique among siblings** (same `parent_id`, case-insensitive) |
| `parent_id` | FK → self, nullable | `NULL` = root folder; cycle-safe moves |
| `sort_order` | integer | `≥ 0`; sibling order among folders under the same parent |
| `default_sewing_operation_template_id` | FK → `SewingOperationTemplate`, nullable (`6.1.19`) | At most **one** default template per folder; `ON DELETE SET NULL`; not a snapshot target |
| `created_at` / `updated_at` | timestamptz | Timezone-aware |

Delete folder only when it has **no child folders** and **no product models** (RESTRICT).

**Default template seed (`6.1.19`):** when a **new** product model is created with `folder_id` pointing at a folder that has `default_sewing_operation_template_id`, the service creates one assembly variant named «Базовый» and copy-on-pick snapshots the template’s sewing ops (same contour as `6.3.13`). Empty template → no variant. Later edits to the template or folder default **do not** rewrite existing variants. Moving a model into a folder **does not** replace non-empty assembly lines.

**Tree order** within one parent (including catalog root):

1. Folders by `sort_order ASC`, then `lower(name)`, then `id`
2. Then models by `sort_order ASC`, then `lower(name)`, then `id`

Sibling ↑/↓ swaps `sort_order` among folders under the same parent. Moving a model sets `folder_id` (nullable root) via `PATCH /product-models/{id}` `{ folder_id }`.

**API:** `/product-model-folders` CRUD + `POST .../move-sibling`; models carry `folder_id` / `sort_order` on create/update/list.

## 3. Links to size grid and pattern set (`6.1.1.2`)

| Link | Cardinality | Notes |
|---|---|---|
| `ProductModel` → `SizeGrid` | **0..1** while unused; **required on activate**; UI picks **one** field «Размерная сетка» (`size_type` follows the grid) | Changing grid / reverting to draft blocked when global ops journal has rows for the model (`18.4`; stub until journal ships). Warning: «По данной модели были операции! Изменения могут затронуть отчетность!» |

Inverse: a size grid **may** be reusable across models only if a later ADR allows shared reference; default MVP assumption for `6.2.1` remains **owned or exclusive** until that ADR says otherwise.

**Forbidden:** `ModelContour` / nested size_type arrays / N size grids on one model.  
**Withdrawn:** `ProductModel` → `PatternSet` (Stage 6.3 now = flat `SewingOperation` catalog; see `sewing-operations-domain.md`).

Assembly variants (`AssemblyVariant[]`) are **1:N children of the model**, not a second link axis like grids.

## 4. Status and versioning (`6.1.1.3`)

Two layers (phased by roadmap):

### 4.1 Catalog status MVP (`6.1.5`) — required before full history

| Status | Meaning | Order / whitelist use |
|---|---|---|
| `draft` | Editable, not offered to managers in new selections | Excluded from PRODUCT available-models pickers and new order-item choices |
| `active` | Catalog-ready | Allowed in whitelist and order selection (subject to ADR-014 empty-list policy) |
| `archived` | Retired | Not for new selection; existing order snapshots remain |

Transitions validated in service layer (`6.1.5`). UI may show status without version history.

### 4.2 Version history (`6.1.6`) — after status MVP

Align with PT-08:

| Version state | Meaning |
|---|---|
| `draft` | Working copy under edit |
| `published` | Approved baseline for the model (**at most one** published baseline) |
| `archived` | Retired version |

Rules:

1. Versioning does **not** create a second article or second `size_type`.
2. Changing published constructive content → new draft version (or explicit “create draft from published”); do not silently mutate the published baseline.
3. Order / specification snapshots reference model (+ variant) at selection time; they do **not** auto-follow later version publishes.
4. Until `6.1.6` ships, implementers store **only** catalog `status` on `ProductModel` (version table optional / deferred).

## 5. Integration constraints (`6.1.1.4`)

### 5.1 Nomenclature (PRODUCT)

- Whitelist M2M on PRODUCT card (`6.1.11`); only `active` models should be addable/selectable for new work.
- Model is **not** a nomenclature variant (ADR-010).

### 5.2 Sales order item (`3.2.5`, former `6.1.13`; routing pick `3.2.7`)

Order line selects `product_model_id` from PRODUCT available-models whitelist, then `assembly_variant_id` of that model, then (when `6.1.17` / `3.2.7` ship) `routing_template_id` ∈ model routing whitelist. Snapshots store article / size_type / name / variant name / total and **MVP operation-line child snapshots** (+ routing id/name when `3.2.7`). Owned by **Sales Orders**, not Stage 6 catalog.

Chain: nomenclature → model ∈ whitelist → autofill `article` + `size_type` (+ name) → assembly variant ∈ model → shop routing ∈ model routing whitelist.

**Canonical contract:** `docs/architecture/order-item-model-assembly.md` (`SL-ORDER-ITEM-MODEL-ASSEMBLY-v1`, `3.2.5.1`).  
Manual lines without nomenclature: out of this contour.

### 5.3 Lead

No separate lead-model master. Reuse the same `ProductModel` catalog when lead commercial details gain model selection (note for `3.2.5.7` / Stage 1). Conversion to order must not invent a second model id space.

### 5.4 Specification (Stage 7)

Spec is a **document report** (plan + fact in one form) for 1С batch cost reporting. Plan blocks copy/read assembly and composition from the **order-item / TC snapshots**. Fact blocks bind execution (materials spent, ops done, time, performers). Spec does not live-edit `ProductModel` / `AssemblyVariant` master. Documents registry lists a link only (ADR-004).

### 5.5 Technical card (Stage 9 / ADR-016)

TC snapshots model / assembly / sewing / routing per ADR-016. `planned_qty` on MATERIAL composition may use `ProductModelOperationNorm` × order qty as a **hint** (`9.3.4`); fact qty is shop-written. Domain constraint: TC must not become a second pattern-base or routing master.

### 5.6 Stage 8 shop routing + model whitelist (`6.1.17`)

Global master of routing templates / stage sequences remains Stage 8 (`/settings/catalogs/routings`, ADR-017). The product model owns only:

- ordered **whitelist** of existing `ShopRoutingTemplate` rows (`ProductModelRoutingLink`);
- per-link **operation material norms** (`ProductModelOperationNorm`) as plan hints for 1 unit;
- nullable `default_routing_template_id` that **must ∈ whitelist** when the whitelist is non-empty.

No duplicate routing CRUD on the model card. Shop routings must not duplicate manager-facing assembly packages (ADR-014).

## 6. Assembly variants (`6.1.12`)

| Entity | Fields | Rules |
|---|---|---|
| `AssemblyVariant` | `product_model_id`, `name` (unique per model), `is_active`, `sort_order` | 1:N child of `ProductModel`; inactive variants excluded from new order picks (`active_only`) |
| `AssemblyOperationLine` | `assembly_variant_id`, `sequence` (≥1, unique per variant), `operation_name`, `cost` (`Numeric(14,2)` ≥0), optional sewing catalog FK | Cost contour Stage 6; ≠ shop routing / material norms |

`total_cost` is always computed from lines (`Decimal`); not persisted.

## 7. Model routing whitelist + operation norms (`6.1.17`)

**Code amend:** `SL-PRODUCT-MODEL-DOMAIN-v1` / `2026-07-27`  
**Task:** `docs/tasks/v0.9.0-stage-6.1.17-model-routing-norms.md`  
**ADRs:** ADR-014 amend, ADR-017 amend

### 7.1 Entities

| Entity | Role | Master of truth |
|---|---|---|
| `ProductModelRoutingLink` | Ordered whitelist row: model ↔ existing `ShopRoutingTemplate` | Stage 6 model card (`6.1.17`); template body SoT = Stage 8 |
| `ProductModelOperationNorm` | Plan hint on one whitelist link: stage and/or tech-op + `norm_qty_per_item` + unit | Stage 6; feeds TC `planned_qty` hint only |
| `ProductModel.default_routing_template_id` | Nullable FK to template; default for TC generate | Must ∈ link set when whitelist non-empty |

### 7.2 Field contract

#### `ProductModelRoutingLink`

| Field | Type | Rules |
|---|---|---|
| `id` | PK | Surrogate |
| `product_model_id` | FK → `product_models` CASCADE | Parent model |
| `shop_routing_template_id` | FK → `shop_routing_templates` RESTRICT | Existing template only; **no clone** of stage lines |
| `sort_order` | int ≥ 0 | Display / pick order |
| `is_active` | bool | Soft exclude from new picks without deleting history |
| `created_at` / `updated_at` | timestamptz | Timezone-aware |

Constraints:

- `UNIQUE(product_model_id, shop_routing_template_id)`
- Attach rejects unknown / inactive templates (service rule; list filter active-only for new picks)
- Removing a link that is the current `default_routing_template_id` clears default or rejects until reassigned (service picks one policy and keeps it)

#### `ProductModelOperationNorm`

| Field | Type | Rules |
|---|---|---|
| `id` | PK | Surrogate |
| `product_model_routing_link_id` | FK → link CASCADE | Norms scoped to one whitelist row |
| `production_stage_id` | FK → `production_stages` RESTRICT, nullable* | Цех bind (`8.3`) |
| `tech_operation_id` | soft/nullable id → TechOperation | Optional finer bind; when set must belong to same цех as stage when both present |
| `norm_qty_per_item` | `Numeric` / `Decimal` | Plan hint for **1 unit** (e.g. `0.7`); **≥ 0**; money-safe Decimal path |
| `unit` | string | Required non-empty unit label/code (e.g. linear meters); align with TechOperation volume unit when op set |
| `created_at` / `updated_at` | timestamptz | Timezone-aware |

\*At least one of `production_stage_id` / `tech_operation_id` required. Service resolves
`production_stage_id` from TechOperation when only op is sent (op must have a цех).
**Uniqueness locked (`6.1.17.2`):** partial unique indexes —
`(link, production_stage_id)` where `tech_operation_id IS NULL`, and
`(link, production_stage_id, tech_operation_id)` where op is set.

Semantics:

- Norm = **plan hint**, not hard BOM × order qty, not fact consumption.
- TC `planned_qty` may compute `norm_qty_per_item × order_line.qty` (`9.3.4`); sizes may differ — not hard SoT.
- Fact qty written by цех (`11.5` / `11.6`); not stored on the model.

### 7.3 Default ∈ whitelist

| Whitelist state | `default_routing_template_id` |
|---|---|
| Empty | May be null (legacy FK cleared when first incompatible write happens) |
| Non-empty | Must be null **or** equal to one of the linked `shop_routing_template_id` values |

Foreign routing on write → reject (API, not UI-only).

### 7.4 UI placement (contract only; build in `6.1.17.4`)

PT-08 model card block **«Варианты маршрутов»**: add/remove/reorder/default + per-link norms editor. Add = pick from active Stage 8 catalog. Link-out to `/settings/catalogs/routings` for master CRUD. **DS-SHELL-01/02** unchanged.

## 8. Out of scope for domain contract alone

- SQLAlchemy / Alembic / API implementation (`6.1.17.2`–`.3`)
- Order-item routing snapshot persistence (`3.2.7`)
- TC plan/fact material gate (`9.3.4`) and shop fact UI (`11.5`/`11.6`)
- Wire generate/apply-routing to whitelist (`8.2.3.7`–`8.2.3.8`)
- Size-grid entity schemas (`6.2.*`); sewing operations (`6.3.*` / `sewing-operations-domain.md`)
- Duplicate Stage 8 routing master on the model card

## 9. Checkpoint (`6.1.1.5` + `6.1.17.1`)

| Criterion | Status |
|---|---|
| Single source of truth for product models | Yes — this doc + ADR-014 |
| Flat `1 model = 1 size_type = 1 article` | Explicit §1–§2 |
| Dependencies on grids, sewing ops, assembly variants, specs | Explicit §3–§6 |
| Model routing whitelist + operation norms domain (`6.1.17.1`) | Explicit §5.6 / §7; ADR-014/017 amend |

**Catalog domain for models:** closed for `6.1.1`; routing whitelist domain locked for `6.1.17.1` (implementation `6.1.17.2+`). Order-item model/assembly binding is Stage `3.2.5`; order routing pick is `3.2.7`.
