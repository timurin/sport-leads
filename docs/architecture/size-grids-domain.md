# Size Grids — Domain Contract

**Code:** `SL-SIZE-GRIDS-DOMAIN-v1`  
**Date:** `2026-07-22`  
**Roadmap:** `6.2.1`  
**Boundary ADR:** `ADR-014`  
**UI template:** list `DS-PT-02-CATALOG`; card `DS-PT-05`  
**Reference source (seed):** [Mosmade — таблицы размеров](https://mosmade.ru/about/tablitsy-razmerov/)

## 1. Decision: Variant A

Separate **SizeGrid** documents per `size_type` (`men` | `women` | `kids`).

- One catalog page may **list** all grids (tabs/filter by type).
- One grid document never mixes genders.
- `ProductModel` (`1 model = 1 size_type = 1 article`) links to **one** grid with the same `size_type` (`6.2.7`).

Rejected for MVP: single multi-gender grid filtered by row type (Variant B).

## 2. Entities

### 2.1 `SizeGrid`

| Field | Type | Rules |
|---|---|---|
| `id` | PK | Surrogate |
| `name` | string | Required; trim; unique |
| `size_type` | enum | `men` \| `women` \| `kids` — same vocabulary as `ProductModel.size_type` |
| `source_note` | string? | Optional provenance (e.g. Mosmade URL) |
| `created_at` / `updated_at` | timestamptz | Timezone-aware |

### 2.2 `SizeGridRow`

One wearable size line inside a grid (Mosmade table row).

| Field | Type | Rules |
|---|---|---|
| `id` | PK | Surrogate |
| `size_grid_id` | FK | Cascade delete with grid |
| `sort_order` | int | `≥ 0`; display order |
| `ru_size` | string | RU label (`"46"`, `"28"`, …) |
| `int_label` | string | INT / growth label (`"S"`, `"116"`, `"2XL"`, …) |
| `chest` | string | Обхват груди — reference text (`"92-96"`) |
| `waist` | string | Обхват талии — reference text (`"80-84"`) |
| `hip` | string | Обхват бедер — reference text (`"96-99"`) |
| `height_s` | string? | Рост S\* — reference text (`"158-164"`); null = «—» |
| `height_n` | string? | Рост N\*\* reference text |
| `height_t` | string? | Рост T\*\*\* reference text |

All Mosmade measurement cells are **reference text only** — not numeric min/max, not used for math/comparison.

## 3. Growth groups (`6.2.1.3`)

Mosmade columns **Рост S / N / T** map to nullable **text** fields on the row:

| Field | Example |
|---|---|
| `height_s` | `"158-164"` |
| `height_n` | `"164-170"` |
| `height_t` | `"170-176"` |

Absent Mosmade cell (`-`) → `null`. Do not split into numeric min/max.

## 4. Link to product model (`6.2.1.2` / `6.2.7`)

| Rule | Detail |
|---|---|
| Cardinality | `ProductModel` → 0..1 `SizeGrid` while draft; **required** on activate (`6.2.7`) |
| Compatibility | `grid.size_type == model.size_type` |
| Sharing | Reference grids (Mosmade seed) **may** be linked by many models until a later ADR forbids it |
| Snapshots | Order-item `size_range` stays ad-hoc until order binding consumes grid rows |
| UI | Model card «Основные реквизиты» — single «Размерная сетка» select (`size_type` derived); workspace — link only |
| Guards | Revert to draft / change grid blocked if `18.4` journal has model operations |

## 5. Mosmade seed plan

Source: men + women tables on Mosmade. Kids table (modal) — later optional microtask.

| Step | Roadmap | Content |
|---|---|---|
| 1 | `6.2.2.4` | Create grid «Мужская (Mosmade)» + **one** row RU `46` / INT `S` — owner verify |
| 2 | `6.2.2.5` | Remaining men rows |
| 3 | `6.2.2.6` | Grid «Женская (Mosmade)» + all women rows |
| 4 | optional | Kids reference grid |

### First row (verify)

Men / RU `46` / INT `S` from Mosmade:

| Field | Value |
|---|---|
| chest | `92-96` (text) |
| waist | `80-84` (text) |
| hip | `96-99` (text) |
| height S | `158-164` (text) |
| height N | `164-170` (text) |
| height T | `170-176` (text) |

## 6. Boundaries

| Concept | Relation |
|---|---|
| `SalesOrderItem.size_range` | Free-text snapshot today; not the SizeGrid master |
| Nomenclature variants | ADR-010 — not size grids |
| Model card workspace | After `6.2.7`, linked grid appears in «Рабочая область версии» |

## 7. API / UI (target)

- Routes: `/settings/catalogs/size-grids`, `/settings/catalogs/size-grids/[id]`
- API prefix: `/size-grids`
- List chrome: `DS-PT-02-CATALOG`; card: `DS-PT-05`
- **Stage 6:** read-only list/card + Mosmade seed
- **Mutations** (create/update/delete grids and rows): role-gated under roadmap `17.1.2.4` (not Stage 6)
