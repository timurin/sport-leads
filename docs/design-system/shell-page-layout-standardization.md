# Sport-Lead — PageLayout Standardization

**Code:** `SL-SHELL-PAGE-LAYOUT-STD-v1`  
**Contract:** `DS-PAGE-01`  
**Date:** `2026-07-21`  
**Roadmap:** `5.3.2.1`  
**Component:** `frontend/components/layout/page-layout.tsx`  
**Related:** `content-width-tokens.md`, `spacing-tokens.md`, `layout-scrolling-audit.md`, `shell-contracts.md`

## Scope

Standardize the **page frame inside AppShell** (not sidebar/topbar):

- introduce `PageLayout` as the page-root wrapper;
- keep `PageContent` as the width + padding body;
- lock density / width variants to portal tokens;
- document composition with `PageToolbar` and scroll ownership;
- **no visual redesign** of existing domain pages; mass migration is later (`5.3.2.4`, PT templates).

Does **not** own: `PageToolbar` / headers (`5.3.2.2` → `DS-PAGE-02`), action semantics (`5.3.2.3`), content cards (`5.3.2.4`), scroll enforcement pass (`5.3.2.5`), loading/error boundaries (`5.3.2.6`).

## Canonical composition

```
AppShell
  └── [data-app-shell-main]          ← sole primary vertical scroll
        └── PageLayout               ← data-page-layout; min-w-0 w-full
              ├── PageToolbar?       ← optional; full bleed under topbar
              └── PageContent        ← data-page-content; mx-auto + padding + max-width
                    └── page body
```

Create flows use shared `CreateDrawer` (ADR-013) as overlays/docked panels — they are **siblings of page content**, not children that redefine page width.

## `DS-PAGE-01` rules

1. New workspace pages wrap in `PageLayout` (or at least `PageContent`).
2. `PageContent` is always `mx-auto w-full min-w-0`.
3. `width` only sets **max-width**; never a fixed page width; no global `min-width` on page roots.
4. Default body: `size="default"`, `width="wide"` (`--portal-content-max` / `1760px`).
5. `PageLayout` / `PageContent` must **not** add `h-screen`, `h-dvh`, or page-level `overflow-y-auto`.
6. Full-bleed body (`width="full"`) is allowed for dense CRM workspaces (e.g. lead) and documented PT exceptions.
7. Platform Shell contracts `DS-SHELL-01` / `DS-SHELL-02` stay untouched.

## Density (`size`)

| `size` | Padding utilities | px (base → large) |
|---|---|---|
| `compact` | `p-portal-3 sm:p-portal-4` | 12 → 16 |
| `default` | `p-portal-4 lg:p-portal-6` | 16 → 24 |
| `spacious` | `p-portal-5 lg:p-portal-8` | 20 → 32 |

## Width

| `width` | Utility | Token | Use |
|---|---|---|---|
| `default` | `max-w-portal-default` | `--portal-content-default` (80rem) | Narrower reading / settings forms |
| `wide` | `max-w-portal-max` | `--portal-content-max` (1760px) | **Platform default** — catalogs, lists |
| `full` | `max-w-none` | — | Dense CRM / full-bleed workspaces |

`narrow` (`--portal-content-narrow`) remains a token for forms/dialogs; not a `PageContent` prop yet.

## Grid helper

`ResponsiveGrid` stays in the same module: auto-fit columns via `.portal-grid-small|medium|large` with `min(100%, N)` minima. Full content-container standardization continues in `5.3.2.4`.

## Smoke consumers

- `frontend/components/layout/page-layout.tsx` (API + tokens)
- `frontend/app/(workspace)/settings/catalogs/nomenclature-types/page.tsx` (`PageLayout` + `PageContent`)

## Unchanged behaviour

- Existing lead/order pages keep current `PageContent` props (`compact`/`full`/`spacious`) — visual look preserved.
- `PageActions` / `ResponsiveGrid` behaviour unchanged (deeper action standardization → `5.3.2.3`).
- No DS-SHELL visual changes.

## Verification

1. `/settings/catalogs/nomenclature-types` — `PageLayout` + default `PageContent` (wide, default padding).
2. Lead / order pages — no visual delta from this microtask.
3. Main scrollbar remains on `[data-app-shell-main]`.
4. Confirm: `DS-SHELL-01 visual contract preserved`, `DS-SHELL-02 visual contract preserved`.

## Status

Primitive + contract shipped for `5.3.2.1`. Owner visual spot-check optional; no redesign expected.
