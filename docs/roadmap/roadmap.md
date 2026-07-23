# Sport-Lead — Global Roadmap

**Code:** `SL-ROADMAP-v1`
**Updated:** `2026-07-23` (insert Stage `4.9` Categories catalog UX; keep closed `4.7.2`; boundary + `4.8` honesty + ADR-016; B3 `4.7.11`; sewing `6.3.8`)
**Project version:** `v0.9.0`
**Git branch:** `feature/v0.8.1-nomenclature-core`
**Git commit:** `0980f34`

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

`CRM → Sales orders → Nomenclature (core) + Pattern-base catalog (Stage 6 closed)`

Active Stage 4 work:

`4.7.10` (owner visual create) → `4.8.6` (nomenclature card unify / compat cleanup) → `4.8.7` (orphan cleanup + focused regression); appearance polish of characteristic card → follow-up chat

Next commercial contour:

`Order-item model/assembly binding (3.2.5) → smoke (3.2.6) → Specifications → Routings → Технические карты → … → Администрирование`

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
- [ ] 1.1.5 — Dashboard: top pattern-model sales analysis with filters — dimensions: model article / order count / units manufactured / order amount / sewing-cost amount; depends on order-item model binding `3.2.5` (and sewing costs from assembly-variant snapshots)

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

#### 3.2.5 — Product model and assembly variant on order items

> Moved from Stage `6.1.13` (`2026-07-22`): Stage 6 owns the pattern-base **catalog**; selection and snapshots live on the **sales-order item** (closer to Заказ покупателя than to nomenclature master / база лекал). Whitelist config stays on PRODUCT nomenclature card (`6.1.11`).

Goal:
After nomenclature selection, manager picks a model from the PRODUCT whitelist; size_type and model article autofill; then picks an assembly variant of that model. Snapshots keep old orders stable.

Dependencies:
- 3.2.4
- 6.1.11
- 6.1.12
- 6.2.7

Microtasks:
- [ ] 3.2.5.1 — Define order-item relation + snapshot strategy (model id/article/size_type; variant id/name/total; optional operation-line snapshot)
- [ ] 3.2.5.2 — Add nullable storage and migration
- [ ] 3.2.5.3 — Add schemas and service rules: model ∈ available list; variant ∈ selected model; require model when whitelist non-empty (per ADR-014)
- [ ] 3.2.5.4 — Add frontend selection flow in order item forms
- [ ] 3.2.5.5 — Add regression tests (whitelist filter; foreign model/variant rejected; snapshot immutability)
- [ ] 3.2.5.6 — Visual verification
- [ ] 3.2.5.7 — Documentation checkpoint (lead reuse notes if applicable)

Completion criteria:
- order chain is nomenclature → available model → assembly variant;
- autofill of size_type and model article works;
- backward-compatible nullable links; snapshots explicit.

#### 3.2.6 — Order-item model selection smoke

> Moved from Stage `6.4.1` (`2026-07-22`): full path including order-item selection is a Sales Orders checkpoint, not pattern-base catalog close.

Goal:
Prove PRODUCT → available models → model (size grid + assembly variants + sewing-ops catalog) → order-item selection without Stage 7 document creation.

Dependencies:
- 3.2.5
- 6.1.11
- 6.1.12
- 6.2.7
- 6.3.5

Microtasks:
- [ ] 3.2.6.1 — Script or manual smoke checklist (whitelist filter, autofill size_type/article, variant offer, reject foreign model)
- [ ] 3.2.6.2 — Fix P0/P1 gaps found in smoke

Completion criteria:
- one reference path works on persistent API data;
- manager cannot select a model outside PRODUCT available list.

### 3.3 — Financial document scope

- [ ] 3.3.1 — Order-level discount
- [ ] 3.3.2 — Tax and VAT model
- [ ] 3.3.3 — Currency, quotations, and invoices (order print output consumes Stage 18 print-form registry)

### 3.4 — Order execution

- [ ] 3.4.1 — Design and approval states in order flow
- [ ] 3.4.2 — Reserve, production, shipping, payment, and closure workflow
- [ ] 3.4.3 — Orders list route `loading.tsx` and surfaced network errors (no silent empty list) — gap: `ui-audit.md` § Registered follow-up bugs

## Stage 4 — Nomenclature

### 4.1 — Persistent core

- [x] 4.1.1 — `v0.8.1` persistent nomenclature CRUD, card, search, activity, and base price (`Nomenclature.article` later removed in `4.7.11`)
- [x] 4.1.2 — Nullable order-item link with independent commercial snapshot

### 4.2 — Classification and typed fields

- [x] 4.2.1 — `v0.8.2` nomenclature types and category hierarchy
- [x] 4.2.2 — `v0.8.3` units-of-measure directory and `storage_unit_id`
- [x] 4.2.3 — `v0.8.4` typed custom fields with category inheritance — historical; SoT superseded by ADR-015 / `4.8`

### 4.3 — Workspace and card

- [x] 4.3.1 — `v0.8.5` separate workspace and editable card
- [x] 4.3.2 — `v0.8.8h` direct free assignment of custom fields in the card — historical; card values now via characteristics API (`4.8.6`)
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

Decision (`ADR-012`, owner `2026-07-23`): **materials are a nomenclature type** (`MATERIAL`), not a separate directory. Standalone `materials` catalog/API/table must be removed after cutover. Stock balances stay outside the nomenclature card.

- [x] 4.6.1 — Approve migration plan from `materials` rows to `nomenclatures` with type `MATERIAL` — `2026-07-23`; evidence: `docs/architecture/materials-nomenclature-migration-plan.md`
- [x] 4.6.2 — Migrate data, preserve articles, and stop dual write paths — `2026-07-23`; Alembic `z6a7b8c9d012`; dual-write stopped by removing `/materials` write surface in `4.6.4`
- [x] 4.6.3 — Remove Materials nav entry; materials are filtered nomenclature type only (no separate menu) — `2026-07-23`; `frontend/lib/navigation.ts`
- [x] 4.6.4 — Delete `/materials` API, frontend routes/components, and `materials` table/data after cutover — `v0.9.0`; evidence: drop migration `a1b2c3d4e567` (guarded), API/model/schemas removed; UI/nav leftovers cleared; stock stays out of Nomenclature (`4.6.5`); residual: depends on sibling cutover `z6a7b8c9d012` having run first
- [ ] 4.6.5 — Keep balances/min stock for warehouse register work; do not copy them onto `Nomenclature`

### 4.7 — Nomenclature UI parity with product-models (canonical catalog templates)

Owner ask (`2026-07-23`): `/settings/catalogs/nomenclature` list+card must match `/settings/catalogs/product-models` templates (`DS-PT-02-CATALOG` / `DS-PT-08-CATALOG`).

Dependencies:
- 5.6.5 / 6.0.3.5 (canonical product-model templates)
- 4.3.1

- [x] 4.7.1 — Align nomenclature list with product-models: shared toolbar + row list (not card tiles) — `v0.8.1`; evidence: `frontend/components/settings/nomenclature-workspace.tsx` (PT-02 toolbar + DataTable rows)
- [x] 4.7.2 — Remove left category tree block from nomenclature workspace — `v0.8.1`; evidence: `frontend/components/settings/nomenclature-workspace.tsx` (TreeListSplit/CategoryTree removed); category tree UX → 4.9 (directory only)
- [x] 4.7.3 — Align nomenclature card (`/settings/catalogs/nomenclature/[id]`) with product-models card chrome/layout — `v0.8.1`; `DS-PT-08-CATALOG`; `VersionedWorkspace` + `CatalogVersionedCardLayout`; evidence: `nomenclature-card.tsx`, `nomenclature-media-carousel.tsx`; shell contracts preserved
- [x] 4.7.4 — Map backend nomenclature fields into card requisites by domain logic (remap schema/UI if needed) — `v0.8.1`; core fields in «Основные реквизиты» via `category_id`/`storage_unit_id` (legacy `category`/`unit` derived); custom fields → «Дополнительные реквизиты»; no demo data; existing PATCH API
- [x] 4.7.5 — Port materials quick-preview right panel into nomenclature list route, then drop materials-only preview — `2026-07-23`; `NomenclatureInspector` on list; materials nav removed (`4.6.3`); legacy materials surface deleted in `4.6.4`
- [x] 4.7.6 — Card «Дополнительные реквизиты»: add form with Название + Значение and autocomplete against existing definitions/options — `2026-07-23`; `NomenclatureAddCustomFieldForm`; evidence: `nomenclature-card.tsx`, `nomenclature-add-custom-field-form.tsx`
- [x] 4.7.7 — Expose «Дополнительные реквизиты» as Settings → Номенклатура directory (`/settings/catalogs/custom-fields`) — `2026-07-23`; **superseded by `4.8.5`** (nav removed; redirect → product-characteristics); DS-SHELL-01/02 visual contracts preserved
- [x] 4.7.8 — Unique custom-field `name` (case-insensitive) + card form auto-fill existing name; icon confirm/cancel — `2026-07-23`; Alembic `b2c3d4e5f678`; service `_assert_unique_name`; evidence: `nomenclature-add-custom-field-form.tsx`, `test_lead_conversion.py`
- [x] 4.7.9 / **B2** — Nomenclature create panel fullscreen over list (fix: docked `CreateDrawer` rendered under rows) — `2026-07-23`; `CreateDrawer` variant `fullscreen`; evidence: `create-drawer.tsx`, `nomenclature-create-panels.tsx`, `nomenclature-workspace.tsx`; ADR-013 updated
- [ ] 4.7.10 — Owner visual: confirm nomenclature create field order/rules after `4.7.9` proposal (Identity → Classification → Commercial → Optional; legacy category/unit derived hidden)
- [x] 4.7.11 / **B3** — Drop `Nomenclature.article` (артикул актуален на `ProductModel` / variant; номенклатура идентифицируется `id`+name) — `2026-07-23`; Alembic `e6f7a8b9c012` (after sewing duration rev fix `d5e6f7a8b901`); evidence: model/schemas/services/API/UI; ADR-012/014 notes; variant + product-model articles unchanged

### 4.8 — Unify characteristics catalog (absorb custom fields)

Owner ask (`2026-07-23`): «Дополнительные реквизиты» дублируют характеристики — оставить один справочник; карточку `/product-characteristics/[id]` с inline CRUD значений; удаление только без использования / журнала (`18.4` stub). ADR-015.

- [x] 4.8.1 — ADR-015 + roadmap/HTML microtasks — `2026-07-23`; `ADR-015-unified-characteristics-catalog.md`
- [x] 4.8.2 — Expand `Characteristic*` schema; migrate `CustomField*` data; drop custom tables — `2026-07-23`; Alembic `f7a8b9c0d123`; `/custom-fields` API unmounted; residual: orphan `custom_fields.py` / legacy `materials.py` modules on disk (cleanup with `4.8.7`)
- [x] 4.8.3 — DELETE definition/option + usage guards + journal stub hook — `2026-07-23`; `characteristic_operations_journal.py`; usage blocks in `characteristics` API
- [x] 4.8.4 — Characteristic detail card: main info (name/code/type) + values inline edit/save/delete; owner visual — `2026-07-23`; `characteristic-card.tsx`; **layout confirmed by owner**; appearance/content polish deferred to follow-up chat
- [x] 4.8.5 — Remove «Дополнительные реквизиты» nav; expand create kinds; redirect `/custom-fields` — `2026-07-23`; `navigation.ts` (product-characteristics only); redirect page
- [ ] 4.8.6 — Nomenclature card: unified block on characteristics API; remove custom-fields UI — values API path exists; residual `CustomField*` names/compat shims in card form (`nomenclature-add-custom-field-form.tsx`, `custom-fields-actions.ts`)
- [ ] 4.8.7 — Regression tests + project-structure / erp-check sync — canonical docs synced `2026-07-23`; residual: orphan `custom_fields.py` / `materials.py` cleanup + focused 4.8 regression suite

### 4.9 — Categories catalog UX (warehouse tree)

Owner ask (`2026-07-23`): nomenclature **category** = warehouse/catalog hierarchy; **nomenclature type** (`SERVICE|PRODUCT|GOODS|MATERIAL`) is accounting/card behavior and must NOT restrict which category a row can use. Decoupling shipped in `4.9.1`. Category directory (`4.9.2`): indented tree-table at `/settings/catalogs/nomenclature-categories` with outline numbers `1 / 1.1 / 1.1.2`. **Do not** restore category tree on `/settings/catalogs/nomenclature` list — closed `4.7.2` remains: TreeListSplit/CategoryTree removed from nomenclature workspace; list stays PT-02.

Dependencies:
- 4.2.1 (category hierarchy data model — already done)
- 4.7.2 (tree stays OFF nomenclature list — constraint)
- 5.5.4 / DS-PT-04 (`TreeListSplit` / `TreePane` primitives — reuse, do not fork second tree chrome)
- ADR-006 (nomenclature types/categories) — amend or successor ADR as needed in 4.9.1

- [x] 4.9.1 — Decouple category from nomenclature type: amend ADR-006 (or short ADR note); remove UI filter of categories by type; remove backend type-match validation (`NomenclatureCategoryRuleError` / equivalent); any nomenclature type may sit in any category; regression tests — `2026-07-23`; ADR-006 amendment; service no longer matches types; card/create show all active categories; evidence: `test_nomenclature_category_type_decouple.py`, `nomenclature-category-resolve.test.mjs`
- [x] 4.9.2 — Tree UI on `/settings/catalogs/nomenclature-categories`: hierarchical display with numbering/path like `1`, `1.1`, `1.1.2`, `2`, `2.1` (from `sort_order` + depth or explicit display codes); reuse DS-PT-04 primitives (`TreePane` / `TreeListSplit`) or indented tree-table within PT-02 — prefer PT-04 if it fits directory CRUD; keep EditDrawer/create patterns already used — `2026-07-23`; indented tree-table + collapse (directory *is* the tree; PT-04 split deferred); evidence: `nomenclature-category-tree.ts`, `nomenclature-categories-workspace.tsx`, `nomenclature-category-tree.test.mjs`
- [ ] 4.9.3 — Tree CRUD: create child under selected node, edit parent, reorder/`sort_order`, soft deactivate; cycle-safe parent changes
- [x] 4.9.4 — Nomenclature card + create: category select shows all active categories (path or number label), no type filter; persist `category_id` correctly — `2026-07-23`; outline labels via `buildCategoryTreeRows`; type change no longer clears category; evidence: `nomenclature-card.tsx`, `nomenclature-create-panels.tsx`
- [ ] 4.9.5 — Owner visual: categories tree + card/create category picker

### Proposed create field layout (`4.7.9`, pending `4.7.10`)

```
Идентификация:  Наименование* → Тип
Классификация:  Категория + Единица хранения
Коммерция:      Базовая цена (+ валюта)
Дополнительно:  Наименование для печати → Описание
```

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
- [x] 5.5.4.4 — Verify on Nomenclature Workspace — owner visual OK (`2026-07-22`); historical PT-04 tree check; tree later removed from nomenclature list (`4.7.2`); list now PT-02 row workspace

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

> Structure note (`2026-07-22`, amended): modules `6.1` Models / `6.2` Size grids / `6.3` **Sewing operations** (replaces Patterns/`PatternSet`); `6.0` shell and ADR; `6.4` catalog checkpoint. Agreed domain: **1 model = 1 size type (men/women/kids) = 1 article**; assembly/finishing variants live on the model; PRODUCT nomenclature holds **available pattern models** whitelist; sewing ops = flat `name`+`cost` catalog. Commercial assembly packages are Stage 6 catalog (before Specs). **Order-item selection of model/assembly variant is Stage `3.2.5`** (moved from former `6.1.13`). Stage 8 keeps shop-floor routings / work centers / execution — not a second place to invent manager-facing assembly variants. Stages 7+ include Technical cards (Stage 9).

Goal:
Собрать справочник моделей изделий для лидов, заказа покупателя, спецификации и технической карты: плоская модель (артикул + тип размера), размерная сетка 1:1, плоский справочник операций пошива, варианты сборки/отделки с операциями и стоимостью; на номенклатуре PRODUCT — whitelist доступных моделей.

> Stage 6 catalog close (`2026-07-22`): masters + UI + owner visual OK. Kids Mosmade seed cancelled (`6.2.2.7`). Order binding → `3.2.5` / smoke `3.2.6`.

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
- [x] 6.0.1.4 — Documentation checkpoint — `v0.9.0`; ADR-014 accepted; Stage 9 tech-card ADR reserved as **ADR-016** (ADR-015 = unified characteristics catalog); task: `docs/tasks/v0.9.0-stage-6.0.1-pattern-base-adr.md`

Completion criteria:
- ADR(s) approved; no parallel master for model/pattern/assembly-variant data;
- nomenclature variant ≠ product model ≠ assembly variant ≠ Stage 8 shop routing.

#### 6.0.2 — Settings navigation contour

Goal:
Users discover models, size grids, and patterns from one settings section.

Dependencies:
- 6.0.1

Microtasks:
- [x] 6.0.2.1 — Add navigation entries in `frontend/lib/navigation.ts` — `v0.9.0`; settings group `pattern-base` (models / size grids / **sewing operations**; was patterns); evidence: `frontend/lib/navigation.ts`, `frontend/lib/navigation.test.mjs`
- [x] 6.0.2.2 — Route group placeholders for list/card routes — `v0.9.0`; list shells + size-grid placeholders; **patterns routes removed `2026-07-22`** → `/settings/catalogs/sewing_operations`; evidence: `frontend/app/(workspace)/settings/catalogs/{product-models,size-grids,sewing_operations}/`
- [x] 6.0.2.3 — Smoke: shell links resolve (no demo data) — `v0.9.0`; owner visual OK (`2026-07-22`); HTTP 200 shells without demo rows; `DS-SHELL-01`/`DS-SHELL-02` visual contract preserved; task: `docs/tasks/v0.9.0-stage-6.0.2-pattern-base-navigation.md`

Completion criteria:
- section visible in settings; routes exist without 404 shell.

#### 6.0.3 — Page template references

Goal:
List and card UIs follow approved PT contracts before feature fill. Product-model routes are the **canonical catalog templates** for directories, sections, and categories.

Dependencies:
- 5.5.2
- 5.5.5

Microtasks:
- [x] 6.0.3.1 — Map models/size grids/patterns lists to PT-02 — `v0.9.0`; evidence: `docs/design-system/stage-6.0.3-pattern-base-pt-mapping.md`
- [x] 6.0.3.2 — Map model and pattern cards to PT-05/PT-06 or reference model shell (`5.6.7`); model card includes assembly-variants block — `v0.9.0`; model+pattern → PT-08; size-grid → PT-05; assembly-variants = PT-08 body block
- [x] 6.0.3.3 — Map PRODUCT nomenclature card block «доступные модели лекал» to existing nomenclature card template — `v0.9.0`; no new PT; PRODUCT-only section on existing card
- [x] 6.0.3.4 — Record breakpoints in design-system task evidence — `v0.9.0`; matrix 1920…390 in mapping doc; task: `docs/tasks/v0.9.0-stage-6.0.3-pattern-base-pt-mapping.md`
- [x] 6.0.3.5 — Promote product-model list/card as canonical catalog directory templates — `v0.9.0`; `/settings/catalogs/product-models` → `DS-PT-02-CATALOG`; `/settings/catalogs/product-models/[id]` → `DS-PT-08-CATALOG`; evidence: `docs/design-system/pt-02-catalog-list.md`, `pt-08-catalog-card-layout.md`, mapping update

Completion criteria:
- template IDs documented per workspace/card before implementation iterations;
- catalog directories / sections / categories reuse product-model list+card templates (not Clients / not ad-hoc chrome).

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
- [x] 6.1.4.1 — Add update schema — `v0.9.0`; `ProductModelUpdate` (no status; status via `6.1.5` actions)
- [x] 6.1.4.2 — Add repository update operation — `v0.9.0`; `apply_product_model_updates`
- [x] 6.1.4.3 — Add service validation for editable fields — `v0.9.0`; unique article; `size_type` only while `draft`
- [x] 6.1.4.4 — Add PATCH endpoint — `v0.9.0`; `PATCH /product-models/{id}`
- [x] 6.1.4.5 — Add regression tests — `v0.9.0`; `test_product_models.py`
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
- [x] 6.1.5.1 — Add status fields and validation rules — `v0.9.0`; catalog `draft`/`active`/`archived` (fields from `6.1.2`)
- [x] 6.1.5.2 — Add service rules for activation and deactivation — `v0.9.0`; `activate_product_model` / `archive_product_model` (+ reactivate archived)
- [x] 6.1.5.3 — Add API endpoints for status actions — `v0.9.0`; `POST …/activate`, `POST …/archive`
- [x] 6.1.5.4 — Add backend regression tests — `v0.9.0`; `test_product_model_status_actions_api`

Completion criteria:
- statuses are persistent and validated;
- UI can show status without full versioning.

#### 6.1.6 — Product model versioning and archival

Goal:
Controlled version history and archival beyond status MVP.

Dependencies:
- 6.1.5

Microtasks:
- [x] 6.1.6.1 — Add version entity rules and migration if required — `v0.9.0`; `ProductModelVersion` + `k1l2m3n4o567_add_product_model_versions.py`
- [x] 6.1.6.2 — Add service rules for version create/activate/archive — `v0.9.0`; create draft / publish (≤1 published) / archive; initial v1 on model create
- [x] 6.1.6.3 — Add API endpoints for version actions — `v0.9.0`; `/product-models/{id}/versions` (+ publish/archive)
- [x] 6.1.6.4 — Add backend regression tests — `v0.9.0`; `test_product_model_version_lifecycle_api`

Completion criteria:
- versions are traceable;
- state changes are covered by tests.

#### 6.1.7 — Product-model workspace and list

Goal:
Users can open a dedicated product-model workspace and browse the catalog. This list is the **canonical `DS-PT-02-CATALOG` etalon** for settings directories, sections, and categories.

Dependencies:
- 6.1.3
- 6.0.3

Microtasks:
- [x] 6.1.7.1 — Add frontend types and API client — `v0.9.0`; `frontend/lib/product-models.ts`
- [x] 6.1.7.2 — Add list route in the settings workspace route group — `v0.9.0`; `/settings/catalogs/product-models` → API list (`DS-PT-02-CATALOG` etalon; `6.0.3.5`)
- [x] 6.1.7.3 — Add workspace UI with loading and error states — `v0.9.0`; `ProductModelsWorkspace` + segment loading/error
- [x] 6.1.7.4 — Add frontend regression tests — `v0.9.0`; `frontend/lib/product-models.test.mjs`
- [x] 6.1.7.5 — Visual verification — `v0.9.0`; owner OK `2026-07-22`
- [x] 6.1.7.6 / **B1** — Restore `DS-PT-02-CATALOG` toolbar sequence after product-type filter regression — `v0.9.0`; owner ask `2026-07-23`; locked order: **Search → Reset search → Filter → Reset filter → Print**; Print toggles leading row checkboxes; domain filters (status/type) only in Filter popover; Create (`Plus`) stays in toolbar `end`; evidence: `product-models-workspace.tsx`, `docs/design-system/pt-02-catalog-list.md`

Completion criteria:
- workspace opens through a real route;
- list data comes from API;
- loading and error states are explicit;
- route remains the catalog-list template reference for directories / sections / categories;
- toolbar icon order matches `DS-PT-02-CATALOG` (B1 / `6.1.7.6`).

#### 6.1.8 — Product-model card route

Goal:
Users can open a dedicated product-model card shell. This card is the **canonical `DS-PT-08-CATALOG` etalon** for versioned settings directories (and the layout reference for catalog section/category cards that need the same chrome).

Dependencies:
- 6.1.7

Microtasks:
- [x] 6.1.8.1 — Add detail route and page shell — `v0.9.0`; `/settings/catalogs/product-models/[id]` → API card (`DS-PT-08-CATALOG` etalon; `6.0.3.5`); `demo-reference` kept as PT-08 demo
- [x] 6.1.8.2 — Add card view state (article, size_type, description, status) — `v0.9.0`; `ProductModelPersistentCard` + version bar from API
- [x] 6.1.8.3 — Add not-found, loading, and error states — `v0.9.0`; segment boundaries + numeric guard
- [x] 6.1.8.4 — Add frontend regression tests — `v0.9.0`; `parseProductModelRouteId` / `toProductModelVersionViews`
- [x] 6.1.8.5 — Visual verification — `v0.9.0`; owner OK `2026-07-22`; requisites polish follow-up `6.1.10.5`

Completion criteria:
- card URL uses the real route structure;
- page handles loading, missing, and error states correctly;
- route remains the catalog-card template reference for versioned directories / analogous section cards.

#### 6.1.9 — Product-model create flow

Goal:
Users can create models from the workspace (CreateDrawer).

Dependencies:
- 6.1.4
- 6.1.8

Microtasks:
- [x] 6.1.9.1 — Add create form and drawer host (article, size_type, name, description) — `v0.9.0`; `ProductModelCreateDrawer` + list «Создать»
- [x] 6.1.9.2 — Add submit actions and validation mapping — `v0.9.0`; `createProductModel` server action; `validateProductModelCreateDraft`
- [x] 6.1.9.3 — Add frontend regression tests — `v0.9.0`; `product-models.test.mjs` create-draft validation
- [x] 6.1.9.4 — Visual verification — `v0.9.0`; owner OK `2026-07-22`

Completion criteria:
- create flow saves through API;
- validation errors are visible.

#### 6.1.10 — Product-model edit flow

Goal:
Users can edit models on the card.

Dependencies:
- 6.1.9

Microtasks:
- [x] 6.1.10.1 — Add edit form and save/cancel blocks — `v0.9.0`; card requisites edit + toolbar Save/Cancel
- [x] 6.1.10.2 — Add dirty guard where required — `v0.9.0`; cancel / back / beforeunload when dirty
- [x] 6.1.10.3 — Add frontend regression tests — `v0.9.0`; `isProductModelRequisitesDirty` / create-draft validation reuse
- [x] 6.1.10.4 — Visual verification — `v0.9.0`; owner OK `2026-07-22`
- [x] 6.1.10.5 — Requisites block visual polish — `v0.9.0`; owner OK `2026-07-22`; responsive 1/2/4-col field grid; status edit-gated; accent field layout (name/article/size/status/description); workspace placeholder text synced to `6.2` / sewing-ops; evidence: `product-model-persistent-card.tsx`
- [x] 6.1.10.6 — Pattern meta fields on model card — `v0.9.0`; `patterns_path` (2 cols), `constructor_name` (1 col), `patterns_created_on` (date, 1 col); migration `x4y5z6a7b890`; edit+view in «Основные реквизиты»

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
- [x] 6.1.11.1 — Add M2M (or link table) `nomenclature_id` ↔ `product_model_id` with sort order — `v0.9.0`; `NomenclatureProductModel`
- [x] 6.1.11.2 — Add migration and schemas; allow links only when `nomenclature_type == PRODUCT` — `v0.9.0`; `o5p6q7r8s901`; schemas in `product_model.py`
- [x] 6.1.11.3 — Add service validation (active models; reject SERVICE/GOODS/MATERIAL; empty-list policy from ADR) — `v0.9.0`; `nomenclature_product_models` service
- [x] 6.1.11.4 — Add API + PRODUCT nomenclature card UI for managing available models — `v0.9.0`; `/nomenclatures/{id}/available-models`; `NomenclatureAvailableModelsBlock`
- [x] 6.1.11.5 — Add regression tests (foreign model rejected; non-PRODUCT link rejected) — `v0.9.0`; `test_nomenclature_available_models.py`

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
- [x] 6.1.12.1 — Define AssemblyVariant + AssemblyOperationLine entities (sequence, operation name or id, Decimal cost; total = Σ lines) — `v0.9.0`; `AssemblyVariant` / `AssemblyOperationLine` in `product_model.py`; domain §6
- [x] 6.1.12.2 — Add Alembic migration, schemas, repository/service CRUD — `v0.9.0`; `p6q7r8s9t012`; `repositories/assembly_variants.py`; `services/assembly_variants.py`
- [x] 6.1.12.3 — Add API endpoints scoped to product model — `v0.9.0`; `/product-models/{id}/assembly-variants` (+ lines CRUD/reorder)
- [x] 6.1.12.4 — Add model-card UI block for variants and operation lines — `v0.9.0`; `AssemblyVariantsBlock` on PT-08 card main slot
- [x] 6.1.12.5 — Add regression tests (ordering, totals, inactive variants) — `v0.9.0`; `test_assembly_variants.py`; frontend helpers in `product-models.test.mjs`
- [x] 6.1.12.6 — Visual verification — `v0.9.0`; owner OK `2026-07-22`

Completion criteria:
- variants and operation costs persist on the model;
- totals are consistent and tested;
- Stage 8 shop routings are not required for this MVP package.

> Moved `2026-07-22`: former **`6.1.13`** (use model + assembly variant in sales-order items) → Stage **`3.2.5`**. Pattern-base Stage 6 stops at catalog masters + PRODUCT whitelist UI; commercial line selection is Заказ покупателя.

#### 6.1.14 — Тип изделия (product type) directory

Goal:
Add pattern-base directory **Тип изделия** (product/garment type), separate from nomenclature type.

Dependencies:
- 6.0.2
- 6.1.3

Microtasks:
- [x] 6.1.14.1 — Domain + CRUD model/API for product types (name, active, sort) — `v0.9.0`; `ProductType` + `/product-types`
- [x] 6.1.14.2 — Settings nav under База лекал + list UI (PT-02 catalog) — `v0.9.0`; `/settings/catalogs/product-types`; DS-SHELL-01/02 visual contracts preserved (nav data only)
- [x] 6.1.14.3 — Migration, schemas, regression tests — `v0.9.0`; Alembic `y5z6a7b8c901`; `backend/tests/test_product_types.py`

#### 6.1.15 — Product type on model card requisites

Goal:
Link product model → product type; place field in «Основные реквизиты» under «Путь к лекалам», width 1 column.

Dependencies:
- 6.1.14
- 6.1.10.6

Microtasks:
- [x] 6.1.15.1 — Add nullable `product_type_id` FK + migration/schemas/API — `a1b2c3d4e515`; DTO includes `product_type_name`; iter `2026-07-23`
- [x] 6.1.15.2 — Card UI: select under `patterns_path`, 1-col grid span — `product-model-persistent-card.tsx`
- [x] 6.1.15.3 — Regression tests — `test_product_models.py::test_product_model_product_type_link_and_list_filter`

#### 6.1.16 — Product type on product-models list

Goal:
Show Тип изделия on `/settings/catalogs/product-models` list (column and/or filter).

Dependencies:
- 6.1.15

Microtasks:
- [x] 6.1.16.1 — Include product type in list API/DTO — `product_type_id` + `product_type_name`; list filter `product_type_id`
- [x] 6.1.16.2 — Render on product-models workspace rows — column + type filter select
- [x] 6.1.16.3 — Visual smoke — list/card wired (`product_type` column + filter); owner visual OK pending (not a separate reopen — note only)

### 6.2 — Размерные сетки (Size Grids)

> Decision (`2026-07-22`): **Variant A** — separate `SizeGrid` per `size_type` (`men`/`women`/`kids`). Reference seed from [Mosmade size tables](https://mosmade.ru/about/tablitsy-razmerov/). Import proceeds **one row at a time** (verify, then continue). Domain: `docs/architecture/size-grids-domain.md`.

#### 6.2.1 — Size-grid architecture

Goal:
Define the dedicated size-grid contour used by models (1:1) and future order size selection.

Dependencies:
- 6.1.1

Microtasks:
- [x] 6.2.1.1 — Define size-grid domain and naming rules — `v0.9.0`; Variant A; evidence: `docs/architecture/size-grids-domain.md`
- [x] 6.2.1.2 — Define 1:1 link to product model (one grid per model; shared reference grids allowed for Mosmade seed until later ADR) — `v0.9.0`; domain §4
- [x] 6.2.1.3 — Define growth groups and measurements scope — `v0.9.0`; S/N/T height ranges + ОГ/ОТ/ОБ min/max; domain §2–§3
- [x] 6.2.1.4 — Documentation checkpoint — `v0.9.0`; task: `docs/tasks/v0.9.0-stage-6.2-size-grids-mosmade.md`

Completion criteria:
- size-grid scope is isolated from ad-hoc order-item size snapshots;
- no multi-gender grids under one model;
- terminology is stable for backend and frontend.

#### 6.2.2 — Size-grid database core

Goal:
Create the persistent storage for size grids, sizes, and growth groups; seed Mosmade reference data row-by-row.

Dependencies:
- 6.2.1

Microtasks:
- [x] 6.2.2.1 — Add SQLAlchemy entities — `v0.9.0`; `backend/app/models/size_grid.py`
- [x] 6.2.2.2 — Add Alembic migration — `v0.9.0`; `s9t0u1v2w345_add_size_grids_mosmade_first_row.py`
- [x] 6.2.2.3 — Add schemas and backend read tests — `v0.9.0`; schemas + `GET /size-grids`; `backend/tests/test_size_grids.py`
- [x] 6.2.2.4 — Seed Mosmade men grid + **one** row (RU `46` / INT `S`) — `v0.9.0`; owner verify before remaining rows; evidence: seed helper + migration insert
- [x] 6.2.2.5 — Seed remaining Mosmade men rows — `v0.9.0`; 18 rows; migration `v2w3x4y5z678`
- [x] 6.2.2.6 — Seed Mosmade women grid + rows — `v0.9.0`; «Женская (Mosmade)» 14 rows; same migration
- [x] 6.2.2.7 — ~~Optional: Mosmade kids reference grid (modal table)~~ — **cancelled** `2026-07-22` (no current business need)

Completion criteria:
- grids and their items are stored persistently;
- migration is reversible;
- Mosmade import is incremental and verified.

#### 6.2.3 — Size-grid read API (write cancelled for Stage 6)

Goal:
Read-only catalog API for size grids in Stage 6. Mutations are **not** part of pattern-base MVP.

> Amended `2026-07-22`: create/update/delete of size grids requires an authorized role (auth/roles not implemented yet). Write work moved to Stage `17.1.2` (see `17.1.2.4`). Former write microtasks `6.2.3.1`–`6.2.3.3` are **cancelled** (not blocking Stage 6).

Dependencies:
- 6.2.2

Microtasks:
- [x] 6.2.3.0 — Read API for list/detail (shipped with `6.2.2.3`) — `v0.9.0`; `GET /size-grids`, `GET /size-grids/{id}`
- [x] 6.2.3.1 — ~~Add repository and service write CRUD~~ — **cancelled** `2026-07-22` → `17.1.2.4`
- [x] 6.2.3.2 — ~~Add write endpoints~~ — **cancelled** `2026-07-22` → `17.1.2.4`
- [x] 6.2.3.3 — ~~Add backend regression tests for write path~~ — **cancelled** `2026-07-22` → `17.1.2.4`

Completion criteria:
- read API supports list/get for catalog UI;
- write path is explicitly owned by access-control stage, not Stage 6.

#### 6.2.4 — Size-grid list workspace

Goal:
Users can browse size grids in a list workspace.

Dependencies:
- 6.2.2
- 6.0.3

Microtasks:
- [x] 6.2.4.1 — Add frontend types and API client — `v0.9.0`; `frontend/lib/size-grids.ts`
- [x] 6.2.4.2 — Add workspace/list route (PT-02) — `v0.9.0`; `/settings/catalogs/size-grids` → `SizeGridsWorkspace`
- [x] 6.2.4.3 — Add loading and error states — `v0.9.0`; segment loading/error + EmptyState
- [x] 6.2.4.4 — Add frontend regression tests — `v0.9.0`; `frontend/lib/size-grids.test.mjs`
- [x] 6.2.4.5 — Visual verification — `v0.9.0`; owner OK `2026-07-22`

Completion criteria:
- list uses real API data;
- workspace states are explicit.

#### 6.2.5 — Size-grid card route

Goal:
Users can open a size-grid card shell.

Dependencies:
- 6.2.4

Microtasks:
- [x] 6.2.5.1 — Add detail route and page shell — `v0.9.0`; `/settings/catalogs/size-grids/[id]` → `SizeGridCard` (PT-05)
- [x] 6.2.5.2 — Add not-found, loading, and error states — `v0.9.0`; `not-found.tsx` + segment boundaries
- [x] 6.2.5.3 — Add frontend regression tests — `v0.9.0`; `parseSizeGridRouteId` in `size-grids.test.mjs`
- [x] 6.2.5.4 — Visual verification — `v0.9.0`; owner OK `2026-07-22`

Completion criteria:
- card route is stable;
- empty and error states work.

#### 6.2.6 — Size-grid create and edit forms

Goal:
Authorized users can create and edit grids and size rows on the card.

> Amended `2026-07-22`: edit UI deferred with write API to Stage `17.1.2` (role-gated). Stage 6 card remains **read-only** after visual OK. Former microtasks below are **cancelled** as Stage-6 work (tracked under `17.1.2.4`).

Dependencies:
- 6.2.5
- 17.1.2

Microtasks:
- [x] 6.2.6.1 — ~~Add create flow~~ — **cancelled** `2026-07-22` → `17.1.2.4`
- [x] 6.2.6.2 — ~~Add edit forms for grid and lines~~ — **cancelled** `2026-07-22` → `17.1.2.4`
- [x] 6.2.6.3 — ~~Add validation mapping~~ — **cancelled** `2026-07-22` → `17.1.2.4`
- [x] 6.2.6.4 — ~~Add frontend regression tests~~ — **cancelled** `2026-07-22` → `17.1.2.4`
- [x] 6.2.6.5 — ~~Visual verification~~ — **cancelled** `2026-07-22` → `17.1.2.4`

Completion criteria:
- Stage 6 does not ship unauthenticated grid mutation UI;
- role-gated edit is delivered with `17.1.2.4`.

#### 6.2.7 — Link size grids to product models

Goal:
A product model references exactly one size grid matching its size_type.

Dependencies:
- 6.1.4
- 6.2.2
- 6.2.5

Microtasks:
- [x] 6.2.7.1 — Add backend relation field on product model (single size_grid_id) — `v0.9.0`; `ProductModel.size_grid_id` FK → `size_grids`
- [x] 6.2.7.2 — Add migration and schema updates — `v0.9.0`; `w3x4y5z6a789`; schemas Create/Update/Read
- [x] 6.2.7.3 — Add service and API validation — `v0.9.0`; size_type match; required on activate; clear on incompatible size_type change
- [x] 6.2.7.4 — Add frontend selection on model card — `v0.9.0`; single «Размерная сетка» in requisites (`size_type` derived); draft revert + journal-ops guard stub (`18.4`)
- [x] 6.2.7.5 — Add regression tests — `v0.9.0`; `test_product_model_size_grid_link_api`; frontend dirty/draft helpers

Completion criteria:
- product models store a valid 1:1 size-grid relation;
- invalid relations are rejected.

### 6.3 — Операции пошива (Sewing Operations)

> Amended `2026-07-22`: former «Лекала / PatternSet» contour withdrawn; Stage `6.3` is a flat sewing-operations catalog (`name` + `cost`).

#### 6.3.1 — Sewing-operation domain architecture

Goal:
Define flat `SewingOperation` catalog (name, cost) and boundaries vs assembly variant lines and Stage 8 shop operations.

Dependencies:
- 6.1.1
- 6.0.1

Microtasks:
- [x] 6.3.1.1 — Define sewing-operation entity fields and uniqueness — `v0.9.0`; evidence: `docs/architecture/sewing-operations-domain.md`
- [x] 6.3.1.2 — Document boundary vs inline `AssemblyOperationLine` and withdrawn `PatternSet` — `v0.9.0`; ADR-014 amendment + domain §3
- [x] 6.3.1.3 — Documentation checkpoint — `v0.9.0`; task: `docs/tasks/v0.9.0-stage-6.3-sewing-operations.md`

Completion criteria:
- sewing-ops contour is clearly separated from models, pattern files, and Stage 8 routings;
- no model→pattern_set link in Stage 6.

#### 6.3.2 — Sewing-operation database core

Goal:
Create persistent flat sewing-operations table.

Dependencies:
- 6.3.1

Microtasks:
- [x] 6.3.2.1 — Add SQLAlchemy entity `SewingOperation` — `v0.9.0`; `backend/app/models/sewing_operation.py`
- [x] 6.3.2.2 — Add Alembic migration — `v0.9.0`; `q7r8s9t0u123_add_sewing_operations.py`
- [x] 6.3.2.3 — Add backend regression tests — `v0.9.0`; `backend/tests/test_sewing_operations.py`

Completion criteria:
- sewing operations are persistent;
- migration is reversible.

#### 6.3.3 — Sewing-operation CRUD API

Goal:
Backend catalog CRUD for sewing operations.

Dependencies:
- 6.3.2

Microtasks:
- [x] 6.3.3.1 — Add repository and service CRUD — `v0.9.0`
- [x] 6.3.3.2 — Add endpoints `/sewing-operations` — `v0.9.0`
- [x] 6.3.3.3 — Add backend regression tests — `v0.9.0`; unique name, cost ≥ 0, delete

Completion criteria:
- API supports list/create/get/update/delete;
- validation is tested.

#### 6.3.4 — Sewing-operation list workspace

Goal:
Users browse sewing operations in a PT-02 catalog list like product-models.

Dependencies:
- 6.3.3
- 6.0.3

Microtasks:
- [x] 6.3.4.1 — Add frontend types and API client — `v0.9.0`; `frontend/lib/sewing-operations.ts`
- [x] 6.3.4.2 — Add workspace/list route (PT-02) — `v0.9.0`; `/settings/catalogs/sewing_operations`
- [x] 6.3.4.3 — Add loading and error states — `v0.9.0`
- [x] 6.3.4.4 — Add frontend regression tests — `v0.9.0`; `frontend/lib/sewing-operations.test.mjs`
- [x] 6.3.4.5 — Visual verification — `v0.9.0`; owner OK `2026-07-22`

Completion criteria:
- catalog list uses persistent API data;
- chrome matches `DS-PT-02-CATALOG` etalon (product-models).

#### 6.3.5 — Sewing-operation create and edit UI

Goal:
Users create and edit sewing operations (name, cost) from the list workspace.

Dependencies:
- 6.3.4

Microtasks:
- [x] 6.3.5.1 — Add CreateDrawer flow — `v0.9.0`; `SewingOperationCreateDrawer`
- [x] 6.3.5.2 — Add inline edit and delete on list — `v0.9.0`; `SewingOperationsWorkspace`
- [x] 6.3.5.3 — Add server actions — `v0.9.0`; `sewing-operation-actions.ts`
- [x] 6.3.5.4 — Visual verification — `v0.9.0`; owner OK `2026-07-22`

Completion criteria:
- forms save through API;
- validation is visible in UI.

#### 6.3.6 — Wire sewing operations into assembly variant lines

Goal:
Pick from sewing-operations catalog when building `AssemblyVariant` (copy-on-pick snapshot; nullable `sewing_operation_id`).

Dependencies:
- 6.1.12
- 6.3.5

Microtasks:
- [x] 6.3.6.1 — Decide FK vs copy-on-pick for `AssemblyOperationLine` — `v0.9.0`; copy-on-pick + nullable `sewing_operation_id`
- [x] 6.3.6.2 — Backend schema/API if FK or picker endpoint needed — `v0.9.0`; migration `r8s9t0u1v234`; create/add via `sewing_operation_ids`
- [x] 6.3.6.3 — Model-card assembly UI picker — `v0.9.0`; right `CreateDrawer` with checkboxes + live total
- [x] 6.3.6.4 — Regression tests — `v0.9.0`; `test_assembly_variant_from_sewing_operations_catalog`

Completion criteria:
- managers can reuse catalog rows without breaking existing inline snapshots.

#### 6.3.8 — Operation execution time (duration seconds)

Goal:
Add normative **время выполнения операции** (`duration_seconds`) to the sewing-operations catalog; snapshot onto assembly lines; show on list rows and model assembly totals.

Dependencies:
- 6.3.6

Microtasks:
- [x] 6.3.8.1 — Add `duration_seconds` to `SewingOperation` + Alembic — `2026-07-23`; `d5e6f7a8b901`
- [x] 6.3.8.2 — Snapshot `duration_seconds` on `AssemblyOperationLine` (copy-on-pick) — `2026-07-23`
- [x] 6.3.8.3 — List/create/edit UI + model card per-line time and «Время сборки 1 изделия …» total — `2026-07-23`; evidence: `sewing-operations-workspace.tsx`, `assembly-variants-block.tsx`
- [x] 6.3.8.4 — Regression tests — `2026-07-23`; `test_sewing_operations.py`, `test_assembly_variants.py`, `sewing-operations.test.mjs`

#### 6.3.7 — PatternSet withdrawal checkpoint

Goal:
Confirm PatternSet / patterns routes / model→pattern link are fully removed from Stage 6 scope and docs.

Dependencies:
- 6.3.1

Microtasks:
- [x] 6.3.7.1 — Remove `/settings/catalogs/patterns` routes and nav entry — `v0.9.0`
- [x] 6.3.7.2 — Amend ADR-014 and product-model domain (drop `pattern_set_id`) — `v0.9.0`
- [x] 6.3.7.3 — Sync roadmap HTML / project-structure / PT mapping — `v0.9.0`

Completion criteria:
- no live PatternSet master or patterns nav item remains in Stage 6.

### 6.4 — Pattern-base catalog checkpoint

#### 6.4.1 — End-to-end smoke scenario

> Moved `2026-07-22`: order-item path smoke → Stage **`3.2.6`** (depends on `3.2.5`). Stage 6 catalog close does not wait on sales-order binding.

Dependencies:
- 3.2.5

Microtasks:
- [x] 6.4.1.1 — ~~Script or manual smoke checklist (whitelist filter, autofill size_type/article, variant offer, reject foreign model)~~ — **moved** `2026-07-22` → `3.2.6.1`
- [x] 6.4.1.2 — ~~Fix P0/P1 gaps found in smoke~~ — **moved** `2026-07-22` → `3.2.6.2`

Completion criteria:
- order-item smoke owned by Sales Orders (`3.2.6`); Stage 6 remains catalog-complete without it.

#### 6.4.2 — Readiness documentation sync

Goal:
Factual readiness reflected in project-structure and erp-check.

Dependencies:
- 6.4.3

Microtasks:
- [x] 6.4.2.1 — Update project-structure checklist items — `v0.9.0`; model-base catalog v1 closed; order-item binding → `3.2.5`
- [x] 6.4.2.2 — Update erp-check pattern-base / assembly-variant lines — `v0.9.0`; sewing-ops visual closed; order binding tracked under Stage 3

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
- [x] 6.4.3.1 — Visual pass: models list/card (incl. assembly variants block) — `v0.9.0`; owner OK `2026-07-22`
- [x] 6.4.3.2 — Visual pass: size grids list/card — `v0.9.0`; owner OK `2026-07-22`
- [x] 6.4.3.3 — Visual pass: sewing-operations list (`/settings/catalogs/sewing_operations`) — `v0.9.0`; owner OK `2026-07-22`
- [x] 6.4.3.4 — Visual pass: PRODUCT nomenclature available-models block — `v0.9.0`; owner OK `2026-07-22`; order selection flow → `3.2.5.6`

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
- 3.2.5
- 6.3.5
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
- 3.2.5
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

> Boundary note (`2026-07-22`): manager-facing **assembly variants** (operation packages + costs on the product model) are Stage `6.1.12` / order selection `3.2.5` / specification copy `7.2.3`. Stage 8 covers **shop-floor routings**: work centers, quality checkpoints, and production execution templates — not a duplicate commercial assembly catalog.

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
- 3.2.5
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
- 6.1.4, 6.1.11, 6.1.12, 3.2.5, 6.2.7, 6.3.5
- 7.2.3
- 8.2.3
- ADR-004
- ADR-016 (tech-card domain contract — to be created; ADR-014 is pattern-base; ADR-015 is unified characteristics)

### 9.1 — Domain and architecture

#### 9.1.1 — Technical card domain contract

Goal:
Зафиксировать границу между коммерческой позицией заказа и производственным документом; одна ТК на одну производимую строку заказа, не на каждую физическую штуку.

Microtasks:
- [ ] 9.1.1.1 — Define «изделие» (eligible nomenclature types), one card per `SalesOrderItem`, numbering `{orderNo}/{cardSeq}`
- [ ] 9.1.1.2 — Define unit lines matrix: N rows = order line quantity (size, personalization, number, …)
- [ ] 9.1.1.3 — Snapshot vs live link policy for model, assembly variant, patterns, materials, routing template
- [ ] 9.1.1.4 — Order manufacturing completeness: all technical cards in terminal state
- [ ] 9.1.1.5 — Documentation checkpoint (ADR-016)

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

#### 17.1.1 — Authentication

Goal:
Users sign in before using protected ERP surfaces.

Microtasks:
- [ ] 17.1.1.1 — Define auth strategy and session/token contract
- [ ] 17.1.1.2 — Implement authentication API and session lifecycle
- [ ] 17.1.1.3 — Wire frontend login / session gate
- [ ] 17.1.1.4 — Regression tests and documentation checkpoint

#### 17.1.2 — System users, roles, and permissions

Goal:
Platform has system users, roles, and permission checks for sensitive catalog mutations and admin actions.

Microtasks:
- [ ] 17.1.2.1 — Define user/role/permission domain model
- [ ] 17.1.2.2 — Persist users, roles, and role↔permission links
- [ ] 17.1.2.3 — Enforce permission checks in API (deny-by-default for protected writes)
- [ ] 17.1.2.4 — Size-grid mutation (create/update/delete grids and rows): role-gated API + UI — supersedes cancelled Stage `6.2.3` write / `6.2.6` edit; catalog stays readable without this permission
- [ ] 17.1.2.5 — Administration UI for assigning roles to users
- [ ] 17.1.2.6 — Regression tests (forbidden without role; allowed with role)

Completion criteria:
- unauthorized users cannot mutate size grids;
- authorized role can change size grids end-to-end;
- other modules can reuse the same permission model.

#### 17.1.3 — Universal audit trail

- [ ] 17.1.3.1 — Define audit event contract
- [ ] 17.1.3.2 — Persist and query audit trail
- [ ] 17.1.3.3 — Surface critical mutations (incl. size-grid edits when `17.1.2.4` ships)

### 17.2 — Production operations

- [ ] 17.2.1 — VPS, production Docker, reverse proxy, and HTTPS
- [ ] 17.2.2 — Production deployment pipeline, centralized monitoring, and log aggregation (dev CI covered in `0.2.3`)
- [ ] 17.2.3 — Production backup, disaster recovery, and administrator runbooks (dev/staging scripts covered in `0.3.3`)

## Stage 18 — Администрирование

> Structure note (`2026-07-22`): раздел платформы для **системных настроек** и **справочников платформы**. Доменные каталоги (номенклатура / Stage 4, база лекал / Stage 6 и т.п.) остаются в своих stage и навигационных группах; Stage 18 владеет оболочкой администрирования, кросс-модульными платформенными справочниками, **реестром печатных форм** и **глобальным журналом операций**. Auth/roles остаются в Stage 17.1; production ops — в Stage 17.2.

### 18.1 — Оболочка администрирования и системные настройки

- [ ] 18.1.1 — Navigation contour for Administration (system settings + platform directories + print forms)
- [ ] 18.1.2 — System settings workspace (platform-level parameters)
- [ ] 18.1.3 — Placement rules: platform directories vs domain catalogs (nomenclature, pattern base, organizations)
- [ ] 18.1.4 — Page template mapping for Administration list/card routes (PT-02 / PT-05 as applicable)

### 18.2 — Справочники платформы

- [ ] 18.2.1 — Platform directories registry and domain contracts
- [ ] 18.2.2 — Persistent CRUD API for platform directories under Administration
- [ ] 18.2.3 — Administration UI for platform directories (list/card, no demo substitution)
- [ ] 18.2.4 — Cross-links from consuming modules to platform directories

### 18.3 — Печатные формы

> Category under Administration: print-form templates bound to specific **models** and **directories** (справочники). Document modules (orders, invoices, …) consume the registry; they do not own a parallel template store.

- [ ] 18.3.1 — Print-form domain contract: entity binding (model / directory / document type), status, versioning
- [ ] 18.3.2 — Database model, migration, and schemas for print-form registry and templates
- [ ] 18.3.3 — Service and API: list/create/update, bind to model or directory, activate/archive
- [ ] 18.3.4 — Template storage, preview, and generation pipeline
- [ ] 18.3.5 — Administration UI: print forms list and card under Administration → Печатные формы
- [ ] 18.3.6 — Integration points: sales order / quotation / invoice print output uses registry (link from `3.3.3`)
- [ ] 18.3.7 — Documentation checkpoint (ADR or domain note) and regression tests

### 18.4 — Глобальный журнал операций

Goal:
Единый журнал движений сущностей (сначала — моделей изделий) по продажам и производству. Запись создаётся **только** когда модель реально участвовала в операции (продажа / производство); отсутствие участия = нет записи. Журнал — источник проверки для возврата модели в черновик и смены размерной сетки.

Dependencies:
- 18.1
- 3.2.5 (order-item ↔ model binding for sales writes)
- Stage 8 / technical cards for production writes (as available)

Microtasks:
- [ ] 18.4.1 — Domain contract: OperationJournal entry fields, sources (sales / production), idempotency, retention
- [ ] 18.4.2 — Database model, migration, schemas for global operations journal
- [ ] 18.4.3 — Service API: append / query by entity (`product_model_id`, …); `has_operations(entity)` helper
- [ ] 18.4.4 — Write path: sales order uses model → append journal row (no write if model not used)
- [ ] 18.4.5 — Write path: production / ТК uses model → append journal row
- [ ] 18.4.6 — Wire product-model guards (`revert_to_draft`, size-grid change) to real `has_operations` (replace Stage-6 stub)
- [ ] 18.4.7 — Administration UI: journal list/filter (PT-02) under Администрирование → Журнал операций
- [ ] 18.4.8 — Regression tests + documentation checkpoint

Completion criteria:
- model used in a sale produces a journal row; unused model produces none;
- catalog guards block draft/size changes when journal has rows and show warning: «По данной модели были операции! Изменения могут затронуть отчетность!»;
- journal is readable from Administration.
