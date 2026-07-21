# Sport-Lead — Global Roadmap

**Code:** `SL-ROADMAP-v1`
**Updated:** `2026-07-21`
**Project version:** `v0.9.0`
**Git branch:** `feature/v0.8.1-nomenclature-core`
**Git commit:** `c9bee2b`

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

`Design System and Platform Templates -> Product models -> Size grids -> Patterns -> Specifications -> Routings`

## Stage 0 — Platform and Infrastructure

### 0.1 — Core platform

- [x] 0.1.1 — Monorepo with `backend/` and `frontend/`
- [x] 0.1.2 — FastAPI, PostgreSQL, SQLAlchemy, and Alembic foundation
- [x] 0.1.3 — Next.js workspace shell, navigation, and shared UI layer
- [x] 0.1.4 — Docker Compose for local development

### 0.2 — Quality and documentation

- [x] 0.2.1 — Repository-level project checks and verification scripts
- [x] 0.2.2 — Canonical documentation set: roadmap, structure, ERP-check, ADR
- [ ] 0.2.3 — Stable CI/CD pipeline for mandatory checks

### 0.3 — Production operations

- [ ] 0.3.1 — Production secrets and deployment baseline
- [ ] 0.3.2 — Monitoring and operational logs
- [ ] 0.3.3 — Backup and restore procedures

## Stage 1 — CRM and Leads

### 1.1 — Sales workspace

- [x] 1.1.1 — Sales dashboard
- [x] 1.1.2 — Lead list, filters, and Kanban UI
- [ ] 1.1.3 — Fully persistent workspace without demo/local lead state

### 1.2 — Lead card

- [x] 1.2.1 — Lead detail route and page states
- [x] 1.2.2 — Customer, contact, and commercial data saving through API
- [x] 1.2.3 — Configurable stages and stage management
- [ ] 1.2.4 — Persistent tasks, notes, timeline, and communications

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

- [ ] 5.1.4.1 — Define responsive verification matrix
- [ ] 5.1.4.2 — Audit desktop layouts
- [ ] 5.1.4.3 — Audit laptop layouts
- [ ] 5.1.4.4 — Audit tablet layouts
- [ ] 5.1.4.5 — Audit mobile layouts
- [ ] 5.1.4.6 — Register visual bug microtasks

### 5.2 — Design tokens

#### 5.2.1 — Visual foundations

- [ ] 5.2.1.1 — Audit existing token sources
- [ ] 5.2.1.2 — Define semantic color tokens
- [ ] 5.2.1.3 — Define typography scale
- [ ] 5.2.1.4 — Define spacing scale
- [ ] 5.2.1.5 — Define borders, radius and shadows
- [ ] 5.2.1.6 — Define component sizes
- [ ] 5.2.1.7 — Define interaction states

#### 5.2.2 — Responsive and layer tokens

- [ ] 5.2.2.1 — Define breakpoints
- [ ] 5.2.2.2 — Define content width rules
- [ ] 5.2.2.3 — Define z-index layers
- [ ] 5.2.2.4 — Define motion rules
- [ ] 5.2.2.5 — Prepare token migration plan

### 5.3 — Platform shell

#### 5.3.1 — Navigation shell

- [ ] 5.3.1.1 — Standardize sidebar
- [ ] 5.3.1.2 — Standardize topbar
- [ ] 5.3.1.3 — Standardize workspace tabs
- [ ] 5.3.1.4 — Define responsive navigation
- [ ] 5.3.1.5 — Verify keyboard navigation

#### 5.3.2 — Page shell

- [ ] 5.3.2.1 — Standardize PageLayout
- [ ] 5.3.2.2 — Standardize PageHeader
- [ ] 5.3.2.3 — Standardize page actions
- [ ] 5.3.2.4 — Standardize content containers
- [ ] 5.3.2.5 — Standardize scrolling ownership
- [ ] 5.3.2.6 — Add shared loading and error boundaries

### 5.4 — Shared UI components

#### 5.4.1 — Forms

- [ ] 5.4.1.1 — Text and numeric inputs
- [ ] 5.4.1.2 — Select and combobox
- [ ] 5.4.1.3 — Checkbox, radio and switch
- [ ] 5.4.1.4 — Date and money controls
- [ ] 5.4.1.5 — Validation and help states
- [ ] 5.4.1.6 — Disabled and read-only states

#### 5.4.2 — Actions and feedback

- [ ] 5.4.2.1 — Buttons and icon actions
- [ ] 5.4.2.2 — Status badges
- [ ] 5.4.2.3 — Dialogs and drawers
- [ ] 5.4.2.4 — Toast and inline feedback
- [ ] 5.4.2.5 — Loading, empty and error states

#### 5.4.3 — Data presentation

- [ ] 5.4.3.1 — Table foundation
- [ ] 5.4.3.2 — Filter toolbar
- [ ] 5.4.3.3 — Pagination and totals
- [ ] 5.4.3.4 — Tabs and compact tabs
- [ ] 5.4.3.5 — Activity timeline
- [ ] 5.4.3.6 — Tasks and comments panels
- [ ] 5.4.3.7 — Entity links and inline editing

### 5.5 — Page templates

#### 5.5.1 — PT-01 Dashboard

- [ ] 5.5.1.1 — Define template contract
- [ ] 5.5.1.2 — Implement reference layout
- [ ] 5.5.1.3 — Add responsive rules
- [ ] 5.5.1.4 — Verify on Sales Dashboard

#### 5.5.2 — PT-02 List/Table Workspace

- [ ] 5.5.2.1 — Define template contract
- [ ] 5.5.2.2 — Implement reference layout
- [ ] 5.5.2.3 — Add responsive table behaviour
- [ ] 5.5.2.4 — Verify on organizations or clients

#### 5.5.3 — PT-03 Kanban Workspace

- [ ] 5.5.3.1 — Define template contract
- [ ] 5.5.3.2 — Standardize board structure
- [ ] 5.5.3.3 — Define mobile fallback
- [ ] 5.5.3.4 — Verify on Leads Kanban

#### 5.5.4 — PT-04 Tree + List Workspace

- [ ] 5.5.4.1 — Define template contract
- [ ] 5.5.4.2 — Standardize tree and content panes
- [ ] 5.5.4.3 — Add responsive tree drawer
- [ ] 5.5.4.4 — Verify on Nomenclature Workspace

#### 5.5.5 — PT-05 Simple Entity Card

- [ ] 5.5.5.1 — Define template contract
- [ ] 5.5.5.2 — Implement reference card
- [ ] 5.5.5.3 — Add responsive layout
- [ ] 5.5.5.4 — Verify on organization or client

#### 5.5.6 — PT-06 Complex Entity Card

- [ ] 5.5.6.1 — Define template contract
- [ ] 5.5.6.2 — Standardize entity header
- [ ] 5.5.6.3 — Standardize stage and metrics area
- [ ] 5.5.6.4 — Standardize section grid
- [ ] 5.5.6.5 — Standardize activity tabs
- [ ] 5.5.6.6 — Define responsive collapse
- [ ] 5.5.6.7 — Verify on Lead Card

#### 5.5.7 — PT-07 Document Card

- [ ] 5.5.7.1 — Define template contract
- [ ] 5.5.7.2 — Standardize document header
- [ ] 5.5.7.3 — Standardize tabular section
- [ ] 5.5.7.4 — Standardize totals and actions
- [ ] 5.5.7.5 — Define responsive behaviour
- [ ] 5.5.7.6 — Verify on Customer Order Card

#### 5.5.8 — PT-08 Versioned Workspace

- [ ] 5.5.8.1 — Define template contract
- [ ] 5.5.8.2 — Define active version and history
- [ ] 5.5.8.3 — Define draft and published states
- [ ] 5.5.8.4 — Define compare and restore UX
- [ ] 5.5.8.5 — Prepare reference Model Card

### 5.6 — Reference migrations

- [ ] 5.6.1 — Migrate Sales Dashboard
- [ ] 5.6.2 — Migrate Leads Kanban
- [ ] 5.6.3 — Migrate Lead Card
- [ ] 5.6.4 — Migrate Customer Order Card
- [ ] 5.6.5 — Migrate Nomenclature Workspace
- [ ] 5.6.6 — Migrate Nomenclature Card
- [ ] 5.6.7 — Create reference Model Card shell

### 5.7 — Responsive and accessibility verification

- [ ] 5.7.1 — Desktop matrix
- [ ] 5.7.2 — Laptop matrix
- [ ] 5.7.3 — Tablet matrix
- [ ] 5.7.4 — Mobile matrix
- [ ] 5.7.5 — Horizontal overflow verification
- [ ] 5.7.6 — Keyboard navigation
- [ ] 5.7.7 — Focus visibility
- [ ] 5.7.8 — Contrast verification
- [ ] 5.7.9 — Visual regression checklist

### 5.8 — Design checkpoint

- [ ] 5.8.1 — Design documentation complete
- [ ] 5.8.2 — Tokens approved
- [ ] 5.8.3 — Platform shell approved
- [ ] 5.8.4 — Page templates approved
- [ ] 5.8.5 — Reference pages approved
- [ ] 5.8.6 — Critical visual bugs fixed
- [ ] 5.8.7 — New modules required to use templates

## Stage 6 — Product Models

### 6.1 — Architecture and domain boundary

#### 6.1.1 — Product model domain contract

Goal:
Define the persistent product-model contour and its boundaries against nomenclature, specifications, routings, and production.

Dependencies:
- 4.1.1
- 4.4.1

Microtasks:
- [ ] 6.1.1.1 — Document model boundaries and lifecycle states
- [ ] 6.1.1.2 — Define links to nomenclature and future size grids
- [ ] 6.1.1.3 — Define versioning and status rules
- [ ] 6.1.1.4 — Review order-item integration constraints
- [ ] 6.1.1.5 — Documentation checkpoint

Completion criteria:
- model contour has a single agreed source of truth;
- dependencies on size grids, patterns, specifications, and routings are explicit;
- future order-item integration is not ambiguous.

#### 6.1.2 — Database core for product models

Goal:
Create the persistent database foundation for product models and their versions.

Dependencies:
- 6.1.1

Microtasks:
- [ ] 6.1.2.1 — Add SQLAlchemy model entities
- [ ] 6.1.2.2 — Add Alembic migration with upgrade and downgrade
- [ ] 6.1.2.3 — Add Pydantic read/write schemas
- [ ] 6.1.2.4 — Add backend regression tests for persistence

Completion criteria:
- product-model data is stored in PostgreSQL;
- migration is reversible;
- tests cover create/read/update persistence rules.

### 6.2 — Backend product models

#### 6.2.1 — Create and list API for product models

Goal:
Users can create and browse product models through backend API.

Dependencies:
- 6.1.2

Microtasks:
- [ ] 6.2.1.1 — Add repository list and create operations
- [ ] 6.2.1.2 — Add service validation for uniqueness and status defaults
- [ ] 6.2.1.3 — Add POST and GET endpoints
- [ ] 6.2.1.4 — Add OpenAPI and regression tests

Completion criteria:
- API creates and lists models;
- duplicates are validated;
- regression tests pass.

#### 6.2.2 — Update API for product models

Goal:
Users can change model data and keep it consistent after reload.

Dependencies:
- 6.2.1

Microtasks:
- [ ] 6.2.2.1 — Add update schema
- [ ] 6.2.2.2 — Add repository update operation
- [ ] 6.2.2.3 — Add service validation for editable fields
- [ ] 6.2.2.4 — Add PATCH endpoint
- [ ] 6.2.2.5 — Add regression tests

Completion criteria:
- model data is updated in PostgreSQL;
- validation errors are explicit;
- repeat open shows saved changes.

#### 6.2.3 — Statuses and versioning for product models

Goal:
Models support controlled lifecycle states and version history.

Dependencies:
- 6.2.2

Microtasks:
- [ ] 6.2.3.1 — Add status fields and version entity rules
- [ ] 6.2.3.2 — Add migration changes if required
- [ ] 6.2.3.3 — Add service rules for activation and archival
- [ ] 6.2.3.4 — Add API endpoints for status/version actions
- [ ] 6.2.3.5 — Add backend regression tests

Completion criteria:
- model statuses are persistent and validated;
- versions are traceable;
- state changes are covered by tests.

### 6.3 — Frontend product models

#### 6.3.1 — Product-model workspace and list

Goal:
Users can open a dedicated product-model workspace and browse the catalog.

Dependencies:
- 6.2.1

Microtasks:
- [ ] 6.3.1.1 — Add frontend types and API client
- [ ] 6.3.1.2 — Add list route in the settings workspace route group
- [ ] 6.3.1.3 — Add workspace UI with loading and error states
- [ ] 6.3.1.4 — Add frontend regression tests
- [ ] 6.3.1.5 — Visual verification

Completion criteria:
- workspace opens through a real route;
- list data comes from API;
- loading and error states are explicit.

#### 6.3.2 — Product-model card route

Goal:
Users can open a dedicated product-model card.

Dependencies:
- 6.3.1

Microtasks:
- [ ] 6.3.2.1 — Add detail route and page shell
- [ ] 6.3.2.2 — Add card view state
- [ ] 6.3.2.3 — Add not-found, loading, and error states
- [ ] 6.3.2.4 — Add frontend regression tests
- [ ] 6.3.2.5 — Visual verification

Completion criteria:
- card URL uses the real route structure;
- page handles loading, missing, and error states correctly.

#### 6.3.3 — Product-model create and edit flows

Goal:
Users can create and edit models from the workspace and card.

Dependencies:
- 6.2.2
- 6.3.2

Microtasks:
- [ ] 6.3.3.1 — Add create form
- [ ] 6.3.3.2 — Add edit form
- [ ] 6.3.3.3 — Add submit actions and validation mapping
- [ ] 6.3.3.4 — Add frontend regression tests
- [ ] 6.3.3.5 — Visual verification

Completion criteria:
- create and edit flows save through API;
- validation errors are visible;
- reopened card shows saved data.

### 6.4 — Links to nomenclature and order items

#### 6.4.1 — Link product models to nomenclature

Goal:
The model card can reference the nomenclature it describes without duplicating the catalog source of truth.

Dependencies:
- 4.1.1
- 6.2.2

Microtasks:
- [ ] 6.4.1.1 — Add backend relation fields
- [ ] 6.4.1.2 — Add migration and schemas
- [ ] 6.4.1.3 — Add service validation for active nomenclature selection
- [ ] 6.4.1.4 — Add API support and regression tests

Completion criteria:
- model-to-nomenclature relation is persistent;
- invalid links are rejected;
- existing nomenclature source of truth remains single.

#### 6.4.2 — Use product model in sales-order items

Goal:
Order items can reference a product model in a controlled way without breaking existing snapshots.

Dependencies:
- 6.4.1
- 3.2.4

Microtasks:
- [ ] 6.4.2.1 — Define backend order-item relation strategy
- [ ] 6.4.2.2 — Add nullable storage and migration if approved
- [ ] 6.4.2.3 — Add schemas, service rules, and API support
- [ ] 6.4.2.4 — Add frontend selection flow in order item forms
- [ ] 6.4.2.5 — Add regression tests
- [ ] 6.4.2.6 — Visual verification
- [ ] 6.4.2.7 — Documentation checkpoint

Completion criteria:
- order items can select a model without breaking backward compatibility;
- snapshot behavior stays explicit;
- backend and frontend checks pass.

## Stage 7 — Size Grids

### 7.1 — Domain and persistence

#### 7.1.1 — Size-grid architecture

Goal:
Define the dedicated size-grid contour used by models and future order scenarios.

Dependencies:
- 6.1.1

Microtasks:
- [ ] 7.1.1.1 — Define size-grid domain and naming rules
- [ ] 7.1.1.2 — Define links to product models and order items
- [ ] 7.1.1.3 — Documentation checkpoint

Completion criteria:
- size-grid scope is isolated from ad-hoc order-item size snapshots;
- terminology is stable for backend and frontend.

#### 7.1.2 — Size-grid database core

Goal:
Create the persistent storage for size grids, sizes, and growth groups.

Dependencies:
- 7.1.1

Microtasks:
- [ ] 7.1.2.1 — Add SQLAlchemy entities
- [ ] 7.1.2.2 — Add Alembic migration
- [ ] 7.1.2.3 — Add schemas and backend tests

Completion criteria:
- grids and their items are stored persistently;
- migration is reversible;
- tests cover persistence rules.

### 7.2 — Backend and frontend flows

#### 7.2.1 — Size-grid CRUD API

Goal:
Users can create, view, and update size grids through API.

Dependencies:
- 7.1.2

Microtasks:
- [ ] 7.2.1.1 — Add repository and service CRUD
- [ ] 7.2.1.2 — Add endpoints
- [ ] 7.2.1.3 — Add backend regression tests

Completion criteria:
- API supports CRUD for grids;
- validation is explicit and tested.

#### 7.2.2 — Size-grid workspace and card

Goal:
Users can manage size grids in the frontend workspace.

Dependencies:
- 7.2.1

Microtasks:
- [ ] 7.2.2.1 — Add frontend types and API client
- [ ] 7.2.2.2 — Add workspace/list route
- [ ] 7.2.2.3 — Add detail card and forms
- [ ] 7.2.2.4 — Add loading/error states
- [ ] 7.2.2.5 — Add frontend regression tests
- [ ] 7.2.2.6 — Visual verification

Completion criteria:
- workspace uses real API data;
- card and forms are usable;
- loading and error states are covered.

#### 7.2.3 — Link size grids to product models

Goal:
A product model can reference a dedicated size grid.

Dependencies:
- 6.2.2
- 7.2.1

Microtasks:
- [ ] 7.2.3.1 — Add backend relation fields
- [ ] 7.2.3.2 — Add migration and schema updates
- [ ] 7.2.3.3 — Add service and API validation
- [ ] 7.2.3.4 — Add frontend selection flow in model forms
- [ ] 7.2.3.5 — Add regression tests

Completion criteria:
- product models store a valid size-grid relation;
- invalid relations are rejected;
- frontend and backend behavior is covered by tests.

## Stage 8 — Patterns

### 8.1 — Pattern catalog foundation

#### 8.1.1 — Pattern domain architecture

Goal:
Define pattern sets, pattern parts, and versioning boundaries for product models.

Dependencies:
- 6.1.1
- 7.2.3

Microtasks:
- [ ] 8.1.1.1 — Define pattern entities and lifecycle
- [ ] 8.1.1.2 — Define file and version boundaries
- [ ] 8.1.1.3 — Documentation checkpoint

Completion criteria:
- pattern contour is clearly separated from models and specifications;
- file/version rules are explicit.

#### 8.1.2 — Pattern database and files core

Goal:
Create the persistent pattern storage and metadata model.

Dependencies:
- 8.1.1

Microtasks:
- [ ] 8.1.2.1 — Add SQLAlchemy entities for pattern sets, parts, and versions
- [ ] 8.1.2.2 — Add Alembic migration
- [ ] 8.1.2.3 — Add file metadata strategy
- [ ] 8.1.2.4 — Add backend regression tests

Completion criteria:
- pattern metadata is persistent;
- migration is reversible;
- file metadata does not create a parallel uncontrolled store.

### 8.2 — Pattern management flows

#### 8.2.1 — Pattern API and workspace

Goal:
Users can browse and maintain the pattern catalog.

Dependencies:
- 8.1.2

Microtasks:
- [ ] 8.2.1.1 — Add repository, service, and CRUD API
- [ ] 8.2.1.2 — Add frontend types and API client
- [ ] 8.2.1.3 — Add workspace/list route
- [ ] 8.2.1.4 — Add regression tests
- [ ] 8.2.1.5 — Visual verification

Completion criteria:
- catalog works on persistent data;
- tests cover CRUD and route behavior.

#### 8.2.2 — Pattern card, files, and versions

Goal:
Users can open a pattern card, inspect files, and manage versions.

Dependencies:
- 8.2.1

Microtasks:
- [ ] 8.2.2.1 — Add detail card route
- [ ] 8.2.2.2 — Add version list and file metadata view
- [ ] 8.2.2.3 — Add create/edit flows for pattern versions
- [ ] 8.2.2.4 — Add loading/error states
- [ ] 8.2.2.5 — Add frontend regression tests
- [ ] 8.2.2.6 — Visual verification

Completion criteria:
- pattern versions are visible and editable;
- route states are explicit;
- file metadata lifecycle is covered by tests.

#### 8.2.3 — Link patterns to product models

Goal:
A product model can reference the correct pattern set and version family.

Dependencies:
- 6.2.3
- 8.2.2

Microtasks:
- [ ] 8.2.3.1 — Add backend relation fields
- [ ] 8.2.3.2 — Add migration and schemas
- [ ] 8.2.3.3 — Add service validation
- [ ] 8.2.3.4 — Add model-card integration
- [ ] 8.2.3.5 — Add regression tests

Completion criteria:
- model-to-pattern relation is persistent and validated;
- model UI exposes the relation clearly.

## Stage 9 — Specifications

### 9.1 — Domain and persistence

#### 9.1.1 — Specification architecture

Goal:
Define specification scope, versioning, and planning role before production start.

Dependencies:
- 6.1.1
- 8.2.3
- ADR-004

Microtasks:
- [ ] 9.1.1.1 — Define specification entities and version lifecycle
- [ ] 9.1.1.2 — Define material, accessory, norm, and substitute scope
- [ ] 9.1.1.3 — Documentation checkpoint

Completion criteria:
- specification is explicitly a planned composition;
- boundaries against production fact are fixed.

#### 9.1.2 — Specification database core

Goal:
Create the persistent storage for specifications and their versions.

Dependencies:
- 9.1.1

Microtasks:
- [ ] 9.1.2.1 — Add SQLAlchemy entities
- [ ] 9.1.2.2 — Add Alembic migration
- [ ] 9.1.2.3 — Add schemas and backend regression tests

Completion criteria:
- specification data is stored persistently;
- migration is reversible;
- tests cover persistence and version structure.

### 9.2 — Specification workflows

#### 9.2.1 — Specification CRUD API

Goal:
Users can create, view, and update specifications through API.

Dependencies:
- 9.1.2

Microtasks:
- [ ] 9.2.1.1 — Add repository and service CRUD
- [ ] 9.2.1.2 — Add endpoints
- [ ] 9.2.1.3 — Add backend regression tests

Completion criteria:
- API supports CRUD for specifications;
- validation and error cases are tested.

#### 9.2.2 — Specification workspace and card

Goal:
Users can manage specifications in a dedicated frontend flow.

Dependencies:
- 9.2.1

Microtasks:
- [ ] 9.2.2.1 — Add frontend types and API client
- [ ] 9.2.2.2 — Add workspace/list route
- [ ] 9.2.2.3 — Add detail card and edit forms
- [ ] 9.2.2.4 — Add loading/error states
- [ ] 9.2.2.5 — Add frontend regression tests
- [ ] 9.2.2.6 — Visual verification

Completion criteria:
- specification workspace uses real API data;
- card and forms are stable;
- route states are explicit.

#### 9.2.3 — Link specifications to product models

Goal:
A product model can reference the approved specification line.

Dependencies:
- 6.2.3
- 9.2.1

Microtasks:
- [ ] 9.2.3.1 — Add backend relation fields
- [ ] 9.2.3.2 — Add migration and schemas
- [ ] 9.2.3.3 — Add service validation for active/approved versions
- [ ] 9.2.3.4 — Add model-card integration
- [ ] 9.2.3.5 — Add regression tests

Completion criteria:
- model-to-specification relation is persistent and validated;
- only allowed versions can be linked.

## Stage 10 — Routings

### 10.1 — Domain and persistence

#### 10.1.1 — Routing architecture

Goal:
Define routing scope, operations, work centers, and quality checkpoints for planned manufacturing.

Dependencies:
- 6.1.1
- 9.2.3
- ADR-004

Microtasks:
- [ ] 10.1.1.1 — Define routing entities and sequencing rules
- [ ] 10.1.1.2 — Define links to models, specifications, and future production fact
- [ ] 10.1.1.3 — Documentation checkpoint

Completion criteria:
- routing contour is distinct from production fact;
- operation order and quality checkpoints are explicit.

#### 10.1.2 — Routing database core

Goal:
Create the persistent storage for routings, operations, and work centers.

Dependencies:
- 10.1.1

Microtasks:
- [ ] 10.1.2.1 — Add SQLAlchemy entities
- [ ] 10.1.2.2 — Add Alembic migration
- [ ] 10.1.2.3 — Add schemas and backend regression tests

Completion criteria:
- routing data is stored persistently;
- migration is reversible;
- tests cover basic persistence rules.

### 10.2 — Routing workflows

#### 10.2.1 — Routing CRUD API

Goal:
Users can create, view, and update routings through API.

Dependencies:
- 10.1.2

Microtasks:
- [ ] 10.2.1.1 — Add repository and service CRUD
- [ ] 10.2.1.2 — Add endpoints
- [ ] 10.2.1.3 — Add backend regression tests

Completion criteria:
- API supports CRUD for routings;
- validation and sequencing constraints are covered.

#### 10.2.2 — Routing workspace and card

Goal:
Users can manage routings in a dedicated frontend flow.

Dependencies:
- 10.2.1

Microtasks:
- [ ] 10.2.2.1 — Add frontend types and API client
- [ ] 10.2.2.2 — Add workspace/list route
- [ ] 10.2.2.3 — Add detail card and edit forms
- [ ] 10.2.2.4 — Add loading/error states
- [ ] 10.2.2.5 — Add frontend regression tests
- [ ] 10.2.2.6 — Visual verification

Completion criteria:
- routing workspace uses real API data;
- card is editable and stable;
- route states are explicit.

#### 10.2.3 — Link routings to product models and order context

Goal:
A product model can reference its routing, and the future order flow can reuse that approved plan.

Dependencies:
- 6.4.2
- 10.2.1

Microtasks:
- [ ] 10.2.3.1 — Add backend relation fields
- [ ] 10.2.3.2 — Add migration and schemas
- [ ] 10.2.3.3 — Add service validation for approved routing selection
- [ ] 10.2.3.4 — Add model-card integration
- [ ] 10.2.3.5 — Add order-context integration notes
- [ ] 10.2.3.6 — Add regression tests

Completion criteria:
- model-to-routing relation is persistent and validated;
- order-context reuse path is documented and technically prepared.

## Stage 11 — Design and Approval

### 11.1 — Design assets and comments

- [ ] 11.1.1 — Design project entity and versions
- [ ] 11.1.2 — Layouts, logos, and comments

### 11.2 — Approval workflow

- [ ] 11.2.1 — Client review and correction requests
- [ ] 11.2.2 — Final approval checkpoint before production launch

## Stage 12 — Production

### 12.1 — Production planning

- [ ] 12.1.1 — Production orders and batches
- [ ] 12.1.2 — Planning and work-center assignment

### 12.2 — Production fact

- [ ] 12.2.1 — Operations, performers, output, and scrap
- [ ] 12.2.2 — Quality control and released finished goods

## Stage 13 — Warehouse

### 13.1 — Storage structure

- [ ] 13.1.1 — Warehouses and bins
- [ ] 13.1.2 — Lots and balances

### 13.2 — Movements

- [ ] 13.2.1 — Receipts, issues, reserves, and transfers
- [ ] 13.2.2 — Inventory and finished-goods flow

## Stage 14 — Procurement

### 14.1 — Supplier contour

- [ ] 14.1.1 — Suppliers and supplier prices
- [ ] 14.1.2 — Procurement requests and purchase orders

### 14.2 — Supply execution

- [ ] 14.2.1 — Receipts and returns
- [ ] 14.2.2 — Demand planning and minimum stock linkage

## Stage 15 — Shipping and Payments

### 15.1 — Shipping

- [ ] 15.1.1 — Shipping orders, packaging, delivery, and documents

### 15.2 — Payments

- [ ] 15.2.1 — Invoices, payments, advances, and debt
- [ ] 15.2.2 — Settlements by order and client

## Stage 16 — Costing and Analytics

### 16.1 — Costing

- [ ] 16.1.1 — Planned, normative, and actual costing
- [ ] 16.1.2 — Margin and plan-fact analysis

### 16.2 — Analytics

- [x] 16.2.1 — CRM dashboard and base order analytics
- [ ] 16.2.2 — ERP analytics and management P&L

## Stage 17 — Integrations

### 17.1 — External channels

- [ ] 17.1.1 — Website forms, email, VK, Telegram, and telephony
- [ ] 17.1.2 — Google Sheets and webhooks

### 17.2 — Enterprise exchange

- [ ] 17.2.1 — 1C:UNF exchange
- [ ] 17.2.2 — Delivery and payment-system integrations
- [ ] 17.2.3 — External API for third-party systems

## Stage 18 — Industrial Operations and Access Control

### 18.1 — Access control

- [ ] 18.1.1 — Authentication
- [ ] 18.1.2 — System users, roles, and permissions
- [ ] 18.1.3 — Universal audit trail

### 18.2 — Production operations

- [ ] 18.2.1 — VPS, production Docker, reverse proxy, and HTTPS
- [ ] 18.2.2 — CI/CD, monitoring, and logging
- [ ] 18.2.3 — Backup, restore, and administrator documentation
