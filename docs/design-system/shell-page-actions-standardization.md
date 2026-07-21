# Sport-Lead — Page Actions Standardization

**Code:** `SL-SHELL-PAGE-ACTIONS-STD-v1`  
**Contract:** `DS-PAGE-03`  
**Date:** `2026-07-21`  
**Roadmap:** `5.3.2.3`  
**Component:** `PageActions` in `frontend/components/layout/page-layout.tsx`  
**Related:** `PageToolbar` (`DS-PAGE-02`), `CreateMenu`, `ActionMenu`, `Button` (`5.4.2.1`)

## Scope

Lock the **action row primitive** used in toolbars, entity headers, and section cards:

- wrap + align rules for `PageActions`
- slot ownership vs create/overflow menus
- **no button visual redesign** (belongs to `5.4.2.1`)

## `DS-PAGE-03` rules

1. Group sibling page/section actions in `PageActions` (not ad-hoc flex without wrap).
2. Alignment:
   - `start` — always left
   - `end` — left on mobile, right from `sm` (**default**)
   - `between` — stacked start on mobile; space-between from `sm`
3. Gap is always `gap-portal-2`.
4. `PageToolbar.end` must use `PageActions` (already wired).
5. Multi-entity create → `CreateMenu` inside `PageActions` / toolbar `end`.
6. Overflow / secondary icon actions → `ActionMenu` inside the same row.
7. Destructive actions use `Button variant="danger"` (semantics only; styling owned by `5.4.2.1`).
8. Do not place platform global Create (topbar) inside page action rows.

## Markers

- `data-page-actions`
- `data-page-actions-align={start|end|between}`

## Smoke consumers

- `PageToolbar`, `EntityHeader`, `SectionCard`, lead header / page footers

## Status

Contract shipped for `5.3.2.3`. Owner visual check not required (layout behaviour unchanged).
