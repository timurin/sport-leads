# Sport-Lead — PT-02 Catalog List (справочники)

**Code:** `SL-PT-02-CATALOG-LIST-v1`  
**Contract:** `DS-PT-02-CATALOG`  
**Date:** `2026-07-22`  
**Parent:** `DS-PT-02` (`pt-02-list-table.md`)  
**Reference page:** `/settings/catalogs/product-models` (`ProductModelsWorkspace`)  
**Related:** `pt-08-catalog-card-layout.md`, `stage-6.0.3-pattern-base-pt-mapping.md`, `DS-PAGE-02`, `DS-TABLE-01`, `DS-ACTION-01`, `responsive-rules.md`

## Purpose

Эталон **списка справочника** в settings-каталогах: разделы, категории, модели и прочие directory lists.  
Новые списки справочников **не копируют** CRM Clients (`/sales/clients`) и не изобретают chrome — берут этот контракт и `ProductModelsWorkspace` как visual/structural reference.

Не заменяет общий PT-02 для CRM/sales lists и не заменяет PT-04 (tree + list).

## When to use

| Use `DS-PT-02-CATALOG` | Use something else |
|---|---|
| Flat directory / catalog list under `/settings/catalogs/…` | CRM list (clients, orgs) → **PT-02** (`/sales/clients`) |
| Sections, categories, product models, size grids, patterns (list) | Tree + list workspace → **PT-04** |
| Mass-select + row actions + inline edit pattern | Kanban → **PT-03** |

## Canonical composition

```
AppShell
  └── [data-app-shell-main]
        └── PageLayout (full-bleed catalog strip)
              ├── PageToolbar
              │     ├── start → full-width search (`Input`)
              │     └── end   → icon cluster (primary `Plus` create · `FilterX` reset · domain toolbar icons)
              ├── Data region
              │     ├── md+: DataTableFrame + DataTable
              │     └── <md: row cards
              ├── EmptyState?
              └── ListTotals
```

No separate `FilterToolbar` strip unless a domain task explicitly adds compact filters.  
No right-rail inspector / quick-preview on catalog lists.

## `DS-PT-02-CATALOG` rules

1. Search lives in `PageToolbar` and uses **maximum available width** (`flex-1` / `w-full`).
2. Reset is an **icon** in the toolbar action cluster (`FilterX`), not a text button in a filter strip.
3. Create is a **primary blue icon** (`Plus` / `IconButton variant="primary"`) opening `CreateDrawer` (ADR-013) — not a text «Создать» button.
4. Optional type/status filters: if present, compact controls **below** toolbar, right-aligned — not beside search.
5. Table columns (etalon order): selection checkbox → photo/thumb → primary keys (article/code) → name → domain attrs → status → optional cost/range placeholder → actions.
6. Row actions: icon **Edit** (inline row edit) + icon **Open** (navigate to card). Edit does **not** navigate away.
7. Mass selection via leading checkbox (header = select all filtered).
8. Mobile `&lt;md`: card stack with the same fields/actions; no page horizontal scroll.
9. Totals via `ListTotals` only — do not duplicate «найдено» next to search.
10. Platform Shell `DS-SHELL-01` / `DS-SHELL-02` unchanged.

## Reference consumers

| Route | Role |
|---|---|
| `/settings/catalogs/product-models` | **Etalon** (API list) |
| `/settings/catalogs/size-grids` | Adopt on `6.2.4` |
| `/settings/catalogs/patterns` | Adopt on `6.3.4` |
| Settings directories / sections / categories lists | Prefer this over Clients PT-02 |
| Older catalog lists (`product-characteristics`, UoM, …) | Migrate toward this chrome when touched |

## Agent / implementer checklist

1. Read this file + parent `pt-02-list-table.md`.
2. Match toolbar / table / mobile / totals slots above.
3. Card route for the same entity uses `DS-PT-08-CATALOG` (versioned) or `DS-PT-05` (simple).
4. Report: template `DS-PT-02-CATALOG`, reference route, breakpoints checked.

## Status

Accepted as catalog-list etalon from product-models (`2026-07-22`, roadmap `6.0.3.5`). Owner visual `6.1.7.5` OK (`2026-07-22`).
