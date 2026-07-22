# Sport-Lead — PT-05 Simple Entity Card

**Code:** `SL-PT-05-SIMPLE-ENTITY-CARD-v1`  
**Contract:** `DS-PT-05`  
**Date:** `2026-07-22`  
**Roadmap:** `5.5.5.1`–`5.5.5.4`  
**Reference page:** `/settings/catalogs/product-characteristics/[characteristicId]` (`CharacteristicCard`)  
**Related:** `DS-PAGE-01`…`04`/`06`, `DS-FORM-01`, `DS-ACTION-01`, `DS-BADGE-01`, `DS-TABLE-01`, `DS-FEEDBACK-02`, inventory **D6**/**D9**, `responsive-rules.md`

## Scope

Define the **simple entity card** template (PT-05): page frame, entity header, one or more content sections (form / table), empty/not-found, and responsive single-column collapse. Reference is Product Characteristic detail (persistent).

Does **not** own: complex CRM cards with stages/activity (PT-06), document cards (PT-07), list workspaces (PT-02), `EntityWorkspace` right inspector (create UX эталон only — ADR-013).

### Reference note (roadmap vs inventory)

Roadmap `5.5.5.4` names «organization or client». Those routes today are **list/inspector demos** (`EntityWorkspace`) without a dedicated card page (`2.2.2` client card still open). **Factual PT-05 reference** = characteristic detail after local-sidebar removal (R1 / D9). Org/client adopt this contract when dedicated cards appear.

## Canonical composition

```
AppShell
  └── [data-app-shell-main]
        └── PageLayout
              └── PageContent (width="wide")
                    └── SimpleEntityCard
                          ├── EntityHeader     ← title / status / back actions
                          └── sections stack
                                ├── SectionCard (main attributes / form)
                                └── SectionCard (related list / options table)
```

No local sidebar. No page-local `h-screen` / competing scroll. Platform Shell only.

## `DS-PT-05` rules

1. Wrap in `PageLayout` → `PageContent` (`width="wide"` default for settings cards).
2. Header uses `EntityHeader` (`DS-PAGE` entity chrome) — not Platform Topbar titles (D6).
3. Body sections use `SectionCard` — no parallel `product-characteristics-card` skins on new work.
4. Forms: `Field` / `Input` / `Select` / `Checkbox` + `Button` (`DS-FORM-01`, `DS-ACTION-01`).
5. Status: `StatusBadge` (`DS-BADGE-01`).
6. Related tabular blocks: `DataTable` / `DataTableFrame` with **local** x-scroll; empty → `EmptyState`.
7. Missing entity: `notFound()` + segment `not-found.tsx` (`PageNotFoundState`) — no inline «не найдена» stub.
8. Never reintroduce a local sticky sidebar / `100vh` rail (D9 / R1).
9. Platform Shell `DS-SHELL-01` / `DS-SHELL-02` unchanged.

## Slots

| Slot | Required | Primitive |
|---|---|---|
| Page frame | yes | `PageLayout` + `PageContent` |
| Card frame | yes | `SimpleEntityCard` |
| Header | yes | `EntityHeader` |
| Primary section | yes | `SectionCard` (+ form) |
| Secondary section | optional | `SectionCard` (+ table / list) |
| Empty related | when no rows | `EmptyState` |
| Not found | route | `PageNotFoundState` |

## Responsive layout (`5.5.5.3`)

| Band | Behaviour |
|---|---|
| Desktop (`lg+`) | Header row: title left, actions right; form fields multi-col when comfortable |
| Tablet (`md`–`lg`) | Header may wrap; form 2 cols where safe |
| Mobile (`&lt;md`) | Single column; full-width actions; table keeps local x-scroll only |

Additional:

1. Every flex/grid child with data: `min-w-0`.
2. No document horizontal overflow.
3. Verification widths: 1920…390.

## Reference consumers

- `/settings/catalogs/product-characteristics/[characteristicId]` — **PT-05 reference**

Future adopters: organization card, client card (`2.2.2`), **size-grid card** (`6.2.5`, see `stage-6.0.3-pattern-base-pt-mapping.md`), other simple settings entities.

## Verification (owner)

1. Open a characteristic card — header, main form save, options table, add option.
2. Invalid id → shared not-found (not inline stub).
3. Resize 1920 → 390 — single column; table scrolls locally; no page overflow; **no local sidebar**.
4. `DS-SHELL-01 visual contract preserved`, `DS-SHELL-02 visual contract preserved`.

Reply: `5.5.5 visual OK` or list issues.

## Status

Contract shipped for `5.5.5.*`. Owner confirmation: **`5.5.5 visual OK`** (`2026-07-22`).
