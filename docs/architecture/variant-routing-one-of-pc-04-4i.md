# PC-04.4I — ONE OF runtime contract

Owner-selected backend continuation of PC-04.4G, 2026-10-08. This is one iteration;
PC-04.4J UI and other roadmap stages remain outside its scope.

## Persistence and graph save

`PUT /shop-routings/{template_id}/graph` saves the existing `RoutingGraph`, including
`variant_groups`, in one transaction. Existing route CRUD creates the named owner;
the graph endpoint creates, updates and removes groups. The routing id is the owner
row/API path, not a separate routing entity. No groups are inferred for old routes.

Each group has a stable string id, workshop id, name/code, `selection_mode=one_of`,
active flag, ordered members (`operation_node_id`, position), and nullable default.
Members must exist in the same workshop. Empty groups, duplicate membership,
duplicate group/member positions, invalid defaults, unknown edges and cycles fail
validation. ALL parallel remains ordinary explicit DAG branching.

Edges reference a group directly: `before -> cutting -> after`. Sequential mode
places a group at its first member's position. The saved graph read returns logical
group endpoints. Existing dependency rows store the expanded connections; **group
metadata is mandatory for ONE OF semantics**. Expanded edges alone still mean ALL.
The graph writer retains line ids at unchanged positions, validates operation and
equipment ownership through the existing routing service, and rolls back failures.
Legacy stage/edge PATCH on a route containing groups is rejected: use graph save
to avoid dropping group metadata or silently turning alternatives into parallel.

Alembic `b8c9d0e1f234`, parent `a7b8c9d0e123`, adds portable JSON columns:

- `shop_routing_templates.route_variant_groups`: template metadata;
- `technical_cards.route_variant_groups`: immutable group snapshot;
- `technical_cards.route_variant_selections`: separate mutable choice/audit state.

Owner FKs, node facts and immutable dependency rows remain the existing PC-04.4G
entities. Template member references become `template:{line_id}`; snapshot references
become `snapshot:{stage_result_id}`. No WorkCenter, norm or frontend changes.

## Snapshot, selection and execution

Both existing snapshot creation paths copy all members, names/codes, ordered
membership, default and selection semantics. Default produces `preliminary` state;
no default leaves selection null and causes `variant_not_selected`. Template edits
do not modify existing card metadata, node facts, dependencies or choices.

`resolve_effective_route_snapshot(db, card_id)` returns an independent validated DAG,
excluded alternatives and unresolved groups. Stored nodes/edges are never mutated.
Only selected members contribute Demand, resource occupancy and CalendarAssignment.
Preliminary and confirmed selections use the same single/mass scheduler and queue,
with ordinary ETA/deadline calculations. Read Demand reports missing selection as
an explicit issue. An explicit graph without edges stays independent after resolution.

Workshop/current-stage/card completion counts ordinary and selected required nodes.
Unselected pending alternatives do not block. An unresolved group does block and
cannot make a workshop/card appear completed. Fact/start writes cannot target an
excluded alternative. Inactive groups exclude their members and cannot be selected.

## Selection API, replanning and audit

`GET /technical-cards/{card_id}/route-variants` returns immutable group metadata and
mutable selected node, preliminary/confirmed status, selected_at/by and confirmation_at/by.

`PATCH /technical-cards/{card_id}/route-variants/{group_id}` accepts:

```json
{
  "selected_operation_snapshot_node_id": "snapshot:123",
  "selection_status": "confirmed",
  "replan": true
}
```

Write permission reuses `technical_cards.create`, as the existing scheduler does;
read requires authenticated staff. Actor ids come from the authenticated platform
user. No new role or audit subsystem is introduced. Existing universal audit records
automatic default selection, explicit selection/change and confirmation separately.
Automatic defaults have nullable actor/timestamps in their selection state.

Changing the selection shares the scheduler advisory transaction gate and locks the
card/facts/assignments before validation and writes. Stage fact/start writers acquire
the same gate first. Started/completed selected members and their started/completed
successors prohibit normal change (409). Manual/locked old assignments and card
plan locks also cause an explicit 409; no protected rows are silently deleted.

An allowed change releases the old member's auto assignments through the existing
allocation cascade, updates the choice, synchronizes current workshop, and by default
replans atomically through `schedule_card_in_transaction`. The response contains
selection, `requires_replan` and the existing `ScheduleRead` with ETA/deadline impact.
If replanning is domain-blocked, the choice remains saved, old selected auto capacity
is released, protected/other rows remain, and `requires_replan=true` plus explicit
deviations tells the caller to resolve the blocker and run planning again.

`replan=false` returns a forecast without saving it and keeps `requires_replan=true`.
Confirming the same choice leaves its existing plan intact. A confirmed choice cannot
be silently demoted without changing member. Existing Schedule/queue DTOs retain
their exact field sets; selection metadata is available via the dedicated read API.

## Self-check and boundaries

`backend/tests/test_route_variants_pc_04_4i.py` covers A–F from the task: template
persistence/validation, immutable snapshot/default, effective DAG, preliminary and
confirmed scheduling, demand/capacity transfer, missing selection, blocked and deferred
replan, mass mixed routes, Kanban/fact protection, graph-save API/selection API and audit.
`backend/tests/test_route_variants_postgres_pc_04_4i.py` runs an isolated reversible
migration cycle and schedule/change plus fact-start/change races on local :5432.
All test datasets use fixture databases or UUID-owned schemas; no VIS-STRESS seed,
mass scheduling, source-card edits or production actions are performed.

Run from the repository root:

```powershell
python -m pytest backend/tests/test_route_variants_pc_04_4i.py backend/tests/test_route_variants_postgres_pc_04_4i.py -q
python scripts/check_project.py
git diff --check
```

No conditional rules, AI/ETA autoselection, design/no-design routing, realistic norms
or separate preliminary queue. Cross-workshop parallel Kanban stays at PC-04.4G's
existing boundary. UI confirmation/choice controls are the separate PC-04.4J task.
