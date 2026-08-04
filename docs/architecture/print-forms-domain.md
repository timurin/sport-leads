# Print-form registry domain (Stage 18.3)

**Code:** `SL-PRINT-FORMS-v1`  
**Date:** `2026-08-02`  
**Roadmap:** `18.3.1` (feeds `18.3.2`–`18.3.8`)  
**Placement:** `docs/architecture/administration-placement.md`

## Purpose

Canonical contract for the **print-form registry** under Administration.

Stage `18.3` owns:

- print-form metadata registry;
- template versions and activation policy;
- binding of a template to a **model**, **platform directory**, or **document type**;
- consumer handoff contract for sales documents and future technical-card print.

Stage `18.3` does **not** own the source business data of orders, quotations, invoices, technical cards, or directories. It owns only the print template registry and render contract.

## Boundary

### In scope

- One registry for print templates under `/settings/print-forms`
- Cross-module template bindings
- Versioning and active/inactive lifecycle
- Stable payload contract between consumer modules and the print engine

### Out of scope

- Data import/export (`4.5`, `16.3`)
- Sales quotation/invoice persistence (`3.3.3`)
- Technical-card domain SoT (`9.*`)
- Global operations journal (`18.4`)
- External 1C/ERP exchange of template files

## Registry entry

Logical entity: `PrintForm`.

| Field | Type | Notes |
|-------|------|-------|
| `id` | int PK | |
| `code` | string(80) | stable registry slug, unique |
| `title` | string(160) | RU label in Administration |
| `description` | text nullable | purpose / operator note |
| `binding_type` | enum | `model` \| `directory` \| `document_type` |
| `binding_key` | string(120) | stable target code, not display label |
| `status` | enum | `draft` \| `active` \| `archived` |
| `output_format` | enum | MVP start: `html`, `pdf`, `xlsx` |
| `versioning_mode` | enum | `single_active` for MVP |
| `created_at` / `updated_at` | timestamptz | |

`binding_key` examples:

| `binding_type` | Example | Meaning |
|----------------|---------|---------|
| `model` | `sales_quotation` | Print for a document model |
| `model` | `technical_card` | Print for `TechnicalCard` |
| `directory` | `cities` | Directory export/print view if later approved |
| `document_type` | `sales_invoice` | Explicit document template binding |

Rule: `binding_type + binding_key + code` must be unique.

## Version entity

Logical child entity: `PrintFormVersion`.

| Field | Type | Notes |
|-------|------|-------|
| `id` | int PK | |
| `print_form_id` | FK | parent registry entry |
| `version_no` | int | monotonic per parent |
| `template_label` | string(160) | operator-visible version label |
| `storage_kind` | enum | `inline_text` \| `file_ref` (exact backend storage later in `18.3.4`) |
| `template_source` | text / opaque ref | actual bytes or reference, implementation deferred |
| `status` | enum | `draft` \| `published` \| `archived` |
| `is_current` | bool | at most one current version per parent |
| `created_at` | timestamptz | |

Version rules:

1. A registry entry may have many versions.
2. Only one version may be `is_current=true`.
3. Entry `status=active` requires one current `published` version.
4. Archiving a registry entry does not delete historical versions.
5. Consumer modules resolve only the current published version.

## Binding rules

### `model`

Used when a template belongs to a business model/document regardless of a specific module route.

Examples:

- `sales_order`
- `sales_quotation`
- `sales_invoice`
- `technical_card`

### `directory`

Used for Administration-owned or platform-owned directories when a printable/exportable registry view is later approved.

Examples:

- `cities`

MVP note: `18.3` does not automatically imply that every platform directory gets a print template.

### `document_type`

Used when multiple printable outputs may exist for one parent model and need separate registry targets.

Examples:

- `sales_invoice_payment`
- `sales_invoice_summary`

MVP note: if one model currently has only one canonical print output, `binding_type=model` is preferred over inventing extra `document_type` keys.

## Activation policy

Registry entry lifecycle:

- `draft` — contract exists, not available to business consumers
- `active` — available for lookup and print generation
- `archived` — hidden from normal consumer lookup, kept for history/manual audit

Version lifecycle:

- `draft` — editable work-in-progress
- `published` — immutable candidate for activation
- `archived` — historical, not current

Activation rules:

1. Only `active` entries participate in consumer lookup.
2. Only the current `published` version may render.
3. Deactivating/archiving an entry must not mutate source business documents.
4. Consumer modules must fail explicitly when no active print form is configured; no hidden demo fallback.

## Consumer lookup contract

Generic lookup inputs:

| Field | Notes |
|-------|-------|
| `binding_type` | `model` / `directory` / `document_type` |
| `binding_key` | requested target code |
| `output_format` | preferred output |

Lookup result:

| Field | Notes |
|-------|-------|
| `print_form_code` | stable registry code |
| `title` | resolved template title |
| `version_id` / `version_no` | exact published version |
| `output_format` | resolved format |
| `template_source` | resolved render source/ref |

Resolution rule:

- prefer exact active entry for requested `binding_type + binding_key`;
- if none exists, return explicit not-configured error;
- no parallel template registry inside sales / technical-card modules.

## Consumer payload contract

Stage `18.3` consumes prepared payloads from domain modules. It does not rebuild domain aggregates from the database on its own.

### Sales documents (`3.3.3`)

Expected consumers:

- `sales_order`
- `sales_quotation`
- `sales_invoice`

Payload owner:

- sales module (`3.3.3`) prepares the snapshot

Minimum payload shape:

| Field | Notes |
|-------|-------|
| `document_id` | source id |
| `document_number` | printable number |
| `currency_code` | order/document currency |
| `issued_at` | timestamp/date |
| `customer` | printable customer summary |
| `items[]` | immutable line snapshot |
| `totals` | subtotal, discount, VAT, grand total |

VAT/currency snapshot rules come from `3.3.2` / `3.3.3` and stay SoT there.

Shipped consumer checkpoint (`18.3.6`, owner visual OK `2026-08-02`):

- `/sales/orders/[id]` documents panel is the consumer entry point;
- `sales_order`, `sales_quotation`, and `sales_invoice` resolve through registry `binding_type=model`;
- payloads are prepared in the sales module from existing immutable order / quotation / invoice snapshots;
- missing active registry entry is surfaced as an explicit UI/API error;
- no route-based template lookup and no sales-side template storage were introduced.

### Technical card print (`18.3.8`)

Consumer:

- `technical_card`

Payload owner:

- technical-card module (`9.*`) — `frontend/lib/production/tech-card-print.ts`

Expected print surface:

- Side 1 (A4 landscape): order info 100%; mockup 30% + piece-by-piece matrix 70%
- Side 2: nomenclature/model (+ model cover photo), separate «Схема сборки изделия», materials, operations/volumes

Shipped implementation (`2026-08-02`, layout v3 `2026-08-03`, **owner visual OK** `2026-08-03`):

- seed registry form `technical_card_a4_x2` (Alembic `a4b5c6d7e891`); layout upgrades `e8f9a0b1c234` / `f9a0b1c2d345`;
- document header **Печать** / **PDF** on `/production/tech-cards/[id]` → `POST /print-forms/generate`;
- payload + HTML fragments from Stage 9 fields (+ linked model cover URL + unit-line fields); no parallel print store;
- FE regression `frontend/lib/production/tech-card-print.test.mjs`.

Excel workbook remains the print visual SoT reference for layout; runtime SoT is the registry template + Stage 9 payload.

## Administration UI implications (`18.3.5`)

The contract implies:

- PT-02 registry list at `/settings/print-forms`
- card/editor route for one registry entry
- visible binding target, status, current version, output format
- version history with one current published version

UI is deferred; this section only constrains future implementation.

## Anti-patterns

- Store template bytes in sales-order, quotation, invoice, or technical-card tables
- Resolve print templates by page route instead of stable binding key
- Allow silent fallback to demo/fixture template when registry entry is missing
- Let the print engine become a second source of domain truth for totals, sizes, materials, or VAT
- Mix print-template registry with import/export job registry

## Evidence

- Task: `docs/tasks/v0.9.0-stage-18.3.1-print-forms-contract.md`
- Task: `docs/tasks/v0.9.0-stage-18.3.6-print-output-integration.md`
- Task: `docs/tasks/v0.9.0-stage-18.3.7-print-forms-docs-tests.md`
- Sales boundary: `docs/tasks/v0.9.0-stage-3.3.3-currency-quotations-invoices.md`
- Frontend consumer payload tests: `frontend/lib/sales/commercial-print.test.mjs`
- Backend registry generate regression: `backend/tests/test_print_forms_18_3_3.py`
- Placement: `docs/architecture/administration-placement.md`
- ADR cross-ref: `docs/architecture/decisions/ADR-005-pricing-and-tax-boundary.md`
