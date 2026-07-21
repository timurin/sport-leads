# Sport-Lead — Loading, Empty and Error States (in-page)

**Code:** `SL-EMPTY-ERROR-STD-v1`  
**Contract:** `DS-FEEDBACK-02` (in-page) + `DS-PAGE-06` (route)  
**Date:** `2026-07-21`  
**Roadmap:** `5.4.2.5`  
**Primitives:** `empty-state.tsx`, `inline-alert.tsx`, `page-state.tsx`  
**Related:** `shell-page-state-boundaries.md`

## Scope

Adopt shared empty/error surfaces beyond route boundaries from `5.3.2.6`.

| Case | Primitive |
|---|---|
| Route loading / error / not-found | `PageLoadingState` / `PageErrorState` / `PageNotFoundState` (`DS-PAGE-06`) |
| True empty or filter empty list | `EmptyState` |
| In-page load / move failure with context | `InlineAlert` or `EmptyState` with description |

## Migrated consumers (this iteration)

- Kanban column empty → `EmptyState`
- Kanban page `loadError` → `EmptyState`
- Clients filter empty → `EmptyState`
- Custom fields empty catalog → `EmptyState`

## Remaining (later templates / lists)

Broader list/table empty adoption continues with `5.4.3` / page templates. Topbar search empty stays shell-sensitive.

## Verification (owner)

1. Empty kanban column shows dashed `EmptyState`.
2. Clients with filters that match nothing — shared empty panel.
3. Custom fields with zero definitions — empty + hint to use Create menu.

## Status

Owner confirmation: **`5.4.2 visual OK`** (`2026-07-21`).
