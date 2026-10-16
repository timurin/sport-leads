# Workshop waiting queue — PC-05.6C

Date: 2026-10-13. Backend contract; frontend PC-05.6B integration is separate.

## Sources and eligibility

Calendar is the weekly plan, queue is waiting order, Kanban is production fact.
Queue identity is the current selected pending snapshot operation, one representative
operation per standalone active card and current workshop. It is not a live route
line, card priority, or an unbound launch marker. Completed/in_progress operations,
cancelled/completed cards, unresolved ONE OF, unselected alternatives, workshops
with active in_progress fact, locked cards and manual/locked/past assignments are
excluded. Effective snapshot predecessors must be completed, or optional skipped.
Pending cards without a saved plan can appear; missing Demand/configuration blocks
the actual preview/apply, not a fabricated ready result. Sales-order contour A is
outside the existing standalone Scheduler contract and is excluded.

Nullable positive `CalendarAssignment.queue_position` stores manual waiting order.
Existing rows remain NULL; no backfill or new fact/status table. Before an override,
sorting uses saved start date/day position, then existing card priority/deadline
sort, then node ID. Explicit queue order precedes that fallback. The response
renumbers currently eligible items from 1; stored gaps after execution are harmless.
`CalendarAssignment.position` remains the dated board position and
`TechnicalCard.priority` remains card priority. Neither is repurposed.

## HTTP contract

All paths use `/production-calendar/workshops/{workshop_id}/queue`.

| Method/path | Input | Result/access |
|---|---|---|
| GET base | workshop ID | WorkshopQueueRead: workshop_id, revision, items; authenticated read |
| POST /preview | revision, ordered_snapshot_node_ids | WorkshopQueuePreview; existing technical_cards.create planning permission |
| POST /apply | same input plus preview_fingerprint | WorkshopQueueApplied: refreshed queue, preview/affected plans, audit_event_id; same permission and authenticated actor |

Request order is an exact permutation of the complete current waiting queue of
one workshop. No duplicate, missing, unknown, foreign or protected nodes. Maximum
500 requested IDs. GET item includes card ID/number, snapshot node, workshop and
operation IDs/names, queue_position, priority, planned_start/end, eta/shipping_date,
risk, waiting status and protected/read_only flags. Protected entries are excluded,
so returned flags are false. DTO stays slim; all queue GET relation/config/occupancy
reads are batched, and a focused test verifies constant SQL request count.

Preview changes include old/new positions, dates, ETA/risk, affected downstream
node IDs and complete proposed affected-card plans with preserved-step flags.
can_apply=false plus shared ProductionDiagnostic blockers means no safe plan.
Deadline misses are warnings and do not silently gate a valid plan; the owner
sees the ETA/risk before applying. No-op order has no plan writes or audit event.

HTTP409 keeps X-Diagnostic-Code/Category. These new endpoints return
detail={message, diagnostic}: manager message contains plain explanation,
shared diagnostic carries safe IDs/expected source/trace for Debug. Codes:
queue_item_not_waiting, queue_cross_workshop_reorder,
queue_contains_protected_fact, workshop_queue_changed, queue_replan_failed.
queue_shipping_risk_increased is a warning about a late plan.
Unknown/inactive workshop is HTTP404; invalid DTO is HTTP422; access is 401/403.

## Preview, transaction and affected scope

GET revision is a SHA256 of planning day, current queue/cards/snapshot/volume/edges,
saved plans, shared allocations and resource/operation/workshop/equipment settings.
It conservatively invalidates on unrelated shared configuration/occupancy changes.
Preview fingerprint also includes effective Demand snapshots, covering live sewing
inputs even when changed values round to the same final allocations. Frontend must
carry the exact revision and preview_fingerprint into apply.

Preview and apply use the existing transaction advisory scheduler gate. Preview
does no INSERT/UPDATE/DELETE, including inside SAVEPOINTs; it removes replaceable
old occupancy from an in-memory view and overlays proposed allocations in queue
order. The existing single-card _build handles Demand, resource alternatives,
capacity, dates, exceptions, rounding, horizon, DAG and protected anchors.

Affected scope is the suffix from the first changed waiting position and each
representative node's effective DAG descendants. Unchanged prefix and independent
branches keep their saved assignments/allocations; unsaved prerequisites outside
scope block the command instead of being silently scheduled. Protected fact,
manual/locked/past downstream stays anchored. An incompatible shifted predecessor
blocks the entire reorder. ETA is the maximum planned step end, including parallel
branches. No current workshop, stage status, lifecycle, quantity or priority write.

Apply reloads and validates revision and effective result under the gate. Any
revision or preview mismatch gives workshop_queue_changed and requires new preview.
All proposed plans must succeed before persistence. Shared persist_plan and
IC-G01..G04 linkage/retirement/consistency/freshness guards stay active. Plan writes,
queue positions and audit commit together; any failure rolls back the entire scope.

Single-card replacement preserves queue_position. Mass Scheduler overlays manual
order within each current workshop's existing batch slots and restores positions
after its usual SAVEPOINT/replay. Global priority ordering of other workshops is
not replaced. Explicit single-card planning still uses existing occupancy; the
manual waiting order remains canonical even if an independent command changes dates.

Existing universal AuditEvent action
production_calendar.workshop_queue_reordered, entity production_stage,
source workshop_queue records workshop, old/new node order, affected card/node IDs,
actor/login/timestamp, original revision and replan result. The timestamp/actor are
canonical audit fields; no new audit store. Failed preview/apply has no persisted
reorder audit. Result/provenance diagnostics remain shared DTOs.

## Limits

Fingerprint GET uses production-wide shared occupancy/configuration reads, although
queue cards are scoped by workshop. SQL request count is bounded; row volume is not
paginated. This conservative concurrency contract is not a performance readiness
claim for an arbitrarily large production database. No mass reorder, production
data repair or frontend connection is performed by this backend task.
