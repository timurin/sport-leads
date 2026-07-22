# Sport-Lead — Project Structure Checklist

**Code:** `SL-PROJECT-STRUCTURE-v1`
**Updated:** `2026-07-22` (`ADR-014` + `product-model-domain.md` `6.1.1`; Stage 9 tech-card ADR → `ADR-015`)
**Project version:** `v0.9.0`
**Git branch:** `feature/v0.8.1-nomenclature-core`
**Git commit:** `bc63397`

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

- [x] Persistent nomenclature CRUD, card, search, active flag, article, and base price
- [x] Nomenclature types and category hierarchy
- [x] Units-of-measure directory and `storage_unit_id` link
- [x] Typed custom fields with category inheritance and effective schema
- [x] Separate workspace and editable card for nomenclature
- [x] Direct free assignment of custom fields to a nomenclature card
- [ ] Audit history, archive flow, bulk editing, import, and export

## 6. Nomenclature Characteristics, Variants, and Media

- [x] Product-characteristics directory with typed kinds, options, and color HEX values
- [x] Category and nomenclature characteristic assignments
- [x] Persistent nomenclature variants with unique combinations and articles
- [x] Sales-order item variant selection with stored characteristic snapshot
- [x] Image media upload, storage, primary image, sorting, and deletion in the card
- [ ] Non-image file attachments
- [ ] Variant pricing, barcodes, and external-sync contour

## 7. Materials

- [x] Persistent material model and CRUD API (legacy; see ADR-012)
- [ ] Persistent materials workspace on backend data — superseded by nomenclature filter (`4.6.3`) unless interim
- [ ] Relation between materials and the common nomenclature contour — `ADR-012` / roadmap `4.6` (migrate into `Nomenclature` type `MATERIAL`)
- [ ] Suppliers, procurement prices, batches, stock balances, and consumption norms (stock balances must not live on the nomenclature card)

## 8. База лекал (Models / Size grids / Patterns), Specifications, and Routings

- [x] Size distribution inside sales-order items
- [ ] Product-model catalog and versioning — domain `ADR-014` + `product-model-domain.md`; DB `product_models` + create/list API (`6.1.2`/`6.1.3`); update/UI not started
- [ ] Pattern catalog, files, and grading
- [ ] Dedicated size-grid directory and measurements
- [ ] Specifications and bill-of-materials contour
- [ ] Routing, operations, equipment, work centers, and quality checkpoints

## 9. Technical cards (Технические карты)

- [ ] Domain contract: one technical card per manufacturable sales order line; unit lines inside the card (ADR-015)
- [ ] Links to model, patterns, materials, routing; stage execution and order manufacturing completeness

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
