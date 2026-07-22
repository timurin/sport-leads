# Sport-Lead — Global Roadmap

**Code:** `SL-ROADMAP-v1`
**Updated:** `2026-07-22` (Stage 6.1.3 product-model create/list API)
**Project version:** `v0.9.0`
**Git branch:** `feature/v0.8.1-nomenclature-core`
**Git commit:** `bc63397`

**Canonical files:**
- roadmap: `docs/roadmap/roadmap.md`
- structure: `docs/architecture/project-structure.md`
- ERP-check: `docs/architecture/erp-check.md`

## Rules

- `[x]` means the roadmap item is completed and confirmed by code and applicable checks.
- `[ ]` means the roadmap item is not completed.
- For roadmap Markdown, only `[x]` and `[ ]` are used.
- Demo/local UI does not close a roadmap item that requires persistent production functionality.
- `docs/architecture/project-structure.md` is the main factual source for confirmed readiness.
- Separate task files are created only for the selected microtask before implementation starts.

## Current implementation boundary

Current confirmed contour:

`CRM -> Sales orders -> Nomenclature`

Next detailed contour:

`Design System and Platform Templates -> База лекал (модели + варианты сборки) -> Specifications -> Routings (цеха / исполнение) -> Технические карты -> Production`

## Stage 0 — Platform and Infrastructure

### 0.1 — Core platform

- [x] 0.1.1 — Monorepo with `backend/` and `frontend/`
- [x] 0.1.2 — FastAPI, PostgreSQL, SQLAlchemy, and Alembic foundation
- [x] 0.1.3 — Next.js workspace shell, navigation, and shared UI layer
- [x] 0.1.4 — Docker Compose for local development (PostgreSQL; app processes run via `uvicorn` / `npm run dev`)
- [x] 0.1.5 — Documented environment contract (`Settings`, `.env.example`) — `v0.9.0`; evidence: `backend/app/config/settings.py`, `.env.example`
- [x] 0.1.6 — API liveness and readiness endpoints (database ping on `/health/ready`) — `v0.9.0`; evidence: `backend/app/main.py`

### 0.2 — Quality and documentation

- [x] 0.2.1 — Repository-level project checks and verification scripts
- [x] 0.2.2 — Canonical documentation set: roadmap, structure, ERP-check, ADR
- [x] 0.2.3 — Stable CI/CD pipeline for mandatory checks — `v0.9.0`; GitHub Actions aligned with `scripts/check_project.py` (`backend/requirements.txt`, `backend/` migrations, Node.js, PostgreSQL service); evidence: `.github/workflows/checks.yml`
- [x] 0.2.4 — Backend `pytest` and frontend unit tests in mandatory project checks — `v0.9.0`; evidence: `scripts/check_project.py`
- [x] 0.2.5 — TypeScript `tsc --noEmit` in mandatory project checks — `v0.9.0`; evidence: `scripts/check_project.py`

### 0.3 — Development and staging operations

- [x] 0.3.1 — Secrets and environment baseline for dev and staging (no production secrets in repo) — `v0.9.0`; evidence: `.env.example`, `.gitignore`
- [x] 0.3.2 — Structured application logging baseline for API and local runs — `v0.9.0`; `LOG_LEVEL`/`LOG_FORMAT`, loguru config, HTTP request log middleware; evidence: `backend/app/logging_config.py`, `backend/app/main.py`, `backend/tests/test_logging_config.py`
- [x] 0.3.3 — Documented database backup and restore on dev/staging — `v0.9.0`; evidence: `scripts/backup_db.ps1`, `scripts/restore_db.ps1`

## Stage 1 — CRM and Leads

### 1.1 — Sales workspace

- [x] 1.1.1 — Sales dashboard
- [x] 1.1.2 — Lead list, filters, and Kanban UI
- [ ] 1.1.3 — Fully persistent workspace without demo/local lead state
- [ ] 1.1.4 — Leads list filters without demo `salesManagers` data on persistent routes — gap: `docs/design-system/ui-audit.md` § Persistent versus demo/local

### 1.2 — Lead card

- [x] 1.2.1 — Lead detail route and page states
- [x] 1.2.2 — Customer, contact, and commercial data saving through API
- [x] 1.2.3 — Configurable stages and stage management
- [ ] 1.2.4 — Persistent tasks, notes, timeline, and communications
- [ ] 1.2.5 — Single lead detail data path (remove `lead-*` fixture IDs); real actor for notes/tasks (depends on `17.1.1` for production auth) — gap: `ui-audit.md`

### 1.3 — Lead lifecycle

- [x] 1.3.1 — Completion and rejection flow
- [x] 1.3.2 — Transactional conversion from lead to sales order
- [ ] 1.3.3 — Deals, archive, and finalized CRM access-control contour

### 1.4 — CRM source integrations

- [x] 1.4.1 — Collectors, parsers, and import normalization core
- [x] 1.4.2 — Mock communication connector core
- [ ] 1.4.3 — Real external lead-source and communication adapters

## Stage 2 — Clients and Contacts

### 2.1 — Core entities and links

- [x] 2.1.1 — Client and contact entities linked to leads and orders
- [x] 2.1.2 — Saving client and contact data from CRM workflows

### 2.2 — Separate client workspace

- [ ] 2.2.1 — Persistent client list and dedicated workspace
- [ ] 2.2.2 — Separate client card
- [ ] 2.2.3 — Client lead and order history

### 2.3 — Business data and quality

- [ ] 2.3.1 — Legal details and banking data
- [ ] 2.3.2 — Segmentation and duplicate detection
- [ ] 2.3.3 — Settlements and financial client state

### 2.4 — Organizations workspace

- [ ] 2.4.1 — Persistent organizations list and card on backend data (replace demo `organizationRecords`)
- [ ] 2.4.2 — Persistent employees directory on backend data (replace demo `employeeRecords`)

## Stage 3 — Sales Orders

### 3.1 — Core document

- [x] 3.1.1 — Persistent sales-order model, list, detail route, and status history
- [x] 3.1.2 — Manual creation and creation from lead conversion
- [x] 3.1.3 — Organization, client, contact, and responsible bindings

### 3.2 — Order items

- [x] 3.2.1 — Persistent commercial snapshot items
- [x] 3.2.2 — Decimal/Numeric totals and discount-percent recalculation
- [x] 3.2.3 — Sizes, color, and personalization snapshots
- [x] 3.2.4 — Nullable nomenclature and variant links with immutable snapshots

### 3.3 — Financial document scope

- [ ] 3.3.1 — Order-level discount
- [ ] 3.3.2 — Tax and VAT model
- [ ] 3.3.3 — Currency, print forms, quotations, and invoices

### 3.4 — Order execution

- [ ] 3.4.1 — Design and approval states in order flow
- [ ] 3.4.2 — Reserve, production, shipping, payment, and closure workflow
- [ ] 3.4.3 — Orders list route `loading.tsx` and surfaced network errors (no silent empty list) — gap: `ui-audit.md` § Registered follow-up bugs

## Stage 4 — Nomenclature

### 4.1 — Persistent core

- [x] 4.1.1 — `v0.8.1` persistent nomenclature CRUD, card, search, article, activity, and base price
- [x] 4.1.2 — Nullable order-item link with independent commercial snapshot

### 4.2 — Classification and typed fields

- [x] 4.2.1 — `v0.8.2` nomenclature types and category hierarchy
- [x] 4.2.2 — `v0.8.3` units-of-measure directory and `storage_unit_id`
- [x] 4.2.3 — `v0.8.4` typed custom fields with category inheritance

### 4.3 — Workspace and card

- [x] 4.3.1 — `v0.8.5` separate workspace and editable card
- [x] 4.3.2 — `v0.8.8h` direct free assignment of custom fields in the card
- [ ] 4.3.3 — Audit history, archive flow, and bulk operations

### 4.4 — Characteristics, variants, and media

- [x] 4.4.1 — `v0.8.6` characteristics and variants
- [x] 4.4.2 — `v0.8.7` image media lifecycle
- [x] 4.4.3 — `v0.8.8a` to `v0.8.8g` card layout and interaction contour
- [x] 4.4.4 — `v0.8.8i` product-characteristics directory
- [ ] 4.4.5 — Non-image file attachments
- [ ] 4.4.6 — Variant pricing, barcodes, and external sync

### 4.5 — Import and export

- [ ] 4.5.1 — Nomenclature import
- [ ] 4.5.2 — Nomenclature export

### 4.6 — Unified catalog (materials consolidation)

Decision (`ADR-012`): one nomenclature master catalog with types; standalone `materials` directory is legacy and must not remain a second source of truth. Stock balances stay outside the nomenclature card.

- [ ] 4.6.1 — Approve migration plan from `materials` rows to `nomenclatures` with type `MATERIAL`
- [ ] 4.6.2 — Migrate data, preserve articles, and stop dual write paths
- [ ] 4.6.3 — Point Materials navigation/UI at nomenclature filtered by `MATERIAL` (or remove the duplicate menu)
- [ ] 4.6.4 — Deprecate `/materials` API and `materials` table after cutover
- [ ] 4.6.5 — Keep balances/min stock for warehouse register work; do not copy them onto `Nomenclature`

## Stage 5 — Design System and Platform Templates

Goal:
Create a single visual and layout foundation so new modules use approved page templates and existing pages migrate without redesigning the interface from scratch.

### 5.1 — Audit and inventory

#### 5.1.1 — Routes and page types

Goal:
Build a factual map of frontend routes and classify platform pages.

Microtasks:
- [x] 5.1.1.1 — Audit existing routes, layouts and page types — `v0.9.0`; evidence: `docs/design-system/ui-audit.md`
- [x] 5.1.1.2 — Audit loading, error and empty states — `v0.9.0`; evidence: `docs/design-system/ui-audit.md` § Loading / error / empty audit
- [x] 5.1.1.3 — Audit persistent versus demo/local data — `v0.9.0`; evidence: `docs/design-system/ui-audit.md` § Persistent versus demo/local audit
- [x] 5.1.1.4 — Document reference and migration pages — `v0.9.0`; evidence: `docs/design-system/ui-audit.md` § Reference and migration pages

#### 5.1.2 — Component inventory

- [x] 5.1.2.1 — Inventory shared UI components — `v0.9.0`; evidence: `docs/design-system/component-inventory.md`
- [x] 5.1.2.2 — Inventory domain components — `v0.9.0`; evidence: `docs/design-system/component-inventory.md`
- [x] 5.1.2.3 — Identify duplicates and overlapping responsibilities — `v0.9.0`; evidence: `docs/design-system/component-inventory.md` § Duplicates
- [x] 5.1.2.4 — Define keep, unify, replace and deprecate decisions — `v0.9.0`; evidence: `docs/design-system/component-inventory.md` § Keep / unify / replace / deprecate

#### 5.1.3 — Layout and scrolling audit

- [x] 5.1.3.1 — Audit AppShell and workspace layouts — `v0.9.0`; evidence: `docs/design-system/layout-scrolling-audit.md`
- [x] 5.1.3.2 — Audit page widths and content containers — `v0.9.0`; evidence: `docs/design-system/layout-scrolling-audit.md`
- [x] 5.1.3.3 — Audit nested and double scrolling — `v0.9.0`; evidence: `docs/design-system/layout-scrolling-audit.md`
- [x] 5.1.3.4 — Audit sticky and fixed elements — `v0.9.0`; evidence: `docs/design-system/layout-scrolling-audit.md`
- [x] 5.1.3.5 — Define target scrolling rules — `v0.9.0`; evidence: `docs/design-system/layout-scrolling-audit.md`

#### 5.1.4 — Responsive audit

- [x] 5.1.4.1 — Define responsive verification matrix — `v0.9.0`; evidence: `docs/design-system/responsive-audit.md`
- [x] 5.1.4.2 — Audit desktop layouts — `v0.9.0`; owner visual pass OK (1920/1600/1440/1280, expanded+compact); evidence: `docs/design-system/responsive-audit.md`
- [x] 5.1.4.3 — Audit laptop layouts — `v0.9.0`; owner visual pass OK (1280/1024); evidence: `docs/design-system/responsive-audit.md`
- [x] 5.1.4.4 — Audit tablet layouts — `v0.9.0`; owner visual pass OK (1024/768); evidence: `docs/design-system/responsive-audit.md`
- [x] 5.1.4.5 — Audit mobile layouts — `v0.9.0`; owner visual pass OK (390); left sidebar hidden below `md`, topbar menu carries sections; evidence: `docs/design-system/responsive-audit.md`
- [x] 5.1.4.6 — Register visual bug microtasks — `v0.9.0`; no confirmed `B1+` from responsive visual pass; pre-seed candidates dismissed or deferred (see `responsive-audit.md`)

### 5.2 — Design tokens

#### 5.2.1 — Visual foundations

- [x] 5.2.1.1 — Audit existing token sources — `v0.9.0`; evidence: `docs/design-system/token-sources-audit.md`
- [x] 5.2.1.2 — Define semantic color tokens — `v0.9.0`; Decision A (`#1f5eff`); evidence: `docs/design-system/color-tokens.md`, `frontend/app/globals.css`
- [x] 5.2.1.3 — Define typography scale — `v0.9.0`; Inter + display→caption; evidence: `docs/design-system/typography-tokens.md`, `frontend/app/globals.css`
- [x] 5.2.1.4 — Define spacing scale — `v0.9.0`; 4px grid `space-0…12`; evidence: `docs/design-system/spacing-tokens.md`, `frontend/app/globals.css`
- [x] 5.2.1.5 — Define borders, radius and shadows — `v0.9.0`; evidence: `docs/design-system/surface-tokens.md`, `frontend/app/globals.css`
- [x] 5.2.1.6 — Define component sizes — `v0.9.0`; control 32/40/44 + icons/avatars/shell refs; evidence: `docs/design-system/component-size-tokens.md`
- [x] 5.2.1.7 — Define interaction states — `v0.9.0`; evidence: `docs/design-system/interaction-tokens.md`; owner visual OK (`2026-07-21`)

#### 5.2.2 — Responsive and layer tokens

- [x] 5.2.2.1 — Define breakpoints — `v0.9.0`; evidence: `docs/design-system/breakpoint-tokens.md`
- [x] 5.2.2.2 — Define content width rules — `v0.9.0`; evidence: `docs/design-system/content-width-tokens.md`
- [x] 5.2.2.3 — Define z-index layers — `v0.9.0`; evidence: `docs/design-system/z-index-tokens.md`
- [x] 5.2.2.4 — Define motion rules — `v0.9.0`; evidence: `docs/design-system/motion-tokens.md`
- [x] 5.2.2.5 — Prepare token migration plan — `v0.9.0`; evidence: `docs/design-system/token-migration-plan.md`

### 5.3 — Platform shell

#### 5.3.1 — Navigation shell

- [x] 5.3.1.1 — Standardize sidebar — `v0.9.0`; tokenized without redesign; evidence: `docs/design-system/shell-sidebar-standardization.md`; owner visual OK (`2026-07-21`)
- [x] 5.3.1.2 — Standardize topbar — `v0.9.0`; tokenized; section title removed by product request; evidence: `docs/design-system/shell-topbar-standardization.md`; **owner visual check pending**
- [x] 5.3.1.3 — Standardize workspace tabs — `v0.9.0`; `WorkspaceTabs` removed from AppShell (product request); component deleted
- [x] 5.3.1.4 — Define responsive navigation — `v0.9.0`; evidence: `docs/design-system/shell-responsive-navigation.md`; matrix aligned with implemented `md`/`lg`/`xl` shell behaviour and `5.1.4` owner pass

> Removed by product (`2026-07-21`): former `5.3.1.5` Verify keyboard navigation — keyboard-first platform navigation is not planned.

#### 5.3.2 — Page shell

- [x] 5.3.2.1 — Standardize PageLayout — `v0.9.0`; `PageLayout` + `DS-PAGE-01`; evidence: `docs/design-system/shell-page-layout-standardization.md`; smoke: nomenclature-types
- [x] 5.3.2.2 — Standardize PageHeader — `v0.9.0`; canonical = `PageToolbar` (`DS-PAGE-02`); evidence: `docs/design-system/shell-page-header-standardization.md`
- [x] 5.3.2.3 — Standardize page actions — `v0.9.0`; `PageActions` + `DS-PAGE-03`; evidence: `docs/design-system/shell-page-actions-standardization.md`
- [x] 5.3.2.4 — Standardize content containers — `v0.9.0`; `DS-PAGE-04`; evidence: `docs/design-system/shell-content-containers-standardization.md`
- [x] 5.3.2.5 — Standardize scrolling ownership — `v0.9.0`; `DS-PAGE-05`; evidence: `docs/design-system/shell-scrolling-ownership.md`
- [x] 5.3.2.6 — Add shared loading and error boundaries — `v0.9.0`; `DS-PAGE-06`; `page-state.tsx` + workspace loading/error; nomenclature 404→`notFound()`; lead retry=`reset`; evidence: `docs/design-system/shell-page-state-boundaries.md`
- [x] 5.3.2.7 — Settings catalog routes: segment loading/error boundaries for custom-fields, units-of-measure, and product-characteristics list — `v0.9.0`; `loading.tsx` + `error.tsx` (`PageLoadingState` / `PageErrorState`)
- [x] 5.3.2.8 — Nomenclature card: reliable `notFound()` when the record is missing — `v0.9.0`; numeric-id guard + segment `not-found`/`loading`/`error`

### 5.4 — Shared UI components

#### 5.4.1 — Forms

- [x] 5.4.1.1 — Text and numeric inputs — `v0.9.0`; `Input`/`Textarea`; evidence: `docs/design-system/form-controls-standardization.md`
- [x] 5.4.1.2 — Select and combobox — `v0.9.0`; `Select` + `CityAutocomplete` on shared chrome
- [x] 5.4.1.3 — Checkbox, radio and switch — `v0.9.0`; `Checkbox`/`Radio`/`Switch`
- [x] 5.4.1.4 — Date and money controls — `v0.9.0`; `DateInput`/`MoneyInput`
- [x] 5.4.1.5 — Validation and help states — `v0.9.0`; `Field` help/error + `invalid`
- [x] 5.4.1.6 — Disabled and read-only states — `v0.9.0`; portal disabled/readonly styles; owner visual OK (`2026-07-21`); evidence: `docs/design-system/form-controls-standardization.md`

#### 5.4.2 — Actions and feedback

- [x] 5.4.2.1 — Buttons and icon actions — `v0.9.0`; `Button`/`IconButton`; `DS-ACTION-01`; evidence: `docs/design-system/actions-buttons-standardization.md`; owner visual OK (`2026-07-21`)
- [x] 5.4.2.2 — Status badges — `v0.9.0`; `StatusBadge`/`DS-BADGE-01`; evidence: `docs/design-system/status-badges-standardization.md`; owner visual OK (`2026-07-21`)
- [x] 5.4.2.3.1 — Adopt create inspector/drawer as platform standard — `v0.9.0`; эталон = materials `EntityInspector` create; ADR-013
- [x] 5.4.2.3.2 — Extract shared CreateDrawer shell — `v0.9.0`; `frontend/components/ui/create-drawer.tsx` (docked + overlay)
- [x] 5.4.2.3.3 — Migrate nomenclature create to CreateDrawer — `v0.9.0`; номенклатура/категория docked справа
- [x] 5.4.2.3.4 — Migrate lead create to CreateDrawer — `v0.9.0`; overlay; form controls + toast on success
- [x] 5.4.2.3.5 — Migrate order/deal/task create (replace DemoActionDialog) — `v0.9.0`; `DemoCreateDrawer` overlay (+ clients)
- [x] 5.4.2.3.6 — Migrate remaining nomenclature-section catalog creates (UoM, characteristics, custom fields) — `v0.9.0`; customField kind in CreateDrawer; inline create removed
- [x] 5.4.2.3.7 — Define modal-vs-drawer boundaries and visual verification — `v0.9.0`; evidence: `docs/design-system/create-modal-drawer-boundaries.md`; owner visual OK (`2026-07-21`) for section `5.4.2`
- [x] 5.4.2.4 — Toast and inline feedback — `v0.9.0`; `ToastProvider`/`InlineAlert`; `DS-FEEDBACK-01`; evidence: `docs/design-system/toast-inline-feedback-standardization.md`
- [x] 5.4.2.5 — Loading, empty and error states — `v0.9.0`; EmptyState adoption + in-page alerts; `DS-FEEDBACK-02`; evidence: `docs/design-system/empty-error-states-standardization.md`; owner visual OK (`2026-07-21`)
- [x] 5.4.2.6 — Finish `EmptyState` and shared load-error banners on remaining catalog list pages — `v0.9.0`; EmptyState on PT-02 catalog lists (`5.5.2.5`); segment error UI via `5.3.2.7`

#### 5.4.3 — Data presentation

- [x] 5.4.3.1 — Table foundation — `v0.9.0`; `DS-TABLE-01`; `data-table.tsx`
- [x] 5.4.3.2 — Filter toolbar — `v0.9.0`; `DS-FILTER-01`; `filter-toolbar.tsx`
- [x] 5.4.3.3 — Pagination and totals — `v0.9.0`; `DS-LIST-01`; `list-pagination.tsx`
- [x] 5.4.3.4 — Tabs and compact tabs — `v0.9.0`; `DS-TABS-01`; CompactTabs on lead tasks/history
- [x] 5.4.3.5 — Activity timeline — `v0.9.0`; `DS-TIMELINE-01`; `activity-timeline.tsx`
- [x] 5.4.3.6 — Tasks and comments panels — `v0.9.0`; `DS-PANEL-01`; `entity-panel.tsx`
- [x] 5.4.3.7 — Entity links and inline editing — `v0.9.0`; `DS-LINK-01`; `entity-link.tsx`; evidence: `docs/design-system/data-presentation-standardization.md`; owner visual OK (`2026-07-21`) for section `5.4.3`

### 5.5 — Page templates

#### 5.5.1 — PT-01 Dashboard

- [x] 5.5.1.1 — Define template contract — `v0.9.0`; `DS-PT-01`; evidence: `docs/design-system/pt-01-dashboard.md`
- [x] 5.5.1.2 — Implement reference layout — `v0.9.0`; `SalesDashboard` → `PageLayout`/`PageContent` + `ui/section-card` (D1); deleted `dashboard/section-card.tsx` / `metric-card.tsx`; `PageContent width="full"`
- [x] 5.5.1.3 — Add responsive rules — `v0.9.0`; matrix in `pt-01-dashboard.md`; KPI `ResponsiveGrid`; section grids `md`/`xl`
- [x] 5.5.1.4 — Verify on Sales Dashboard — owner visual OK (`2026-07-21`); full-bleed width confirmed

#### 5.5.2 — PT-02 List/Table Workspace

- [x] 5.5.2.1 — Define template contract — `v0.9.0`; `DS-PT-02`; evidence: `docs/design-system/pt-02-list-table.md`
- [x] 5.5.2.2 — Implement reference layout — `v0.9.0`; `/sales/clients` `ClientsTable` → `PageLayout` + `MetricCard` + DS-TABLE/FILTER/LIST
- [x] 5.5.2.3 — Add responsive table behaviour — `v0.9.0`; `md+` local x-scroll table; `<md` card stack (R3); mobile full-width filter/toolbar fields
- [x] 5.5.2.4 — Verify on organizations or clients — owner visual OK (`2026-07-22`); `/sales/clients` + orders toolbar full-width at 390px
- [x] 5.5.2.5 — Migrate nomenclature catalog list routes — `v0.9.0`; PT-02 shell + left `EditDrawer`; product-characteristics, units-of-measure, nomenclature-categories, nomenclature-types; evidence: `docs/tasks/v0.9.0-catalog-settings-pt02-lists.md`

#### 5.5.3 — PT-03 Kanban Workspace

- [x] 5.5.3.1 — Define template contract — `v0.9.0`; `DS-PT-03`; evidence: `docs/design-system/pt-03-kanban.md`
- [x] 5.5.3.2 — Standardize board structure — `v0.9.0`; portal `KanbanColumn`/`KanbanBoard`; `LeadWorkspace`/`KanbanPage` → `PageLayout` + `MetricCard`
- [x] 5.5.3.3 — Define mobile fallback — `v0.9.0`; local board x-scroll + snap; full-width toolbar (R2)
- [x] 5.5.3.4 — Verify on Leads Kanban — owner visual OK (`2026-07-22`); `/sales/leads`

#### 5.5.4 — PT-04 Tree + List Workspace

- [x] 5.5.4.1 — Define template contract — `v0.9.0`; `DS-PT-04`; evidence: `docs/design-system/pt-04-tree-list.md`
- [x] 5.5.4.2 — Standardize tree and content panes — `v0.9.0`; `TreePane` / `TreeListSplit` / `TreeListContent`; flush strip+table; collapsible dock
- [x] 5.5.4.3 — Add responsive tree drawer — `v0.9.0`; R5; docked/collapsible `lg+`, left drawer `<lg` via toolbar «Группы»
- [x] 5.5.4.4 — Verify on Nomenclature Workspace — owner visual OK (`2026-07-22`); collapsible tree + flush list chrome

#### 5.5.5 — PT-05 Simple Entity Card

- [x] 5.5.5.1 — Define template contract — `v0.9.0`; `DS-PT-05`; evidence: `docs/design-system/pt-05-simple-entity-card.md`
- [x] 5.5.5.2 — Implement reference card — `v0.9.0`; `SimpleEntityCard` + `CharacteristicCard`; `notFound()` + segment not-found
- [x] 5.5.5.3 — Add responsive layout — `v0.9.0`; stacked form/`SectionCard` below `md`; table local x-scroll
- [x] 5.5.5.4 — Verify on organization or client — owner visual OK (`2026-07-22`); factual ref: characteristic card + list (`DS-PT-05` / `5.5.2.5` list shell)

#### 5.5.6 — PT-06 Complex Entity Card

- [x] 5.5.6.1 — Define template contract — `v0.9.0`; `DS-PT-06`; evidence: `docs/design-system/pt-06-complex-entity-card.md`
- [x] 5.5.6.2 — Standardize entity header — `v0.9.0`; `LeadHeader` `data-complex-entity-header`; portal surface tokens
- [x] 5.5.6.3 — Standardize stage and metrics area — `v0.9.0`; stage rail kept; metrics → `SectionCard` + `MetricCard`
- [x] 5.5.6.4 — Standardize section grid — `v0.9.0`; portal section shells; `ComplexEntityCard` + `PageLayout`
- [x] 5.5.6.5 — Standardize activity tabs — `v0.9.0`; `CompactTabs` (`DS-TABS-01`) on narrow bands
- [x] 5.5.6.6 — Define responsive collapse — `v0.9.0`; R4; tabbed panels `<lg`, multi-panel `lg+`
- [x] 5.5.6.7 — Verify on Lead Card — `v0.9.0`; owner **`5.5.6 visual OK`** (`2026-07-22`); tablet stage rail + header grid in `lead-header.tsx`

#### 5.5.7 — PT-07 Document Card

- [x] 5.5.7.1 — Define template contract — `v0.9.0`; `DS-PT-07`; evidence: `docs/design-system/pt-07-document-card.md`
- [x] 5.5.7.2 — Standardize document header — `v0.9.0`; `SalesOrderHeader` + `EntityHeader` (`data-document-header`)
- [x] 5.5.7.3 — Standardize tabular section — `v0.9.0`; `SalesOrderItems` → `SectionCard`; local `overflow-x-auto`
- [x] 5.5.7.4 — Standardize totals and actions — `v0.9.0`; `ListTotals` footer; row save/delete unchanged
- [x] 5.5.7.5 — Define responsive behaviour — `v0.9.0`; contract + stacked sections; line grid local scroll
- [x] 5.5.7.6 — Verify on Customer Order Card — `v0.9.0`; owner **`5.5.7 visual OK`** (`2026-07-22`)

#### 5.5.8 — PT-08 Versioned Workspace

- [x] 5.5.8.1 — Define template contract — `v0.9.0`; `DS-PT-08`; evidence: `docs/design-system/pt-08-versioned-workspace.md`
- [x] 5.5.8.2 — Define active version and history — `v0.9.0`; version bar + history section in contract
- [x] 5.5.8.3 — Define draft and published states — `v0.9.0`; `StatusBadge` state matrix in contract
- [x] 5.5.8.4 — Define compare and restore UX — `v0.9.0`; modal compare + confirm restore (demo)
- [x] 5.5.8.5 — Prepare reference Model Card — `v0.9.0`; `/settings/catalogs/product-models/demo-reference`; `ProductModelCard`

### 5.6 — Reference migrations

> Stage 5 design-platform close (`2026-07-22`): template migrations formalized from prior PT owner visual OKs. Lead **data / block composition** deferred to Stage 1 CRM detailing (owner follow-up). Nomenclature card **pixel HTML parity** polish remains optional under Stage 1/catalog backlog if needed.

- [x] 5.6.1 — Migrate Sales Dashboard — `v0.9.0`; PT-01 alignment (`5.5.1.*`); demo banner; `ui-audit` → reference; prior **`5.5.1 visual OK`**
- [x] 5.6.2 — Migrate Leads Kanban — `v0.9.0`; PT-03 (`LeadWorkspace`); `ui-audit`; prior **`5.5.3 visual OK`**
- [x] 5.6.3 — Migrate Lead Card — `v0.9.0`; PT-06 (`LeadPage`); prior **`5.5.6 visual OK`**; data/composition → Stage 1
- [x] 5.6.4 — Migrate Customer Order Card — `v0.9.0`; PT-07 (`SalesOrderPage`); prior **`5.5.7 visual OK`**
- [x] 5.6.5 — Migrate Nomenclature Workspace — `v0.9.0`; PT-04; prior **`5.5.4 visual OK`**
- [x] 5.6.6 — Migrate Nomenclature Card — `v0.9.0`; PT-06 secondary + segment boundaries (`5.3.2.8`); HTML pixel parity optional later
- [x] 5.6.7 — Create reference Model Card shell — `v0.9.0`; PT-08 demo `/settings/catalogs/product-models/demo-reference` (`5.5.8.5`)

### 5.7 — Responsive and accessibility verification

> Closed with Stage 5 platform checkpoint (`2026-07-22`): cumulative owner visual OK across PT-01…PT-07 reference pages and responsive rules; shell keyboard-first nav cancelled earlier (`5.3.1.5` removed). Deeper CRM/ERP a11y passes follow module detailing.

- [x] 5.7.1 — Desktop matrix — `v0.9.0`; covered via PT owner verifies + `responsive-rules.md` / `responsive-audit.md`
- [x] 5.7.2 — Laptop matrix — `v0.9.0`; same evidence
- [x] 5.7.3 — Tablet matrix — `v0.9.0`; PT-06 tablet stage rail; PT-02/03/04 mobile/tablet passes
- [x] 5.7.4 — Mobile matrix — `v0.9.0`; owner passes at 390px on lists/kanban/cards
- [x] 5.7.5 — Horizontal overflow verification — `v0.9.0`; local overflow rules in PT contracts
- [x] 5.7.6 — Keyboard navigation — `v0.9.0`; platform keyboard-first nav not planned; focus rings via interaction tokens
- [x] 5.7.7 — Focus visibility — `v0.9.0`; `interaction-tokens.md` / portal focus ring
- [x] 5.7.8 — Contrast verification — `v0.9.0`; `color-tokens.md` Decision A baseline
- [x] 5.7.9 — Visual regression checklist — `v0.9.0`; `page-design-checklist.md` + PT verification sections

### 5.8 — Design checkpoint

> Owner Stage 5 close (`2026-07-22`): design platform (tokens, shell, shared UI, PT-01…PT-08, reference migrations) accepted. Module CRM/ERP logic and data composition continue in Stages 1+ / 6+.

- [x] 5.8.1 — Design documentation complete — `v0.9.0`; `docs/design-system/*` contracts PT-01…PT-08
- [x] 5.8.2 — Tokens approved — `v0.9.0`; Stage `5.2.*` shipped
- [x] 5.8.3 — Platform shell approved — `v0.9.0`; `DS-SHELL-01`/`02` protected; Stage `5.3.*`
- [x] 5.8.4 — Page templates approved — `v0.9.0`; Stage `5.5.*` complete
- [x] 5.8.5 — Reference pages approved — `v0.9.0`; Stage `5.6.*` + prior visual OKs
- [x] 5.8.6 — Critical visual bugs fixed — `v0.9.0`; P0/P1 visual blockers closed in Stage 5; residual product polish → module stages
- [x] 5.8.7 — New modules required to use templates — `v0.9.0`; rule in `AGENTS.md` / design-system README; Stage `6.0.3` maps new UIs to PT contracts

## Stage 6 — База лекал

> Structure note (`2026-07-22`, flat model + assembly variants): modules `6.1` Models / `6.2` Size grids / `6.3` Patterns; `6.0` shell and ADR; `6.4` integration checkpoint. Agreed domain: **1 model = 1 size type (men/women/kids) = 1 article**; assembly/finishing variants live on the model; PRODUCT nomenclature holds **available pattern models** whitelist. Commercial assembly packages are Stage 6 (before Specs). Stage 8 keeps shop-floor routings / work centers / execution — not a second place to invent manager-facing assembly variants. Stages 7+ include Technical cards (Stage 9).

Goal:
Собрать справочник моделей изделий для лидов, заказа покупателя, спецификации и технической карты: плоская модель (артикул + тип размера), размерная сетка 1:1, лекала 1:1, варианты сборки/отделки с операциями и стоимостью; на номенклатуре PRODUCT — whitelist доступных моделей.

### 6.0 — Module shell and contracts

#### 6.0.1 — Pattern-base architecture package

Goal:
Single agreed boundary for flat product models, size grids, patterns, assembly variants, and PRODUCT available-models whitelist vs nomenclature variants, specifications, shop routings, and technical cards.

Dependencies:
- 4.1.1
- 4.2.1
- ADR-004
- ADR-006
- ADR-010

Microtasks:
- [x] 6.0.1.1 — Document module boundaries and shared terminology (ADR package): ProductModel, SizeGrid, PatternSet, AssemblyVariant, AssemblyOperationLine; rule `1 model = 1 size_type = 1 article` — `v0.9.0`; evidence: `docs/architecture/decisions/ADR-014-pattern-base-product-models-boundary.md`
- [x] 6.0.1.2 — Define cross-links: PRODUCT «доступные модели лекал», order-item selection chain, specification copy of assembly operations, Stage 8 shop-routing boundary — `v0.9.0`; ADR-014 §§ 3–4
- [x] 6.0.1.3 — Define empty available-models policy and MVP operation lines (inline name+cost vs shared operations catalog) — `v0.9.0`; ADR-014 §§ 5–6 (empty whitelist → model optional; non-empty → required; MVP lines = inline name+cost)
- [x] 6.0.1.4 — Documentation checkpoint — `v0.9.0`; ADR-014 accepted; Stage 9 tech-card ADR reserved as ADR-015; task: `docs/tasks/v0.9.0-stage-6.0.1-pattern-base-adr.md`

Completion criteria:
- ADR(s) approved; no parallel master for model/pattern/assembly-variant data;
- nomenclature variant ≠ product model ≠ assembly variant ≠ Stage 8 shop routing.

#### 6.0.2 — Settings navigation contour

Goal:
Users discover models, size grids, and patterns from one settings section.

Dependencies:
- 6.0.1

Microtasks:
- [x] 6.0.2.1 — Add navigation entries in `frontend/lib/navigation.ts` — `v0.9.0`; settings group `pattern-base` (models / size grids / patterns); evidence: `frontend/lib/navigation.ts`, `frontend/lib/navigation.test.mjs`
- [x] 6.0.2.2 — Route group placeholders for list/card routes — `v0.9.0`; list shells + size-grid/pattern card placeholders without demo catalog data; evidence: `frontend/app/(workspace)/settings/catalogs/{product-models,size-grids,patterns}/`, `frontend/components/settings/catalog-shell-placeholder.tsx`
- [x] 6.0.2.3 — Smoke: shell links resolve (no demo data) — `v0.9.0`; owner visual OK (`2026-07-22`); HTTP 200 shells without demo rows; `DS-SHELL-01`/`DS-SHELL-02` visual contract preserved; task: `docs/tasks/v0.9.0-stage-6.0.2-pattern-base-navigation.md`

Completion criteria:
- section visible in settings; routes exist without 404 shell.

#### 6.0.3 — Page template references

Goal:
List and card UIs follow approved PT contracts before feature fill.

Dependencies:
- 5.5.2
- 5.5.5

Microtasks:
- [x] 6.0.3.1 — Map models/size grids/patterns lists to PT-02 — `v0.9.0`; evidence: `docs/design-system/stage-6.0.3-pattern-base-pt-mapping.md`
- [x] 6.0.3.2 — Map model and pattern cards to PT-05/PT-06 or reference model shell (`5.6.7`); model card includes assembly-variants block — `v0.9.0`; model+pattern → PT-08; size-grid → PT-05; assembly-variants = PT-08 body block
- [x] 6.0.3.3 — Map PRODUCT nomenclature card block «доступные модели лекал» to existing nomenclature card template — `v0.9.0`; no new PT; PRODUCT-only section on existing card
- [x] 6.0.3.4 — Record breakpoints in design-system task evidence — `v0.9.0`; matrix 1920…390 in mapping doc; task: `docs/tasks/v0.9.0-stage-6.0.3-pattern-base-pt-mapping.md`

Completion criteria:
- template IDs documented per workspace/card before implementation iterations.

### 6.1 — Модели изделий (Product Models)

#### 6.1.1 — Product model domain contract

Goal:
Define the flat product-model catalog used in leads, sales orders, specifications, and technical cards: one size type and one article per model; boundaries against nomenclature, size grids, patterns, assembly variants, and production.

Dependencies:
- 4.1.1
- 4.4.1
- 6.0.1

Microtasks:
- [x] 6.1.1.1 — Document model fields and lifecycle: article (unique), name, size_type (men/women/kids), description, status — `v0.9.0`; evidence: `docs/architecture/product-model-domain.md` §2
- [x] 6.1.1.2 — Define 1:1 links to size grid and pattern set; no nested gender contours inside one model — `v0.9.0`; domain §3
- [x] 6.1.1.3 — Define versioning and status rules — `v0.9.0`; domain §4 (`draft`/`active`/`archived` MVP; PT-08 versions in `6.1.6`)
- [x] 6.1.1.4 — Review lead / order-item / specification / technical-card integration constraints — `v0.9.0`; domain §5
- [x] 6.1.1.5 — Documentation checkpoint — `v0.9.0`; task: `docs/tasks/v0.9.0-stage-6.1.1-product-model-domain.md`

Completion criteria:
- model contour has a single agreed source of truth;
- flat rule `1 model = 1 size_type = 1 article` is explicit;
- dependencies on grids, patterns, assembly variants, and specs are explicit.

#### 6.1.2 — Database core for product models

Goal:
Create the persistent database foundation for product models (article, size_type, status) and optional versioning hooks.

Dependencies:
- 6.1.1

Microtasks:
- [x] 6.1.2.1 — Add SQLAlchemy model entities including unique article and size_type — `v0.9.0`; `backend/app/models/product_model.py`
- [x] 6.1.2.2 — Add Alembic migration with upgrade and downgrade — `v0.9.0`; `j0k1l2m3n456_add_product_models.py`
- [x] 6.1.2.3 — Add Pydantic read/write schemas — `v0.9.0`; `backend/app/schemas/product_model.py`
- [x] 6.1.2.4 — Add backend regression tests for persistence — `v0.9.0`; `backend/tests/test_product_models.py` (create/read/update + unique article)

Completion criteria:
- product-model data is stored in PostgreSQL;
- migration is reversible;
- tests cover create/read/update and uniqueness rules.

#### 6.1.3 — Create and list API for product models

Goal:
Users can create and browse product models through backend API.

Dependencies:
- 6.1.2

Microtasks:
- [x] 6.1.3.1 — Add repository list and create operations — `v0.9.0`; `backend/app/repositories/product_models.py`
- [x] 6.1.3.2 — Add service validation for unique article and status defaults — `v0.9.0`; `backend/app/services/product_models.py` (default `draft`; 409 on duplicate article)
- [x] 6.1.3.3 — Add POST and GET endpoints — `v0.9.0`; `/product-models` list/create + get by id
- [x] 6.1.3.4 — Add OpenAPI and regression tests — `v0.9.0`; `test_product_models.py` (operationIds unique; duplicate → 409)

Completion criteria:
- API creates and lists models;
- duplicate articles are rejected;
- regression tests pass.

#### 6.1.4 — Update API for product models

Goal:
Users can change model data and keep it consistent after reload.

Dependencies:
- 6.1.3

Microtasks:
- [ ] 6.1.4.1 — Add update schema
- [ ] 6.1.4.2 — Add repository update operation
- [ ] 6.1.4.3 — Add service validation for editable fields
- [ ] 6.1.4.4 — Add PATCH endpoint
- [ ] 6.1.4.5 — Add regression tests

Completion criteria:
- model data is updated in PostgreSQL;
- validation errors are explicit;
- repeat open shows saved changes.

#### 6.1.5 — Product model status MVP

Goal:
Models support draft/active (or equivalent) before full version history.

Dependencies:
- 6.1.4

Microtasks:
- [ ] 6.1.5.1 — Add status fields and validation rules
- [ ] 6.1.5.2 — Add service rules for activation and deactivation
- [ ] 6.1.5.3 — Add API endpoints for status actions
- [ ] 6.1.5.4 — Add backend regression tests

Completion criteria:
- statuses are persistent and validated;
- UI can show status without full versioning.

#### 6.1.6 — Product model versioning and archival

Goal:
Controlled version history and archival beyond status MVP.

Dependencies:
- 6.1.5

Microtasks:
- [ ] 6.1.6.1 — Add version entity rules and migration if required
- [ ] 6.1.6.2 — Add service rules for version create/activate/archive
- [ ] 6.1.6.3 — Add API endpoints for version actions
- [ ] 6.1.6.4 — Add backend regression tests

Completion criteria:
- versions are traceable;
- state changes are covered by tests.

#### 6.1.7 — Product-model workspace and list

Goal:
Users can open a dedicated product-model workspace and browse the catalog.

Dependencies:
- 6.1.3
- 6.0.3

Microtasks:
- [ ] 6.1.7.1 — Add frontend types and API client
- [ ] 6.1.7.2 — Add list route in the settings workspace route group
- [ ] 6.1.7.3 — Add workspace UI with loading and error states
- [ ] 6.1.7.4 — Add frontend regression tests
- [ ] 6.1.7.5 — Visual verification

Completion criteria:
- workspace opens through a real route;
- list data comes from API;
- loading and error states are explicit.

#### 6.1.8 — Product-model card route

Goal:
Users can open a dedicated product-model card shell.

Dependencies:
- 6.1.7

Microtasks:
- [ ] 6.1.8.1 — Add detail route and page shell
- [ ] 6.1.8.2 — Add card view state (article, size_type, description, status)
- [ ] 6.1.8.3 — Add not-found, loading, and error states
- [ ] 6.1.8.4 — Add frontend regression tests
- [ ] 6.1.8.5 — Visual verification

Completion criteria:
- card URL uses the real route structure;
- page handles loading, missing, and error states correctly.

#### 6.1.9 — Product-model create flow

Goal:
Users can create models from the workspace (CreateDrawer).

Dependencies:
- 6.1.4
- 6.1.8

Microtasks:
- [ ] 6.1.9.1 — Add create form and drawer host (article, size_type, name, description)
- [ ] 6.1.9.2 — Add submit actions and validation mapping
- [ ] 6.1.9.3 — Add frontend regression tests
- [ ] 6.1.9.4 — Visual verification

Completion criteria:
- create flow saves through API;
- validation errors are visible.

#### 6.1.10 — Product-model edit flow

Goal:
Users can edit models on the card.

Dependencies:
- 6.1.9

Microtasks:
- [ ] 6.1.10.1 — Add edit form and save/cancel blocks
- [ ] 6.1.10.2 — Add dirty guard where required
- [ ] 6.1.10.3 — Add frontend regression tests
- [ ] 6.1.10.4 — Visual verification

Completion criteria:
- reopened card shows saved changes;
- edit errors are explicit.

#### 6.1.11 — Available pattern models on PRODUCT nomenclature

Goal:
PRODUCT nomenclature card holds a whitelist «доступные модели лекал» so order entry cannot pick a model outside the allowed set.

Dependencies:
- 4.1.1
- 4.2.1
- 6.1.4
- 6.0.1

Microtasks:
- [ ] 6.1.11.1 — Add M2M (or link table) `nomenclature_id` ↔ `product_model_id` with sort order
- [ ] 6.1.11.2 — Add migration and schemas; allow links only when `nomenclature_type == PRODUCT`
- [ ] 6.1.11.3 — Add service validation (active models; reject SERVICE/GOODS/MATERIAL; empty-list policy from ADR)
- [ ] 6.1.11.4 — Add API + PRODUCT nomenclature card UI for managing available models
- [ ] 6.1.11.5 — Add regression tests (foreign model rejected; non-PRODUCT link rejected)

Completion criteria:
- PRODUCT stores a persistent available-models list;
- invalid links are rejected;
- manager error path is closed at API level, not only in UI.

#### 6.1.12 — Assembly variants on product model

Goal:
Each product model owns assembly/finishing variants (e.g. «С отстрочкой», «Без отстрочки») with ordered operation lines, per-line cost, and variant total — manager-facing packages before Stage 7/8.

Dependencies:
- 6.1.4
- 6.1.8
- 6.0.1

Microtasks:
- [ ] 6.1.12.1 — Define AssemblyVariant + AssemblyOperationLine entities (sequence, operation name or id, Decimal cost; total = Σ lines)
- [ ] 6.1.12.2 — Add Alembic migration, schemas, repository/service CRUD
- [ ] 6.1.12.3 — Add API endpoints scoped to product model
- [ ] 6.1.12.4 — Add model-card UI block for variants and operation lines
- [ ] 6.1.12.5 — Add regression tests (ordering, totals, inactive variants)
- [ ] 6.1.12.6 — Visual verification

Completion criteria:
- variants and operation costs persist on the model;
- totals are consistent and tested;
- Stage 8 shop routings are not required for this MVP package.

#### 6.1.13 — Use model and assembly variant in sales-order items

Goal:
After nomenclature selection, manager picks a model from the PRODUCT whitelist; size_type and model article autofill; then picks an assembly variant of that model. Snapshots keep old orders stable.

Dependencies:
- 6.1.11
- 6.1.12
- 3.2.4

Microtasks:
- [ ] 6.1.13.1 — Define order-item relation + snapshot strategy (model id/article/size_type; variant id/name/total; optional operation-line snapshot)
- [ ] 6.1.13.2 — Add nullable storage and migration
- [ ] 6.1.13.3 — Add schemas and service rules: model ∈ available list; variant ∈ selected model; require model when whitelist non-empty (per ADR)
- [ ] 6.1.13.4 — Add frontend selection flow in order item forms
- [ ] 6.1.13.5 — Add regression tests (whitelist filter; foreign model/variant rejected; snapshot immutability)
- [ ] 6.1.13.6 — Visual verification
- [ ] 6.1.13.7 — Documentation checkpoint (lead reuse notes if applicable)

Completion criteria:
- order chain is nomenclature → available model → assembly variant;
- autofill of size_type and model article works;
- backward-compatible nullable links; snapshots explicit.

### 6.2 — Размерные сетки (Size Grids)

#### 6.2.1 — Size-grid architecture

Goal:
Define the dedicated size-grid contour used by models (1:1) and future order size selection.

Dependencies:
- 6.1.1

Microtasks:
- [ ] 6.2.1.1 — Define size-grid domain and naming rules
- [ ] 6.2.1.2 — Define 1:1 link to product model (one grid per model; grid may be reusable only if ADR allows shared reference)
- [ ] 6.2.1.3 — Define growth groups and measurements scope
- [ ] 6.2.1.4 — Documentation checkpoint

Completion criteria:
- size-grid scope is isolated from ad-hoc order-item size snapshots;
- no multi-gender grids under one model;
- terminology is stable for backend and frontend.

#### 6.2.2 — Size-grid database core

Goal:
Create the persistent storage for size grids, sizes, and growth groups.

Dependencies:
- 6.2.1

Microtasks:
- [ ] 6.2.2.1 — Add SQLAlchemy entities
- [ ] 6.2.2.2 — Add Alembic migration
- [ ] 6.2.2.3 — Add schemas and backend tests

Completion criteria:
- grids and their items are stored persistently;
- migration is reversible.

#### 6.2.3 — Size-grid CRUD API

Goal:
Users can create, view, and update size grids through API.

Dependencies:
- 6.2.2

Microtasks:
- [ ] 6.2.3.1 — Add repository and service CRUD
- [ ] 6.2.3.2 — Add endpoints
- [ ] 6.2.3.3 — Add backend regression tests

Completion criteria:
- API supports CRUD for grids;
- validation is explicit and tested.

#### 6.2.4 — Size-grid list workspace

Goal:
Users can browse size grids in a list workspace.

Dependencies:
- 6.2.3
- 6.0.3

Microtasks:
- [ ] 6.2.4.1 — Add frontend types and API client
- [ ] 6.2.4.2 — Add workspace/list route (PT-02)
- [ ] 6.2.4.3 — Add loading and error states
- [ ] 6.2.4.4 — Add frontend regression tests
- [ ] 6.2.4.5 — Visual verification

Completion criteria:
- list uses real API data;
- workspace states are explicit.

#### 6.2.5 — Size-grid card route

Goal:
Users can open a size-grid card shell.

Dependencies:
- 6.2.4

Microtasks:
- [ ] 6.2.5.1 — Add detail route and page shell
- [ ] 6.2.5.2 — Add not-found, loading, and error states
- [ ] 6.2.5.3 — Add frontend regression tests
- [ ] 6.2.5.4 — Visual verification

Completion criteria:
- card route is stable;
- empty and error states work.

#### 6.2.6 — Size-grid create and edit forms

Goal:
Users can create and edit grids and size rows on the card.

Dependencies:
- 6.2.5

Microtasks:
- [ ] 6.2.6.1 — Add create flow (workspace or drawer)
- [ ] 6.2.6.2 — Add edit forms for grid and lines
- [ ] 6.2.6.3 — Add validation mapping
- [ ] 6.2.6.4 — Add frontend regression tests
- [ ] 6.2.6.5 — Visual verification

Completion criteria:
- forms save through API;
- validation is visible in UI.

#### 6.2.7 — Link size grids to product models

Goal:
A product model references exactly one size grid matching its size_type.

Dependencies:
- 6.1.4
- 6.2.3

Microtasks:
- [ ] 6.2.7.1 — Add backend relation field on product model (single size_grid_id)
- [ ] 6.2.7.2 — Add migration and schema updates
- [ ] 6.2.7.3 — Add service and API validation
- [ ] 6.2.7.4 — Add frontend selection on model card
- [ ] 6.2.7.5 — Add regression tests

Completion criteria:
- product models store a valid 1:1 size-grid relation;
- invalid relations are rejected.

### 6.3 — Лекала (Patterns)

#### 6.3.1 — Pattern domain architecture

Goal:
Define pattern sets, pattern parts, and versioning boundaries for product models (1:1 model → pattern set).

Dependencies:
- 6.1.1
- 6.2.7

Microtasks:
- [ ] 6.3.1.1 — Define pattern entities and lifecycle
- [ ] 6.3.1.2 — Define file and version boundaries
- [ ] 6.3.1.3 — Documentation checkpoint

Completion criteria:
- pattern contour is clearly separated from models, assembly variants, and specifications;
- file/version rules are explicit;
- no nested multi-gender pattern families under one model.

#### 6.3.2 — Pattern database and metadata core

Goal:
Create persistent pattern metadata (sets, parts, versions).

Dependencies:
- 6.3.1

Microtasks:
- [ ] 6.3.2.1 — Add SQLAlchemy entities for pattern sets, parts, and versions
- [ ] 6.3.2.2 — Add Alembic migration
- [ ] 6.3.2.3 — Add file metadata strategy (no uncontrolled parallel store)
- [ ] 6.3.2.4 — Add backend regression tests

Completion criteria:
- pattern metadata is persistent;
- migration is reversible.

#### 6.3.3 — Pattern CRUD API

Goal:
Backend catalog for pattern sets and versions.

Dependencies:
- 6.3.2

Microtasks:
- [ ] 6.3.3.1 — Add repository and service CRUD
- [ ] 6.3.3.2 — Add endpoints
- [ ] 6.3.3.3 — Add backend regression tests

Completion criteria:
- API supports CRUD;
- validation is tested.

#### 6.3.4 — Pattern list workspace

Goal:
Users can browse the pattern catalog in a list workspace.

Dependencies:
- 6.3.3
- 6.0.3

Microtasks:
- [ ] 6.3.4.1 — Add frontend types and API client
- [ ] 6.3.4.2 — Add workspace/list route (PT-02)
- [ ] 6.3.4.3 — Add loading and error states
- [ ] 6.3.4.4 — Add frontend regression tests
- [ ] 6.3.4.5 — Visual verification

Completion criteria:
- catalog list uses persistent API data.

#### 6.3.5 — Pattern card and versions UI

Goal:
Users open a pattern card and manage version metadata.

Dependencies:
- 6.3.4

Microtasks:
- [ ] 6.3.5.1 — Add detail card route
- [ ] 6.3.5.2 — Add version list and metadata view
- [ ] 6.3.5.3 — Add create/edit flows for pattern versions
- [ ] 6.3.5.4 — Add loading/error states
- [ ] 6.3.5.5 — Add frontend regression tests
- [ ] 6.3.5.6 — Visual verification

Completion criteria:
- pattern versions are visible and editable;
- route states are explicit.

#### 6.3.6 — Pattern file storage and delivery

Goal:
Secure upload, storage, download, and delete for pattern files.

Dependencies:
- 6.3.2
- 6.3.5

Microtasks:
- [ ] 6.3.6.1 — Implement storage adapter and path rules
- [ ] 6.3.6.2 — Add upload/download/delete API
- [ ] 6.3.6.3 — Add frontend file actions on pattern card
- [ ] 6.3.6.4 — Add regression tests (size/MIME limits)

Completion criteria:
- file lifecycle is controlled and tested;
- no orphan files outside metadata.

#### 6.3.7 — Link patterns to product models

Goal:
A product model references exactly one pattern set / version family.

Dependencies:
- 6.1.6
- 6.3.5

Microtasks:
- [ ] 6.3.7.1 — Add backend relation field on product model (single pattern_set_id / version family)
- [ ] 6.3.7.2 — Add migration and schemas
- [ ] 6.3.7.3 — Add service validation
- [ ] 6.3.7.4 — Add model-card integration
- [ ] 6.3.7.5 — Add regression tests

Completion criteria:
- model-to-pattern relation is persistent 1:1 and validated;
- model UI exposes the relation clearly.

### 6.4 — Pattern-base integration checkpoint

#### 6.4.1 — End-to-end smoke scenario

Goal:
Prove PRODUCT → available models → model (size grid + patterns + assembly variants) → order-item selection without Stage 7 document creation.

Dependencies:
- 6.1.11
- 6.1.12
- 6.1.13
- 6.2.7
- 6.3.7

Microtasks:
- [ ] 6.4.1.1 — Script or manual smoke checklist (whitelist filter, autofill size_type/article, variant offer, reject foreign model)
- [ ] 6.4.1.2 — Fix P0/P1 gaps found in smoke

Completion criteria:
- one reference path works on persistent API data;
- manager cannot select a model outside PRODUCT available list.

#### 6.4.2 — Readiness documentation sync

Goal:
Factual readiness reflected in project-structure and erp-check.

Dependencies:
- 6.4.1

Microtasks:
- [ ] 6.4.2.1 — Update project-structure checklist items
- [ ] 6.4.2.2 — Update erp-check pattern-base / assembly-variant lines

Completion criteria:
- canonical docs match implemented contour.

#### 6.4.3 — Owner visual pass

Goal:
Owner confirms list/card UX on approved responsive matrix.

Dependencies:
- 6.1.7
- 6.1.12
- 6.2.4
- 6.3.4

Microtasks:
- [ ] 6.4.3.1 — Visual pass: models list/card (incl. assembly variants block)
- [ ] 6.4.3.2 — Visual pass: size grids list/card
- [ ] 6.4.3.3 — Visual pass: patterns list/card
- [ ] 6.4.3.4 — Visual pass: PRODUCT nomenclature available-models block + order selection flow

Completion criteria:
- owner sign-off recorded in roadmap evidence or task file.


## Stage 7 — Specifications

### 7.1 — Domain and persistence

#### 7.1.1 — Specification architecture

Goal:
Define specification scope, versioning, and planning role before production start. Specification copies assembly operation lines from the order-item assembly-variant snapshot (not a live edit of the model master).

Dependencies:
- 6.1.1
- 6.1.12
- 6.1.13
- 6.3.7
- ADR-004

Microtasks:
- [ ] 7.1.1.1 — Define specification entities and version lifecycle
- [ ] 7.1.1.2 — Define material, accessory, norm, and substitute scope
- [ ] 7.1.1.3 — Define copy contract: assembly operations/costs from order-item variant snapshot into specification lines
- [ ] 7.1.1.4 — Documentation checkpoint

Completion criteria:
- specification is explicitly a planned composition;
- operation lines originate from Stage 6 assembly variant via snapshot copy;
- boundaries against production fact are fixed.

#### 7.1.2 — Specification database core

Goal:
Create the persistent storage for specifications and their versions.

Dependencies:
- 7.1.1

Microtasks:
- [ ] 7.1.2.1 — Add SQLAlchemy entities
- [ ] 7.1.2.2 — Add Alembic migration
- [ ] 7.1.2.3 — Add schemas and backend regression tests

Completion criteria:
- specification data is stored persistently;
- migration is reversible;
- tests cover persistence and version structure.

### 7.2 — Specification workflows

#### 7.2.1 — Specification CRUD API

Goal:
Users can create, view, and update specifications through API.

Dependencies:
- 7.1.2

Microtasks:
- [ ] 7.2.1.1 — Add repository and service CRUD
- [ ] 7.2.1.2 — Add endpoints
- [ ] 7.2.1.3 — Add backend regression tests

Completion criteria:
- API supports CRUD for specifications;
- validation and error cases are tested.

#### 7.2.2 — Specification workspace and card

Goal:
Users can manage specifications in a dedicated frontend flow.

Dependencies:
- 7.2.1

Microtasks:
- [ ] 7.2.2.1 — Add frontend types and API client
- [ ] 7.2.2.2 — Add workspace/list route
- [ ] 7.2.2.3 — Add detail card and edit forms
- [ ] 7.2.2.4 — Add loading/error states
- [ ] 7.2.2.5 — Add frontend regression tests
- [ ] 7.2.2.6 — Visual verification

Completion criteria:
- specification workspace uses real API data;
- card and forms are stable;
- route states are explicit.

#### 7.2.3 — Link specifications to order context and product models

Goal:
Specification is formed for an order context: materials/norms plus a copied assembly-operation package from the selected model variant; model master remains unchanged when the specification is edited later.

Dependencies:
- 6.1.6
- 6.1.13
- 7.2.1

Microtasks:
- [ ] 7.2.3.1 — Add backend relation fields (order item / model / variant references as approved)
- [ ] 7.2.3.2 — Add migration and schemas for specification operation lines (snapshot)
- [ ] 7.2.3.3 — Add service: copy assembly operations from order-item variant snapshot on specification create
- [ ] 7.2.3.4 — Add service validation for active/approved versions where applicable
- [ ] 7.2.3.5 — Add workspace/card integration showing copied operations
- [ ] 7.2.3.6 — Add regression tests (copy immutability vs later model-variant edits)

Completion criteria:
- specification receives operation lines from the chosen assembly variant;
- later edits to model variants do not rewrite existing specifications;
- only allowed versions/links can be used.

## Stage 8 — Routings

> Boundary note (`2026-07-22`): manager-facing **assembly variants** (operation packages + costs on the product model) are Stage `6.1.12` / order selection `6.1.13` / specification copy `7.2.3`. Stage 8 covers **shop-floor routings**: work centers, quality checkpoints, and production execution templates — not a duplicate commercial assembly catalog.

### 8.1 — Domain and persistence

#### 8.1.1 — Routing architecture

Goal:
Define shop-routing scope, work centers, quality checkpoints, and how they relate to Stage 6 assembly variants and Stage 7 specification snapshots for planned manufacturing.

Dependencies:
- 6.1.1
- 6.1.12
- 7.2.3
- ADR-004

Microtasks:
- [ ] 8.1.1.1 — Define routing entities and sequencing rules (distinct from AssemblyVariant)
- [ ] 8.1.1.2 — Define links to models/assembly variants, specifications, and future production fact
- [ ] 8.1.1.3 — Documentation checkpoint

Completion criteria:
- routing contour is distinct from production fact and from Stage 6 commercial assembly variants;
- operation order and quality checkpoints are explicit.

#### 8.1.2 — Routing database core

Goal:
Create the persistent storage for routings, operations, and work centers.

Dependencies:
- 8.1.1

Microtasks:
- [ ] 8.1.2.1 — Add SQLAlchemy entities
- [ ] 8.1.2.2 — Add Alembic migration
- [ ] 8.1.2.3 — Add schemas and backend regression tests

Completion criteria:
- routing data is stored persistently;
- migration is reversible;
- tests cover basic persistence rules.

### 8.2 — Routing workflows

#### 8.2.1 — Routing CRUD API

Goal:
Users can create, view, and update routings through API.

Dependencies:
- 8.1.2

Microtasks:
- [ ] 8.2.1.1 — Add repository and service CRUD
- [ ] 8.2.1.2 — Add endpoints
- [ ] 8.2.1.3 — Add backend regression tests

Completion criteria:
- API supports CRUD for routings;
- validation and sequencing constraints are covered.

#### 8.2.2 — Routing workspace and card

Goal:
Users can manage routings in a dedicated frontend flow.

Dependencies:
- 8.2.1

Microtasks:
- [ ] 8.2.2.1 — Add frontend types and API client
- [ ] 8.2.2.2 — Add workspace/list route
- [ ] 8.2.2.3 — Add detail card and edit forms
- [ ] 8.2.2.4 — Add loading/error states
- [ ] 8.2.2.5 — Add frontend regression tests
- [ ] 8.2.2.6 — Visual verification

Completion criteria:
- routing workspace uses real API data;
- card is editable and stable;
- route states are explicit.

#### 8.2.3 — Link shop routings to models / variants and order context

Goal:
A shop routing can be linked to a product model / assembly variant where needed for production execution; order/technical-card flow reuses the approved shop plan without replacing Stage 6 manager packages.

Dependencies:
- 6.1.13
- 8.2.1

Microtasks:
- [ ] 8.2.3.1 — Add backend relation fields
- [ ] 8.2.3.2 — Add migration and schemas
- [ ] 8.2.3.3 — Add service validation for approved routing selection
- [ ] 8.2.3.4 — Add model-card / variant integration notes (no duplicate assembly-variant CRUD)
- [ ] 8.2.3.5 — Add order-context / technical-card integration notes
- [ ] 8.2.3.6 — Add regression tests

Completion criteria:
- model/variant-to-shop-routing relation is persistent and validated when required;
- order-context reuse path is documented and technically prepared;
- Stage 6 assembly variants remain the manager-facing source for costed operation packages.

## Stage 9 — Технические карты (Technical Cards)

Goal:
Производственный документ на одну производимую позицию заказа (номенклатура типа Продукция / Полуфабрикат): связи с моделью, лекалами, материалами и маршрутом; таблица поштучных характеристик (размер, персонализация и т.д.) внутри одного документа; прохождение участков с фиксацией результата. Заказ готов по производству, когда все технические карты по заказу завершены.

Dependencies:
- 3.2.4
- 4.2.1
- 6.1.4, 6.1.11, 6.1.12, 6.1.13, 6.2.7, 6.3.7
- 7.2.3
- 8.2.3
- ADR-004
- ADR-015 (domain contract — to be created; ADR-014 is pattern-base)

### 9.1 — Domain and architecture

#### 9.1.1 — Technical card domain contract

Goal:
Зафиксировать границу между коммерческой позицией заказа и производственным документом; одна ТК на одну производимую строку заказа, не на каждую физическую штуку.

Microtasks:
- [ ] 9.1.1.1 — Define «изделие» (eligible nomenclature types), one card per `SalesOrderItem`, numbering `{orderNo}/{cardSeq}`
- [ ] 9.1.1.2 — Define unit lines matrix: N rows = order line quantity (size, personalization, number, …)
- [ ] 9.1.1.3 — Snapshot vs live link policy for model, assembly variant, patterns, materials, routing template
- [ ] 9.1.1.4 — Order manufacturing completeness: all technical cards in terminal state
- [ ] 9.1.1.5 — Documentation checkpoint (ADR-015)

Completion criteria:
- one technical card per manufacturable order line is the single agreed rule;
- unit-level data lives in lines inside the card, not in separate documents;
- order closure rules are explicit.

#### 9.1.2 — Database core

Goal:
Persistent storage for technical card header, composition links, unit lines, and stage results.

Dependencies:
- 9.1.1

Microtasks:
- [ ] 9.1.2.1 — Add SQLAlchemy entities (header, composition, unit lines, stage results)
- [ ] 9.1.2.2 — Add Alembic migration with upgrade and downgrade
- [ ] 9.1.2.3 — Add Pydantic read/write schemas
- [ ] 9.1.2.4 — Add backend regression tests for persistence

Completion criteria:
- technical card data is stored in PostgreSQL;
- migration is reversible;
- tests cover header, lines, and stage result persistence.

### 9.2 — Generation and lifecycle

#### 9.2.1 — Create technical cards from sales order

Goal:
Users can create one technical card per eligible order line and maintain unit lines when quantity changes.

Dependencies:
- 9.1.2

Microtasks:
- [ ] 9.2.1.1 — Service: create card per manufacturable order line; prefill from nomenclature and model/spec/routing templates
- [ ] 9.2.1.2 — Service: sync unit line count with order line quantity (add/remove rows)
- [ ] 9.2.1.3 — API: generate, preview, cancel draft cards
- [ ] 9.2.1.4 — Regression tests

Completion criteria:
- eligible lines get exactly one technical card;
- quantity changes update unit lines without spawning extra documents.

#### 9.2.2 — Technical card state machine and routing execution

Goal:
The card follows the approved routing; each shop stage records results; transitions are strict.

Dependencies:
- 9.2.1
- 8.2.1

Microtasks:
- [ ] 9.2.2.1 — Status model and allowed transitions aligned with routing operations
- [ ] 9.2.2.2 — Stage gate: previous operation complete before next
- [ ] 9.2.2.3 — Record performer, timestamps, scrap/rework; optional per-unit-line progress inside one card
- [ ] 9.2.2.4 — API for stage completion and controlled rollback
- [ ] 9.2.2.5 — Regression tests

Completion criteria:
- routing execution is traceable on the card;
- invalid skips are rejected;
- stage results are covered by tests.

### 9.3 — Composition and unit lines

#### 9.3.1 — Model, patterns, and materials on card

Goal:
The card references model, pattern set, and planned materials without duplicating master data.

Dependencies:
- 9.2.1

Microtasks:
- [ ] 9.3.1.1 — Persist and validate model / pattern / material lines on card
- [ ] 9.3.1.2 — Apply approved specification version as planned composition
- [ ] 9.3.1.3 — API and regression tests

Completion criteria:
- composition links are persistent and validated;
- specification version rules are enforced.

#### 9.3.2 — Unit lines (sizes and personalization)

Goal:
Users maintain per-piece characteristics inside one technical card (e.g. size, surname, print number).

Dependencies:
- 9.2.1

Microtasks:
- [ ] 9.3.2.1 — Define unit line field set and validation
- [ ] 9.3.2.2 — Defaults from order line snapshots vs per-row edit
- [ ] 9.3.2.3 — API and bulk edit/import hooks
- [ ] 9.3.2.4 — Regression tests

Completion criteria:
- all quantity rows are editable and validated;
- data round-trips through API.

### 9.4 — Frontend

#### 9.4.1 — Sales order integration

Goal:
Order card shows technical cards per line and aggregate manufacturing status.

Dependencies:
- 9.2.1

Microtasks:
- [ ] 9.4.1.1 — Order detail tab: lines → technical card link and status summary
- [ ] 9.4.1.2 — Actions: generate cards, open filtered list
- [ ] 9.4.1.3 — Visual verification (document-style host)

Completion criteria:
- order UI reflects technical card presence and status;
- actions use real API data.

#### 9.4.2 — Technical card list and document card

Goal:
Dedicated list and document card with composition, unit lines table, and stage timeline.

Dependencies:
- 9.2.2
- 9.3.2

Microtasks:
- [ ] 9.4.2.1 — List route with filters (order, stage, status)
- [ ] 9.4.2.2 — Document card: header, composition, unit lines, stage timeline
- [ ] 9.4.2.3 — Stage actions for shop-floor roles; loading and error states
- [ ] 9.4.2.4 — Frontend regression tests and visual verification

Completion criteria:
- list and card use persistent API data;
- unit lines and stages are usable on desktop and responsive breakpoints.

### 9.5 — Order execution linkage

#### 9.5.1 — Manufacturing completeness on sales order

Goal:
Sales order closure and production gates respect technical card completion.

Dependencies:
- 9.2.2
- 3.4.2

Microtasks:
- [ ] 9.5.1.1 — Service: compute order manufacturing completeness from technical cards
- [ ] 9.5.1.2 — Integrate with order execution workflow (reserve, production, shipping, closure)
- [ ] 9.5.1.3 — Documentation and regression tests

Completion criteria:
- order cannot be treated as production-complete while any technical card is open;
- integration points with Stage 3.4 are documented and tested.


## Stage 10 — Design and Approval

### 10.1 — Design assets and comments

- [ ] 10.1.1 — Design project entity and versions
- [ ] 10.1.2 — Layouts, logos, and comments

### 10.2 — Approval workflow

- [ ] 10.2.1 — Client review and correction requests
- [ ] 10.2.2 — Final approval checkpoint before production launch

## Stage 11 — Production

### 11.1 — Production planning

- [ ] 11.1.1 — Production orders and batches
- [ ] 11.1.2 — Planning and work-center assignment

### 11.2 — Production fact

- [ ] 11.2.1 — Operations, performers, output, and scrap
- [ ] 11.2.2 — Quality control and released finished goods

## Stage 12 — Warehouse

### 12.1 — Storage structure

- [ ] 12.1.1 — Warehouses and bins
- [ ] 12.1.2 — Lots and balances

### 12.2 — Movements

- [ ] 12.2.1 — Receipts, issues, reserves, and transfers
- [ ] 12.2.2 — Inventory and finished-goods flow

## Stage 13 — Procurement

### 13.1 — Supplier contour

- [ ] 13.1.1 — Suppliers and supplier prices
- [ ] 13.1.2 — Procurement requests and purchase orders

### 13.2 — Supply execution

- [ ] 13.2.1 — Receipts and returns
- [ ] 13.2.2 — Demand planning and minimum stock linkage

## Stage 14 — Shipping and Payments

### 14.1 — Shipping

- [ ] 14.1.1 — Shipping orders, packaging, delivery, and documents

### 14.2 — Payments

- [ ] 14.2.1 — Invoices, payments, advances, and debt
- [ ] 14.2.2 — Settlements by order and client

## Stage 15 — Costing and Analytics

### 15.1 — Costing

- [ ] 15.1.1 — Planned, normative, and actual costing
- [ ] 15.1.2 — Margin and plan-fact analysis

### 15.2 — Analytics

- [x] 15.2.1 — CRM dashboard and base order analytics
- [ ] 15.2.2 — ERP analytics and management P&L

## Stage 16 — Integrations

### 16.1 — External channels

- [ ] 16.1.1 — Website forms, email, VK, Telegram, and telephony
- [ ] 16.1.2 — Google Sheets and webhooks

### 16.2 — Enterprise exchange

- [ ] 16.2.1 — 1C:UNF exchange
- [ ] 16.2.2 — Delivery and payment-system integrations
- [ ] 16.2.3 — External API for third-party systems

## Stage 17 — Industrial Operations and Access Control

### 17.1 — Access control

- [ ] 17.1.1 — Authentication
- [ ] 17.1.2 — System users, roles, and permissions
- [ ] 17.1.3 — Universal audit trail

### 17.2 — Production operations

- [ ] 17.2.1 — VPS, production Docker, reverse proxy, and HTTPS
- [ ] 17.2.2 — Production deployment pipeline, centralized monitoring, and log aggregation (dev CI covered in `0.2.3`)
- [ ] 17.2.3 — Production backup, disaster recovery, and administrator runbooks (dev/staging scripts covered in `0.3.3`)
