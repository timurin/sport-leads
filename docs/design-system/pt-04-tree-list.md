# Sport-Lead — PT-04 Tree + List Workspace

**Code:** `SL-PT-04-TREE-LIST-v1`  
**Contract:** `DS-PT-04`  
**Date:** `2026-07-22`  
**Roadmap:** `5.5.4.1`–`5.5.4.4`  
**Reference page:** `/settings/catalogs/nomenclature` (`NomenclatureWorkspace`)  
**Related:** `DS-PAGE-01`…`04`, `DS-FILTER-01`, `DS-TABLE-01`, `DS-FEEDBACK-02`, inventory **D5**, `responsive-rules.md`, R5

## Scope

Define the **tree + list workspace** template (PT-04): page frame, toolbar, collapsible tree pane, content pane (filters + table), empty state, and responsive tree drawer. Reference is Nomenclature Workspace (persistent).

Does **not** own: plain list/table without tree (PT-02), nomenclature entity card (PT-06), create-panel domain fields (ADR-013 `CreateDrawer` stays create-only). Does **not** adopt `EntityWorkspace` / `EntityTable` (materials remains create-inspector UX эталон only).

## Canonical composition

```
AppShell
  └── [data-app-shell-main]
        └── PageLayout
              ├── PageToolbar              ← tree toggle / selection summary / create
              └── TreeListSplit            ← flex row; tree optional
                    ├── TreePane (lg+, if open)  ← docked left column + close
                    ├── TreeDrawer (<lg, if open) ← same TreePane as overlay (R5)
                    └── TreeListContent
                          ├── FilterToolbar (strip)
                          └── DataTableFrame (flush) + DataTable (+ EmptyState)
```

Create overlays (`NomenclatureCreatePanels` / `CreateDrawer`) are **siblings** of the split — not inside the tree column.

## `DS-PT-04` rules

1. New tree+list pages wrap in `PageLayout` (full-bleed; no content max-width).
2. Shared split primitives: `TreeListSplit`, `TreePane`, `TreeListContent` — do not fork a second tree chrome (D5 dedicated workspaces). `TreeListSplit` takes `renderTree({ onClose })` so docked and drawer each mount their own instance.
3. Tree is **collapsible** on all bands (materials-like show/hide): toolbar «Группы» toggles; pane `X` / Escape closes. Default open.
4. Tree surface docked: flush column (`border-r`, no card shadow). Selected node: `bg-portal-primary-soft` + `text-portal-primary`.
5. Content filters: `FilterToolbar` **strip** (not card) + `Input` / `Select` / `Checkbox` / `Button`.
6. Content table: flush `DataTableFrame` (no rounded card chrome) + `DataTable` (`DS-TABLE-01`); empty → `EmptyState`.
7. Below `lg`, open tree uses **left** overlay drawer (`z-portal-modal-1`). Selecting a node closes the drawer on narrow viewports only.
8. Platform Shell `DS-SHELL-01` / `DS-SHELL-02` unchanged.

## Slots

| Slot | Required | Primitive |
|---|---|---|
| Page frame | yes | `PageLayout` |
| Toolbar | yes | `PageToolbar` |
| Tree toggle | yes | `Button` in toolbar (`aria-pressed`) |
| Tree pane | yes (when open) | `TreePane` `variant="dock"` |
| Tree drawer | yes (&lt;lg when open) | `TreeListSplit` drawer mode |
| Content | yes | `TreeListContent` |
| Filters | recommended | `FilterToolbar` `variant="strip"` |
| Table | yes | flush `DataTableFrame` + `DataTable` |
| Empty | when no rows | `EmptyState` |
| Create | optional | `CreateDrawer` / domain panels |

## Tree + content panes (`5.5.4.2`)

1. Desktop (`lg+`): optional docked column `w-[280px]` + `minmax(0,1fr)` list; both `min-w-0`.
2. Tree pane: header (title + count + close), scrollable body, optional footer (edit group).
3. Content pane: strip filters then flush table; local table x-scroll only inside `DataTableFrame`.
4. Vertical scroll owner remains `[data-app-shell-main]` — do not add page-root `h-screen` / nested page scroll.

## Responsive tree drawer (`5.5.4.3`) — addresses R5

| Band | Behaviour |
|---|---|
| Desktop / laptop (`lg+`) | Collapsible docked `TreePane`; list expands when closed |
| Tablet / mobile (`&lt;lg`) | Overlay left drawer when open; toolbar toggle; backdrop / Escape / select closes |
| Content | Always visible; filters stack full width below `md` (PT-02 pattern) |

Additional:

1. Drawer panel: `fixed inset-y-0 left-0`, `max-w-[min(100%,320px)]`, `z-portal-modal-1`, `shadow-portal-overlay`.
2. Backdrop: `bg-slate-950/40`, click closes.
3. Verification: 1920…390 — no document horizontal overflow; tree usable on 390 via drawer.

## Reference consumers

- `/settings/catalogs/nomenclature` — **PT-04 reference** (`NomenclatureWorkspace`)

Secondary (migrate later): other catalog trees if introduced — reuse `TreeListSplit` / `TreePane`.

## Verification (owner)

1. `/settings/catalogs/nomenclature` — toolbar toggle, tree close, filters strip, flush table, create panels.
2. `lg+` — open/close docked tree; list goes full width when closed; select keeps tree open.
3. 1024 / 768 / 390 — drawer open/close; select closes; no page overflow.
4. Compare list chrome to materials (full-bleed table feel) without switching to `EntityWorkspace`.
5. `DS-SHELL-01 visual contract preserved`, `DS-SHELL-02 visual contract preserved`.

Reply: `5.5.4 visual OK` or list issues.

## Status

Contract + collapsible dock + flush list chrome shipped for `5.5.4.*`. Owner confirmation: **`5.5.4 visual OK`** (`2026-07-22`).
