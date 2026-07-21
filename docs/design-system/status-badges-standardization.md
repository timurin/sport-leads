# Sport-Lead — Status Badges Standardization

**Code:** `SL-STATUS-BADGES-STD-v1`  
**Contract:** `DS-BADGE-01`  
**Date:** `2026-07-21`  
**Roadmap:** `5.4.2.2`  
**Primitive:** `frontend/components/ui/status-badge.tsx`  
**Related:** `color-tokens.md`, `component-size-tokens.md`

## Scope

Unify status chips on entity cards, lists and kanban.

## Visual rules

1. Tones: `neutral` | `primary` | `success` | `warning` | `danger`.
2. Sizes: `compact` | `default`; radius `rounded-portal-full`.
3. Optional `dot` for stage/status emphasis.
4. Kanban legacy tones map: blue/violet→primary, amber→warning, emerald→success, red→danger, slate→neutral.

## Migrated consumers (this iteration)

- `kanban-card.tsx`
- `clients-table.tsx`
- `sales-order-page.tsx`
- `lead-header.tsx` (stage badge)
- `custom-fields-workspace.tsx` (active/disabled)

## Verification (owner)

1. `/sales/leads` — card badges use portal soft tones.
2. `/sales/clients` — status column uses `StatusBadge`.
3. Lead card header stage badge + order header status.

Reply with section visual result under `5.4.2 visual OK`.

## Status

Owner confirmation: **`5.4.2 visual OK`** (`2026-07-21`).
