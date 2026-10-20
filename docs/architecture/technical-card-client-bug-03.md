# TechnicalCard Client contract — BUG-03A

Verified locally 2026-10-20. Scope: existing CRM Client and parent-owned card identity;
frontend select/create integration remains BUG-03B / Cursor work.

## Source and ownership

`Client.id` (`clients`) is the current buyer/counterparty identity. Supplier is
procurement identity; Organization is a separate legal entity. They are not
interchangeable. `/sales/clients` uses existing backend `/clients`.

`/settings/catalogs/contractors` is a planned navigation/registry entry, not a
working directory: no page implementation and no contractors API. Local HTTP
verification: frontend `/sales/clients` redirects to login; contractors page
returns 404; backend `/clients?limit=1` returns 200; `/contractors` returns 404;
`/platform-directories` requires authentication (401 anonymously), and the
authenticated registry regression confirms `contractors.status=planned`,
`api_prefix=""`. No Contractor table or migration is needed.

| Card contour | Stored client reference | Scope of explicit selection |
|---|---|---|
| SalesOrder | `SalesOrder.client_id` → `Client.id` | Order and all its cards |
| Standalone | `TechnicalCardOrderGroup.client_id` → `Client.id` | All cards in that group |

TechnicalCard stores neither a second client ID nor a copied client name. The
existing contour XOR chooses its parent. `technical_card_clients` resolves
client ID and live Client label in one batch query; detail and both card list
endpoints consume the same resolver. Label = trimmed company name, otherwise
contact name. Order DTO uses the same label function.

Changing one sibling's selection explicitly changes the shared parent. It does
not create a card-only override. Another order/group remains untouched, even
when it refers to the same Client. Renaming a Client updates that entity's live
label everywhere it is joined; it does not change any reference.

## Existing APIs and additive changes

| API | Contract |
|---|---|
| `GET /clients?q=…&limit=20&offset=0` | Existing searchable Client list; ID, company_name, contact_name; max limit 500 |
| `POST /clients` | Required nonblank `contact_name`, optional `company_name`; 201 ClientDetailRead including `id` |
| `GET /clients/{id}` | Existing Client detail; missing → 404 |
| `PATCH /clients/{id}` | Now also accepts `company_name`, `contact_name`; returns current ClientDetailRead |
| `PATCH /technical-cards/{id}/client` | Explicit required key `client_id`, positive ID or null; returns refreshed TechnicalCardRead |
| `PATCH /orders/{id}/client` | Existing required client selection; shared locked order service, returns refreshed order DTO |
| `GET /technical-cards/{id}` | `client_id`, `client_name` resolved through current parent |
| `GET /technical-cards` | Slim list now embeds both `client_id` and live `client_name` in one batch |
| `GET /orders/{id}/technical-cards` | Same slim client embed for every order card |

PATCH Client fields are optional independently; absent keys stay unchanged.
`company_name=null` or a blank string clears company name; contact name remains
the label. An explicitly null/empty/whitespace `contact_name` is 422; valid names
are trimmed, max 255 characters. No duplicate Client is created by rename.

Card binding: missing key/zero/negative ID → 422, unknown card/client → 404,
cancelled card → 422, anonymous request → 401. Explicit null clears a standalone
group but is rejected for a SalesOrder card. The order service's stale
`Client.is_active` check was removed because Client has no such field; this does
not introduce activation/deactivation semantics.

Current `/clients` and `/orders` CRUD endpoints retain their existing access
contract (no new authentication/RBAC policy here); do not promise a 401 from
those legacy endpoints. The card mutation itself remains authenticated.

Standalone creation uses existing POST `/technical-cards/standalone`, then an
explicit PATCH client selection on the returned card ID. The create payload
does not accept a card-local Client field. A newly created sibling automatically
inherits an existing group's selection. SalesOrder creation requires client_id;
generated order cards inherit it immediately.

## Related documents and production boundary

Both selection surfaces update only the parent FK. Before reusing the order
mutation, SalesQuotation/SalesInvoice and Specification dependencies were
checked: commercial documents retain `sales_order_id` and their existing line
snapshots; Specification references the order and production batch, not a new
Client binding. No propagation SQL, snapshot rewrite, payment reassignment,
historical buyer backfill or fact/plan mutation is added. Existing rendering
that reads an order live continues to see its current selected Client; this is
not an immutable historical buyer guarantee. A separate historical-document
policy would need an explicit task, not a migration inferred here.

Regressions compare saved quotation/invoice responses before and after explicit
selection, unrelated group identity, and protected production fact/plan/audit
rows. All are preserved. No local persistent data repair or production writes.

## Cursor handoff: select/create and cache invalidation

Keep existing `tech-card-order-data-card.tsx`, `ClientCreateDrawer` and
`tech-card-actions.ts`; do not build a Contractors picker backed by another
entity. `listTechnicalCardClientCandidates` already reads `/clients`; use its ID,
not editable label text, for binding. `createClientRecord` already POSTs `/clients`.

Existing drawer `onCreated` only sets selected ID/label in local form state.
It does not persist the card's selection. Save must explicitly call
`updateTechnicalCardClientAction(cardId, created.id)` through the existing PATCH;
show an error if binding fails, and retain the created Client for retry rather
than POSTing it again. Do not perform a silent parent-wide switch merely on
opening/closing a select. Make the group/order scope clear before Save.

Use returned DTO client_id/client_name and reload server data after successful
save. Refresh candidate lists after create/rename. On binding, invalidate
`/production/tech-cards` and all sibling details, `/sales/orders` and the affected
order detail if present, plus Client list/detail aggregates for old/new clients.
Current `revalidateTechCardPaths` covers the list, selected card, order detail
and Kanban, but does not invalidate sibling detail routes or Client aggregates.
Use a bounded route/layout invalidation (for example the dynamic card page
pattern with `type="page"`) rather than fetching every sibling detail.

On Client rename, invalidate `/sales/clients`, its detail, `/sales/orders` and
order detail page pattern, and the card list/detail page pattern. Refresh the
currently mounted router and ensure local selected label resets from the
returned/refetched DTO. Backend reads are live and carry no name cache; cache
invalidation and open-form stale labels are the frontend follow-up. Do not
claim browser verification or a completed UI fix from these backend tests.

Evidence: `backend/tests/test_techcard_client_bug_03.py` and the BUG-03A task report.
