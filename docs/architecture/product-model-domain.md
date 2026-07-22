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
| `article` | string | **Globally unique** among product models; trim; non-empty. Independent from `Nomenclature.article`. |
| `name` | string | Non-empty display name |
| `size_type` | enum | Exactly one of: `men` \| `women` \| `kids`. Immutable after first publish/activation if versions exist; until then editable with caution (API may allow while `draft`) |
| `description` | text, nullable | Free text |
| `cover_image_url` | string, nullable | Optional cover/thumbnail URL (list + card preview; full media gallery later) |
| `status` | enum | See §4 (`draft` \| `active` \| `archived`) |
| `size_grid_id` | FK, nullable | 0..1 — see §3 |
| `pattern_set_id` | FK, nullable | 0..1 — see §3 |
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

## 3. Links to size grid and pattern set (`6.1.1.2`)

| Link | Cardinality | Notes |
|---|---|---|
| `ProductModel` → `SizeGrid` | **0..1** now; **1:1 required** when model is production-ready (after `6.2.7` enforcement may stay soft-nullable with validation on activate) | Grid must be compatible with model `size_type`. No multi-gender grid under one model. |
| `ProductModel` → `PatternSet` | **0..1** now; target **1:1** after `6.3.7` | One pattern set per model; versions live on the set / PT-08 bar, not as nested gender families. |

Inverse: a size grid or pattern set **may** be reusable across models only if a later ADR allows shared reference; default MVP assumption for `6.2.1` / `6.3.1` remains **owned or exclusive** until that ADR says otherwise. This contract does **not** invent shared-grid reuse.

**Forbidden:** `ModelContour` / nested size_type arrays / N size grids or N pattern sets on one model.

Assembly variants (`AssemblyVariant[]`) are **1:N children of the model**, not a second link axis like grids/patterns.

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

### 5.2 Sales order item (`6.1.13`)

Chain: nomenclature → model ∈ whitelist → autofill `article` + `size_type` → assembly variant ∈ model.

Persist: nullable FKs + snapshots (`model_article`, `size_type`, variant name/total, optional operation lines).  
Manual lines without nomenclature: out of this contour.

### 5.3 Lead

No separate lead-model master. Reuse the same `ProductModel` catalog when lead commercial details gain model selection (note for `6.1.13.7` / Stage 1). Conversion to order must not invent a second model id space.

### 5.4 Specification (Stage 7)

Spec copies assembly operation lines from the **order-item assembly-variant snapshot**. Spec does not live-edit `ProductModel` / `AssemblyVariant` master.

### 5.5 Technical card (Stage 9 / ADR-015)

TC links or snapshots model / assembly variant / patterns per future ADR-015. Domain constraint from this contract: TC must not become a second pattern-base master.

### 5.6 Stage 8 shop routing

Shop routings may later reference a model/variant for execution; they must not duplicate manager-facing assembly packages (ADR-014).

## 6. Out of scope for `6.1.1`

- SQLAlchemy / Alembic / API (`6.1.2+`)
- Size-grid / pattern entity schemas (`6.2.*` / `6.3.*`)
- Assembly variant persistence (`6.1.12`)
- UI feature fill beyond already shipped shells

## 7. Checkpoint (`6.1.1.5`)

| Criterion | Status |
|---|---|
| Single source of truth for product models | Yes — this doc + ADR-014 |
| Flat `1 model = 1 size_type = 1 article` | Explicit §1–§2 |
| Dependencies on grids, patterns, assembly variants, specs | Explicit §3–§5 |

**Next:** `6.1.2` database core.
