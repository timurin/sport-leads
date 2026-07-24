# Sport-Lead — Project Structure Checklist

**Code:** `SL-PROJECT-STRUCTURE-v1`
**Updated:** `2026-07-24` (close `4.9.3` categories tree CRUD; `4.8.7` orphan cleanup; `4.8.6` card unify)
**Project version:** `v0.9.0`
**Git branch:** `feature/v0.8.1-nomenclature-core`
**Git commit:** `0980f34`

## Rules

- `[x]` marks a capability that is implemented and verified by code and applicable checks.
- `[ ]` marks a capability that is not finished or is still demo/local-only in a broader flow.
- Partially implemented areas must be split into narrower checklist items instead of using `[~]`.
- UI alone, API alone, model alone, or documentation alone is not enough to close a checkbox.
- When this checklist changes, `docs/erp/status/project-structure.html` must be updated in the same task.

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
- [ ] Production secrets management, monitoring, and disaster recovery

## 2. CRM and Leads

- [x] Persistent `Lead`, `LeadContact`, `Client`, `LeadEvent`, and stage backend contour
- [x] Lead creation plus customer, contact, and commercial updates through API
- [x] Lead completion, rejection reasons, and transactional conversion to sales order
- [x] Lead detail route with timeline, notes, tasks, and communication UI
- [x] Lead dashboard, Kanban, list, filters, and basic analytics UI
- [ ] Persistent lead workspace without demo/local frontend states
- [ ] Persistent tasks, notes, and communications
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
- [x] Persistent order items with commercial snapshot fields
- [x] Decimal/Numeric line totals and discount-percent recalculation
- [x] Size distribution, color, and personalization snapshots
- [x] Nullable nomenclature and variant links with immutable order snapshots
- [ ] Order-level discount, tax model, currency, print forms, and customer invoice
- [ ] Design, reserve, production, shipping, payment, and closing workflow

## 5. Nomenclature Core

- [x] Persistent nomenclature CRUD, card, search, active flag, and base price — `Nomenclature.article` removed (`4.7.11` / B3; garment article on ProductModel)
- [x] Nomenclature types and category hierarchy — tree directory CRUD (`4.9.3`: create child, parent edit with descendant exclusion, ↑/↓ reorder, soft deactivate)
- [x] Units-of-measure directory and `storage_unit_id` link
- [x] Typed fields with category inheritance and effective schema — historical `CustomField*`; SoT unified into characteristics (`4.8` / ADR-015; Alembic `f7a8b9c0d123`); orphan `custom_fields` modules removed (`4.8.7`)
- [x] Separate workspace and editable card for nomenclature — create uses `CreateDrawer` fullscreen (`4.7.9` / B2); create field order owner OK (`4.7.10`, 50/50 name+price | type+category+unit)
- [x] Nomenclature card free-assignment UI on characteristics names (no `CustomField*` shims) — `4.8.6`
- [x] Stage `4.8` residual: focused regression for unmounted `/custom-fields` + definition DELETE guards — `4.8.7` (`test_characteristics_catalog_4_8.py`)
- [ ] Audit history, archive flow, bulk editing, import, and export

## 6. Nomenclature Characteristics, Variants, and Media

- [x] Product-characteristics directory with typed kinds, options, and color HEX values — expanded kinds + absorbed custom fields (`4.8` / ADR-015)
- [x] Category and nomenclature characteristic assignments
- [x] Characteristic DELETE with usage guards + operations-journal stub (`4.8.3`)
- [x] Characteristic detail card layout (`4.8.4`) — owner confirmed composition; appearance/content polish deferred
- [x] Persistent nomenclature variants with unique combinations and articles
- [x] Sales-order item variant selection with stored characteristic snapshot
- [x] Image media upload, storage, primary image, sorting, and deletion in the card
- [ ] Non-image file attachments
- [ ] Variant pricing, barcodes, and external-sync contour

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
- [x] Sewing operations flat catalog API + PT-02 list UI — `sewing_operations` / `/settings/catalogs/sewing_operations` (`6.3.1–5`; owner visual OK `6.3.4.5` / `6.3.5.4` / `6.4.3.3`); PatternSet withdrawn
- [x] Sewing operation normative duration (`duration_seconds`) + assembly-line snapshot — `6.3.8`; Alembic `d5e6f7a8b901`
- [x] Dedicated size-grid directory and measurements — Mosmade men 18 + women 14; list/card visual OK (`6.2.4.5` / `6.2.5.4` / `6.4.3.2`); Stage-6 read-only; write/edit → `17.1.2.4`; model link `6.2.7` shipped (`ProductModel.size_grid_id`)
- [x] Pattern-base owner visual checkpoint — models / grids / sewing ops / PRODUCT available-models (`6.4.3`); Stage 6 catalog closed
- [ ] Order-item model + assembly-variant selection — Stage `3.2.5` (moved from former `6.1.13`); smoke `3.2.6`
- [ ] Specifications and bill-of-materials contour
- [ ] Routing, operations, equipment, work centers, and quality checkpoints

## 9. Technical cards (Технические карты)

- [ ] Domain contract: one technical card per manufacturable sales order line; unit lines inside the card (**ADR-016**; ADR-015 = unified characteristics)
- [ ] Links to model, sewing operations, materials, routing; stage execution and order manufacturing completeness

## 10. Design, Production, Warehouse, Procurement, and Shipping

- [ ] Design approvals and versioned layouts
- [ ] Production orders, batches, fact operations, scrap, and output
- [ ] Warehouse movements, reserves, inventory, and finished-goods flow
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
- [ ] 1C exchange
- [ ] Universal import and export contour

## 13. Operations and Deployment

- [ ] VPS, production Docker, reverse proxy, HTTPS, and domain
- [x] Dev/staging CI for mandatory checks
- [ ] Production deployment pipeline, centralized monitoring, and log aggregation
- [ ] Production backup, disaster recovery, and administrator runbooks
