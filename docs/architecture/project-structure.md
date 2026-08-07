# Sport-Lead — Project Structure Checklist

**Code:** `SL-PROJECT-STRUCTURE-v1`
**Updated:** `2026-08-06` (v1.00 Stage `23` Unified Work Tasks — ADR-028 / `23.0.1`; Stage `22` Design v1.0 in progress)  
**Project version:** `v0.9.0` / early `v1.00` Stages 0 + 20 + 21 + 22 + 23
**Git branch:** `feature/v0.8.1-nomenclature-core`

## Rules

- `[x]` marks a capability that is implemented and verified by code and applicable checks.
- `[ ]` marks a capability that is not finished or is still demo/local-only in a broader flow.
- Partially implemented areas must be split into narrower checklist items instead of using `[~]`.
- UI alone, API alone, model alone, or documentation alone is not enough to close a checkbox.
- When this checklist changes, `docs/erp/status/project-structure.html` must be updated in the **same task** (atomic MD+HTML twin). Do not close MD checkboxes without the matching HTML `done` state.

## 1. Platform and System Core

- [x] Monorepo with `backend/` and `frontend/`
- [x] FastAPI backend, PostgreSQL, SQLAlchemy, and Alembic migrations
- [x] Next.js workspace shell, navigation, and shared UI layer
- [x] Repository-level verification scripts and project checks
- [x] Documented dev/staging environment contract (`.env.example`, `Settings`)
- [x] API liveness and readiness endpoints
- [x] CI pipeline for mandatory checks (GitHub Actions + `scripts/check_project.py`)
- [x] Dev/staging database backup and restore scripts
- [x] Structured application logging baseline
- [x] List-page data rules (`v1.00` `0.2.1`–`0.2.8`) — `SL-LIST-PAGE-RULES-v1`; product-models/characteristics/warehouse/tech-cards list N+1; PO batch rollups; stock `nomenclature_name`; nomenclature card options-batch
- [x] LAN local-stack access (`v1.00` `0.3.1`–`0.3.3`) — `dev-servers.ps1 -Lan`; CORS/`NEXT_PUBLIC_*` notes; owner smoke OK `2026-08-05`
- [x] Create SalesOrder without Lead (`v1.00` `0.4.1`–`0.4.3`) — nullable `lead_id`; `POST /orders`; FE create drawer; convert intact; owner visual OK `2026-08-05`
- [x] Authentication (`17.1.1`) — ADR-023 + API + `/login` gate shipped (owner visual OK `2026-08-01`)
- [x] System users, roles, and permissions (`17.1.2`) — ADR-024; Alembic `t7u8v9w0x123` + `u8v9w0x1y234`; owner visuals OK `2026-08-01`; **Users cabinet UX** → Stage `21`
- [x] Universal audit trail (`17.1.3`) — ADR-025; Alembic `v9w0x1y2z345`; size-grid «Журнал аудита»; owner visual OK `2026-08-01`
- [x] Administration shell and system settings workspace (`18.1`) — nav «Платформа», system settings workspace, placement rules, and PT mapping; owner visuals OK `2026-08-02`
- [x] Platform directories under Administration (`18.2`) — cities first live directory, persistent API/UI, and CRM consumer cross-links; Alembic `y2z3a4b5c678`; owner visual OK `2026-08-02`
- [x] Print-form registry and sales consumer output (`18.3.1`–`18.3.8`) — domain, persistence, API/pipeline, live registry list/card, `/sales/orders/[id]` print integration, and technical-card A4×2 print/PDF; owner visuals OK `2026-08-02` / `2026-08-03`
- [ ] Universal file subsystem beyond nomenclature images
- [ ] Notifications and background jobs
- [x] Internal staff collaboration chat on sales order + technical card (Stage `19`: threads, @mentions, chat-microtasks, in-app notifications) — ≠ CRM lead comms `1.2.4`; Alembic `g0a1b2c3d456`/`h1b2c3d4e567`; owner visual OK `19.3.5`; **stage sign-off OK** `19.5.3` (`2026-08-04`)
- [x] Lead / order card UX + unified messaging (`v1.00` Stage `20`) — need-cleanup `20.1`; lead layout `20.2`; ADR-027 lead XOR collaboration + shared shell `20.3`; order parity client-need/metrics/comms `20.4`; Alembic `l5m6n7o8p901`; owner visual OK `20.4.5` (`2026-08-05`)
- [x] Settings / Users cabinet (`v1.00` Stage `21`) — nav «Пользователи» `/settings/users` (≠ org «Сотрудники» `2.4.2`); invite/list/profile PATCH; access matrix; extends `17.1.2`; Alembic `m6n7o8p9q012`; owner visual OK `21.5.1` (`2026-08-05`); contract `SL-USERS-CABINET-v1`
- [ ] Design v1.0 (`v1.00` Stage `22`) — Soft UI etalons → platform; `SL-DESIGN-V1-PROCESS-v1`; approved Lead + Order (`22.1`/`22.2`); draft `22.4`–`22.9` (modules + shell); TBD boards `22.3`; task `docs/tasks/v1.00-stage-22-design-v1.md`
- [ ] Unified Work Tasks (`v1.00` Stage `23`) — `WorkTask` replaces `LeadTask` + `CollaborationMicrotask`; ADR-028; chat + images; `storage/task-media`; live `/sales/tasks`; `23.0.1` closed `2026-08-06`; next `23.1`
- [ ] Production secrets management (Vault/etc.) — monitoring + DR covered in `17.2.2`/`17.2.3`; file `.env.production` remains host SoT for secrets MVP

## 2. CRM and Leads

- [x] Persistent `Lead`, `LeadContact`, `Client`, `LeadEvent`, and stage backend contour
- [x] Lead creation plus customer, contact, and commercial updates through API
- [x] Lead completion, rejection reasons, and transactional conversion to sales order
- [x] Lead detail route with timeline, notes, tasks, and communication UI
- [x] Lead dashboard, Kanban, list, filters, and basic analytics UI
- [x] Persistent lead workspace without demo/local frontend states — list/kanban `1.1.3`/`1.1.4` + card demix `1.2.5` owner visual OK `2026-08-01`; production auth actor → `17.1.1`
- [x] Sales dashboard pattern-model analysis (`1.1.5`) — live API panel; owner visual OK `2026-08-01`; other dashboard KPIs still demo
- [x] Persistent lead tasks (`1.2.4.1`–`1.2.4.6`) — owner visual OK `2026-08-01`
- [x] Persistent lead notes (`1.2.4.7`) — owner visual OK `2026-08-01`
- [x] Persistent lead communications (`1.2.4.8`) — owner visual OK `2026-08-01`; mock send only; real connectors → `v1.00` / `1.4.3` (channel transport `16.1`)
- [x] Deals boundary + CRM access-control — `1.3.3`: no separate Deal; `/sales/deals` → orders; lead archive cancelled (converted/rejected); ACL → `17.1.1`; owner visual OK `2026-08-01`
- [x] Persistent client list workspace (`2.2.1`) — `GET /clients` + `/sales/clients`; owner visual OK `2026-08-01`
- [x] Separate client card (`2.2.2`) — PT-05 `/sales/clients/[id]`; owner visual OK `2026-08-01`; history → v1.00

## 3. Organizations, Clients, and Contacts

- [x] Persistent organizations API and `SalesOrder.organization_id` binding
- [ ] Persistent organizations workspace on backend data
- [ ] Persistent employees directory, org structure, and user linkage (`2.4.2`) — org HR «Сотрудники»; **≠** platform Users cabinet Stage `21` / `/settings/users`
- [x] Clients and contacts linked to leads and orders
- [x] Customer and contact saving from the lead workflow
- [ ] Separate persistent client history, deduplication, and settlements (`2.2.3`+ / `2.3`; → v1.00)

## 4. Sales Orders

- [x] Persistent sales-order model, list, detail route, and status history
- [x] Manual order creation without lead (`v1.00` `0.4`) + order creation from lead conversion — `POST /orders`; Alembic `i2j3k4l5m678`; owner visual OK `2026-08-05`
- [x] Organization, client, contact, and responsible bindings in order data
- [x] Order card field-link map and compact UX code (`3.5.1`–`3.5.8`, `3.5.10`) — evidence: `docs/architecture/order-card-field-links.md`, `sales-order-page.tsx`
- [x] Order card owner visual verification (`3.5.9`) — owner OK `2026-07-31` (responsive stack + collapse + sidebar compact ≤1299)
- [ ] Internal order/ТК colleague chat under «Коммуникация» (Stage `19`) — surface filter shipped in `3.5.7`; domain not started
- [x] Persistent order items with commercial snapshot fields
- [x] Decimal/Numeric line totals and discount-percent recalculation
- [x] Size distribution, color, and personalization snapshots
- [x] Nullable nomenclature and variant links with immutable order snapshots
- [x] Order-level discount (`3.3.1`) — `SalesOrder.discount_percent` / computed `discount_amount` / `items_subtotal`; Alembic `c0d1e2f3a456`; card metrics UI
- [x] Tax/VAT on order lines (`3.3.2`) — `price_includes_vat` + line/order `vat_amount` / `amount_net`; Alembic `e2f3a4b5c678`; toolbar BadgePercent apply-all; transfer rule for price docs
- [x] Currency, quotations, invoices (`3.3.3`) — `currency_code` + КП/счёт snapshot API/UI; Alembic `f3a4b5c6d789` / `g4b5c6d7e890`; owner visual OK `2026-07-31`; print templates → Stage 18
- [x] Design approval on order (`3.4.1`) — `design_approval_status` + production gate; Alembic `h5c6d7e8f901`; owner visual OK `2026-07-31`
- [x] Order execution markers (`3.4.2`) — payment + material reserve sales flags + completed-requires-paid; Alembic `i6d7e8f9a012`; owner visual OK `2026-07-31`; warehouse/ledger → Stage 12/14
- [x] Orders list loading/error (`3.4.3`) — segment `loading.tsx`/`error.tsx` + `getOrderList` network catch (no silent empty)

## 5. Nomenclature Core

- [x] Persistent nomenclature CRUD, card, search, active flag, and base price — `Nomenclature.article` removed (`4.7.11` / B3; garment article on ProductModel)
- [x] Nomenclature types and category hierarchy — tree directory CRUD (`4.9.3`) + owner visual OK (`4.9.5`: default collapsed folders, hide №/code, icon actions, expand on parent name click)
- [x] Units-of-measure directory and `storage_unit_id` link
- [x] Typed fields with category inheritance and effective schema — historical `CustomField*`; SoT unified into characteristics (`4.8` / ADR-015; Alembic `f7a8b9c0d123`); orphan `custom_fields` modules removed (`4.8.7`)
- [x] Separate workspace and editable card for nomenclature — create uses `CreateDrawer` fullscreen (`4.7.9` / B2); create field order owner OK (`4.7.10`, 50/50 name+price | type+category+unit)
- [x] Nomenclature card free-assignment UI on characteristics names (no `CustomField*` shims) — `4.8.6`
- [x] Stage `4.8` residual: focused regression for unmounted `/custom-fields` + definition DELETE guards — `4.8.7` (`test_characteristics_catalog_4_8.py`)
- [x] Audit history, archive flow, bulk editing, import, and export — history/archive/bulk `4.3.3` (`v0.9.0`); catalog file I/O `4.5` (ADR-020; inventory `import-export-contours.md`); universal job shell → Stage `16.3`

## 6. Nomenclature Characteristics, Variants, and Media

- [x] Product-characteristics directory with typed kinds, options, and color HEX values — expanded kinds + absorbed custom fields (`4.8` / ADR-015)
- [x] Category and nomenclature characteristic assignments
- [x] Characteristic DELETE with usage guards + operations-journal stub (`4.8.3`)
- [x] Characteristic detail card layout (`4.8.4`) — owner confirmed composition; appearance/content polish deferred
- [x] Persistent nomenclature variants with unique combinations and articles
- [x] Sales-order item variant selection with stored characteristic snapshot
- [x] Image media upload, storage, primary image, sorting, and deletion in the card
- [x] Non-image file attachments — `4.4.5` (`v0.9.0`; pdf/office/zip/txt/csv on same `nomenclature_media`; card «Вложения»)
- [x] Variant pricing, barcodes, and external-sync contour — `4.4.6` (`v0.9.0`; Alembic `b9c0d1e2f345`; card «Варианты»; order suggests variant price; 1C sync remains `16.2.1`)

## 7. Materials

- [x] Persistent material model and CRUD API (legacy; see ADR-012) — removed in `4.6.4`
- [x] Materials as nomenclature type `MATERIAL` — data migration + nav removed (`4.6.1`–`4.6.3`); Alembic `z6a7b8c9d012`
- [x] Relation between materials and the common nomenclature contour — `ADR-012` / `materials-nomenclature-migration-plan.md`
- [x] Delete legacy materials API/UI/table (`4.6.4`) — drop `a1b2c3d4e567`
- [ ] Suppliers, procurement prices, batches, stock balances, and consumption norms (stock balances must not live on the nomenclature card)

## 8. База лекал (Models / Size grids / Sewing ops), Specifications, and Routings

- [x] Size distribution inside sales-order items
- [x] Product-model domain contract — `ADR-014` + `product-model-domain.md` (`6.1.1`)
- [x] Product-model DB + API (create/list/update/status/versions) — `product_models` / `product_model_versions` (`6.1.2`–`6.1.6`)
- [x] Product-model list UI owner visual — `DS-PT-02-CATALOG` etalon `/settings/catalogs/product-models` (`6.1.7.5`; toolbar sequence B1/`6.1.7.6`; directories/sections/categories)
- [x] Product-model card UI owner visual — `DS-PT-08-CATALOG` etalon `/settings/catalogs/product-models/[id]` (`6.1.8.5`; requisites polish `6.1.10.5`)
- [x] Product-model create / edit UI and PRODUCT whitelist — create/edit visual OK; requisites polish `6.1.10.5`; whitelist API+UI `6.1.11` shipped
- [x] Product types directory + model link + list column/filter — `ProductType` (`6.1.14`–`6.1.16`); Alembic `y5z6a7b8c901` / `a1b2c3d4e515`
- [x] Assembly variants API + model-card UI (sewing-ops picker) — `AssemblyVariantsBlock` + copy-on-pick (`6.1.12` / `6.3.6`); owner visual OK `6.1.12.6` (`2026-07-22`)
- [x] Model routing whitelist + operation material norms on product model — Stage `6.1.17` shipped (owner visual OK `2026-07-27`; plan hint; fact on TC/`11.5`–`11.6`)
- [x] Sewing operations flat catalog API + PT-02 list UI — `sewing_operations` / `/settings/catalogs/sewing_operations` (`6.3.1–5`; owner visual OK `6.3.4.5` / `6.3.5.4` / `6.4.3.3`); PatternSet withdrawn
- [x] Sewing operations folder tree catalog (`6.3.11`) + templates library modal (`6.3.12`) + apply template to assembly (`6.3.13`) — owner visual OK `2026-08-02`; Alembic `a4b5c6d7e890` / `b5c6d7e8f901`
- [x] Product-model folders catalog tree (`6.1.18`) + folder default sewing template (`6.1.19`) — owner visual OK `2026-08-03`; Alembic `c6d7e8f9a012` / `d7e8f9a0b123`
- [x] Sewing operation normative duration (`duration_seconds`) + assembly-line snapshot — `6.3.8`; Alembic `d5e6f7a8b901`
- [x] Sewing operation ↔ sewing-shop equipment (`WorkCenter`, цех Пошив) — `6.3.10` closed; Alembic `d1e2f3a4b567`; API `work_center_ids`; UI picker; ≠ routing/TC `11.1.2`
- [x] Dedicated size-grid directory and measurements — Mosmade men 18 + women 14; list/card visual OK (`6.2.4.5` / `6.2.5.4` / `6.4.3.2`); Stage-6 read-only; write/edit → `17.1.2.4`; model link `6.2.7` shipped (`ProductModel.size_grid_id`)
- [x] Pattern-base owner visual checkpoint — models / grids / sewing ops / PRODUCT available-models (`6.4.3`); Stage 6 catalog closed
- [x] Order-item model + assembly-variant selection — Stage `3.2.5` shipped; smoke `3.2.6` shipped `2026-07-27`; order routing `3.2.7` shipped
- [x] Order-item routing template selection from model whitelist — Stage `3.2.7` shipped (owner visual OK `2026-07-27`)
- [ ] Specifications and bill-of-materials contour — Stage 7 **plan+fact report document** from filled TC + execution (ADR-004; not hard dep of Stage 8/9; Documents = link registry later)
- [x] ProductionStage (цех) catalog + routing/ops bind (`8.3`) — Дизайн→Раскрой→Печать→Пошив→ВТО→ОТК→Упаковка; WorkCenter = оборудование; migration `m4n5o6p7q890`; owner visual routings OK `2026-07-28`
- [x] Routing, operations, work centers, QC flags; shop TechOperation catalog (`8.1.3` + required materials `8.1.4`) + routings UI (`8.2`) — `v0.9.0`; ADR-017 amend `8.3`; TC whitelist wire `8.2.3.7`–`8.2.3.8` shipped; migration `l3m4n5o6p789`; owner visual `8.2.2.6` OK `2026-07-28`

## 9. Technical cards (Технические карты)

- [x] Domain contract: one technical card per manufacturable sales order line; unit lines inside the card (**ADR-016** accepted `2026-07-26`; amend Excel/print + Spec↔ТК: composition SoT on TC; Spec outbound Stage 7; **amend plan/fact materials + hard gate `9.3.4` planned `2026-07-27`**)
- [x] Persistence DB core `9.1.2` (`technical_cards` + composition / unit / `TechnicalCardOperationLine` / stage results; soft `tech_operation_id` until `8.1.3`; migration `k2l3m4n5o678`)
- [x] Generate from order `9.2.1` (preview / generate / cancel draft / sync unit lines; eligible = PRODUCT; **no Spec required**)
- [x] Composition on card `9.3.1` (model/pattern/material lines SoT; soft Spec version stamp optional until Stage 7 outbound)
- [x] Composition plan/fact + stage bind + hard material gate cutting/print — Stage `9.3.4`; owner visual OK `2026-07-28`
- [x] Unit lines API `9.3.2` (patch / bulk / replace / aggregate import / reset-defaults; `size_type` male/female; Alembic `o2p3q4r5s678`)
- [x] Operation volumes API `9.3.3` (replace/patch/prefill soft until `8.1.3`; no demo)
- [x] Order ↔ tech cards UI `9.4.1` (gap `#4` closed; owner visual `9.4.1.4` OK)
- [x] Stage machine / routing execution `9.2.2` — start/complete/rollback + gates; evidence `test_technical_cards_9_2_2.py`
- [x] Production list + document UI `9.4.2` — PT-02/07; global `GET /technical-cards`; owner visual `9.4.2.7` OK `2026-07-28`
- [x] Order manufacturing completeness (`9.5`) — service + READY+/status gates; evidence `test_technical_cards_9_5_1.py`; full `3.4.2` docs reuse helper
- [x] Placement: Production + Settings tech-cards nav (`9.0.1`/`9.0.2`); UI contract `9.0.3` (`SL-TECH-CARDS-UI-v1`); order gap `#4` plan `9.0.4` + ship `9.4.1`; settings page `9.6`; print A4×2 `18.3.8` owner visual OK `2026-08-03`

## 10. Design, Production, Warehouse, Procurement, and Shipping

- [x] Design versioned layouts / assets (Stage `10.1`) — **ADR-021/022**; `10.1.1`–`10.1.2` closed (owner visuals OK `2026-08-01`); approval = `3.4.1` + Stage `19` (`10.2` cancelled); shop Дизайн = `11.4`
- [x] Production orders/batches `11.1.1` + WorkCenter planning `11.1.2` + aggregate fact `11.2.1` shipped (owner visuals OK `2026-07-30`); FG warehouse `11.2.2` shipped (owner visual `11.2.2.5` OK `2026-08-01`)
- [x] Shop-floor modules platform + per-цех UIs (`11.3`–`11.10`) — fact on technical card; material `fact_qty` hard gate on Раскрой/Печать (`9.3.4` / `11.5`–`11.6`); owner visuals OK through `11.10.5` (`2026-07-29`)
- [x] Warehouse nomenclature PT-04 `/warehouse/stock` — tree CRUD + list + settings redirects + остаток column/filter + owner visual OK (`4.10.1`–`4.10.7`); live ledger column `12.2.3` (ADR-019)
- [x] Warehouse Stage 12 ledger MVP `12.2` (`12.2.1`–`12.2.5` / former `4.6.5.*`) — StockDocument/Ledger + post/API + live `/warehouse/stock` column + regression + docs sync
- [x] Warehouse FG docs + movements `12.3` (`12.3.1`–`12.3.3`) shipped; inventory/transfers `12.4`–`12.5` → v1.00
- [ ] Procurement requests, supplier orders, receipts, and returns
- [ ] Shipping documents, delivery tracking, and confirmation of receipt

## 11. Finance and Costing

- [ ] Invoices, payments, advances, debt, and settlements
- [ ] Tax model, VAT, price types, and financial documents
- [ ] Planned and actual costing
- [ ] Margin and management P&L

## 12. Analytics and Integrations

- [x] CRM dashboard and basic order analytics
- [x] Collectors, parsers, and import normalization core
- [x] Mock communications connector core
- [ ] Real external CRM and communications adapters
- [ ] Website forms, email, telephony, VK, and Telegram integrations
- [ ] 1C exchange — Stage `16.2.1` (ADR-020 contour D)
- [ ] Universal import and export contour — Stage `16.3` orchestration shell (ADR-020); not `4.5` / not domain `9.3.2`

## 13. Operations and Deployment

- [x] VPS, production Docker, reverse proxy, HTTPS, and domain (`17.2.1`) — in-repo `compose.prod.yaml` + Caddy + runbook; live host apply = owner
- [x] Dev/staging CI for mandatory checks
- [x] Production deployment pipeline, centralized monitoring, and log aggregation (`17.2.2`) — `deploy-production.yml` + health probes + json-file rotation
- [x] Production backup, disaster recovery, and administrator runbooks (`17.2.3`) — `prod-backup/restore` + `docs/ops/production-17-2-3.md`
