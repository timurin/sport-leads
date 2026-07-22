# Sport-Lead — PT-02 List/Table Workspace

**Code:** `SL-PT-02-LIST-TABLE-v1`  
**Contract:** `DS-PT-02`  
**Date:** `2026-07-21`  
**Roadmap:** `5.5.2.1`–`5.5.2.4`  
**Reference page:** `/sales/clients` (`ClientsTable`)  
**Related:** `DS-PAGE-01`…`04`, `DS-TABLE-01`, `DS-FILTER-01`, `DS-LIST-01`, `DS-FEEDBACK-02`, `responsive-rules.md`, `ui-audit.md` (R3)

## Scope

Define the **list/table workspace** template (PT-02): page frame, toolbar, optional metrics, filters, table, totals/pagination, and responsive table behaviour. Reference is Clients (demo). Persistence migration is later; EntityWorkspace orgs/employees remain provisional until dedicated workspaces.

Does **not** own: tree+list (PT-04), kanban (PT-03), entity cards (PT-05/06).

## Canonical composition

```
AppShell
  └── [data-app-shell-main]
        └── PageLayout                         ← DS-PAGE-01
              ├── PageToolbar?                 ← DS-PAGE-02 (create / primary actions)
              ├── Metrics strip?               ← ResponsiveGrid + MetricCard (optional)
              ├── FilterToolbar                ← DS-FILTER-01 (strip default)
              ├── Data region
              │     ├── md+: DataTableFrame + DataTable   ← DS-TABLE-01 (local x-scroll)
              │     └── <md: row cards stack              ← responsive fallback
              ├── EmptyState?                  ← filter/true empty inside data region
              ├── ListTotals                   ← DS-LIST-01
              └── Pagination?                  ← when pageSize exceeded
```

`PageContent` is optional. Dense CRM lists may stay **full-bleed** under `PageLayout` (no content max-width / no extra outer padding) so toolbar, filter strip, and table share one edge-to-edge chrome — same as the approved Clients look.

## `DS-PT-02` rules

1. New list/table pages wrap in `PageLayout`. Prefer full-bleed strip chrome for CRM/catalog lists; use `PageContent width="wide"` only when the list is a padded settings panel.
2. Tables use `DataTable` / `DataTableFrame` (`DS-TABLE-01`) — no ad-hoc `<table>` skins for new work.
3. Filters use `FilterToolbar` + `Input` / `Select` / `Button` (`DS-FORM-01`, `DS-ACTION-01`).
4. Totals and paging use `ListTotals` / `Pagination` (`DS-LIST-01`).
5. Empty filter or empty catalog uses `EmptyState` (`DS-FEEDBACK-02`).
6. Optional summary metrics use `MetricCard` / `ResponsiveGrid` — not one-off stat tiles.
7. Create: persistent entities → `CreateDrawer` (ADR-013); demo pages may keep `DemoCreateDrawer`.
8. Demo data stays labeled; do not invent persistence in this template.
9. Platform Shell `DS-SHELL-01` / `DS-SHELL-02` unchanged.
10. Do not treat blank EntityWorkspace empties as the visual reference (`ui-audit.md`).

## Slots

| Slot | Required | Primitive |
|---|---|---|
| Page frame | yes | `PageLayout` |
| Page toolbar | recommended | `PageToolbar` + `PageActions` / `Button` |
| Metrics | optional | `ResponsiveGrid` + `MetricCard` |
| Filters | recommended | `FilterToolbar` |
| Desktop table | yes (md+) | `DataTableFrame` + `DataTable` |
| Mobile rows | yes (&lt;md) | card stack (same row fields, no page x-scroll) |
| Empty | when no rows | `EmptyState` |
| Totals | recommended | `ListTotals` |
| Pagination | when needed | `Pagination` |

## Responsive table rules (`5.5.2.3`)

Addresses deferred **R3** (wide tables) for PT-02:

| Band | Behaviour |
|---|---|
| Desktop / laptop (`md+`) | Table visible; wide tables keep `min-w-*` **inside** `DataTableFrame` (`overflow-x-auto` only). No document horizontal scroll. |
| Tablet (`md`–`lg`) | Same as desktop; local x-scroll OK. |
| Mobile (`&lt;md`) | Hide wide table; show **one card per row** with primary fields + status. Filter fields stack **full width**. |
| Totals / pagination | Always full width under the data region; controls wrap via existing primitives. |

Additional:

1. Every flex/grid child with data: `min-w-0`.
2. Sticky table head stays inside the local scroll owner (`z-portal-raised`).
3. Verification widths: 1920, 1600, 1440, 1280, 1024, 768, 390.

## Reference consumers

- `/sales/clients` — `frontend/components/tables/clients-table.tsx` (**PT-02 reference**)

Secondary adopters (migrate later, not required to close `5.5.2`): product-characteristics list, custom-fields, organizations EntityWorkspace.

## Verification (owner)

1. `/sales/clients` — toolbar, metrics, filters, table, totals/pagination, empty filters.
2. Resize 1920 → 390 — no page horizontal overflow; mobile cards below `md`.
3. Demo create drawer still opens; demo data unchanged.
4. `DS-SHELL-01 visual contract preserved`, `DS-SHELL-02 visual contract preserved`.

Reply: `5.5.2 visual OK` or list issues.

## Status

Contract + reference layout + responsive table rules shipped for `5.5.2.*`. Owner confirmation: **`5.5.2 visual OK`** (`2026-07-22`). Mobile full-width filter/toolbar fields confirmed (clients + orders/kanban toolbar).
