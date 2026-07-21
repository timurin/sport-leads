# Sport-Lead — Component Inventory

**Code:** `SL-COMPONENT-INVENTORY-v1`
**Date:** `2026-07-21`
**Project version:** `v0.9.0`
**Git branch:** `feature/v0.8.1-nomenclature-core`
**Git commit:** `c9bee2b` (audit baseline)
**Related:** `docs/design-system/ui-audit.md`, `docs/design-system/shell-contracts.md`

## Roadmap microtasks

- `[x]` `5.1.2.1` — Inventory shared UI components
- `[x]` `5.1.2.2` — Inventory domain components
- `[x]` `5.1.2.3` — Identify duplicates and overlapping responsibilities
- `[x]` `5.1.2.4` — Define keep, unify, replace and deprecate decisions

## Method (`5.1.2.1`)

Enumerate files under:

- `frontend/components/ui/`
- `frontend/components/layout/`
- `frontend/components/navigation/` (shell chrome; contracts in `shell-contracts.md`)

Record exports, role, and obvious consumers. Domain folders (`sales/`, `settings/`, `kanban/`, `entity/`, `dashboard/`, `tables/`) are deferred to `5.1.2.2`.

No production code changed.

## Shared UI — `frontend/components/ui/`

| File | Exports | Role | Notes |
|---|---|---|---|
| `button.tsx` | `Button` | Primary actions | variants `primary` / `secondary` / `ghost` / `danger`; sizes compact/default/spacious |
| `page-header.tsx` | `PageToolbar` (canonical), `PageHeader` (deprecated alias) | Page-local toolbar (`start`/`end`); no title | `DS-PAGE-02` — `shell-page-header-standardization.md` |
| `entity-header.tsx` | `EntityHeader` | Entity title block | Overlaps conceptually with page/card headers |
| `section-card.tsx` | `SectionCard`, `InfoCard`, `MetricCard` | Content cards / metrics | Portal tokens |
| `status-badge.tsx` | `StatusBadge` | Status chips | tone + optional dot |
| `empty-state.tsx` | `EmptyState` | Empty lists/filters | **Defined, unused** (see ui-audit 5.1.1.2) |
| `data-list.tsx` | `DataList`, `DataListItem` | Label/value grids | |
| `compact-tabs.tsx` | `CompactTabs`, `CompactTabItem` | In-page tabs | Distinct from nomenclature card custom tabs |
| `action-menu.tsx` | `ActionMenu`, `ActionMenuItem` | Kebab / overflow menus | |
| `city-autocomplete.tsx` | `CityAutocomplete` | Lead city field | Uses static `lib/city-suggestions` |
| `demo-action-dialog.tsx` | `DemoActionDialog` | Demo-only dialog shell | Marked demo; do not use for persistent flows |

## Shared layout — `frontend/components/layout/`

| File | Exports | Role | Notes |
|---|---|---|---|
| `app-shell.tsx` | `AppShell` | Sidebar + topbar + main scroll owner | Used by `(workspace)/layout.tsx` |
| `app-topbar.tsx` | `AppTopbar` | Thin wrapper | Must not fork Topbar; see DS-SHELL-02 |
| `page-layout.tsx` | `PageLayout`, `PageContent`, `PageActions`, `ResponsiveGrid` | Page root, width/padding, action row, auto-fit grid | `DS-PAGE-01`…`03` / `04` grid |
| `page-state.tsx` | `PageLoadingState`, `PageErrorState`, `PageNotFoundState` | Shared route loading/error/not-found | `DS-PAGE-06` — `shell-page-state-boundaries.md` |
| `form-controls.tsx` | `Field`, `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Switch`, `DateInput`, `MoneyInput` | Shared form controls | `DS-FORM-01` — `form-controls-standardization.md` |

## Platform navigation (shared chrome)

| File | Role | Contract |
|---|---|---|
| `navigation/app-sidebar.tsx` | Platform Sidebar | `DS-SHELL-01` — protected |
| `navigation/top-navigation.tsx` | Platform Topbar | `DS-SHELL-02` — protected |
| `navigation/workspace-tabs.tsx` | Workspace tab strip | **Removed** (`5.3.1.3`) — no longer in AppShell |

Navigation data source: `frontend/lib/navigation.ts` (not a component).

## Shared UI summary counts

| Area | Files | Status |
|---|---:|---|
| `components/ui` | 11 | primitives + one unused EmptyState + one demo dialog |
| `components/layout` | 3 | shell + page layout helpers |
| `components/navigation` | 3 | protected shell + workspace tabs |

## Obvious overlaps to resolve in `5.1.2.3` / `5.1.2.4`

(Registered now; decisions deferred.)

1. `dashboard/metric-card.tsx` / `dashboard/section-card.tsx` vs `ui/section-card` `MetricCard` / `SectionCard`.
2. Nomenclature/lead custom tab UIs vs `CompactTabs`.
3. Ad-hoc empty copy vs unused `EmptyState`.
4. `LeadPageState` / order error panels vs future shared page-state primitive.
5. `EntityHeader` vs card headers in lead/nomenclature/order.
6. `DemoActionDialog` vs real dialogs in sales settings.

## Next

- `5.1.2.3` — Identify duplicates and overlapping responsibilities
- `5.1.2.4` — Define keep, unify, replace and deprecate decisions

## Domain components (`5.1.2.2`)

**Method:** list `frontend/components/{sales,settings,kanban,entity,dashboard,tables}/**/*.tsx` (and adjacent `.ts` helpers that are UI-coupled). Persistence notes from ui-audit.

### Sales — `frontend/components/sales/`

| File | Role |
|---|---|
| `lead-workspace.tsx` | Leads kanban workspace + filters |
| `lead-page.tsx` | Lead complex card shell |
| `lead-header.tsx` | Lead header / stage / actions |
| `lead-page-skeleton.tsx` | Lead route loading skeleton |
| `lead-page-state.tsx` | Lead error/not-found state panel |
| `lead-back-button.tsx` | Back navigation |
| `lead-customer-details.tsx` | Customer block |
| `lead-commercial-details.tsx` | Commercial block |
| `lead-activity-timeline.tsx` | Notes/history tabs |
| `lead-tasks.tsx` | Tasks panel |
| `lead-communication-panel.tsx` | Communications UI |
| `lead-create-dialog.tsx` | Create lead |
| `lead-contact-dialog.tsx` | Contact editor |
| `lead-note-dialog.tsx` | Note editor |
| `lead-task-dialog.tsx` | Task editor |
| `lead-completion-dialog.tsx` | Complete / reject / convert |
| `lead-stage-settings-dialog.tsx` | Stage settings |
| `sales-order-page.tsx` | Order document card |
| `sales-order-items.tsx` | Order line items + nomenclature picker |

### Settings / catalogs — `frontend/components/settings/`

| File | Role |
|---|---|
| `nomenclature-workspace.tsx` | Tree + list nomenclature |
| `nomenclature-card.tsx` | Nomenclature complex card |
| `nomenclature-media-gallery.tsx` | Media library / Uppy |
| `product-characteristics-workspace.tsx` | Characteristics list |
| `custom-fields-workspace.tsx` | Custom fields admin |
| `units-of-measure-workspace.tsx` | UoM admin |

### Kanban — `frontend/components/kanban/`

| File | Role |
|---|---|
| `kanban-page.tsx` | Shared board page (orders/tasks/deals) |
| `kanban-board.tsx` | Board layout + empty search |
| `kanban-column.tsx` | Column + empty column copy |
| `kanban-card.tsx` | Card chrome |
| `kanban-state.ts` / `kanban-interaction.ts` / `kanban-types.ts` | DnD/state helpers |

### Entity workspace — `frontend/components/entity/`

| File | Role |
|---|---|
| `entity-workspace.tsx` | Generic list workspace (demo orgs/employees/materials) |
| `entity-table.tsx` | Table |
| `entity-toolbar.tsx` | Toolbar |
| `entity-form.tsx` | Form |
| `entity-card.tsx` | Side/detail card |
| `entity-inspector.tsx` | Inspector pane |

### Dashboard — `frontend/components/dashboard/`

| File | Role |
|---|---|
| `sales-dashboard.tsx` | Dashboard composition (demo data) |
| `dashboard-kpi-grid.tsx` | KPI grid |
| `dashboard-filters.tsx` | Period filters |
| `metric-card.tsx` | **Local** metric card (overlaps `ui/MetricCard`) |
| `section-card.tsx` | **Local** section card (overlaps `ui/SectionCard`) |
| `sales-funnel.tsx` | Funnel |
| `sales-dynamics-chart.tsx` | Dynamics chart |
| `sales-status-summary.tsx` | Status summary |
| `orders-summary.tsx` | Orders summary |
| `tasks-summary.tsx` | Tasks summary |
| `rejection-reasons-summary.tsx` | Rejection reasons |
| `lead-sources-table.tsx` | Sources table |
| `recent-activity.tsx` | Activity feed |

### Tables — `frontend/components/tables/`

| File | Role |
|---|---|
| `clients-table.tsx` | Clients list/table (demo) |

### Domain inventory counts

| Folder | Approx. UI modules | Persistence posture |
|---|---:|---|
| sales | 19 | leads/orders mostly API; managers/demo still mixed on leads |
| settings | 6 | nomenclature/characteristics/fields/UoM API; materials via entity demo |
| kanban | 4 (+3 helpers) | shared by API orders + demo tasks/deals |
| entity | 6 | demo catalogs only |
| dashboard | 13 | demo |
| tables | 1 | demo clients |

### Cross-domain coupling notes (for `5.1.2.3`)

- `LeadWorkspace` vs `KanbanPage` — two board entry patterns.
- `EntityWorkspace` family vs nomenclature/characteristics dedicated workspaces.
- Dashboard local cards vs portal `ui/section-card`.
- Characteristic detail page still embeds layout outside shared settings components (shell deviation).

## Duplicates and overlaps (`5.1.2.3`)

| ID | Overlap | Components | Risk |
|---|---|---|---|
| D1 | Metric / section cards | `dashboard/metric-card.tsx`, `dashboard/section-card.tsx` vs `ui/section-card` (`MetricCard`, `SectionCard`) | Parallel visual systems |
| D2 | Empty UX | Unused `ui/empty-state` vs ad-hoc copy in kanban, clients, catalogs, dashboard | Inconsistent empty language |
| D3 | Page / error state | `LeadPageState` vs order `error.tsx`/`not-found.tsx` panels vs red `loadError` banners | Three error languages |
| D4 | Kanban hosts | `LeadWorkspace` vs `KanbanPage` | Divergent filters/error chrome |
| D5 | List workspaces | `EntityWorkspace` vs `NomenclatureWorkspace` / characteristics / custom-fields / UoM | Generic demo vs dedicated API UIs |
| D6 | Headers | `PageHeader`, `EntityHeader`, lead/nomenclature/order custom headers | Unclear ownership vs Page Toolbar rules |
| D7 | Tabs | `CompactTabs` vs nomenclature card / characteristic tabs | Multiple tab implementations |
| D8 | Dialogs | `DemoActionDialog` vs sales dialogs | Demo primitive may leak into real flows |
| D9 | Shell | Characteristic detail local sidebar vs `AppShell` | Direct DS-SHELL violation |

## Keep / unify / replace / deprecate (`5.1.2.4`)

Decisions are documentation-only. Implementation belongs to later Stage 5 items (`5.3`–`5.6`, `5.4.2.5`).

| ID | Decision | Action |
|---|---|---|
| D1 | **Unify** | Migrate dashboard to `ui/section-card` MetricCard/SectionCard; delete dashboard-local duplicates after visual check |
| D2 | **Keep + adopt** | Keep `EmptyState`; adopt in list/kanban/catalog empties; remove one-off dashed empties when touching those pages |
| D3 | **Unify** | Shared `PageLoadingState` / `PageErrorState` shipped in `5.3.2.6`; continue EmptyState/`loadError` banner adoption in `5.4.2.5` |
| D4 | **Unify toward KanbanPage** | Keep `KanbanPage` as board host; fold lead-specific filters into composition over shared board rather than a second board framework |
| D5 | **Keep dedicated workspaces + reuse create inspector UX** | New persistent catalogs use dedicated workspaces (nomenclature pattern). **Create UX эталон** = materials right inspector / `CreateDrawer` (ADR-013). EntityWorkspace remains demo data-host until orgs/employees/materials persistence replace it |
| D6 | **Keep split** | `PageToolbar` (`DS-PAGE-02`) for page chrome; domain card headers stay domain-owned until PT-05/06/07; never put them in Platform Topbar |
| D7 | **Keep CompactTabs; unify adopters** | Prefer `CompactTabs` for simple in-page tabs; nomenclature complex tabs may stay custom until PT-06 contract |
| D8 | **Deprecate DemoActionDialog for create; modal only for confirm** | Create flows use `CreateDrawer` (ADR-013). `DemoActionDialog` only on explicitly demo pages until `5.4.2.3.5`; ban centered create modals for persistent entities |
| D9 | **Replace** | Characteristic detail must use Platform Shell only; remove local sidebar in a dedicated bug/microtask before treating as PT-05 reference |

### Explicit keep (no change required now)

- `Button`, `StatusBadge`, `DataList`, `ActionMenu`, `PageContent` / `PageActions` / `ResponsiveGrid`
- Protected `AppSidebar` / `TopNavigation` (DS-SHELL-01/02)
- Domain-rich modules: `nomenclature-card`, `sales-order-items`, lead dialogs — keep until PT migrations

### Explicit do-not-create

- No second button/badge/empty/card primitive without checking this inventory
- No new alternate Platform Sidebar/Topbar
- No new EntityWorkspace-based persistent catalog without comparing to nomenclature workspace

## Next

- `5.1.3.1` — Audit AppShell and workspace layouts
