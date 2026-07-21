# Sport-Lead — Actions Buttons Standardization

**Code:** `SL-ACTIONS-BUTTONS-STD-v1`  
**Contract:** `DS-ACTION-01`  
**Date:** `2026-07-21`  
**Roadmap:** `5.4.2.1`  
**Primitives:** `frontend/components/ui/button.tsx` (`Button`, `IconButton`)  
**Related:** `component-size-tokens.md`, `interaction-tokens.md`, `shell-page-actions-standardization.md`

## Scope

| Microtask | Deliverable |
|---|---|
| `5.4.2.1` | Shared `Button` variants + `IconButton` for square icon-only controls |

## Visual rules

1. Text buttons: `primary` / `secondary` / `ghost` / `danger`.
2. Heights: `compact` 32 / `default` 40 / `spacious` 44 via `h-portal-control-*`.
3. Icon-only: `IconButton` + `size-portal-control-icon` (32); always provide `label` (`aria-label`).
4. Focus: `.portal-focus-ring`; disabled: portal opacity + no pointer events.
5. Create toolbar control uses `Button variant="primary"` (`CreateMenu`).
6. Do not invent slate/blue one-off button skins for new work.

## Migrated consumers (this iteration)

- `create-drawer.tsx` — close via `IconButton`
- `create-menu.tsx` — primary `Button`
- `toast.tsx` — dismiss via `IconButton`

## Verification (owner)

1. Any CreateDrawer — close icon is 32×32 ghost control.
2. Nomenclature «Создать» menu — primary portal button (height 40).
3. Confirm: `DS-SHELL-01 visual contract preserved`, `DS-SHELL-02 visual contract preserved`.

Reply: `5.4.2 visual OK` or list issues.

## Status

Owner confirmation: **`5.4.2 visual OK`** (`2026-07-21`).
