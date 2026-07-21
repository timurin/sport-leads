# Sport-Lead — Shared Loading and Error Boundaries

**Code:** `SL-SHELL-PAGE-STATE-STD-v1`  
**Contract:** `DS-PAGE-06`  
**Date:** `2026-07-21`  
**Roadmap:** `5.3.2.6`  
**Primitives:** `frontend/components/ui/page-state.tsx`  
**Related:** `docs/design-system/ui-audit.md` § Loading / error / empty

## Scope

Add shared workspace loading/error/not-found surfaces and wire route boundaries. Empty-state adoption remains mostly `5.4.2.5`.

## Shared primitives

| Export | Use |
|---|---|
| `PageLoadingState` | Default pulse skeleton for `loading.tsx` |
| `PageErrorState` | Error panel with standard **`reset`** retry |
| `PageNotFoundState` | Segment `not-found.tsx` panel |

Composition uses `PageLayout` + `PageContent` (`DS-PAGE-01`).

## Route wiring

| Location | File | Notes |
|---|---|---|
| Workspace | `app/(workspace)/loading.tsx` | Covers catalogs / settings / sales without local loading |
| Workspace | `app/(workspace)/error.tsx` | Shared catch-all; uses `reset` |
| Order detail | loading + error → shared primitives | |
| Lead detail | error → shared `PageErrorState` + `reset` (was `unstable_retry`) | Lead skeleton loading kept (domain) |
| Nomenclature card | `not-found.tsx` + `getNomenclatureById` returns `null` on HTTP 404 | `notFound()` now reachable |

## `DS-PAGE-06` rules

1. New segment boundaries use shared primitives (or domain skeleton that still calls `reset` for errors).
2. Retry API is **`reset`** — do not introduce `unstable_retry` for new boundaries.
3. Persistent loaders must map HTTP 404 → `notFound()`, not a thrown generic error, when the resource is missing.
4. Do not silently replace API failures with demo data.
5. Domain-specific chrome (lead skeleton, nomenclature card layout) may wrap or sit beside shared states, but error retry stays `reset`.

## Out of scope here

- Full `EmptyState` migration across lists (`5.4.2.5`)
- Per-list `loading.tsx` for every demo sales board
- Fixing product-characteristics parallel shell (scroll debt)

## Verification

1. Break a catalog fetch (stop API) — workspace/error UI with «Повторить».
2. Open unknown nomenclature id — not-found panel, not default Next error.
3. Lead/order detail errors — retry via `reset`.
4. Confirm shell contracts preserved (states render inside AppShell).

## Status

Shipped for `5.3.2.6`. Owner functional spot-check recommended (API down + bad nomenclature id).
