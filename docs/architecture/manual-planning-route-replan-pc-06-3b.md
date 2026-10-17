# Manual route replan — PC-06.3B

Current backend contract,2026-10-16, amended by PC-06.3D. Existing single-row PUT remains unchanged. PC-06.3C is the frontend consumer; this overdue fix contains no frontend patch.

## Endpoints and access

- POST `/production-calendar/manual-planning/preview`
- POST `/production-calendar/manual-planning/apply`

Both require the existing authenticated platform session and `technical_cards.create` permission. No new role/permission. Missing session401, insufficient permission403, missing card404, invalid request422.

## Request

```json
{
  "technical_card_id": 162,
  "snapshot_node_id": 1162,
  "target_date": "2026-10-26",
  "mode": "downstream"
}
```

Modes: `single` moves only the selected pending operation (past/today/future original date); `downstream` includes its effective selected DAG descendants. An optional64-character lowercase hexadecimal `revision` may be sent to preview to require a previously observed plan version. Omit it for the initial preview: that read bootstraps the current revision, with no scheduling persistence.

Apply sends the same four fields, the returned `revision`, and returned `preview_fingerprint` (both required64-character lowercase hex). Never calculate these tokens or planning dates in the browser. A successful preview is not an optimistic persisted change. Apply recomputes it under the existing scheduler transaction lock and requires the same inputs and result.

## Preview response

- Echo: technical_card_id, snapshot_node_id, target_date, mode.
- Tokens: revision, preview_fingerprint. `apply_allowed` is authoritative.
- Selected dates: old_selected_start/end, new_selected_start/end. Null means not calculable; never infer a successful date from a blocker. `selected_operation` contains full selected change on successful proposal.
- `affected_assignments`: old assignment_id, snapshot_node_id, frozen operation_name, workshop_id/name, old_start/end, new_start/end, old/new_allocations and reason (`selected_date` / `downstream_dependency`). Allocation fields reuse ScheduledAllocation: resource_key,date,allocated_amount,capacity_unit,nullable work_center_id.
- `downstream_snapshot_node_ids`: selected effective descendants, even in single mode (impact context, not authorization for cascade).
- `old_eta`, `new_eta`, shipping_date, old_slack, new_slack, risk_before/after (`unknown` / `on_time` / `late`). Old summary reuses persisted-plan projection; new values come from ScheduleRead. Dates are inclusive local planning DATEs, slack is canonical calendar-day slack, not working hours.
- `capacity_warnings`, `dependency_warnings`, `blockers`: existing ProductionDiagnostic arrays. Use each diagnostic's severity/code/message; capacity/dependency arrays may repeat a blocker for context. Debug retains Scheduler reason/resource details. A late but capacity-valid plan can apply with `manual_replan_shipping_risk` warning.
- `plan`: existing complete ScheduleRead proposal, including protected preserved steps and new allocations. It is not persisted until apply succeeds.

Blocked proposal normally returns200 with apply_allowed=false and manager-friendly blockers. No silent single-mode cascade and no silently substituted start date: if target_date cannot be met exactly under dependencies/capacity/work calendar/horizon, preview blocks and may expose earliest_available_start/resource alternatives in Debug. Capacity quantities/budgets and machine alternatives remain the existing Scheduler rules.

## Apply response and errors

Successful200: `{preview, planning_summary, audit_event_id}`. `preview.plan.persisted=true`; step assignment IDs refer to saved replacements. `planning_summary` is the same canonical detail-only persisted summary as the card GET; Calendar/allocations/ETA agree. Re-fetch affected Calendar and card data; discard the used revision/fingerprint. No Kanban/fact mutation or optimistic completion.

Conflict409 shape: `{detail: {message, diagnostic}}`, with `X-Diagnostic-Code` and `X-Diagnostic-Category`. Codes:

| Code | Meaning / client action |
|---|---|
| manual_replan_changed | Plan/effective inputs/result/day changed, or fingerprint was altered; discard preview and request a new one |
| manual_replan_protected | Started/completed/fact-bearing, terminal/shipped or locked plan; downstream blocker identifies the protected operation |
| manual_replan_dependency | Single move violates route sequence; the server message recommends downstream mode (this and subsequent operations) |
| manual_replan_capacity | Exact date has no compatible remaining capacity/work calendar/horizon; choose another date |
| manual_replan_blocked | Other route/readiness/linkage/freshness/retirement blockers, missing/unselected saved operation or target_date_in_past; show manager reason and diagnostic Debug |

## Protection and persistence

Scope stays existing standalone contour B. Selected node must be pending and unstamped, without canonical material/unit/ledger/stage fact. Its original assignment date may be past, today or future; waiting/current/ready placement alone is not production fact. Target date must be today/future. TechnicalCard must not be completed/cancelled/shipped. Whole-card plan_locked and explicit locked assignments cannot be overridden. PC-06.3D removes the old future-only and current/ready protection predicates.

Only manual preview/apply supplies editable_overdue_node_ids for eligible selected/downstream pending scope. The existing Scheduler default still protects past assignments; the optional flag relaxes date age only, never fact/manual locks. Single-mode historical successor dependencies are validated explicitly after the proposal. Downstream can replan old pending descendants; a protected downstream node blocks with its operation name/snapshot_node_id/reason, without changing its fact.

The explicitly selected pending `manual_adjusted` row can be moved again; other manual/locked/fact assignments and nodes outside the effective replan scope remain protected anchors. Apply pins the selected date as `manual_adjusted`/manual_lock=true; affected auto descendants remain auto. Stored queue_position is retained by the shared persistence service; no queue reorder occurs. Parallel independent branches, unselected ONE OF alternatives and other cards are not replanned.

The existing Scheduler receives a scoped replan_node_ids set and an optional not_before_by_node constraint for the selected operation. It owns duration, resource/WorkCenter choice, daily capacity, calendars, inclusive predecessor dates and the120-date horizon. Unused constraint leaves other Scheduler commands unchanged. Preview uses no in-memory ORM writes or savepoint mutations. Apply takes the same global scheduler gate, reloads inputs, revalidates the fingerprint, then uses existing persist_plan with preflight/retirement/allocation consistency and one commit. Exceptions roll everything back.

Existing calendar.assignment_deleted/created/replanned lifecycle events are retained with actor attribution. One canonical audit event `production_calendar.manual_route_replanned`, source=manual_planning, stores actor, selected node, mode, old/new dates/allocations, affected nodes and revision/fingerprint. No new audit store, migration, warehouse effect or production state source.

## Evidence

`backend/tests/test_manual_route_replan_pc_06_3b.py`:13 tests including actual PostgreSQL concurrent apply (one revision wins), read-only preview, atomic failure rollback, dependency/capacity conflict, selected ONE OF, independent branch preservation, re-moving explicit manual adjustment, API401/403/409 and fact protection.58 targeted cases with existing queue, Scheduler and persisted-summary regressions pass.

Local planning-only SKU201.2 card162 (`PC063B-PLAN-20261016-1`) retained for review. Actual API/service/RBAC/PostgreSQL E2E, existing auth/session dependency harness only: preview0 SQL writes;6 operations replanned, ETA2026-10-23→26, slack15→12;apply200/stale409;249 FK/0 orphans. All prior rows across26 source/business tables, including157/158/159 facts and source catalogs/stock/sewing, unchanged. Evidence: ignored logs/pc-06-3b/live-proof.json and manifest.json. No frontend patch, production apply, commit or push.

PC-06.3D evidence:11 new regressions and64 targeted cases; safe planning-only163 SKU201.2 has a pending QC operation originally2026-10-14. Single30October returns dependency (not protected); downstream moves2 pending operations, updates ETA to30October,apply200/replay409,preview0 SQL writes,249 FK/0 orphans. Existing current source route has QC rather than WTO; no route/config/facts were changed for this reproduction.
