# PC-04.2 — ResourceDemand contract

**Date:** 2026-10-07. **Status:** architecture specification. PC-04.2B implements the read-only calculation (`GET /technical-cards/{id}/demand`); it does not place work, write allocations, or run the scheduler.

Sources: [task](../tasks/pc-04-2-demand-calculation-contract.md), [scheduler architecture](production-scheduler-pc-04-0.md), [shared resources](production-calendar-shared-capacity-pc-03-7a.md), ADR-016 and ADR-017. PC-04.2 takes precedence over the earlier scheduler architecture's Demand table where their units or conversion policy differ; the rest of that architecture stays unchanged. The historical roadmap code PC-04 still means adding a card to the queue, not completion of Scheduler.

## Boundary and identity

**PC-04.4O amendment (2026-10-09):** TechOperation owns nullable `demand_rule`
(`fixed_per_order` / `per_item`) and positive integer `demand_duration_seconds`.
The existing TechOperation CRUD read/write DTO exposes both fields; partial settings
are allowed and remain blocked until complete. There is no time-norm field on the
TechnicalCard write contract. Legacy operations remain null; no production norm is
invented or backfilled. The admin rule applies only to linked `explicit_hours`
resources and preserves their exact hourly units (`labor_hour`, `machine_hour`,
`team_hour`). Capacity settings/counts are not work multipliers.

Runtime reads capture the current admin rule into the immutable Demand input DTO,
as they capture existing operation/resource settings. Card graph membership, edges
and operation facts are not rewritten. An existing plan changes only through its
existing explicit scheduling action; protected manual/fact plans retain their gates.
Diagnostics identify the TechOperation and either `demand_rule` (Правило расчёта
потребности) or `demand_duration_seconds` (Норма времени), with one identical message
across applicable operation/template/card surfaces. Missing norms for all explicit
hourly resources now use `missing_operator_norm`, replacing the legacy machine-only
`missing_fixed_norm` distinction for this adapter.

The future internal service contract is `calculate_step_demands(card, routing_stage_line, operation, linked_resources, verified_inputs) -> StepDemandResult`. Reads are batched before adapter execution. Adapters receive immutable input data, not a writable Session. The specification itself added no API. PC-04.2B exposes the same result as a read-only GET.

`TechOperation + TechnicalCard -> ResourceDemand[]` requires **route-step context**: one operation can appear twice in the same route. Identity is `(technical_card_id, routing_stage_line_id, resource_key)`. Neither workshop nor operation name/code identifies a step. Validate that the line belongs to `card.routing_template_id`, its operation matches the requested TechOperation, and operation/line stages agree. A stale/mismatched route snapshot is a diagnostic, never matched to the first similarly named operation.

TechOperation owns technological identity; CapacityResource owns available capacity; the junction supplies links. No copied capacity or guessed resource aliases (`plotter_pool`, `sewing_team`) are introduced. Use the real keys such as `plotter_1`, `print_operator`, `sewers` and `packing_team` when linked.

## Logical DTO (not a shipped API schema)

| Field | Meaning |
|---|---|
| technical_card_id | Existing card id. |
| routing_stage_line_id | Existing concrete route-line id, required. |
| operation_id | Existing TechOperation id, required for a demand. |
| resource_key | Existing linked CapacityResource key, required. |
| amount | Decimal or null; a `ready` demand has a finite positive amount. |
| unit | `labor_hour`, `machine_hour`, `team_hour`, `item`, `linear_meter`; null permitted only for a non-consuming milestone. |
| status | `ready`, `missing_input`, `manual_required`, `not_applicable`. |
| source_type | Stable provenance category below; nullable when configuration cannot select a source. |
| details | Structured evidence and a reason, not an opaque free-text formula. |

The task's conceptual `calculation_source` maps to **source_type**, and `calculation_details` maps to **details**; do not publish two synonymous fields.

Source categories: sewing_operation_times, technical_card_quantity, technical_card_linear_meters, fixed_per_card, fixed_per_batch, manual, milestone. PC-04.4O supplies fixed_per_card from the TechOperation fixed_per_order norm; its per_item norm uses technical_card_quantity with the stored time factor in details. Fixed-per-batch/design inputs remain future. A missing source may be null with an explanatory issue. An unresolved unit mismatch retains the candidate's manufacturing unit in `unit`; `details.expected_unit` records the resource unit. A missing admin hourly norm uses the expected hourly unit while its amount remains null.

`details` contains `adapter`, `reason_code` (null for ready), input entity/row ids, field names, used quantities/units, formula id, rule reference when available, and the resource's expected unit. For an incompatible unit it also records `candidate_amount`/`candidate_unit`; the demand itself keeps `amount=null`. Decimal values are JSON strings. Human-readable explanation can accompany the stable reason code.

`StepDemandResult` has card/step/operation identity, ordered `demands`, aggregate `status` using the same four values, and `issues`. Issue objects have `reason_code`, step identity and nullable operation/resource references. Missing operation/link has no real resource key: return `demands=[]` plus a blocking issue, rather than manufacturing a ResourceDemand with a fictitious key.

## Status and missing-data policy

| Status | Semantics |
|---|---|
| ready | Source and identity are verified, amount >0, unit matches the resource exactly. |
| missing_input | A selected rule lacks required input or fails identity/unit validation. Amount is null. |
| manual_required | No supported stored rule/input exists for this kind of work; an explicit estimate or decision is needed. Amount is null. |
| not_applicable | Milestone or explicitly excluded resource; no amount consumed and no allocation. |

Absent, zero, negative or non-finite inputs are not silently replaced by defaults. Zero in a card operation volume is a generation placeholder in current code, not proof that the operation is free. A documented explicit zero split can make that split's resource not_applicable; such split data is not currently stored.

All linked resources included in calendar load are required constraints under the existing PC-04.0 contract. A step with consuming demands is ready only when every required demand is ready and there are no blocking issues. If one resource is missing/manual, the step is incomplete even if other demands are calculable; future Scheduler must not allocate the known subset. Aggregate priority is missing_input, then manual_required, then ready; only an entirely milestone/excluded step is not_applicable. No links is missing_input/missing_resource_link, not a vacuously ready step.

Demand calculation does not inspect working days, staffing, daily exceptions, shipping date, horizon or locks to determine required work. Missing available capacity is a separate future capacity/readiness result: it does not turn verified work quantity into an invented norm. Changing hours/day or resource_count must not change the card's work demand.

## Existing input audit

| Input | Confirmed source | Limit |
|---|---|---|
| Card quantity | `TechnicalCard.quantity`, Numeric(14,3) | Use the card's quantity, not group card count, order quantity or batch guess. |
| Step | `ShopRoutingStageLine.id`, template id, stage_order, tech_operation_id | Operation FK can be null; route may have changed since card snapshot. |
| Card operation volume | `TechnicalCardOperationLine`, source_kind= routing, tech_operation_id, stage_order, production_stage_id, volume/unit | No routing_stage_line_id or explicit volume-confirmed flag on this snapshot row; generated volume defaults to 0. |
| Applied sewing operations | Card operation rows source_kind= sewing, sewing_operation_id/name and stage_order | These rows contain neither duration_seconds nor multiplicity. Their volume is not a sewing time. |
| Sewing time and multiplicity | `SalesOrderItemAssemblyOperationSnapshot` or selected `AssemblyVariant`'s `AssemblyOperationLine`: duration_seconds, quantity_per_item | `quantity_per_item` is multiplicity. `TechnicalCardStageResult.duration_seconds` is fact and must not supply a plan norm. |
| Resource links/settings | `TechOperationCapacityResource`, `CapacityResource` | Current modes are explicit_hours, rate, sewing_norm, cutting_methods, team_rate, milestone. There is no operation-owned calculation_mode column. |
| Fixed/operator/design estimate | Not found in the audited card/operation/resource models | base_rate means productivity, not fixed hours; note is not structured input. |
| Cutting mode and split | No manual_quantity, laser_quantity or selected cutting-method fields found | Do not derive a split from names, route order or available machines. |

Audit evidence: `backend/app/models/technical_card.py`, `models/product_model.py`, `models/sales.py`, `models/shop_routing.py`, `models/tech_operation.py`, `models/production_capacity.py`; `services/technical_cards.py`, `services/production_capacity.py`, `repositories/production_capacity.py`. Existing `_sewing_norms`/`sewing_norm_data` are reuse candidates, not a new implementation in this task.

## Adapters and selection

Dispatch by **persisted calculation_mode plus typed resource/input context**, never by operation name/code. The names sewing_time/item_throughput/linear_meter_throughput/team_throughput below describe future adapter roles; they are not new enum values added to the database here.

| Current mode | Future adapter selection | Result under this contract |
|---|---|---|
| sewing_norm | sewing_time | Verified applied sewing seconds × card quantity /3600, labor_hour. |
| rate + item | item_throughput | Card quantity, item, for the explicitly selected full-card item rule. |
| rate + linear_meter | linear_meter_throughput | Verified card operation volume, linear_meter. |
| rate + hourly unit | No implicit throughput→hours adapter | A throughput candidate cannot become ready without a separately approved, stored rule producing that exact hourly unit. capacity_unit_mismatch when the selected workload unit differs. |
| explicit_hours | TechOperation admin time norm (PC-04.4O) | `demand_rule=fixed_per_order` uses `demand_duration_seconds / 3600` once per card/step; `per_item` additionally multiplies by card quantity. Integer seconds, Decimal hours; missing rule/value remains `missing_operator_norm`. No manager-entered hours. |
| cutting_methods | cutting adapter | Ready only for TechOperation.code `manual-cut` with stored `cutting_method` `manual_single` or `manual_lay`. Amount is card quantity in item; the matching cutters rate is recorded and is not divided into hours. Empty method is manual_required/missing_cutting_mode. Laser and opt-cut are not selected by this adapter. |
| team_rate | team_throughput | Card quantity in item; the current team_hour resource therefore fails unit equality for this candidate. No double staffing multiplier. |
| milestone | milestone | not_applicable, amount=null, unit=null. |
| fixed_per_card / fixed_per_batch / design rule | PC-04.4O supplies fixed-per-card provenance through explicit_hours; batch/design rules remain future | Not independent database modes. `fixed_per_order` means one TechOperation execution on one TechnicalCard, not once across a SalesOrder/group. Batch attribution/design rules are not added; never infer a norm from base_rate or free text. |

Unknown/unsupported mode produces missing_input/unsupported_calculation_mode. A resource with include_in_calendar_load=false emits not_applicable/resource_excluded without inspecting manufacturing inputs. Milestone behaves the same regardless of availability. No adapter creates or changes operation/resource records to make itself supported.

### Sewing

Resolve applied **card sewing rows for this concrete step**, then match each once to its accepted time source. If sales_order_item_id is present, use that item's assembly snapshots; do not replace a missing snapshot with a live variant. For standalone cards use the selected AssemblyVariant only when it belongs to the card's product_model_id. Ambiguous matches, reused source rows, changed route scope or missing verification yield missing_input; do not count an entire assembly again for every sewing step.

Use sewing_operation_id when present; the existing name-match path is admissible only when it yields exactly one source row. Never select a TechOperation adapter by its display name. Every applied row must have positive duration_seconds and multiplicity≥1 from a verified source. Unapplied source rows do not contribute. Record both card row ids and source row ids in details.

`amount = Σ(duration_seconds × quantity_per_item) × TechnicalCard.quantity / 3600`, unit=labor_hour. Missing time/multiplicity yields missing_sewing_norm. Missing/ambiguous source yields sewing_norm_unverified. Schema-compatible example: verified sum 720 seconds per item ×1000/3600 =200 labor_hour. The task's 0.184 hour/item →184 hours example is an arithmetic illustration: it requires 662.4 seconds per item, which cannot be represented exactly by today's integer durations/integer multiplicities. Do not insert or round that illustrative norm as if it were stored data.

The existing load helper evaluates the card's complete applied sewing set. Future reuse must expose or verify route-step scoping; blindly calling it once per repeated sewing step would double-count. No existing helper is changed here.

### Items, linear meters and cutting

For the explicit full-card item rule, return card.quantity once for the operation/resource. Do not multiply an already-total quantity by card quantity again. Applicability to manual cutting, laser, packing or control must be selected by a stored rule; operation names alone are not a rule.

For linear meters, select **one** routing snapshot row using card id, source_kind=routing, tech_operation_id, stage_order and matching production_stage_id against the requested live line. Exactly one compatible positive `volume` with volume_unit=linear_meters supplies the total meters for this card/step; map the vocabulary to linear_meter. Multiple candidates, mismatched route data or zero/missing volume yield missing_input (ambiguous_operation_volume, route_snapshot_mismatch, missing_linear_meters). Do not sum arbitrary material lines or compute meters from card.quantity/model hints; the demand adapter consumes an accepted card volume and does not certify or invent a model norm. A future volume-provenance/confirmation flag is a separate persistence decision.

`pieces -> item` and `linear_meters -> linear_meter` are vocabulary normalization of the same measured quantity, not conversion to hours. Machine and operator demands remain separate. Without an operator rule, the labor resource yields manual_required/missing_operator_norm; machine hours cannot be copied into labor hours.

**PC-04.4T, 2026-10-10 — owner-requested operation input population.** The producer, not the Demand adapter, fills new/empty routing rows when model/assembly/routing is bound. Piece rows use the existing whole-card quantity rule. Meter rows require one positive, unit-compatible norm on the selected active `ProductModelRoutingLink`: an exact operation/stage match takes precedence, otherwise a unique workshop default is permitted. An unrelated operation's norm, wrong unit/stage, inactive link, zero or ambiguous norm never supplies meters. The accepted total is copied into `TechnicalCardOperationLine.volume`; Demand still consumes that stored row and does not fetch live model hints.

`TechnicalCardOperationLine.volume_qty_per_item` is nullable internal input provenance (migration `d0e1f2a3b456`). Newly generated routing inputs snapshot 1 for pieces or the accepted meter norm; sewing rows snapshot their source's positive multiplicity. A quantity import/unit-line replacement recomputes only marked inputs from this frozen basis, without replacing the route snapshot or rereading changed catalog norms. An explicit shop volume write clears the basis. Existing positive legacy/manual inputs and missing meter inputs are not guessed or retroactively marked by the migration. Explicit route reapplication can accept new catalog norms. Sewing Demand remains the verified, step-scoped `duration_seconds × multiplicity × card.quantity / 3600`; the projected sewing piece volume is not multiplied into that formula a second time. Zero time remains a real blocker.

An explicit model change invalidates only marked routing inputs before accepting the new model's compatible norms. Missing new-model meters stay missing; unmarked legacy/shop volumes remain untouched. This is an explicit write/binding step, never a fallback in read-only Demand.

**PC-04.4U, 2026-10-10 — route norm persistence/cache audit.** The canonical variant input is `ProductModelOperationNorm.norm_qty_per_item` plus `unit`, scoped by the selected active model/routing link and operation/workshop. The editor writes this field. Both meter and piece producers copy a unique compatible configured norm into `TechnicalCardOperationLine.volume_qty_per_item`; piece operations use the existing one-item default only when no applicable variant norm exists. Invalid configured norms are not replaced by that default. This internal column is the frozen source norm per item, not a productivity/time rate or a second live source of truth. The accepted `volume` is the rounded total `volume_qty_per_item × card.quantity`. A manual shop write clears the basis and preserves the manually accepted total through quantity changes. Explicit route reapplication replaces the snapshot and accepts current source norms, including replacement of previous route volumes under the existing reapply contract.

New cards read current norms at binding/reapply; existing cards are never refreshed from live variant edits by GET, Demand or Scheduler. Quantity changes use the saved basis. Demand's established item/time rules remain unchanged: a configured piece input is persisted/displayed, but does not redefine a whole-card item demand or sewing time formula. PostgreSQL, fresh API requests and two frontend reloads matched for a committed temporary quantity-8 card (0.700 → 5.600 meters, 1.000 → 8.000 pieces); the temporary card and owned group were deleted. `CACHE NOT ROOT CAUSE`: 29 pre-fix CAL-STRESS cards retained zero/null inputs. Explicit same-model/assembly repair restored 329 inputs (22 meter rows), retaining routing nodes/edges, ONE OF choices and calendar assignments. The 36 remaining meter zeros have no compatible source norm; real sewing-time/unit blockers remain. No global cache policy, Capacity, WorkCenter or Scheduler change is required. Evidence: `docs/tasks/pc-04-4u-route-norms-to-techcard-persistence-cache-audit-codex.md`, ignored `logs/pc-04-4u/`.

PC-04.2F stores nullable `cutting_method` (`manual_single` or `manual_lay`) on the card operation line. It is valid only for TechOperation.code `manual-cut`. A selected method returns card.quantity in item and records that method's stored cutters rate (`manual_single_items_per_person_hour` or `manual_lay_items_per_person_hour`). The rate is not used to convert the demand into hours. An empty method stays manual_required/missing_cutting_mode. Laser remains its own rate/item operation. opt-cut is not given a cutters rate. Mixed manual/laser quantities are not stored. A volume is never duplicated across methods or divided using available capacity.

### Team, fixed work and design

Team throughput demand is card.quantity in item. Team productivity belongs to CapacityResource. Staff count, crew size and shifts do not multiply card demand or team output a second time. PC-04.2C stores packing_team as item with base_rate equal to whole-brigade items per hour and resource_count 1. A stored headcount is not a second multiplier. Dated exception numbers are left as stored.

Fixed-per-card work uses one stored norm once per card/step, independent of quantity. Fixed-per-batch work requires a stored norm, explicit existing batch identity and explicit once-per-batch attribution. An order group/number or number of cards does not establish that scope; absence is manual_required/missing_fixed_norm or missing_batch_scope. This task adds neither Batch nor ProductionJob. Cross-card deduplication for a future batch rule is not implemented and cannot be assumed.

Design's proposed `base_hours + unique_design_variants × variant_hours` is a separate, unimplemented adapter. No such parameters are confirmed on the current models, so design yields manual_required/missing_design_rule. Do not infer uniqueness or complexity from size rows/media count, multiply work by card.quantity, or count waiting for customer approval as labor load.

## Unit boundary and compatibility

Ready requires exact equality `demand.unit == CapacityResource.capacity_unit`, consistent with PC-04.1's allocation service. team_hour stays a distinct supported unit; it is never added to labor_hour. Milestones have no allocation unit. The old load-state DTO's person_hours/machine_hours/team_hours vocabulary must not be passed to allocations as if it were canonical units.

**No implicit quantity/rate conversion in Scheduler or in an unspecified adapter.** PC-04.2C stores plotter_1..plotter_4 and calender as linear_meter, and laser, cutters and packing_team as item, so a matching demand can be ready. A resource that still uses a different hourly unit keeps missing_input/capacity_unit_mismatch and preserves the candidate. A later owner-approved stored normalization rule could explicitly produce machine_hour/team_hour, but it must declare inputs, provenance, formula and unit, be independently tested, and not be selected merely because a rate exists.

The calendar load-state service still converts meters and items to hours for its warning percentage. That response is not ResourceDemand. PC-04.2C does not implement `base_rate * resource_count * hours_per_day * shifts_per_day * efficiency`. The older PC-04.0 Demand table's automatic hourly conversion stays superseded by this boundary.

## Multiple and shared resources

Return one normalized demand per card/step/resource key. One operation can return several demands with distinct units. print_operator remains one shared row across sublimation/heat_transfer; each real step creates its own work demand, but does not receive a copy of resource capacity. Across cards/steps, do not discard legitimate demand merely because the resource key repeats. Future Scheduler aggregates consumption by actual resource/date.

All linked consuming resources are mandatory concurrently under PC-04.0. Four plotter links do not express an alternative pool or automatically mean one quarter of the volume each. Alternative-resource selection/pool roles require an explicit later decision; no resource or role is inferred in this contract. Resource failures do not silently remove a link.

## Determinism and future validation

Use one captured input snapshot per calculation, sorted by route stage_order/line id, then resource_key; source rows sort by stable id. Decimal arithmetic uses a declared fixed precision (28 significant digits for the future adapter contract), without binary floats, dates/days rounding, random choices or wall-clock dependence. Serialization is a canonical plain decimal string. CalendarAllocation's Numeric(14,4) rounding/overflow checks belong to a future allocation writer; Demand does not round away work to fit that column. No demands or errors are persisted in this documentation iteration.

Examples use existing key names **when linked**; ids below are illustrative, not inserted records:

```json
{
  "technical_card_id": 42,
  "routing_stage_line_id": 7,
  "operation_id": 3,
  "resource_key": "sewers",
  "amount": "200",
  "unit": "labor_hour",
  "status": "ready",
  "source_type": "sewing_operation_times",
  "details": {
    "adapter": "sewing_time",
    "reason_code": null,
    "formula_id": "sum_seconds_multiplicity_times_card_quantity_div_3600",
    "quantity": "1000",
    "seconds_per_item": "720",
    "card_operation_line_ids": [101],
    "norm_line_ids": [11],
    "norm_table": "assembly_operation_lines",
    "expected_unit": "labor_hour"
  }
}
```

```json
{
  "technical_card_id": 42,
  "routing_stage_line_id": 8,
  "operation_id": 1,
  "resource_key": "print_operator",
  "amount": null,
  "unit": "labor_hour",
  "status": "manual_required",
  "source_type": "manual",
  "details": {"adapter": "explicit_hours", "reason_code": "missing_operator_norm", "missing_field": "demand_rule"}
}
```

A 300-meter print step can be ready for a linked plotter or calender whose capacity_unit is linear_meter. The same step stays incomplete while an operator has no stored labor norm. A resource that is still machine_hour keeps capacity_unit_mismatch. Demand does not write assignments or allocations.

| Future test | Required expectation |
|---|---|
| Sewing | Scoped applied rows only; quantity/multiplicity each multiplied once; missing duration and ambiguous snapshot fail. |
| Item throughput | Approved full-card rule gives 1000 item for quantity=1000; zero/invalid quantity fails. |
| Meters | Unique positive card snapshot yields its total meters once; absent/zero/ambiguous/foreign snapshot fails. |
| Fixed work | Stored fixed-per-card norm stays constant when quantity changes; absent norm requires TechOperation admin configuration, not manager manual input. |
| Batch fixed work | Explicit scope/attribution required; no accidental per-card duplication. |
| Milestone/excluded | not_applicable, null amount, no allocation. Empty resource links remain blocking. |
| Multi-resource | Ready machine plus missing operator makes the entire step incomplete; known subset is not reserved. |
| Unit mismatch | item/linear_meter cannot consume labor_hour/machine_hour/team_hour without an approved explicit rule. |
| Team | 1000 items stays 1000 when crew size changes; no second staffing multiplier. |
| Cutting | Missing mixed split requires manual input; exact split conservation; common pool is not duplicated. |
| Shared resource | Two steps share one capacity row and retain two separate demand identities. |
| Deterministic/pure | Same snapshot produces identical ordered DTO/details; queries bounded by collections, no writes, dates or allocations. |

All adapter tests and executable DTO/service work remain future implementation. Scope excludes calendar placement, priority sorting, date search, locks, deadline calculation, reservation, writing CalendarAssignment/CalendarAllocation, factual production changes and frontend changes.
