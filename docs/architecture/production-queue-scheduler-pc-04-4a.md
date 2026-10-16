# PC-04.4A — Production Queue Scheduler

Implemented 2026-10-07 by owner selection after PC-04.3A/B/C. Explicit backend command only; no frontend, model or migration changes.

## API and selection

`POST /production-calendar/schedule`, no body, operationId `production_calendar_schedule_queue`. PlatformUser session and `technical_cards.create` required (401/403). Domain failures are HTTP200 summary results; integrity/concurrent link conflicts are409. No automatic/background execution.

Select all existing standalone cards (`order_group_id IS NOT NULL`, `sales_order_id IS NULL`) in draft/in_progress. Completed/cancelled and SalesOrder flow are excluded. Existing allocations of excluded cards still consume capacity. Missing dates/route/Demand and plan locks remain in the summary as blocked, rather than silently disappearing. The shared engine validates positive quantity, active route/steps, resource bindings/units and all mandatory Demand. Nonpositive quantity is also forbidden by the existing database CHECK.

Queue uses existing `priority_sort_key`: explicit priority ASC (null last), shipping_date ASC, planning_start_date ASC, created_at ASC, id ASC. Missing dates sort as date.max; their cards are blocked. Stored card number is returned, not a newly inferred display number.

## Shared engine and transaction

`production_queue_scheduler.schedule_queue` orchestrates `production_scheduler.schedule_card_in_transaction`; `_build` placement is reused unchanged. `persist_plan` writes/flushes complete assignments and allocations without committing. The public single-card `schedule_card` continues to own commit/rollback with the same API response. Demand/formulas/120-date horizon are unchanged.

One outer transaction owns the full queue. Remove only future, mapped, replaceable AUTO assignments and allocations of participating cards, using the existing `_protected` rule. Manual/locked/manual_lock, past-start spans, started/completed facts, plan_locked cards and entry markers are retained. Place cards in queue order; each sees flushed allocations of earlier cards and all retained occupancy. Old future AUTO plans must be removed together to allow priority changes to reorder the queue.

A blocked card keeps its previous plan. If that card had removed AUTO occupancy, roll back the round to a SAVEPOINT, exclude all blocked cards of that round, and replay remaining cards with the restored occupancy. This prevents an earlier success from stealing capacity of a later blocked card's old plan. At least one card is excluded on each replay, bounding rounds by selected-card count+1. Failures without removed AUTO occupancy need no replay: protected occupancy stayed visible. Blocked cards are not retried again in this command; a later explicit command can retry them.

Commit publishes only complete successful plans. Unexpected SQL/INSERT/commit failure rolls back the entire command, including deletions and earlier successes. Domain horizon/readiness failures do not abort other cards. Deadline_missed remains a saved planned result. Intermediate SAVEPOINT rounds are never published. A loop calling the public committing single-card function would not provide these semantics.

## Locks

Both single-card write and queue commands first acquire PostgreSQL transaction advisory lock `704044001`, then existing card/assignment/resource/fact locks. Queue cards lock by stable id; resources retain sorted-key locks. The gate survives SAVEPOINT rollback until outer commit/rollback, serializing scheduler commands and preventing mass/single lock inversions. This deliberately also serializes unrelated scheduler resources for MVP simplicity. No migration is needed. SQLite fixtures verify sequential behavior; concurrency is verified on real local PostgreSQL :5432. Dry-run single-card remains lock-free.

Existing low-level allocation/direct SQL writers remain subject to the PC-04.3A shared resource lock discipline; they are not automatically scheduler commands. Cutting-method one-rate-per-resource/day and other PC-04.3A boundaries remain.

## Summary

`QueueScheduleRead` contains status, total_cards, planned_cards, blocked_cards, deadline_missed_cards, preserved_cards and results. Aggregate status: empty (no selected cards), planned (all planned), partial (planned+blocked), blocked (all blocked).

Each result: technical_card_id, technical_card_number, priority, status planned/blocked, persisted, preserved, planned_completion_date, on_time, buffer_days, delay_days, steps_count, deviations. Results stay in queue order. Successful final commit has persisted=true; blocked has persisted=false, steps_count=0 and null completion/deadline fields. The old preserved plan is not represented as newly planned.

Preserved=true for planned cards with protected route anchors, or blocked cards with retained production assignments or plan_locked. Entry markers alone do not increase this count. Preserved count overlaps planned/blocked; it is not a separate partition. Late plans increment deadline_missed_cards, retain signed buffer and nonnegative delay. Summary omits large nested allocation arrays and returns schemas, never ORM rows.

Bottleneck summary is deferred: exact utilization requires date-range aggregation of exceptions and method-dependent cutting budgets. An approximation that multiplies base_rate by horizon or mixes units would be misleading. No analytics table or fallback formula was added.

## Evidence

`test_production_queue_scheduler_pc_04_4a.py`: queue order, null priority, ship/start/id ties, two/three shared-resource cards, leftovers, priority rebuild/determinism, missing inputs/route/date, horizon, plan lock, manual/past/fact anchors, late plans, terminal exclusion, permissions and injected second INSERT failure.

`test_queue_scheduler_concurrency_pc_04_4a.py`: two mass commands, mass+single, transaction rollback and blocked old-plan replay in a UUID-owned local PostgreSQL schema. Fixture rows are copied only from isolated tests; only the owned schema is removed. Owner plans/VPS are untouched. Existing PC-04.3A/C tests verify unchanged single-card/entry-marker behavior. Full evidence and check results: task report `docs/tasks/pc-04-4a-production-queue-mass-scheduler-backend-codex.md`.
