# Sport-Lead — PT-01 Dashboard Template

**Code:** `SL-PT-01-DASHBOARD-v1`  
**Contract:** `DS-PT-01`  
**Date:** `2026-07-21`  
**Roadmap:** `5.5.1.1`–`5.5.1.4`  
**Reference page:** `/sales/dashboard` (`SalesDashboard`)  
**Related:** `DS-PAGE-01`…`04`, `DS-FILTER-01`, `DS-FEEDBACK-02`, inventory **D1**, `ui-audit.md`, `responsive-rules.md`

## Scope

Define the **platform dashboard page template** (PT-01): page frame, section order, approved containers, and responsive behaviour. Reference implementation is Sales Dashboard (demo data). Persistence / demo→API migration stays in `5.6.1`.

Does **not** own: Platform Shell (`DS-SHELL-01`/`02`), list/kanban/card templates (PT-02…), chart library choice.

## Canonical composition

```
AppShell
  └── [data-app-shell-main]          ← sole primary vertical scroll
        └── PageLayout               ← DS-PAGE-01
              └── PageContent        ← width="full", size="default" (full-bleed analytics)
                    ├── Filters      ← SectionCard + Field/Select/Input (+ optional FilterToolbar)
                    ├── EmptyState?  ← filter/period empty (`DS-FEEDBACK-02`)
                    ├── KPI row      ← ResponsiveGrid + MetricCard
                    ├── Charts row   ← 1→2 cols (funnel | dynamics)
                    ├── Summaries    ← stacked → multi-col section cards
                    └── Tasks+feed   ← tasks | activity (activity spans 2 at xl)
```

Optional `PageToolbar` is allowed when a dashboard needs page-level actions; Sales Dashboard has none today.

## `DS-PT-01` rules

1. New dashboard pages use `PageLayout` → `PageContent` (`full` / `default` — full-bleed analytics, no content max-width). Do not add page-local `p-*` that duplicates `PageContent` padding.
2. Content cards and KPI tiles use `@/components/ui/section-card` (`SectionCard`, `MetricCard`, `InfoCard`) — **D1 unify**. Do not add module-local card chrome.
3. Filters compose `Field` / `Select` / `Input` / `DateInput` (`DS-FORM-01`) and `Button` (`DS-ACTION-01`). Active filter chips use `StatusBadge`. Prefer `SectionCard` for multi-field analytics filters; `FilterToolbar` (`DS-FILTER-01`) for compact strip filters.
4. Filter/period empty uses shared `EmptyState` — not ad-hoc dashed boxes.
5. Section bodies may keep domain widgets (charts, funnels, tables); table overflow stays **local** (`overflow-x-auto`).
6. Demo/local data must stay labeled; do not invent persistence in this template.
7. Do not change Platform Shell visuals. Confirm `DS-SHELL-01` / `DS-SHELL-02` preserved on verify.
8. `/dashboard` stub is **not** a PT-01 reference (`ui-audit.md`).

## Slots

| Slot | Required | Primitive / pattern |
|---|---|---|
| Page frame | yes | `PageLayout` + `PageContent` (`width="full"`) |
| Filters | recommended | `SectionCard` + form controls |
| Empty | when filtered empty | `EmptyState` |
| KPI | recommended | `ResponsiveGrid` + `MetricCard` |
| Primary charts | optional | two `SectionCard`s, `xl:grid-cols-2` |
| Summary cards | optional | `SectionCard` grid |
| Activity / tasks | optional | `SectionCard` + `ActivityTimeline` / domain summary |

## Responsive rules (`5.5.1.3`)

Breakpoints: `responsive-rules.md` / `breakpoint-tokens.md`.

| Region | Mobile (&lt;md) | Tablet (md–lg) | Desktop (xl+) |
|---|---|---|---|
| Filters | single column fields; actions wrap | 2–4 field columns | up to 7 fields in one row |
| KPI | 1 col (`ResponsiveGrid` auto-fit) | ~2 cols | ~4 cols (`minItemWidth="small"`) |
| Charts | stacked | stacked or 2 if width allows | 2 equal columns |
| Summaries | stacked | 2 cols where comfortable | 4-col grid; wide table card may `xl:col-span-2` |
| Tasks + activity | stacked | stacked | 3-col; activity `xl:col-span-2` |
| Tables | local `overflow-x-auto` | same | same |

Additional:

1. Every grid/flex child with data: `min-w-0`.
2. No page-root `min-width`, `h-screen`, or second primary scrollbar.
3. Prefer `ResponsiveGrid` for KPI/metric tiles; explicit `xl:grid-cols-*` for curated multi-section rows.
4. Verification widths: 1920, 1600, 1440, 1280, 1024, 768, 390.

## Reference consumers

- `/sales/dashboard` — `frontend/components/dashboard/sales-dashboard.tsx` (+ section widgets)

## Verification (owner)

1. `/sales/dashboard` — portal page frame, section cards, KPI metrics, filters, empty period state.
2. Resize through matrix above — no horizontal page overflow; tables scroll locally.
3. Demo snapshot / filters still work; no persistence change.
4. `DS-SHELL-01 visual contract preserved`, `DS-SHELL-02 visual contract preserved`.

Reply: `5.5.1 visual OK` or list issues.

## Status

Contract + reference layout + responsive rules shipped for `5.5.1.*`. Owner confirmation: **`5.5.1 visual OK`** (`2026-07-21`). `PageContent width="full"` (full-bleed).
