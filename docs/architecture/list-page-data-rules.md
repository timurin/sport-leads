# List-page data rules (Stage 0 / `0.2.1`)

**Code:** `SL-LIST-PAGE-RULES-v1`  
**Date:** `2026-08-05`  
**Roadmap:** `v1.00` `0.2.1`  
**Related:** audit `docs/tasks/v1.00-stage-0.1.1-slow-data-audit.md`; guardrails follow-up `0.2.4`

## Goal / Цель

List and catalog pages must reach first paint without **N round-trips** that grow with row count (RSC per-row HTTP or BE per-row fat loads). Success = list TTFB dominated by a **bounded** request set, not by `O(rows)`.

Список/каталог не должен делать **N HTTP** или жирный per-row load. Успех = TTFB без N round-trips.

## Rules / Правила

### 1. No per-row RSC HTTP

Forbidden on Server Components that render a **list/catalog**:

```ts
await Promise.all(items.map((row) => fetchOneThing(row.id)));
```

Allowed: one list fetch + optional **fixed** parallel fetches (folders, stages, units) whose count does **not** scale with rows.

### 2. Batch or embed summary on list DTO

If the list UI needs a column/summary derived from children (cost range, option count, cover URL, balance):

- Prefer **embed** on the list response (`assembly_cost_min/max`, `option_count`, …), or
- Prefer one **batch** endpoint keyed by ids (`?ids=` / body), returning a map.

Do not fetch full child collections only to compute a count or min/max on the FE.

### 3. Slim list vs fat detail

| Surface | Load |
|---------|------|
| List / workspace table | Header + display columns only; no composition lines, media galleries, option catalogs, journal bodies |
| Detail / card | Full relations via dedicated GET |

List schemas must **not** inherit full detail schemas when that pulls nested arrays by default (anti-pattern: `ListRead(DetailRead)`).

### 4. Bounded request budget (list page)

Target for a list RSC page:

1. `GET` primary collection (≤1)
2. Optional fixed lookups (folders, dirs, settings) — small constant
3. Optional one batch enrichment (covers/values/balances) — ≤1

Anything that becomes `1 + k×N` is a Stage 0 defect until fixed or explicitly backlogged.

### 5. Detail-page N+1

Detail routes with per-entity child fetches (N options on a card, N names on a document) are **P2** relative to list TTFB, but the same batch/embed rule applies when N is unbounded. Track under Stage 0 backlog codes (`0.2.6`+).

### 6. Tests / regression

New list enrichment paths need a focused test that proves:

- list endpoint returns the embedded summary without requiring N child GETs from the FE, and/or
- batch helper/SQL returns one map for many ids.

## Reference implementations / Эталоны

| Pattern | Where |
|---------|--------|
| Embed cost bounds on list | `GET /product-models` + `assembly_cost_ranges_by_model_ids` |
| Batch balances | `getNomenclatureStockBalances` / stock balances API |
| Violations (fix targets) | characteristics option counts; warehouse 2N media+values; tech-cards fat list |
| Batch fact rollups on PO detail | `GET /production-orders/{id}/batch-fact-rollups` (`0.2.6`) |
| Embed nomenclature names on stock doc lines | `StockLedgerLineRead.nomenclature_name` (`0.2.7`) |
| Batch characteristic options on nomenclature card | `GET /characteristics/options-batch` (`0.2.8`) |

## Checklist for new list pages (also `0.2.4` / AGENTS)

- [ ] RSC page does not `map` → per-row `fetch` / `get*`
- [ ] List DTO is slim (no detail nested arrays by default)
- [ ] Summary columns come from embed or one batch call
- [ ] Focused test covers the batch/embed path when non-trivial
