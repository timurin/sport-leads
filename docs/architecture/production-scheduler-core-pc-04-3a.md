# PC-04.3A — Scheduler Engine Core

Implemented 2026-10-07 by explicit owner selection after the prerequisites named in the task. Backend only; single standalone card, no background or mass scheduler. No new table, column or migration.

## Service and API

`backend/app/services/production_scheduler.py` separates `_build` (in-memory placement, no writes) from `schedule_card` (snapshot, locks, transaction and persistence). The existing read-only Demand service supplies every production step; its adapters, norms and units are not replaced. `backend/app/repositories/production_scheduler.py` batches resource, allocation, exception, route/catalog and protected-fact reads. Availability is computed from the canonical CapacityResource fields, not the legacy UI load-state DTO.

**POST `/technical-cards/{card_id}/schedule`**, operationId `schedule_technical_card`. No request body. Requires a PlatformUser session and existing `technical_cards.create`, the same permission as calendar planning. 401/403 for absent session/permission; unknown card 404; a database integrity/concurrent link conflict 409. Domain readiness/capacity/lock failures are 200 with `status=blocked` and explanations, without writing a new plan.

Response fields:

- technical_card_id, status (`planned`/`blocked`), persisted;
- planning_from, horizon_end;
- planned_completion_date, on_time, buffer_days, delay_days (null for blocked);
- steps: route-line id, stage id, start/end, preserved, assignment_id, allocations;
- allocations: resource_key, date, allocated_amount (Decimal JSON string), capacity_unit;
- deviations: code, reason, optional route-line id/resource key.

An unsuccessful response has steps=[]; it does not expose a partial draft as a saved plan. `deadline_missed` is a successful saved plan with on_time=false. `buffer_days` is signed ship-date minus completion; `delay_days=max(0,-buffer_days)`.

Internal `schedule_card(db, card_id, persist=False, today=...)` is a read-only dry-run: no row locks or writes and no assignment IDs for newly proposed rows. `persist=True` owns commit/rollback for the command's Session. The explicit today parameter makes tests reproducible; public today comes from the platform timezone and the current UTC timestamp. No dry-run API or caller-supplied date is exposed.

## Readiness and traversal

Require an existing standalone draft/in_progress card with positive quantity, active route, planning_start_date and shipping_date, and plan_locked=false. Validate active production stages/operations and all mandatory Demand results before placement. Missing/manual Demand, absent links, incompatible units and unavailable bindings produce explicit deviations. The service never fills missing card inputs or norms.

Use existing route stage_order/id; skip the launch_preparation stage itself. Included ready demands consume capacity; milestones and excluded resources create date-marker route assignments without allocations. A route with no production steps is blocked.

First new production date is **max(platform today, planning_start_date)**. The next step may start on its predecessor's planned_end_date, inclusive, as in the existing route architecture. Earlier allocations reduce the same day's remaining shared capacity. No hidden sequence is created among linked resources of one operation.

**Horizon is exactly 120 calendar dates for new placement**, from planning_from through planning_from+119 days, shared by the card's whole traversal. Shipping_date is a deadline and never extends this technical search bound. This bounded implementation supersedes the earlier PC-04.0 proposal to search until max(shipping_date, planning_start_date)+120. A preserved existing anchor may lie outside that window; it is not moved. If it leaves no date for a later new step, the command is blocked.

Future batch ordering helper `priority_sort_key`: priority ASC with null last, then shipping_date, planning_start_date, created_at, id. It does not select or re-prioritize any other card.

## Daily capacity and occupancy

PC-04.4D treats linked physical machine resources as alternatives: choose one compatible active WorkCenter per step while all labor/team/other demands remain concurrent. Trial selection, physical allocation identity and the equipment capacity API are defined in [WorkCenter contract](work-center-capacity-pc-04-4d.md). Scalar formulas, horizon and priority are unchanged; scheduler allocation JSON adds nullable work_center_id.

Days not in working_days have zero capacity. A dated unavailable exception gives zero; a positive/zero override replaces the full capacity in the resource's canonical unit, including on an otherwise nonworking date.

Productive hours = hours_per_day × shifts_per_day × efficiency. Hourly labor capacity = hours × resource_count; machine count is one existing active WorkCenter in the correct active stage. Item/linear_meter capacity = productive hours × effective count × base_rate. Machine effective count=1. packing_team/team_rate uses one team, resource_count=1, not an additional multiplier for its two members; invalid team composition stays unknown. The existing team_hour unit remains distinct from labor_hour.

Cutting-method productivity uses the selected stored method rate returned in verified Demand details (20/40 are not Scheduler constants). Existing cutting allocations resolve their method through their own card routing operation snapshot and actual resource norm_rates. Missing/ambiguous method provenance blocks planning with capacity_missing. **Conservative MVP restriction:** a shared resource/day uses one method rate. A day already occupied under another method is skipped for the new step. The engine does not silently add unlike productivity budgets or infer employee hours from item-only dated exceptions. Incompatible protected anchor method use is a lock conflict. This may leave unused capacity; mixed-method utilization optimization is a separate future task, not batch splitting here.

Subtract all retained CalendarAllocation amounts in the same canonical resource/unit/date. Old replaceable AUTO allocations of the requested card are excluded from the calculation. Other cards and retained anchors continue to consume capacity. Foreign allocations outside the search window cannot occupy it. Never sum different units; an existing incompatible allocation yields capacity_unit_mismatch.

For one multi-resource step, find the minimum fraction of **remaining** demands that fits concurrently on a candidate day, then allocate that fraction separately in each resource's unit. If one mandatory resource has no usable remainder, do not allocate the others that day. Later days receive the outstanding work; no scheduler-generated demands or operator norms.

Allocation arithmetic uses Decimal precision 28 and the existing Numeric(14,4) storage quantum 0.0001. Each total demand is rounded **up once** to the storage quantum so positive work is not lost. Day availability and partial allocations are rounded down; zero rounded shares skip the day. Totals outside Numeric(14,4) range are blocked. Spans use the first/last allocation date; markers use one date. Persisted allocation tuples remain unique by assignment/resource/date.

## Recalculation, anchors and entry marker

Only the card's route-mapped AUTO rows starting on/after today, with manual_lock=false and no started/completed fact, are replaceable. Rows whose span starts in the past (including one overlapping today) are preserved; this is more conservative than testing end_date only. User-owned unmapped production rows cannot be guessed into a route step and produce a lock conflict. Obsolete future AUTO route rows can be replaced; obsolete protected rows block the command.

Retained mapped assignments are immutable anchors. Their stage, span and allocation totals/units must agree with current Demand; future anchor dates must respect predecessor completion. Saved allocations must exactly span the anchor dates and fit current availability. If an anchor conflicts, return locked_assignment_conflict, preserving every old row. An in_progress/completed fact without a saved mapped plan blocks new scheduling for that step; fact timestamps are not invented into plan dates. Historical compatible anchors can precede today; following new rows cannot.

The existing unmapped launch_preparation queue row is kept as an entry/readiness marker on both success and failure, preserving id, note, position and locks. It is never copied or allocated. This service does not advance factual shop status/current stage, create a new marker when none exists, or delete it after planning.

## Atomicity and concurrency

PC-04.4A adds a queue orchestrator over the same engine and persistence helpers. Single-card and queue writes now first take PostgreSQL transaction advisory lock `704044001`, before existing row locks, preventing mass/single lock inversions. `schedule_card_in_transaction` does not commit; the single-card wrapper retains its transaction/response contract. Dry-run remains lock-free. See [queue contract](production-queue-scheduler-pc-04-4a.md).

Preflight and every route placement finish in memory before any AUTO deletion. If any step fails—including horizon exhaustion—none of the new draft is persisted and the previous AUTO/manual plan remains. Success deletes only replaceable allocations/assignments and inserts the complete new plan in one transaction; an INSERT/commit error rolls back deletion too. This atomic behavior supersedes the PC-04.0 proposal to keep partial horizon-exhausted placements.

Write commands lock the card, its existing assignments and facts, and shared resource rows in stable key order. Occupancy is read after acquiring the shared locks; Demand is refreshed after waiting so resource settings are not used from a stale cached ORM view. New links outside the locked resource set cause a retry conflict. The PostgreSQL test runs simultaneous commands against one shared resource and verifies no overflow.

These locks serialize this Scheduler's commands and ordinary updates to locked resource/card/assignment rows. The lower-level pre-existing allocation foundation is not a concurrent Scheduler writer and was not redesigned here; an external writer must follow the same resource lock discipline. No claim is made that this service auto-reconciles arbitrary direct SQL edits or performs a background recalculation after catalog/exception changes.

Queue positions append to the existing date/stage tail, without reordering retained rows; integer overflow returns a conflict and rolls back. Response preserves anchor assignment IDs. Recalculated AUTO IDs may change; demand/date/amount order is deterministic for the same input snapshot and today.

## Evidence and limits

Tests: `backend/tests/test_production_scheduler_pc_04_3a.py` and `test_scheduler_concurrency_pc_04_3a.py`; existing Demand and unit-alignment regressions. TestClient verifies endpoint permission/status behavior. SQLite tests cover missing inputs/links, dry-run purity, working days/exceptions, efficiency, shared and concurrent resource use, milestones, route steps in the same workshop, manual/locked/historical/factual anchors, horizon, rounding, deadline risk and rollback after an injected persistence failure.

PostgreSQL verification uses canonical local :5432 and a UUID-owned test schema, cleaned after the test; no owner plans or production data are scheduled. No migration, frontend change, ProductionJob/Batch, bulk/background/backward scheduler, drag/drop, new norm, or production apply. The rest of the calendar/module readiness remains open.
