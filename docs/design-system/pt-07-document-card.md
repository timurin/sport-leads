# Sport-Lead — PT-07 Document Card

**Code:** `SL-PT-07-DOCUMENT-CARD-v1`  
**Contract:** `DS-PT-07`  
**Date:** `2026-07-22`  
**Roadmap:** `5.5.7.1`–`5.5.7.6`  
**Reference page:** `/sales/orders/[orderId]` (`SalesOrderPage` + `SalesOrderHeader`)  
**Related:** `DS-PAGE-01`…`04`, `DS-TABLE-01`, `DS-LIST-01`, `DS-TIMELINE-01`, `DS-BADGE-01`, inventory **D6**, `responsive-rules.md`

## Scope

Define the **document card** template (PT-07): page frame, document header (number / title / status / meta), attribute blocks, tabular line sections, totals footer, related links, history feed, and responsive collapse. Reference is Customer Order Card.

Does **not** own: simple settings cards (PT-05), complex CRM cards with stages/workspace tabs (PT-06), list workspaces (PT-02), print/PDF layouts.

## Canonical composition

```
AppShell
  └── [data-app-shell-main]
        └── PageLayout
              └── PageContent (width="full", size="compact")
                    └── DocumentCard
                          ├── Document header slot   ← SalesOrderHeader (`data-document-header`)
                          └── body sections stack
                                ├── SectionCard (attributes / DataList)
                                ├── SectionCard (relations)
                                ├── SectionCard (line items + ListTotals footer)
                                ├── SectionCard (notes / description)
                                └── SectionCard (history → ActivityTimeline)
```

## `DS-PT-07` rules

1. Wrap in `PageLayout` → `PageContent` (`width="full"`, `size="compact"` for document density).
2. Header uses `EntityHeader` inside a portal surface shell — not Platform Topbar titles (D6).
3. Body sections use `SectionCard` — no one-off `rounded-[var(--portal-radius-md)]` stacks on new work.
4. Line items live in a dedicated `SectionCard`; editable grids use local `overflow-x-auto` + `min-w-0` (no document overflow).
5. Document totals: `ListTotals` in section **footer** (position count + document amount).
6. History / audit: `ActivityTimeline` (`DS-TIMELINE-01`) — no second timeline markup.
7. Status: `StatusBadge` (`DS-BADGE-01`).
8. Missing document: `notFound()` + segment `not-found.tsx` (`PageNotFoundState`).
9. Platform Shell `DS-SHELL-01` / `DS-SHELL-02` unchanged.

## Slots

| Slot | Required | Primitive |
|---|---|---|
| Page frame | yes | `PageLayout` + `PageContent` |
| Card frame | yes | `DocumentCard` |
| Header | yes | domain header (`SalesOrderHeader`) |
| Attributes | yes | `SectionCard` + `DataList` |
| Relations | optional | `SectionCard` + `EntityLink` |
| Line items | yes | `SectionCard` (+ forms / table) |
| Totals | yes | `ListTotals` in items section footer |
| Notes | optional | `SectionCard` |
| History | recommended | `SectionCard` + `ActivityTimeline` |

## Document header (`5.5.7.2`)

1. Back link to list workspace.
2. Title + status badge; meta row: document number, amount, dates.
3. Primary document actions (when added) use `PageActions` on the header shell.

## Tabular section (`5.5.7.3`)

1. Line items grouped in one `SectionCard` with titled header.
2. Each line may be an editable grid (reference) or read-only `DataTable` — share one section shell.
3. Create row / actions at section bottom; status messages via `role="status"`.

## Totals and actions (`5.5.7.4`)

1. Footer strip: line count + document total amount (`ListTotals`).
2. Per-line save/delete remain on row forms until a dedicated row-actions pattern ships.

## Responsive behaviour (`5.5.7.5`)

| Band | Behaviour |
|---|---|
| Desktop (`lg+`) | Header row; attribute `DataList` multi-column; line forms use wide grid |
| Tablet (`md`–`lg`) | Sections stack; line grids wrap |
| Mobile (`&lt;md`) | Single column; line item forms scroll **locally** (`overflow-x-auto`); full-width buttons |

Verification widths: 1920…390.

## Reference consumers

- `/sales/orders/[orderId]` — **PT-07 reference**

## Verification (owner)

1. Open a customer order — header, attributes, source lead link, line items, totals footer, history.
2. Invalid id → shared not-found.
3. Resize 1920 → 390 — no page overflow; line section scrolls locally.
4. `DS-SHELL-01 visual contract preserved`, `DS-SHELL-02 visual contract preserved`.

Reply: `5.5.7 visual OK` or list issues.

## Status

Contract + Customer Order Card standardization shipping for `5.5.7.*`. Owner confirmation for `5.5.7.6` pending.
