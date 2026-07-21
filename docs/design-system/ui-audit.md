# Sport-Lead — UI Route and Page-Type Audit

**Code:** `SL-UI-AUDIT-v1`
**Date:** `2026-07-21`
**Project version:** `v0.9.0`
**Git branch:** `feature/v0.8.1-nomenclature-core`
**Git commit:** `c9bee2b` (audit baseline; closeout on current branch)
**Roadmap microtasks:**

- `[x]` `5.1.1.1` — Audit existing routes, layouts and page types
- `[x]` `5.1.1.2` — Audit loading, error and empty states
- `[x]` `5.1.1.3` — Audit persistent versus demo/local data
- `[x]` `5.1.1.4` — Document reference and migration pages

## Method

1. Enumerate tracked `frontend/app/**/page.tsx`, `layout.tsx`, `loading.tsx`, and `error.tsx`.
2. Map each page URL without the `(workspace)` route group.
3. Classify page type from the Stage 5 template vocabulary.
4. Inspect page imports and data loaders for persistent API vs demo/local vs mixed.
5. Cross-check `frontend/lib/navigation.ts` hrefs against existing pages.
6. Record obvious responsive and shell risks for later microtasks; full scrolling/responsive audits are out of scope for `5.1.1.1`.

## Layouts

| Layout | Path | Role |
|---|---|---|
| Root | `frontend/app/layout.tsx` | HTML shell, fonts, global providers |
| Workspace | `frontend/app/(workspace)/layout.tsx` | Wraps children in `AppShell` (Platform Sidebar + Topbar) |
| Sales | `frontend/app/(workspace)/sales/layout.tsx` | Sales-section layout wrapper |

Almost all product pages live under `(workspace)` and therefore use Platform Shell, except noted shell deviations below.

## Full route table

| URL | File | Route group | Module | Page type | Main components | Data | loading | error | Empty state | Desktop | Tablet | Mobile |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `/` | `frontend/app/page.tsx` | root | root | Redirect | `redirect` | redirect | no | no | n/a | ok | ok | ok |
| `/dashboard` | `frontend/app/(workspace)/dashboard/page.tsx` | `(workspace)` | dashboard | Placeholder | inline stub | unknown | no | no | placeholder copy | unknown | risk | risk |
| `/sales` | `frontend/app/(workspace)/sales/page.tsx` | `(workspace)` | sales | Redirect | `redirect` | redirect | no | no | n/a | ok | ok | ok |
| `/sales/dashboard` | `frontend/app/(workspace)/sales/dashboard/page.tsx` | `(workspace)` | sales | Dashboard | `SalesDashboard` | demo | no | no | unknown | likely | risk | risk |
| `/sales/leads` | `frontend/app/(workspace)/sales/leads/page.tsx` | `(workspace)` | sales | Kanban Workspace | `LeadWorkspace` | persistent | no | no | loadError / empty board | likely | risk | risk |
| `/sales/leads/[leadId]` | `frontend/app/(workspace)/sales/leads/[leadId]/page.tsx` | `(workspace)` | sales | Complex Entity Card | `LeadPage` | mixed | yes | yes | `notFound()` | likely | risk | risk |
| `/sales/orders` | `frontend/app/(workspace)/sales/orders/page.tsx` | `(workspace)` | sales | Kanban Workspace | `KanbanPage` | persistent | no | no | loadError / empty columns | likely | risk | risk |
| `/sales/orders/[orderId]` | `frontend/app/(workspace)/sales/orders/[orderId]/page.tsx` | `(workspace)` | sales | Document Card | `SalesOrderPage` | persistent | yes | yes | `notFound()` | likely | risk | risk |
| `/sales/clients` | `frontend/app/(workspace)/sales/clients/page.tsx` | `(workspace)` | sales | List/Table Workspace | `ClientsTable` | demo | no | no | not dedicated | likely | risk | risk |
| `/sales/tasks` | `frontend/app/(workspace)/sales/tasks/page.tsx` | `(workspace)` | sales | Kanban Workspace | `KanbanPage` | demo | no | no | not dedicated | likely | risk | risk |
| `/sales/deals` | `frontend/app/(workspace)/sales/deals/page.tsx` | `(workspace)` | sales | Kanban Workspace | `KanbanPage` | demo | no | no | not dedicated | likely | risk | risk |
| `/settings` | `frontend/app/(workspace)/settings/page.tsx` | `(workspace)` | settings | Settings Page | hub links | mixed links | no | no | n/a | likely | risk | risk |
| `/settings/organizations` | `frontend/app/(workspace)/settings/organizations/page.tsx` | `(workspace)` | settings | List/Table Workspace | `EntityWorkspace` | demo | no | no | not dedicated | likely | risk | risk |
| `/settings/organizations/employees` | `frontend/app/(workspace)/settings/organizations/employees/page.tsx` | `(workspace)` | settings | List/Table Workspace | `EntityWorkspace` | demo | no | no | not dedicated | likely | risk | risk |
| `/settings/catalogs/materials` | `frontend/app/(workspace)/settings/catalogs/materials/page.tsx` | `(workspace)` | settings | List/Table Workspace | `EntityWorkspace` | demo | no | no | not dedicated | likely | risk | risk |
| `/settings/catalogs/nomenclature` | `frontend/app/(workspace)/settings/catalogs/nomenclature/page.tsx` | `(workspace)` | settings | Tree + List Workspace | `NomenclatureWorkspace` | persistent | no | no | count UI only | likely | risk | risk |
| `/settings/catalogs/nomenclature/[nomenclatureId]` | `frontend/app/(workspace)/settings/catalogs/nomenclature/[nomenclatureId]/page.tsx` | `(workspace)` | settings | Complex Entity Card | `NomenclatureCard` | persistent | no | no | `notFound()` | likely | likely | likely |
| `/settings/catalogs/custom-fields` | `frontend/app/(workspace)/settings/catalogs/custom-fields/page.tsx` | `(workspace)` | settings | Settings Page | `CustomFieldsWorkspace` | persistent | no | no | not dedicated | likely | risk | risk |
| `/settings/catalogs/product-characteristics` | `frontend/app/(workspace)/settings/catalogs/product-characteristics/page.tsx` | `(workspace)` | settings | List/Table Workspace | `ProductCharacteristicsWorkspace` | persistent | no | no | not dedicated | likely | risk | risk |
| `/settings/catalogs/product-characteristics/[characteristicId]` | `frontend/app/(workspace)/settings/catalogs/product-characteristics/[characteristicId]/page.tsx` | `(workspace)` | settings | Simple Entity Card | local form/table UI | persistent | no | no | inline not-found | risk | risk | risk |
| `/settings/catalogs/units-of-measure` | `frontend/app/(workspace)/settings/catalogs/units-of-measure/page.tsx` | `(workspace)` | settings | Settings Page | `UnitsOfMeasureWorkspace` | persistent | no | no | not dedicated | likely | risk | risk |

**Totals:** 21 `page.tsx` routes. Only lead and order cards provide sibling `loading.tsx` / `error.tsx`.

## Classification summary

| Page type | Count | URLs |
|---|---|---|
| Redirect | 2 | `/`, `/sales` |
| Placeholder | 1 | `/dashboard` |
| Dashboard | 1 | `/sales/dashboard` |
| Kanban Workspace | 4 | `/sales/leads`, `/sales/orders`, `/sales/tasks`, `/sales/deals` |
| List/Table Workspace | 5 | clients, orgs, employees, materials, product-characteristics |
| Tree + List Workspace | 1 | nomenclature list |
| Complex Entity Card | 2 | lead card, nomenclature card |
| Document Card | 1 | order card |
| Simple Entity Card | 1 | characteristic card |
| Settings Page | 3 | settings hub, custom-fields, units-of-measure |

Secondary notes:

- `/sales/deals` is also Demo/Local and is absent from `navigation.ts`.
- `/sales/leads/[leadId]` is mixed because numeric IDs use API while demo IDs use local fixtures.
- Characteristic detail additionally renders a local alternate sidebar and is a Platform Shell deviation.

## Persistent / demo / mixed

Detailed matrix: § Persistent versus demo/local audit (`5.1.1.3`). Summary:

### Persistent API

- `/sales/leads`
- `/sales/orders`
- `/sales/orders/[orderId]`
- `/settings/catalogs/nomenclature`
- `/settings/catalogs/nomenclature/[nomenclatureId]`
- `/settings/catalogs/custom-fields`
- `/settings/catalogs/product-characteristics`
- `/settings/catalogs/product-characteristics/[characteristicId]`
- `/settings/catalogs/units-of-measure`

### Demo / local

- `/sales/dashboard`
- `/sales/clients`
- `/sales/tasks`
- `/sales/deals`
- `/settings/organizations`
- `/settings/organizations/employees`
- `/settings/catalogs/materials`

### Mixed / other

- `/sales/leads/[leadId]` — mixed (API numeric IDs + demo `lead-*` fixtures; demo managers/`mockCurrentUser`)
- `/sales/leads` — persistent list with demo `salesManagers` in filter options
- `/dashboard` — placeholder stub
- `/settings` — hub linking to both live and missing routes
- `/`, `/sales` — redirects

## Reference and migration pages (`5.1.1.4`)

**Method:** use only routes that exist in this checkout; classify each as **reference** (preferred pattern for a future PT), **provisional** (usable until a stronger persistent page exists), or **migrate** (must be brought to a PT later). HTML mockups in `docs/design/` are visual aids, not live routes.

### Legend

| Tag | Meaning |
|---|---|
| reference | Primary live (or best) pattern for a PT until the template contract is approved |
| provisional | Acceptable interim pattern; demo or incomplete persistence |
| migrate | Must be rewritten/aligned in Stage 5.6 |
| shell-deviation | Breaks Platform Shell; fix before treating as reference |
| missing | Expected in product list but no `page.tsx` in checkout |

### Required product pages (factual)

| Role | URL | File | Data | Tag | Future PT | Notes |
|---|---|---|---|---|---|---|
| Sales Dashboard | `/sales/dashboard` | `frontend/app/(workspace)/sales/dashboard/page.tsx` | demo | provisional → migrate | PT-01 | Only dashboard implementation; demo-labeled UI |
| Leads Kanban | `/sales/leads` | `…/sales/leads/page.tsx` | persistent | **reference** | PT-03 | Best kanban + API `loadError` precedent |
| Lead Card | `/sales/leads/[leadId]` | `…/sales/leads/[leadId]/page.tsx` | mixed | provisional → migrate | PT-06 | Full loading/error/not-found; still demo managers / dual IDs |
| Customer Order Card | `/sales/orders/[orderId]` | `…/sales/orders/[orderId]/page.tsx` | persistent | **reference** | PT-07 | Persistent document card with segment boundaries |
| Nomenclature Workspace | `/settings/catalogs/nomenclature` | `…/nomenclature/page.tsx` | persistent | **reference** | PT-04 | Only tree+list workspace |
| Nomenclature Card | `/settings/catalogs/nomenclature/[nomenclatureId]` | `…/nomenclature/[nomenclatureId]/page.tsx` | persistent | **reference** | PT-06 | Aligns with HTML ref; needs loading/error siblings |
| Organizations | `/settings/organizations` | `…/organizations/page.tsx` | demo | provisional → migrate | PT-02 | EntityWorkspace demo |
| Employees | `/settings/organizations/employees` | `…/employees/page.tsx` | demo | provisional → migrate | PT-02 | EntityWorkspace demo |
| Materials | `/settings/catalogs/materials` | `…/materials/page.tsx` | demo | provisional → migrate | PT-02 | Backend materials exist; UI demo |

### Additional live pages useful for templates

| Role | URL | Tag | Future PT | Notes |
|---|---|---|---|---|
| Orders board | `/sales/orders` | migrate (secondary PT-03) | PT-03 / PT-02 | Persistent kanban; prefer leads as primary PT-03 ref |
| Product characteristics list | `/settings/catalogs/product-characteristics` | provisional → migrate | PT-02 | Persistent list; empty/error UX weak |
| Characteristic detail | `/settings/catalogs/product-characteristics/[id]` | shell-deviation → migrate | PT-05 | Persistent; **local sidebar** — not a shell reference |
| Custom fields | `/settings/catalogs/custom-fields` | migrate | Settings / PT-02 | Persistent settings workspace |
| Units of measure | `/settings/catalogs/units-of-measure` | migrate | Settings / PT-02 | Persistent |
| Clients | `/sales/clients` | provisional → migrate | PT-02 | Demo table with filter-empty copy |
| Tasks / Deals boards | `/sales/tasks`, `/sales/deals` | migrate (demo) | PT-03 | Demo only; deals not in nav |
| Settings hub | `/settings` | migrate | Settings | Link hub; includes dead links |
| Platform home stub | `/dashboard` | migrate / replace | PT-01 or drop | Placeholder «MOSMADE ERP» |

### HTML visual references (not routes)

| File | Maps to | Use |
|---|---|---|
| `docs/design/nomenclature-card-reference-v1.html` | Nomenclature Card / PT-06 | Pixel/layout reference for card composition |
| `docs/design/product-characteristics-reference-v2.html` | Characteristics list+detail / PT-02+PT-05 | Visual aid; live detail must drop local sidebar |

### Recommended PT reference owners (until contracts exist)

| PT | Primary reference now | Do not use as reference |
|---|---|---|
| PT-01 | `/sales/dashboard` (provisional) | `/dashboard` stub |
| PT-02 | `/settings/catalogs/product-characteristics` (persistent list) or clients table patterns | blank EntityWorkspace empties |
| PT-03 | `/sales/leads` | demo tasks/deals only as secondary |
| PT-04 | `/settings/catalogs/nomenclature` | — |
| PT-05 | none clean — characteristic detail after shell fix | characteristic detail **until** shell-deviation fixed |
| PT-06 | nomenclature card + lead card (lead for activity tabs) | — |
| PT-07 | `/sales/orders/[orderId]` | — |
| PT-08 | **missing** — prepare with product models | — |

### Migration priority for Stage `5.6`

Order matches roadmap `5.6.1`–`5.6.7` and audit risk:

1. Sales Dashboard → PT-01 (`5.6.1`) — landing is demo
2. Leads Kanban → PT-03 (`5.6.2`) — already strongest; formalize
3. Lead Card → PT-06 (`5.6.3`) — de-mix data + unify with card template
4. Customer Order Card → PT-07 (`5.6.4`) — already strong; formalize
5. Nomenclature Workspace → PT-04 (`5.6.5`)
6. Nomenclature Card → PT-06 (`5.6.6`) — add boundaries; keep HTML parity
7. Model Card shell → PT-08 (`5.6.7`) — not in checkout yet

Parallel / follow-on migrations (not separate 5.6 codes yet): organizations, employees, materials, characteristics detail shell fix, clients, custom-fields, UoM, remove `/sales/deals` or add to nav intentionally.

### Rules for new pages (until PT contracts land)

1. Prefer the **reference** owner in the table above for the matching page type.
2. Demo/provisional pages may be copied only if persistence work is in the same task.
3. Never copy characteristic detail’s local sidebar.
4. Never treat nav-only hrefs (production, warehouse, …) as references — pages are **missing**.

## Navigation hrefs without pages

Whole modules are nav-only today:

- Dashboard: `/dashboard/activity`, `/dashboard/analytics`
- Sales reports: `/sales/reports/funnel`, `/sales/reports/managers`, `/sales/reports/dynamics`
- Production: `/production`, `/production/orders`, `/production/tasks`, `/production/stages/*`
- Warehouse: `/warehouse`, `/warehouse/stock`, `/warehouse/movements`, `/warehouse/inventory`
- Purchases: `/purchases`, `/purchases/orders`, `/purchases/suppliers`
- Finance: `/finance`, `/finance/payments`, `/finance/reports/*`
- Analytics: `/analytics`, `/analytics/sales`, `/analytics/production`
- Settings gaps: `/settings/catalogs/cities`, `/settings/catalogs/warehouses`, `/settings/catalogs/contractors`, `/settings/organizations/departments`, `/settings/products`, `/settings/products/types`, `/settings/users`, `/settings/integrations`

## Pages without matching nav entry

- `/sales/deals`
- `/settings/catalogs/nomenclature` and nomenclature card
- Dynamic detail routes for leads, orders, and characteristics (expected)

## Pages requiring future template migration

Superseded by § Reference and migration pages (`5.1.1.4`). Kept summary:

| Future PT | Candidate pages |
|---|---|
| PT-01 Dashboard | `/sales/dashboard` |
| PT-02 List/Table | clients, orgs, employees, materials, product-characteristics |
| PT-03 Kanban | leads, orders board, tasks, deals |
| PT-04 Tree + List | nomenclature workspace |
| PT-05 Simple Card | characteristic detail (after shell fix) |
| PT-06 Complex Card | lead card, nomenclature card |
| PT-07 Document Card | order card |
| PT-08 Versioned Workspace | none yet (prepare with models) |

## Gaps and risks registered for later microtasks

1. Nav ≫ pages: large set of dead navigation targets across future ERP modules.
2. Route-level loading/error/not-found coverage is limited to lead and order cards (details in § Loading / error / empty audit).
3. Shared `EmptyState` exists but is unused; most empties are ad-hoc copy or blank tables.
4. Demo/local still mixed into CRM and settings catalogs (details in § Persistent versus demo/local audit).
5. Nomenclature is live but missing from `navigation.ts`.
6. Characteristic detail uses a local alternate sidebar — Platform Shell contract risk.
7. Responsive readiness is assumed only from existing card work; full matrix is `5.1.4.*`.
8. Nested/double scroll ownership needs AppShell audit (`5.1.3.*`).

## Loading / error / empty audit (`5.1.1.2`)

**Method:** inspect every `page.tsx` plus sibling `loading.tsx` / `error.tsx` / `not-found.tsx`; grep for `EmptyState`, `loadError`, `notFound()`, throw-on-fetch patterns, and inline empty copy. No production code changed.

### Cross-cutting

| Item | Finding |
|---|---|
| `frontend/components/ui/empty-state.tsx` | Defined, **never imported** |
| Root / `(workspace)` `loading.tsx` | Absent |
| Root / `(workspace)` `error.tsx` / `global-error.tsx` | Absent |
| Segment `loading` + `error` + `not-found` | Only `/sales/leads/[leadId]` and `/sales/orders/[orderId]` |
| Retry API | Lead uses `unstable_retry`; Order uses standard `reset` |

### Per-route matrix

| URL | loading.tsx | error.tsx | not-found.tsx | API / in-page error | Empty UX | Notes |
|---|---|---|---|---|---|---|
| `/` | no | no | no | n/a redirect | n/a | |
| `/dashboard` | no | no | no | none (stub) | placeholder copy | |
| `/sales` | no | no | no | n/a redirect | n/a | |
| `/sales/dashboard` | no | no | no | none (demo) | inline period-empty panel | |
| `/sales/leads` | no | no | no | `loadError` red banner | kanban «Ничего не найдено» / column empty | keeps chrome on error |
| `/sales/leads/[leadId]` | **yes** skeleton | **yes** `unstable_retry` | **yes** | `notFound()` / throw → segment error | nested task/timeline/message empties | best segment coverage |
| `/sales/orders` | no | no | no | `loadError` replaces board | kanban empties when OK | network throw uncaught |
| `/sales/orders/[orderId]` | **yes** pulse | **yes** `reset` | **yes** | `notFound()` / throw | items/history/picker empties | nomenclature fail looks like order error |
| `/sales/clients` | no | no | no | none (demo) | «Клиенты не найдены» | |
| `/sales/tasks` | no | no | no | none (demo) | kanban empties | |
| `/sales/deals` | no | no | no | none (demo) | kanban empties | |
| `/settings` | no | no | no | none | n/a hub | |
| `/settings/organizations` | no | no | no | none (demo) | **none** (blank tbody) | |
| `/settings/organizations/employees` | no | no | no | none (demo) | **none** | |
| `/settings/catalogs/materials` | no | no | no | none (demo) | **none** | |
| `/settings/catalogs/nomenclature` | no | no | no | **throw** → default Next error | filter empty line only | needs boundaries |
| `/settings/catalogs/nomenclature/[id]` | no | no | no | throw on !ok (incl. 404) | nested media/forms | `notFound()` path effectively dead |
| `/settings/catalogs/custom-fields` | no | no | no | **throw** | **none** | |
| `/settings/catalogs/product-characteristics` | no | no | no | **throw** | **none** (total 0) | |
| `/settings/catalogs/product-characteristics/[id]` | no | no | no | inline «не найдена» / throw | options tbody blank | not using `not-found.tsx` |
| `/settings/catalogs/units-of-measure` | no | no | no | **throw** | **none** | |

### Patterns to standardize later

1. **Segment boundaries** (`5.3.2.6`): add shared workspace/root loading+error; cover nomenclature, custom-fields, UoM, characteristics; fix 404 → `notFound()` for nomenclature card; unify Lead/Order retry on `reset`.
2. **Empty / error UI** (`5.4.2.5`): adopt `EmptyState` for list/filter/true-empty; shared `loadError` banner with retry; distinguish true empty vs filter empty; shared skeletons.
3. **List pages**: `/sales/leads`, `/sales/orders`, and settings catalogs lack route `loading.tsx`.
4. **Demo pages**: no real failure surface until persistence lands (tracked in § Persistent versus demo/local audit gaps).

### Registered follow-up bugs / gaps (not opened as B-codes yet)

- P1: catalog pages throw without segment error UI
- P1: nomenclature detail 404 does not reliably hit `notFound()`
- P1: `EmptyState` unused while ad-hoc empties proliferate
- P2: Lead `unstable_retry` vs Order `reset`
- P2: orders list network errors uncaught; list loading absent
- P2: EntityWorkspace demo tables have blank empty bodies

## Persistent versus demo/local audit (`5.1.1.3`)

**Method:** trace each `page.tsx` import graph into `lib/demo-data/*`, sales/nomenclature API clients, and server actions; search `localStorage` / `sessionStorage`. No production code changed.

### Verdict on silent fallback

Across audited loaders, **no page silently substitutes demo data when a persistent API call fails**. Lead mixed mode is an intentional ID-based dual path (`lead-*` fixtures vs numeric API), not catch→demo.

### Per-route classification

| URL | Class | Demo / local | Persistent | Notes |
|---|---|---|---|---|
| `/` | redirect | — | — | → `/sales/dashboard` (demo landing) |
| `/dashboard` | stub | placeholder copy | — | no fetch |
| `/sales` | redirect | — | — | → `/sales/dashboard` |
| `/sales/dashboard` | demo | `getSalesDashboardDemoData` + `lib/demo-data/sales` | — | UI labels demo snapshot date |
| `/sales/leads` | persistent* | `salesManagers` in filters | `getLeadList`, stages API | *filter contamination; fail → empty + «Demo-данные не подставлены» |
| `/sales/leads/[leadId]` | mixed | `leads` fixtures, `salesManagers`, `mockCurrentUser`; optional `localStorage` stages read | numeric `GET /leads/{id}` + mutations | dual ID scheme |
| `/sales/orders` | persistent | — | `getOrderList`, status actions | fail → `loadError`, no demo |
| `/sales/orders/[orderId]` | persistent | — | order + nomenclature APIs | throw / `notFound` |
| `/sales/clients` | demo | `clients`, `salesCurrency` | — | |
| `/sales/tasks` | demo | `salesTasks`, `taskColumns`, `salesManagers` | — | |
| `/sales/deals` | demo | `deals`, `dealColumns`, `salesManagers` | — | not in nav |
| `/settings` | stub | hardcoded hub links | — | |
| `/settings/organizations` | demo | `organizationRecords` | — | EntityWorkspace |
| `/settings/organizations/employees` | demo | `employeeRecords` | — | |
| `/settings/catalogs/materials` | demo | `materialRecords` | — | API materials exist backend-side; UI demo |
| `/settings/catalogs/nomenclature` | persistent | — | `lib/nomenclature` | throw on error |
| `/settings/catalogs/nomenclature/[id]` | persistent | — | full card APIs | |
| `/settings/catalogs/custom-fields` | persistent | — | custom-fields API | |
| `/settings/catalogs/product-characteristics` | persistent | — | characteristics API | |
| `/settings/catalogs/product-characteristics/[id]` | persistent | local shell only (not demo data) | definitions/options API | |
| `/settings/catalogs/units-of-measure` | persistent | — | UoM API | |

Counts: redirect 2 · stub 2 · demo 7 (+ deals) = 8 demo routes · persistent 9 · mixed 1.

### `frontend/lib/demo-data/` inventory

| File | Role | Consumers |
|---|---|---|
| `sales.ts` | CRM fixtures + managers + columns | dashboard, clients, tasks, deals, lead workspace/header/page, lead-details |
| `sales-dashboard.ts` | dashboard aggregator over sales fixtures | `SalesDashboard` only |
| `catalogs.ts` | org/employee/material records | organizations, employees, materials pages |
| `clients.ts` | `clientRecords` | **orphan — unused** |

### localStorage

| Key | Purpose | Persistence of business data? |
|---|---|---|
| `sport-lead-sidebar-mode` | Platform Sidebar compact mode | No (chrome) |
| `sport-leads.sales.lead-stages.v1` | read in demo lead header stage path | Intended demo CRM; **no writer found** (dead/read-only) |

### Demo injected into otherwise persistent pages

| Dependency | Where | Risk |
|---|---|---|
| `salesManagers` | leads list filters; lead card header/timelines | Demo people on API screens |
| `mockCurrentUser` | lead card notes/tasks authorship | Fake actor / permissions |
| `leads` fixtures | `getLeadDetails` for `lead-*` ids | Parallel non-API lead path |
| `RUSSIAN_CITY_SUGGESTIONS` | lead city autocomplete | Static local suggestions (acceptable until geo API) |

### Prioritized persistence gaps (later work, not this microtask)

1. P1 — Persist CRM: dashboard, clients, tasks, deals (landing currently demo).
2. P1 — De-mix lead card: drop `lead-*` dual path; replace managers/`mockCurrentUser` with employees/auth.
3. P1 — Persist settings: organizations, employees, materials workspace on backend data.
4. P2 — Remove `salesManagers` from leads list filters; derive from API.
5. P2 — Remove orphan `clients.ts`; clean unused demo order fixtures if unused.
6. P2 — Settings hub links to missing catalogs without data layer.
7. P3 — Clarify `/dashboard` stub vs `/sales/dashboard`.

Good precedent to keep: leads/orders loaders that refuse silent demo fallback; nomenclature throw-on-error.

## Obvious responsive risks (not a full audit)

- Kanban boards and wide tables likely overflow or force horizontal scroll on tablet/mobile.
- Tree + list nomenclature needs a tree drawer strategy on narrow viewports.
- Characteristic detail local sidebar conflicts with compact Platform Sidebar behaviour.
- Settings hub and demo EntityWorkspace pages are not verified against the shell responsive matrix.

## Next audit microtasks

- `5.1.4.2`–`5.1.4.5` — manual viewport audits (blocked; see `docs/design-system/responsive-audit.md`)
- `5.1.4.6` — Register visual bug microtasks after visual pass

## Out of scope for this file

- Production frontend/backend code changes
- Implementing shared loading/error boundaries (belongs to `5.3.2.6`)
- Implementing shared empty/error UI (belongs to `5.4.2.5`)
- Full component inventory
- Full scrolling and responsive audits
- PT-01…PT-08 contract implementation
