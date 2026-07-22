# Stage 6.0.3 — Pattern-base page template mapping

**Code:** `SL-STAGE-6.0.3-PT-MAP-v1`  
**Date:** `2026-07-22`  
**Roadmap:** `6.0.3.1`–`6.0.3.4`  
**Domain:** `ADR-014`  
**Related:** `pt-02-list-table.md`, `pt-05-simple-entity-card.md`, `pt-06-complex-entity-card.md`, `pt-08-versioned-workspace.md`, `breakpoint-tokens.md`, `responsive-audit.md`

## Purpose

Зафиксировать template IDs **до** feature-fill (`6.1+` / `6.2+` / `6.3+`), чтобы списки и карточки Базы лекал не изобретали layout.

**Canonical catalog etalons (`6.0.3.5`):**

| Route | Contract | Scope |
|---|---|---|
| `/settings/catalogs/product-models` | **`DS-PT-02-CATALOG`** | Primary list template for **справочники, разделы, категории** and other flat directory lists |
| `/settings/catalogs/product-models/[id]` | **`DS-PT-08-CATALOG`** | Primary card template for versioned directory cards (and layout chrome for analogous catalog cards) |

Evidence: `pt-02-catalog-list.md`, `pt-08-catalog-card-layout.md`.

Документ не реализует UI. Плейсхолдеры `6.0.2` остаются EmptyState-shell до своих workspace-итераций.

## Route → template map

| Route | Role | Template | Reference / notes |
|---|---|---|---|
| `/settings/catalogs/product-models` | list | **PT-02** + **`DS-PT-02-CATALOG`** | **Etalon** for directories / sections / categories lists. Impl: `ProductModelsWorkspace`. Contract: `pt-02-catalog-list.md`. Create → `CreateDrawer` (ADR-013). |
| `/settings/catalogs/size-grids` | list | **PT-02** + **`DS-PT-02-CATALOG`** | Same catalog-list chrome as models. |
| `/settings/catalogs/sewing_operations` | list | **PT-02** + **`DS-PT-02-CATALOG`** | Same catalog-list chrome as models. Impl: `SewingOperationsWorkspace`. Replaces withdrawn `/settings/catalogs/patterns`. |
| `/settings/catalogs/product-models/[modelId]` | card | **PT-08** + **`DS-PT-08-CATALOG`** | **Etalon** for versioned catalog cards. Impl: `ProductModelPersistentCard` + `CatalogVersionedCardLayout`. Layout: `pt-08-catalog-card-layout.md`. Demo: `demo-reference`. |
| `/settings/catalogs/size-grids/[gridId]` | card | **PT-05** (`DS-PT-05`) | Simple settings card (no versions): header + attributes + size-rows table. Ref: characteristic detail. |
| `/settings/catalogs/nomenclature/[id]` | PRODUCT block | **existing nomenclature card** (PT-06 card chrome) | No new page template. Block «Доступные модели лекал» inside current card. |
| Future settings directories / sections / categories | list (+ card) | **`DS-PT-02-CATALOG`** (+ **`DS-PT-08-CATALOG`** if versioned, else **PT-05**) | Do **not** copy `/sales/clients` or invent parallel chrome. |

PT-06 Lead-style complex card is **not** used for model/pattern/size-grid cards.

## List slots (PT-02-CATALOG) — models / size grids / sewing operations / directories

Required when filling `6.1.7` / `6.2.4` / `6.3.4` and future directory lists:

| Slot | Decision |
|---|---|
| Frame | `PageLayout` full-bleed strip (catalog list chrome) |
| Toolbar | `PageToolbar`: full-width search + icon actions (`FilterX` + domain icons) |
| Filters | Optional compact row **below** toolbar, right-aligned — not beside search |
| Desktop | `DataTableFrame` + `DataTable` (checkbox · photo · keys · attrs · status · cost? · actions) |
| Row actions | Inline edit icon + Open icon (edit stays in-row) |
| Mobile `&lt;md` | row cards |
| Empty | `EmptyState` (true empty / filter empty) |
| Totals | `ListTotals` only (no duplicate «найдено» in toolbar) |
| Demo | Forbidden as production readiness (ADR / `6.0.2` smoke) |

## Model card (PT-08 + DS-PT-08-CATALOG) — body blocks

Layout etalon: `pt-08-catalog-card-layout.md` / `CatalogVersionedCardLayout`.

| Slot / block | Content | When |
|---|---|---|
| `main` — attributes | article, name, `size_type`, description, status (header) | `6.1.8+` |
| `main` — workspace | composition / links / assembly variants | `6.1.12+` / links after `6.2.7` |
| `media` | photo carousel (primary → list thumb) | `6.1.8+` |
| `versions` | version bar + change history | `6.1.6` / `6.1.8+` |

Assembly variants are **not** a separate PT and **not** a nomenclature-variant UI (ADR-010 / ADR-014).

## Size-grid card (PT-05)

| Section | Content |
|---|---|
| Header | grid name / status / back |
| Primary | meta (name, notes, compatibility with `size_type`) |
| Secondary table | size rows / growth groups (`DataTable` + local x-scroll) |

## Sewing operations list (PT-02)

Flat catalog — no dedicated PT-08 card. Create/edit via CreateDrawer + inline row edit on the list (same chrome as product-models list).

| Column / action | Content |
|---|---|
| Наименование | unique name |
| Стоимость | `Numeric` display |
| Actions | edit / delete |

## PRODUCT «доступные модели лекал» (nomenclature card)

| Decision | Detail |
|---|---|
| Template | Keep **existing** nomenclature card composition (reference PT-06 card / HTML ref). Do **not** invent a second card layout. |
| Placement | Section/block on **PRODUCT** only; hidden/disabled for `SERVICE` / `GOODS` / `MATERIAL` (ADR-014). |
| Preferred slot | New subsection on tab **«Основное»** *or* extend planned production-related area — implement in `6.1.11` without changing tab chrome unless needed. |
| UX | Ordered multi-select / link list of `ProductModel`; edit/save via existing block-edit pattern (`BlockActions`). |
| Empty | `EmptyState` + hint to bind models (empty-list order policy = ADR-014 §5). |

## Breakpoints evidence (`6.0.3.4`)

Canonical bands: `breakpoint-tokens.md` / verification matrix `responsive-audit.md`.

| Width | Band | Shell / list / card expectation for Stage 6 UIs |
|---|---|---|
| 1920 | wide desktop | PT-02 table + PT-08 version bar inline |
| 1600 | desktop | same |
| 1440 | desktop | same |
| 1280 | desktop (`xl`) | same |
| 1024 | laptop (`lg`) | section top nav; cards may tighten grids |
| 768 | tablet (`md`) | sidebar compact/expanded; PT-02 table with local x-scroll |
| 390 | mobile (`&lt;md`) | sidebar hidden; PT-02 **row cards**; PT-05/08 single column; version bar local scroll |

Feature iterations must re-check this matrix when closing visual microtasks (`6.1.7.5`, `6.1.8.5`, `6.1.12.6`, `6.2.4.5`, …). This document only **records** the target breakpoints — it does not close those visual items.

## Out of scope

- Implementing list/card feature UIs
- Changing DS-SHELL-01 / DS-SHELL-02
- Stage 7/8/9 document templates
- Pixel parity of nomenclature HTML reference beyond the new block’s fit

## Status

Mapping accepted for roadmap `6.0.3` (`2026-07-22`).  
Canonical catalog etalons promoted in `6.0.3.5` (`2026-07-22`): product-models list/card for directories / sections / categories. Implementation continues at `6.1.*`.
