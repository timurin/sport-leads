# Sport-Lead — Project Structure Checklist

**Code:** `SL-PROJECT-STRUCTURE-v1`
**Updated:** `2026-07-28` (Stage 19 planned: internal staff chat on order + tech cards)
**Project version:** `v0.9.0`
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
- [ ] Authentication, system users, and access roles
- [ ] Universal audit trail
- [ ] Universal file subsystem beyond nomenclature images
- [ ] Notifications and background jobs
- [ ] Internal staff collaboration chat on sales order + technical card (Stage `19`: threads, @mentions, chat-microtasks) — ≠ CRM lead comms `1.2.4`
- [ ] Production secrets management, monitoring, and disaster recovery

## 2. CRM and Leads

- [x] Persistent `Lead`, `LeadContact`, `Client`, `LeadEvent`, and stage backend contour
- [x] Lead creation plus customer, contact, and commercial updates through API
- [x] Lead completion, rejection reasons, and transactional conversion to sales order
- [x] Lead detail route with timeline, notes, tasks, and communication UI
- [x] Lead dashboard, Kanban, list, filters, and basic analytics UI
- [~] Persistent lead workspace without demo/local frontend states — list/kanban `1.1.3`/`1.1.4` owner visual OK `2026-07-31`; lead card demix `1.2.5.1`–`1.2.5.4` shipped (**STOP visual** `1.2.5.5`)
- [x] Sales dashboard pattern-model analysis (`1.1.5`) — live API panel; owner visual OK `2026-08-01`; other dashboard KPIs still demo
- [x] Persistent lead tasks (`1.2.4.1`–`1.2.4.6`) — owner visual OK `2026-08-01`
- [x] Persistent lead notes (`1.2.4.7`) — owner visual OK `2026-08-01`
- [x] Persistent lead communications (`1.2.4.8`) — owner visual OK `2026-08-01`; mock send only; real connectors → `1.4.3` / `16.1`
- [ ] Deals, archive flow, and finalized access-control contour

## 3. Organizations, Clients, and Contacts

- [x] Persistent organizations API and `SalesOrder.organization_id` binding
- [ ] Persistent organizations workspace on backend data
- [ ] Persistent employees directory, org structure, and user linkage
- [x] Clients and contacts linked to leads and orders
- [x] Customer and contact saving from the lead workflow
- [ ] Separate persistent client workspace, card, history, deduplication, and settlements

## 4. Sales Orders

- [x] Persistent sales-order model, list, detail route, and status history
- [x] Manual order creation and order creation from lead conversion
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
- [ ] Model routing whitelist + operation material norms on product model — Stage `6.1.17` (plan hint; fact on TC/`11.5`–`11.6`)
- [x] Sewing operations flat catalog API + PT-02 list UI — `sewing_operations` / `/settings/catalogs/sewing_operations` (`6.3.1–5`; owner visual OK `6.3.4.5` / `6.3.5.4` / `6.4.3.3`); PatternSet withdrawn
- [x] Sewing operation normative duration (`duration_seconds`) + assembly-line snapshot — `6.3.8`; Alembic `d5e6f7a8b901`
- [x] Sewing operation ↔ sewing-shop equipment (`WorkCenter`, цех Пошив) — `6.3.10` closed; Alembic `d1e2f3a4b567`; API `work_center_ids`; UI picker; ≠ routing/TC `11.1.2`
- [x] Dedicated size-grid directory and measurements — Mosmade men 18 + women 14; list/card visual OK (`6.2.4.5` / `6.2.5.4` / `6.4.3.2`); Stage-6 read-only; write/edit → `17.1.2.4`; model link `6.2.7` shipped (`ProductModel.size_grid_id`)
- [x] Pattern-base owner visual checkpoint — models / grids / sewing ops / PRODUCT available-models (`6.4.3`); Stage 6 catalog closed
- [x] Order-item model + assembly-variant selection — Stage `3.2.5` shipped; smoke `3.2.6` shipped `2026-07-27`; order routing `3.2.7` shipped
- [ ] Order-item routing template selection from model whitelist — Stage `3.2.7`
- [ ] Specifications and bill-of-materials contour — Stage 7 **plan+fact report document** from filled TC + execution (ADR-004; not hard dep of Stage 8/9; Documents = link registry later)
- [x] ProductionStage (цех) catalog + routing/ops bind (`8.3`) — Дизайн→Раскрой→Печать→Пошив→ВТО→ОТК→Упаковка; WorkCenter = оборудование; migration `m4n5o6p7q890`; owner visual routings OK `2026-07-28`
- [x] Routing, operations, work centers, QC flags; shop TechOperation catalog (`8.1.3`) + routings UI (`8.2`) — `v0.9.0`; ADR-017 amend `8.3` + whitelist wire `8.2.3.7`–`8.2.3.8` planned; migration `l3m4n5o6p789`; owner visual `8.2.2.6` OK `2026-07-28`

## 9. Technical cards (Технические карты)

- [x] Domain contract: one technical card per manufacturable sales order line; unit lines inside the card (**ADR-016** accepted `2026-07-26`; amend Excel/print + Spec↔ТК: composition SoT on TC; Spec outbound Stage 7; **amend plan/fact materials + hard gate `9.3.4` planned `2026-07-27`**)
- [x] Persistence DB core `9.1.2` (`technical_cards` + composition / unit / `TechnicalCardOperationLine` / stage results; soft `tech_operation_id` until `8.1.3`; migration `k2l3m4n5o678`)
- [x] Generate from order `9.2.1` (preview / generate / cancel draft / sync unit lines; eligible = PRODUCT; **no Spec required**)
- [x] Composition on card `9.3.1` (model/pattern/material lines SoT; soft Spec version stamp optional until Stage 7 outbound)
- [x] Composition plan/fact + stage bind + hard material gate cutting/print — Stage `9.3.4`; owner visual OK `2026-07-28`
- [x] Unit lines API `9.3.2` (patch / bulk / replace / import / reset-defaults)
- [x] Operation volumes API `9.3.3` (replace/patch/prefill soft until `8.1.3`; no demo)
- [x] Order ↔ tech cards UI `9.4.1` (gap `#4` closed; owner visual `9.4.1.4` OK)
- [x] Stage machine / routing execution `9.2.2` — start/complete/rollback + gates; evidence `test_technical_cards_9_2_2.py`
- [x] Production list + document UI `9.4.2` — PT-02/07; global `GET /technical-cards`; owner visual `9.4.2.7` OK `2026-07-28`
- [x] Order manufacturing completeness (`9.5`) — service + READY+/status gates; evidence `test_technical_cards_9_5_1.py`; full `3.4.2` docs reuse helper
- [x] Placement: Production + Settings tech-cards nav (`9.0.1`/`9.0.2`); UI contract `9.0.3` (`SL-TECH-CARDS-UI-v1`); order gap `#4` plan `9.0.4` + ship `9.4.1`; settings page `9.6`; print A4×2 `18.3.8` still open

## 10. Design, Production, Warehouse, Procurement, and Shipping

- [ ] Design versioned layouts / assets (Stage `10.1`); approval = `3.4.1` order status + Stage `19` chat/microtasks (`10.2` cancelled); shop Дизайн = `11.4`
- [x] Production orders/batches `11.1.1` + WorkCenter planning `11.1.2` + aggregate fact `11.2.1` shipped (owner visuals OK `2026-07-30`); FG warehouse `11.2.2.1`–`11.2.2.3` shipped; wire/visual `11.2.2.4`–`11.2.2.5` open (deps `12.2`)
- [x] Shop-floor modules platform + per-цех UIs (`11.3`–`11.10`) — fact on technical card; material `fact_qty` hard gate on Раскрой/Печать (`9.3.4` / `11.5`–`11.6`); owner visuals OK through `11.10.5` (`2026-07-29`)
- [x] Warehouse nomenclature PT-04 `/warehouse/stock` — tree CRUD + list + settings redirects + остаток column/filter + owner visual OK (`4.10.1`–`4.10.7`); live ledger column `12.2.3` (ADR-019)
- [x] Warehouse Stage 12 ledger MVP `12.2` (`12.2.1`–`12.2.5` / former `4.6.5.*`) — StockDocument/Ledger + post/API + live `/warehouse/stock` column + regression + docs sync
- [ ] Warehouse Stage 12 remainder: FG docs `12.3`, inventory/transfers `12.4`–`12.5` (structure `12.1` done)
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

- [ ] VPS, production Docker, reverse proxy, HTTPS, and domain
- [x] Dev/staging CI for mandatory checks
- [ ] Production deployment pipeline, centralized monitoring, and log aggregation
- [ ] Production backup, disaster recovery, and administrator runbooks
