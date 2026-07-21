# Sport-Lead — UI Route and Page-Type Audit

**Code:** `SL-UI-AUDIT-v1`  
**Date:** `2026-07-21`  
**Project version:** `v0.9.0`  
**Git branch:** `feature/v0.8.1-nomenclature-core`  
**Git commit:** `281569b`  
**Roadmap microtask:** `5.1.1.1 — Audit existing routes, layouts and page types`

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

- `/sales/leads/[leadId]` — mixed
- `/dashboard` — placeholder stub
- `/settings` — hub linking to both live and missing routes
- `/`, `/sales` — redirects

## Reference pages (factual paths)

| Role | Status | Path |
|---|---|---|
| Sales Dashboard | present (demo) | `frontend/app/(workspace)/sales/dashboard/page.tsx` → `/sales/dashboard` |
| Leads Kanban | present (persistent) | `frontend/app/(workspace)/sales/leads/page.tsx` → `/sales/leads` |
| Lead Card | present (mixed) | `frontend/app/(workspace)/sales/leads/[leadId]/page.tsx` |
| Customer Order Card | present (persistent) | `frontend/app/(workspace)/sales/orders/[orderId]/page.tsx` |
| Nomenclature Workspace | present (persistent) | `frontend/app/(workspace)/settings/catalogs/nomenclature/page.tsx` |
| Nomenclature Card | present (persistent) | `frontend/app/(workspace)/settings/catalogs/nomenclature/[nomenclatureId]/page.tsx` |
| Organizations | present (demo) | `frontend/app/(workspace)/settings/organizations/page.tsx` |
| Employees | present (demo) | `frontend/app/(workspace)/settings/organizations/employees/page.tsx` |
| Materials | present (demo) | `frontend/app/(workspace)/settings/catalogs/materials/page.tsx` |

HTML visual references (not routes):

- `docs/design/nomenclature-card-reference-v1.html`
- `docs/design/product-characteristics-reference-v2.html`

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

| Future PT | Candidate pages |
|---|---|
| PT-01 Dashboard | `/sales/dashboard` |
| PT-02 List/Table | clients, orgs, employees, materials, product-characteristics |
| PT-03 Kanban | leads, orders board, tasks, deals |
| PT-04 Tree + List | nomenclature workspace |
| PT-05 Simple Card | characteristic detail |
| PT-06 Complex Card | lead card, nomenclature card |
| PT-07 Document Card | order card |
| PT-08 Versioned Workspace | none yet (prepare with models) |

## Gaps and risks registered for later microtasks

1. Nav ≫ pages: large set of dead navigation targets across future ERP modules.
2. loading/error coverage is limited to lead and order cards (`5.1.1.2`).
3. Dedicated empty states are rare; most pages rely on empty tables/boards or loadError text (`5.1.1.2`).
4. Demo/local still mixed into CRM and settings catalogs (`5.1.1.3`).
5. Nomenclature is live but missing from `navigation.ts`.
6. Characteristic detail uses a local alternate sidebar — Platform Shell contract risk.
7. Responsive readiness is assumed only from existing card work; full matrix is `5.1.4.*`.
8. Nested/double scroll ownership needs AppShell audit (`5.1.3.*`).

## Obvious responsive risks (not a full audit)

- Kanban boards and wide tables likely overflow or force horizontal scroll on tablet/mobile.
- Tree + list nomenclature needs a tree drawer strategy on narrow viewports.
- Characteristic detail local sidebar conflicts with compact Platform Sidebar behaviour.
- Settings hub and demo EntityWorkspace pages are not verified against the shell responsive matrix.

## Next audit microtasks

- `5.1.1.2` — Audit loading, error and empty states
- `5.1.1.3` — Audit persistent versus demo/local data
- `5.1.1.4` — Document reference and migration pages
- then `5.1.2.*` component inventory and `5.1.3.*` layout/scrolling

## Out of scope for this file

- Production frontend/backend code changes
- Full component inventory
- Full scrolling and responsive audits
- PT-01…PT-08 contract implementation
