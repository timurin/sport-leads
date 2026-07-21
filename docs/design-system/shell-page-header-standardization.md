# Sport-Lead — Page Header / PageToolbar Standardization

**Code:** `SL-SHELL-PAGE-HEADER-STD-v1`  
**Contract:** `DS-PAGE-02`  
**Date:** `2026-07-21`  
**Roadmap:** `5.3.2.2` (title: Standardize PageHeader)  
**Canonical component:** `PageToolbar` in `frontend/components/ui/page-header.tsx`  
**Related:** `shell-contracts.md` (Topbar vs Page Toolbar), `shell-page-layout-standardization.md` (`DS-PAGE-01`), `spacing-tokens.md`

## Product naming

Roadmap item says **PageHeader**. Product decision (`2026-07-21`): page chrome is a **toolbar without title/description**.

| Name | Status |
|---|---|
| `PageToolbar` | **Canonical** |
| `PageHeader` | Deprecated compatibility alias → `PageToolbar` |

Page / entity titles live in page body or domain headers (`EntityHeader`, card headers) — not in the page toolbar and not in Platform Topbar.

## Scope

Tokenize and lock the page toolbar chrome **without redesign**:

- surfaces/borders → `bg-portal-surface`, `border-portal-border`
- padding → `px-portal-4 py-portal-3 sm:px-portal-6` (same 16 / 12 / 24 px as before)
- gaps → `gap-portal-2|3|4`
- actions row → shared `PageActions`
- `data-page-toolbar` marker

Does **not** own: Platform Topbar (`DS-SHELL-02`), `PageLayout` (`DS-PAGE-01`), action button semantics (`5.3.2.3`), domain card headers.

## Composition

```
PageLayout
  ├── PageToolbar          ← DS-PAGE-02; full-bleed under topbar
  │     ├── start          ← search / filters / view / chips
  │     └── end            ← page actions (CreateMenu, buttons, …)
  └── PageContent          ← DS-PAGE-01 body
```

## `DS-PAGE-02` rules

1. Use `PageToolbar` for page-local chrome; never invent a second global topbar.
2. **No** page title / description / breadcrumbs in `PageToolbar`.
3. **No** platform section navigation, global Search, or global Create in `PageToolbar` (those stay in `DS-SHELL-02`).
4. Allowed: local search, filters, view modes, status chips, list/entity actions (create/delete/export via page menus such as `CreateMenu` / `CreateDrawer`).
5. Toolbar is full-bleed (not inside `PageContent` max-width).
6. Empty toolbar (`!start && !end`) renders nothing.
7. Do not add page-level `h-screen` / `overflow-y-auto` on the toolbar root.
8. Visual changes to padding/border/surface need an explicit product task.

## Unchanged behaviour

- Existing consumers (nomenclature workspace, kanban, leads, clients, section create host) keep the same layout slots (`start` / `end`).
- Pixel padding/gaps preserved via portal token mapping.
- `PageHeader` alias still works for any residual imports.

## Smoke consumers

- `frontend/components/settings/nomenclature-workspace.tsx`
- `frontend/components/settings/nomenclature-section-create-host.tsx`
- `frontend/components/kanban/kanban-page.tsx`
- `frontend/components/sales/lead-workspace.tsx`
- `frontend/components/tables/clients-table.tsx`

## Verification

1. Nomenclature list — toolbar with create menu; no title block.
2. Kanban / leads — search/filters in `start`, actions in `end`.
3. Topbar remains the only platform nav chrome.
4. Confirm: `DS-SHELL-01 visual contract preserved`, `DS-SHELL-02 visual contract preserved`.

## Status

Primitive + contract shipped for `5.3.2.2`. No redesign expected.
