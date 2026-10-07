# PC-04.0 — Production Scheduler v0.1

Architecture freeze. This iteration does not add tables, fields, endpoints, or a scheduler run. A later implementation task must follow this document and must not invent a second route, a second capacity catalog, or a ProductionJob.

The canonical roadmap item **PC-04** («Добавление существующей ТК в календарную очередь») is a different checkpoint. This document does not close it.

## Decision

The scheduler is a deterministic forward placement of one standalone TechnicalCard onto the existing shop route and the existing shared CapacityResource rows.

It explains every placed day by the demand it consumed, the resource that limited that day, and the locks it refused to move. It does not optimize, solve backward from the ship date, or split a card into batches.

## Sources that already exist

| Input | Live source | Scheduler use |
|---|---|---|
| Card identity and quantity | `technical_cards.id`, `number`, `quantity` | Subject of the plan. Quantity is already required and greater than zero. |
| Standalone order number | `technical_card_order_groups.order_number` | Display and stable ordering context. A SalesOrder is not required. |
| Created at | `technical_cards.created_at` | Default planning start, and the last sort key before id. |
| Route | `shop_routing_templates` + `shop_routing_stage_lines`, referenced by `technical_cards.routing_template_id` | Ordered steps. There is no separate calendar route. |
| Operation | `tech_operations` on the route line (`tech_operation_id`) | Volume unit, stage, and M:N resource links. The operation does not store its own capacity. |
| Card operation snapshot | `technical_card_operation_lines` | Volume already captured for that card (`volume`, `volume_unit`, `sequence`, `stage_order`). |
| Capacity | `capacity_resources` via `tech_operation_capacity_resources` | One shared row for many operations. Exceptions stay on `production_capacity_exceptions`. |
| Queue span | `calendar_assignments.planned_date` (synonym `planned_start_date`) and `planned_end_date` | The visible start/end of a step. |
| Fact that must not be moved | `technical_card_stage_results.status` `in_progress` or `completed` | Those steps are already started or done. |
| Entry stage | production stage code `launch_preparation` | Where a card stays until it is ready. It is not a capacity consumer. |
| Sewing norm | Existing load calculation for resource key `sewers` | `Σ(duration_seconds × quantity_per_item) × card quantity / 3600`. `quantity_per_item` is the multiplicity. |

Live resource keys stay the keys already stored. The scheduler does not create aliases such as `plotter_pool`, `sewing_team`, or `packaging_team`. The current catalog keys include `plotter_1`…`plotter_4`, `print_operator`, `calender`, `calender_operator`, `cutters`, `laser`, `laser_operator`, `sewers`, and `packing_team`.

Route order is `shop_routing_stage_lines.stage_order`. The route has no predecessor or successor edges. The next line is the successor. Resources linked to the same TechOperation are simultaneous constraints, not a hidden sequence inside the operation. Plotter then calender is two route lines when they are two operations. One operation that links both resources waits for both on the same day.

## Fields the scheduler reads

PC-04.1 stores these. The scheduler still does not calculate demand or write allocations.

On the card, not on the order group:

- `planning_start_date` — date. For a card created after the field exists, the default is the calendar date of `created_at` in the platform timezone (`Europe/Moscow` unless settings say otherwise). For an older card the user sets the date explicitly. The scheduler does not guess it from `desired_date`.
- `shipping_date` — the client ship date for this card. `technical_card_order_groups.desired_date` remains the group wish date and is not renamed into `shipping_date`.
- `priority` — integer, nullable. A smaller number is planned first. Null sorts after every explicit priority.
- `plan_locked` — boolean, default false. Whole-card lock. The UI can wait.

On `calendar_assignments`:

- `routing_stage_line_id` — nullable FK to `shop_routing_stage_lines.id`. Null means the row is not a route step (the current entry queue). It is never a guessed line. The operation stays on that line; the assignment does not copy `tech_operation_id`.
- `planning_mode` — `auto`, `manual_adjusted`, or `locked`.
- `manual_lock` — true exactly when `planning_mode` is not `auto`. Both `manual_adjusted` and `locked` refuse an automatic move; the mode says why. The check constraint keeps the flag and the mode together.

New table `calendar_allocations`, one row per assignment, resource, and date:

- `assignment_id`
- `resource_key` (the CapacityResource primary key, not a new numeric id)
- `date`
- `allocated_amount` (Decimal, greater than zero)
- `capacity_unit` (the resource unit at plan time: `labor_hour`, `machine_hour`, `team_hour`, `item`, or `linear_meter`)

Unique `(assignment_id, resource_key, date)`. Deleting an unlocked future assignment deletes its allocations.

Uniqueness is no longer one row per card and stage. A partial unique index keeps one row per card and route step where `routing_stage_line_id` is set, and another keeps one unmapped row per card and stage. Two steps in one workshop can both be stored. Stage remains on the row for the weekly board. The scheduler still does not write assignments.

## Readiness

A card enters the plan only when all of the following hold:

- the card exists and `quantity > 0`;
- `routing_template_id` points at an active template with at least one line after `launch_preparation`;
- every production line has a TechOperation;
- `planning_start_date` and `shipping_date` are set;
- every linked resource used for demand exists;
- every required demand is calculable (section below).

Otherwise the card stays on `launch_preparation`. No production assignment and no allocation are written for it. The run returns `readiness_not_complete` or `demand_calculation_missing` or `capacity_missing`, naming the missing input.

`launch_preparation` itself never receives an allocation.

## Sort

Ready cards only, in this order:

1. `priority` ascending, null last;
2. `shipping_date` ascending;
3. `planning_start_date` ascending;
4. `created_at` ascending;
5. `technical_cards.id` ascending.

The same inputs always produce the same order.

## Demand

**PC-04.2 precedence (2026-10-07):** [ResourceDemand specification](production-demand-pc-04-2.md) is the current future Demand contract. Its explicit unit-equality and no-implicit-conversion policy supersede hourly conversions in the historical table below. Existing calendar load-state formulas remain unchanged; those estimates are not a shipped ResourceDemand service. Missing stored rules, mixed-cutting split and hourly/throughput mismatches remain explicit readiness limits. Demand implementation and Scheduler are still absent. The table below is retained as the PC-04.0 proposal, not a second master.

There is no single formula for every operation. The adapter is `route line + card → ResourceDemand[]`. Each demand names one `resource_key`, one unit, and one positive amount. Units are never added across resources.

| Mode on the linked resource | Demand | Missing when |
|---|---|---|
| `sewing_norm` (`sewers`) | Existing sewing calculation: verified seconds × card quantity / 3600, unit `labor_hour`. Seconds are `duration_seconds × quantity_per_item` on the assembly snapshot the current load calculation already accepts. | The current calculation returns `norm_missing` or `norm_unverified`. Zero duration is missing, not zero work. |
| `rate` and unit `linear_meter` or `item` | Card operation-line `volume` in that unit. A labor or machine resource in `rate` mode converts that volume with `base_rate` (`volume / base_rate`) into its own hour unit. | Volume is null or zero, the line unit does not match, or `base_rate` is absent. |
| `cutting_methods` (`cutters`) | Card quantity and the selected cutting method, using the existing method rates. | The card does not store a cutting method. The scheduler does not pick manual or lay. |
| `explicit_hours` | Hours taken from a stored card input for that operation. | No stored hours. |
| `team_rate` (`packing_team`) | Card quantity converted by the existing team rate. | Quantity is absent, or the team capacity rule cannot produce a number. |
| `milestone` | No demand and no allocation. | Never a capacity error by itself. |

If one required resource of a line cannot be calculated, the whole line is `demand_calculation_missing`. The run does not substitute a norm.

A resource with `include_in_calendar_load = false` is not a constraint and gets no allocation. A production line whose every linked resource is a milestone or excluded from the calendar is a date marker only. A production line with no remaining linked resource is `capacity_missing`.

## Daily capacity

`available = configured_capacity − allocations already kept for that resource and date`.

`configured_capacity` follows the current resource rules, not a new constant:

- labor: `resource_count × hours_per_day × shifts_per_day × efficiency`;
- machine: `hours_per_day × shifts_per_day × efficiency` (the machine count is not stored);
- team: the existing team rule, which does not multiply output by headcount;
- throughput: `resource_count × hours_per_day × shifts_per_day × efficiency × base_rate`, in `item` or `linear_meter`.

A date outside `working_days` has capacity 0. An exception with `unavailable` has capacity 0. An exception with `capacity` replaces `configured_capacity` for that date. Missing hours, count, or rate leaves the resource without a number: that resource is `capacity_missing`, and the line is not reserved.

Allocations of locked and manual rows count as already used. Two operation links to one resource do not double its capacity.

## Forward placement

Cards are placed in sort order. Inside a card, route lines are placed in `stage_order`, skipping `launch_preparation`.

The first production line has `earliest_start = planning_start_date`. The next line has `earliest_start = previous planned_end_date` (that date included). Shared resources still cannot be double-booked, because earlier allocations already reduced `available`.

For each line with demand, walk forward from `earliest_start`:

1. Skip days before `earliest_start`.
2. On a candidate day, compute how large a fraction of each concurrent demand still fits in that resource's `available`.
3. Place the minimum fraction across all concurrent resources of the line. Allocate that fraction of each demand, in that demand's own unit.
4. Carry the remainder to the next day.
5. Stop the line when every demand is fully allocated. `planned_start_date` is the first allocated day. `planned_end_date` is the last.

A milestone or date-marker line gets `planned_start_date = planned_end_date = earliest_start` and no allocation rows.

Search at most through `max(shipping_date, planning_start_date) + SCHEDULER_HORIZON_DAYS` calendar days (`120`, `backend/app/services/scheduler_horizon.py`). The number is not stored on the card. Demand still remaining is `no_available_capacity`. The partial allocations and the span reached so far are kept and shown. The run does not invent dates past the horizon. This search is not implemented.

An exception that zeroes a day the line needed, while an earlier unlocked plan had used that day, is reported as `resource_exception_conflict` when a locked row is the reason the remainder cannot move. A locked row that overlaps the only feasible days and blocks the remainder is `locked_assignment_conflict`.

## Assignments

One assignment per card and route line:

- `technical_card_id`
- `routing_stage_line_id` — null for an entry-queue row
- `production_stage_id`
- `planned_start_date`, `planned_end_date`
- `position` — order among cards on that stage and start date, following the same sort
- `planning_mode`
- `manual_lock` — true exactly when `planning_mode <> auto`
- `note` — optional; the scheduler may write the limiting resource key, and does not overwrite a user's note on a locked row

`planning_mode = auto` is what a recalculation may replace, and then `manual_lock` is false. `manual_adjusted` keeps the user's span and its allocations. `locked` is the same refusal to move. Existing calendar rows are stored as `manual_adjusted` with `manual_lock` true so a future run does not treat them as its own.

## What a recalculation refuses to change

- stage results `in_progress` or `completed`;
- assignments with `planned_end_date` before today;
- `manual_lock` assignments and `manual_adjusted` / `locked` modes;
- every assignment of a card with `plan_locked`.

Only future `auto` rows are deleted and written again. Locked rows stay and occupy capacity for the cards planned after them.

Priority, route, card norms, a CapacityResource, an exception, or an unlock are reasons to run. The MVP action is explicit: «Пересчитать план». There is no background recalculation.

## Completion and ship date

`planned_completion_date` is the `planned_end_date` of the last required production line. Every route line except `launch_preparation` is required. The route has no optional flag.

`buffer_days = shipping_date − planned_completion_date`, in calendar days.

- positive — buffer;
- zero — on the ship date;
- negative — `deadline_missed`.

A missed date is still saved. The deviation is the explanation, not a reason to hide the plan.

## Deviations

A run returns computed deviations. It does not create issue cards.

- `readiness_not_complete`
- `demand_calculation_missing`
- `capacity_missing`
- `no_available_capacity`
- `deadline_missed`
- `locked_assignment_conflict`
- `resource_exception_conflict`

Each item names the card, the route line when there is one, the resource key when a resource caused it, and the input that was missing or the day that stopped placement.

## Explainability

For any planned card the user can see:

- the sort keys that put it before or after another card;
- each route line's start and end;
- each allocation: date, resource, amount, unit;
- the resource whose available amount set the fraction on that day;
- the ship-date buffer or `deadline_missed`;
- which rows were left in place because they are locked, already started, or in the past.

## MVP boundary

The first implementation after this freeze selects ready cards, sorts them, walks the route, builds demand, places daily allocations, writes assignments, computes completion and deadline risk, saves that result, and respects locks.

It does not include Lead or Bitrix24, SalesOrder synchronization, 1C, ProductionJob or batch splitting, a solver, backward scheduling, purchase planning, fact execution, or an automatic planner.
