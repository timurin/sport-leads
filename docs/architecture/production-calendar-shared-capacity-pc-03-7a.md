# PC-03.7A — Shared CapacityResource and TechOperation

Owner decision 2026-10-06 supersedes the task's original preference for operation-owned 1:1 capacity. **TechOperation owns technological identity; CapacityResource owns capacity.** M:N links describe participation, with no per-operation capacity copies and no scheduler.

## Tables and data migration

- `production_capacity_settings` is renamed in place to `capacity_resources`. Old keys, stage/equipment links, staff, hours, days, note and timestamps are preserved. No parallel storage remains. `ProductionCapacitySettings` is only a Python import alias of the same `CapacityResource` mapper.
- `tech_operation_capacity_resources` has composite PK `(tech_operation_id, resource_key)`. Operation deletion removes its links, without deleting shared resources. Resource deletion is restricted while linked.
- Existing `production_capacity_exceptions` retains its rows, key/date PK and values; PostgreSQL updates its FK during the table rename. Exceptions belong to the shared resource, never to an operation copy.
- `resource_count` is an ORM/API alias of physical `staff_count`, without a second count column. A machine is one existing WorkCenter; its count is implicit one, with physical `staff_count=null` for backward compatibility.
- New persisted resource metadata: optional name, resource_type, capacity_unit, base_rate, shifts_per_day, efficiency, include_in_calendar_load, calculation_mode, norm_rates. Existing PC-03.4 rates/rules are backfilled from frozen definitions, not inferred from names.

Migration **`y4z5a6b7c890`**, after `x3y4z5a6b789`. Local saved resources were `designers` and `print_operator`. The migration creates two links from the same `print_operator` row to existing operations with codes `sublimation` and `heat_transfer`, as explicitly approved. A code/stage conflict stops migration. A sole design-stage operation receives the designers link; more than one candidate stops migration. No TechOperation is created or edited. Other resources remain preserved and unlinked until an explicit link is saved; no guessed machine/cutting/packing assignments. Missing matching operations leave resources intact and unlinked.

Downgrade restores the original table name, preserving all legacy availability fields, timestamps and exception rows. It drops new metadata and M:N links; re-upgrade reinitializes resource metadata from legacy definitions and the approved links. New custom resource keys cannot re-upgrade without an explicit definition, so upgrade aborts on unknown legacy keys rather than inventing semantics. Verify export of new metadata/links before an operational downgrade. No production downgrade/migration was performed.

## Canonical resource API

Prefix: **`/production-calendar/capacity/resources`**. Read requires the existing PlatformUser session; writes require `technical_cards.create`.

| Method | Path | Contract |
|---|---|---|
| GET | `/resources` | Saved resources only, scalar summaries; no exception arrays and no write-on-read. |
| GET | `/resources/{key}` | Shared resource fields + dated exceptions, 404 if missing. |
| PUT | `/resources/{key}` | Full replacement/upsert, one shared row; returns detail. |
| DELETE | `/resources/{key}` | 204; 409 if still linked or has dated exceptions; explicit unlink/exception removal required. |
| PUT | `/resources/{key}/exceptions/{date}` | Upsert shared date override using the existing exception schema. |
| DELETE | `/resources/{key}/exceptions/{date}` | 204; removes that override only. |

PUT fields:

```json
{
  "name": "Shared print operator", "production_stage_id": 3,
  "work_center_id": null, "resource_type": "labor", "capacity_unit": "labor_hour",
  "base_rate": null, "resource_count": 1, "hours_per_day": "10",
  "shifts_per_day": 1, "efficiency": "1", "working_days": [0,1,2,3,4],
  "include_in_calendar_load": true, "calculation_mode": "explicit_hours", "note": null
}
```

Required: name, production_stage_id, resource_type, capacity_unit (explicit null for milestone), working_days, calculation_mode. Optional fields use the defaults shown above except count/hours/base_rate/work_center/note default null. Shifts default 1, efficiency default 1, include defaults true. PATCH of resource fields is not exposed. Numeric values are Decimal; response decimals are strings, trailing zeros may vary. Days are unique integers 0–6, Monday=0. Unknown extra fields return 422.

Types/units and validation:

- labor uses labor_hour; team_hour is retained for the existing packing team, without multiplying team output by headcount. No WorkCenter.
- machine uses machine_hour, requires one active WorkCenter in its resource stage, resource_count null or 1. A WorkCenter remains unique across resource rows; duplicates return 409.
- throughput uses item or linear_meter, positive base_rate, rate mode, no equipment binding.
- milestone has capacity_unit=null, mode=milestone, count/hours/base_rate/equipment=null. It has no hourly exceptions or percentage.
- hours 0–24, shifts 1–24, total hours×shifts ≤24, count 0–10000, efficiency 0–1, positive optional base_rate. Working days and date overrides retain their previous semantics.

Modes: explicit_hours, rate, milestone for new resources. Existing legacy sewers/cutters/packing_team retain sewing_norm/cutting_methods/team_rate rules; those specialized rules are not assigned to new resources without a separately approved norm contract. Missing inputs stay unknown. Legacy resource stage/type/unit/mode are immutable through the canonical editor to preserve the old calendar contract. Base rate may be edited where one legacy throughput rate exists; its persisted rate changes the same load calculation. Cutting's two confirmed method rates remain fixed in this iteration.

## TechOperation API

- Existing GET `/tech-operations` and GET `/{id}` add slim `capacity_resource_keys: string[]`, sorted; no embedded exception arrays. The extra collection is fetched in one batch, not once per operation.
- Existing POST `/tech-operations` accepts optional `capacity_resource_keys` (default empty); PATCH `/{id}` accepts the field as full link-list replacement. Omission leaves links unchanged, `[]` unlinks, null/duplicates/missing resource keys return 422 without mutation. Existing catalog access contract is preserved.
- Unknown operation fields, including an inline `capacity` or flat resource fields, return 422 rather than being silently discarded. Editors must use the shared resource endpoints and link keys.
- GET `/tech-operations/{id}/capacity-resources` returns the canonical resource details for links to that operation (bounded queries), requiring session.
- PUT `/tech-operations/{id}/capacity-resources/{key}` accepts the canonical resource PUT payload, requires `technical_cards.create` and an existing link. It updates the same global shared row, so other linked operations and the calendar see the edit on reload. No inline `capacity` object is written on TechOperation.

To attach a new resource: PUT the canonical resource once, then POST/PATCH operation link lists. Both print operations use `capacity_resource_keys:["print_operator"]`; adding a link does not clone availability, rates or exceptions. Unlinking/deleting an operation preserves the physical resource. No route, TC snapshot or execution semantics change when links change.

## Calendar compatibility and load

Existing GET/PUT `/production-calendar/capacity/settings` and `/settings/{legacy-key}` retain the 14 legacy slots and their DTOs. They read/write `capacity_resources` directly. The old exception paths are aliases of the canonical date-override handlers. Unconfigured legacy slots remain visible without inserting records; new custom resources use the canonical resource list. No fabricated resources or available hours are seeded.

Existing POST `/production-calendar/capacity/load-state` accepts legacy keys and saved custom keys. Legacy units remain person_hours/machine_hours/team_hours/milestone; new throughput uses item/linear_meter. Units must match the resource. The available hourly capacity includes shifts and efficiency; labor=count×hours×shifts×efficiency, machine=hours×shifts×efficiency, team follows its existing crew rule, throughput=count×hours×shifts×efficiency×base_rate. Resource type and missing inputs preserve unknown/zero behavior; `include_in_calendar_load=false` yields unknown capacity and no percentage.

Resource demands supplied to one load-state request are summed once against that resource's capacity. The junction is not joined into this sum, so two operation links do not double capacity. Generic explicit_hours uses declared hours, generic rate uses quantity/running_meters ÷ base_rate for hourly resources or direct demand volume for throughput. Existing sewing norms continue to read the existing TC/assembly sources, unchanged; no new TC norm calculation or auto-allocation was introduced.

## Limits and validation

Frontend was not edited in PC-03.7A; PC-03.7B must consume shared resources/link lists, superseding its initial single inline capacity adapter. Runtime visual acceptance belongs to that task. No Scheduler, ProductionJob, auto-link by operation name, route changes, production apply, commit or push.

Evidence: `backend/tests/test_capacity_resources_pc_03_7a.py`, `backend/tests/test_capacity_resource_migration_pc_03_7a.py`, existing capacity/operation/routing/calendar suites and task execution report. PostgreSQL verification uses only local :5432 and a temporary schema rolled back in a transaction; exact old settings/timestamps and date exceptions are compared across migration cycles.
