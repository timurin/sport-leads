# Sport-Lead — Content Containers Standardization

**Code:** `SL-SHELL-CONTENT-CONTAINERS-STD-v1`  
**Contract:** `DS-PAGE-04`  
**Date:** `2026-07-21`  
**Roadmap:** `5.3.2.4`  
**Related:** `DS-PAGE-01`, `content-width-tokens.md`, `surface-tokens.md`, `layout-scrolling-audit.md`

## Scope

Define the **approved page body containers** for new and migrated workspace pages. This is a contract + keep-list, not a mass visual rewrite of domain pages.

## Approved containers

| Primitive | Module | Role |
|---|---|---|
| `PageContent` | `page-layout.tsx` | Outer width + page padding (`DS-PAGE-01`) |
| `ResponsiveGrid` | `page-layout.tsx` | Auto-fit metric/card grids (`min(100%, N)`) |
| `SectionCard` | `section-card.tsx` | Primary content section (title / actions / body / footer) |
| `InfoCard` | `section-card.tsx` | Dense labeled value tile |
| `MetricCard` | `section-card.tsx` | KPI tile with tone |
| `EmptyState` | `empty-state.tsx` | True-empty / filter-empty panels (`5.4.2.5` adoption continues) |

## `DS-PAGE-04` rules

1. New list/settings pages: `PageLayout` → (`PageToolbar`) → `PageContent` → `SectionCard` / table / `ResponsiveGrid`.
2. Cards use portal surface tokens: `bg-portal-surface`, `border-portal-border`, `rounded-portal-lg`, `shadow-portal-card|sm`.
3. Do not invent parallel dashboard `SectionCard` copies — use `@/components/ui/section-card` only (`5.5.1` / D1 closed on Sales Dashboard).
4. Wide tables stay inside a local `overflow-x-auto` wrapper; page root stays `min-w-0`.
5. Full-bleed exceptions (`PageContent width="full"`) require a documented PT / CRM workspace reason.
6. Mass migration of existing ad-hoc `p-6` / raw bordered divs is incremental via PT templates (`5.5` / `5.6`) — not required to close this microtask.

## Known debt (tracked, not blocking)

- Nomenclature workspace / characteristics still use local bordered panels — migrate under PT contracts.
- ~~Dashboard module-local `SectionCard`~~ — removed in `5.5.1`.

## Smoke

- Shared `SectionCard` / `MetricCard` / `ResponsiveGrid` consumers (sales order page, design-system README example)
- Catalog smoke page using `PageContent`: nomenclature-types

## Status

Contract shipped for `5.3.2.4`. No owner visual redesign pass expected.
