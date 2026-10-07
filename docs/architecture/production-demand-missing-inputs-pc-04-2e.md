# PC-04.2E — Missing Demand inputs

Audit only. No schema, API, adapter, or capacity change.

Local evidence is Docker Postgres `127.0.0.1:5432` on 7 Oct 2026. Codes below are the stored `code` values. Display names are omitted where the console encoding was lossy; the codes are the identity.

## Short result

Nothing that is still `manual_required` can be turned into hours or a cutting split from data that already exists. Sewing, item throughput, linear meters, packing, and milestones already have a source. Empty meter volumes and missing resource links are missing rows, not missing columns.

Do not copy machine meters or laser quantity into operator hours. Do not treat design approval, mockups, or size rows as labor. Do not add `manual_quantity` / `laser_quantity`: the route already picks one cutting operation.

## Matrix

| Resource / mode | Current status | Existing inputs | Missing inputs | Proposed owner | New field? |
|---|---|---|---|---|---|
| designers / explicit_hours | manual_required, `missing_operator_norm` | `design-op` linked to `designers`; card media; design project/version/asset; `SalesOrder.design_approval_status` | labor hours for this card's design step | TechnicalCard step, only after a rule exists | No, until the rule is approved |
| print_operator / explicit_hours | manual_required, `missing_operator_norm` | Linked to `sublimation` and `heat_transfer`; those operations are `linear_meters` | labor hours that are not derived from plotter meters | TechOperation fixed hours, only after a rule exists | No, until the rule is approved |
| calender_operator / explicit_hours | same, when the catalog row is saved and linked | Code catalog only. No calender operation, no link, no 1:1 rule | an explicit operator rule | not CapacityResource | No |
| laser_operator / explicit_hours | same | `laser` operation exists and is unlinked. No 1:1 rule | an explicit operator rule | not the laser machine rate | No |
| cutters / cutting_methods | manual_required, `missing_cutting_mode` | Rates `manual_single` 20 and `manual_lay` 40 on the catalog resource. Route step already stores one `tech_operation_id` | which of the two manual rates applies | TechnicalCard operation line | Yes, later: `cutting_method` only |
| laser / rate + item | ready once linked and quantity > 0 | Card quantity. Operation `laser` is pieces | the resource link is absent in the live DB | existing junction | No |
| packing_team / team_rate + item | ready from card quantity | `base_rate` 80 is the whole brigade. `resource_count` 1 | none for the amount. Live `packaging` operation is not linked | existing junction | No |
| sewers / sewing_norm | ready when a scoped norm matches | Assembly lines and sales snapshots with `duration_seconds` | none as a column. Some live rows have duration 0 | existing sewing tables | No |
| plotter_1..4, calender / rate + linear_meter | ready when one positive routing volume exists | `TechnicalCardOperationLine.volume` | live meter rows are all 0. No calender operation | existing volume column | No |
| procurement / milestone | not_applicable | milestone resource in the code catalog | none | stage `launch_preparation` | No |
| qc, ready_to_ship, shipped | not a demand resource | stage codes and one `is_quality_checkpoint` | none | stage state | No |

## What already exists

Demand dispatch is `CapacityResource.calculation_mode` plus `capacity_unit` in `backend/app/services/production_demand.py`. It does not read the operation name.

`explicit_hours` plus `labor_hour` returns `manual_required` / `missing_operator_norm` with a null amount (`_manual_hours`). Designers use that same reason. The specification text `missing_design_rule` is not a separate implemented code.

Sewing time is `AssemblyOperationLine` or `SalesOrderItemAssemblyOperationSnapshot`: `duration_seconds`, `quantity_per_item`. The amount is the scoped sum times `TechnicalCard.quantity` / 3600. `TechnicalCardStageResult.duration_seconds` is fact. `SpecificationOperationLine.duration_seconds` is not read by Demand; locally every such value is null or zero.

Linear meters are one routing snapshot on `TechnicalCardOperationLine` (`source_kind=routing`, `volume_unit=linear_meters`, `volume`). The route template does not store a second volume. `ProductModelOperationNorm.norm_qty_per_item` is a per-item hint (locally 8 meter rows and 22 piece rows). Demand must not sum it into the card total.

Item throughput and packing use `TechnicalCard.quantity` once. Packing `staff_count` / `resource_count` is not a second multiplier. No card column stores a crew size.

Milestones: `procurement` is `calculation_mode=milestone` on stage `launch_preparation`. `ShopRoutingStageLine.is_quality_checkpoint` is a gate. Stages `qc`, `ready_to_ship`, and `shipped` move stock or record passage. `SalesOrder.design_approval_status` is `not_required`, `pending`, `in_review`, `approved`, or `rejected`. Waiting for the client is not labor.

Design files, not hours: `DesignProject`, `DesignVersion`, `DesignVersionAsset`, `TechnicalCardMedia`, `TechnicalCard.design_mockup_url`, `ProductModel.patterns_path`. Unit lines store `size`, `personalization`, `print_number`, and `color`. Locally: 1 design project, 4 card media files, 24 unit lines, 10 distinct sizes, 0 pattern composition lines, 1 model with `patterns_path`. None of these is a time norm.

Cutting operations already exist as separate rows: `manual-cut`, `laser`, `opt-cut`. Every live route step that cuts uses `manual-cut` only. `laser` and `opt-cut` are not on a route and are not linked to a capacity resource. `opt-cut` has no rate in the cutters catalog.

## What is actually missing

1. Design labor hours for one card step. Files, sizes, and approval state do not produce them. A formula such as base hours plus unique variants is not stored and is not approved here.
2. Print-operator labor hours. Meter volume, even after it is filled, is the plotter/calender quantity. It is not operator time. There is no fixed-per-card or per-batch hour field. An order group is not a batch.
3. Calender-operator rule. There is no calender tech operation and no stored statement that one operator covers the calender for the same meters.
4. Laser-operator rule. `laser.base_rate` 100 items per machine hour is machine throughput. It is not a stored 1:1 labor rule.
5. Manual cutting method. The resource already has two rates. Nothing on the card or the route says `manual_single` or `manual_lay`.
6. Filled meter volumes. The column exists. All 10 local routing meter rows have `volume = 0`, so meter demand stays `missing_linear_meters`.
7. Resource links that are not schema: `sewing`, `packaging`, `manual-cut`, and `laser` have no capacity link. `packing_team`, `cutters`, `laser`, plotters, and calender are code-catalog resources and are not rows in `capacity_resources` yet.

## Schema changes worth making later

None in this task.

The only gap that is a selector rather than a new norm is the manual method:

- Name: `cutting_method`.
- Meaning: which existing cutters rate applies, `manual_single` or `manual_lay`.
- Where: `technical_card_operation_lines` for the cutting step.
- Why there: the same `manual-cut` operation can be single or a lay for different cards. The route step has one `tech_operation_id` and cannot store the lay choice. The resource already stores both rates and must not also store the card's choice.
- Why not a new catalog, and why not `manual_quantity` plus `laser_quantity`: laser and manual cutting are already different tech operations. A quantity split would duplicate that choice. Add a split only if one step must divide one card's quantity across both methods. That shape does not exist today.
- `opt-cut` still has no rate. Do not invent one.

Do not add operator or design hour columns until the owner approves the rule. If design hours differ per order, the later value belongs on the card step, not on `design-op` and not on `CapacityResource`. If print preparation is one constant for every run of `sublimation` or `heat_transfer`, the later value belongs once on that `TechOperation`, applied once per card step, and must not be multiplied by the number of plotters. Those are alternative homes, not fields to create now.

## Leave manual

- designers, print_operator, calender_operator, laser_operator;
- cutters, until `cutting_method` is both stored and read;
- any `opt-cut` demand;
- design approval, QC, procurement, ready-to-ship, and shipped as gates rather than capacity.

## Already calculable, no migration

- Sewing, when the scoped snapshot or the matching variant line has a positive duration and multiplicity. A sales card with no snapshot stays unverified and must not fall back to the variant. One local card has a model and no assembly variant.
- Plotter and calender meters, when the linked resource unit is `linear_meter` and exactly one positive routing volume exists.
- Laser and packing item demand, when those resources are linked. The amount is the card quantity. Packing does not need a crew field on the card.
- Milestones stay `not_applicable` with a null amount.

Linking an existing resource and typing a meter volume are data entry. They are not a migration and not an adapter change.
