# Sport-Lead — PT-03 Kanban Workspace

**Code:** `SL-PT-03-KANBAN-v1`  
**Contract:** `DS-PT-03`  
**Date:** `2026-07-22`  
**Roadmap:** `5.5.3.1`–`5.5.3.4`  
**Reference page:** `/sales/leads` (`LeadWorkspace` + shared `KanbanBoard`)  
**Secondary:** `/sales/orders` (`KanbanPage`)  
**Related:** `DS-PAGE-01`…`04`, `DS-FILTER-01`, `DS-FEEDBACK-01`/`02`, inventory **D4**, `responsive-rules.md`, R2

## Scope

Define the **kanban workspace** template (PT-03): page frame, toolbar/filters, metrics, board chrome, empty/error, and mobile behaviour. Reference is Leads Kanban (persistent). Orders/tasks reuse the same board primitives.

Does **not** own: full merge of `LeadWorkspace` domain dialogs into `KanbanPage` (D4 continues incrementally), lead/order card templates (PT-06/07).

## Canonical composition

```
AppShell
  └── [data-app-shell-main]
        └── PageLayout
              ├── PageToolbar              ← view chips / search / filters / create
              ├── InlineAlert?             ← loadError / data-origin / move errors
              ├── Metrics strip            ← ResponsiveGrid + MetricCard
              └── Board region
                    └── KanbanBoard        ← local overflow-x-auto (DS-PT-03)
                          └── KanbanColumn[] ← fixed column width, portal surface
                                └── KanbanCard
```

Domain overlays (create drawer/dialog, stage settings, completion) are **siblings** of the page body — not inside columns.

## `DS-PT-03` rules

1. New kanban pages wrap in `PageLayout` (full-bleed; no content max-width).
2. Shared board primitives: `KanbanBoard`, `KanbanColumn`, `KanbanCard` — do not fork a second board framework (D4).
3. Page chrome: `PageToolbar` + portal form controls / `Button`; mobile fields stretch full width (`DS-PAGE-02` / PT-02 pattern).
4. Metrics: `ResponsiveGrid` + `MetricCard` — not one-off slate tiles.
5. Board empty (no cards after filter): shared `EmptyState`.
6. Load/move errors: `InlineAlert` (`DS-FEEDBACK-01`); keep board chrome when possible.
7. Horizontal scroll of columns is **local only** (`overflow-x-auto` on the board region) — never on `document` / page root.
8. Demo boards (tasks/deals) may keep `DemoCreateDrawer`; persistent leads use real create flows.
9. Platform Shell `DS-SHELL-01` / `DS-SHELL-02` unchanged.

## Slots

| Slot | Required | Primitive |
|---|---|---|
| Page frame | yes | `PageLayout` |
| Toolbar | yes | `PageToolbar` |
| Metrics | recommended | `ResponsiveGrid` + `MetricCard` |
| Board | yes | `KanbanBoard` |
| Column | yes | `KanbanColumn` |
| Empty board | when filtered empty | `EmptyState` |
| Alerts | when needed | `InlineAlert` |
| Domain dialogs | optional | create / settings / completion |

## Board structure (`5.5.3.2`)

1. Column width: fixed shrink-0 track (`~310px`) so many stages scroll horizontally.
2. Column surface: `bg-portal-surface-secondary`, `border-portal-border`, `rounded-portal-lg`.
3. Drop-over: primary soft border/background (`border-portal-primary`, `bg-portal-primary-soft`).
4. Column header: title + count badge; optional amount metric.
5. Cards: existing `KanbanCard` chrome; drag via shared sensors.
6. Empty column: compact `EmptyState` inside the column body.

## Mobile fallback (`5.5.3.3`) — addresses R2

| Band | Behaviour |
|---|---|
| Desktop / laptop | Multi-column board; local x-scroll if stages exceed viewport |
| Tablet | Same; board remains the scroll owner |
| Mobile (`&lt;md`) | **Keep horizontal board** with local `overflow-x-auto` + optional `scroll-snap-x` on columns; toolbar filters stack full width; do **not** invent a second page scrollbar |

Additional:

1. Board wrapper: `min-w-0`, `overflow-x-auto`, `-webkit-overflow-scrolling: touch`.
2. Columns: `snap-start` when snap is enabled.
3. Verification: 1920…390 — no document horizontal overflow; board scrolls locally.

## Reference consumers

- `/sales/leads` — **PT-03 reference** (`LeadWorkspace`)
- `/sales/orders` — `KanbanPage` (same board chrome)

## Verification (owner)

1. `/sales/leads` — toolbar, metrics, columns, drag, empty filter, load alert.
2. 390px — full-width toolbar fields; board x-scrolls locally; no page overflow.
3. `/sales/orders` smoke — same board chrome.
4. `DS-SHELL-01 visual contract preserved`, `DS-SHELL-02 visual contract preserved`.

Reply: `5.5.3 visual OK` or list issues.

## Status

Contract + board standardization + mobile fallback shipped for `5.5.3.*`. Owner confirmation: **`5.5.3 visual OK`** (`2026-07-22`).
