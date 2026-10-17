# SL-DATA-FLOW-v1

Каноническая карта производственных данных Sport-Lead. Версия 1, проверено по текущему рабочему коду 2026-10-10, задача PC-05.0A. Markdown — источник; [HTML twin](../erp/status/SL-DATA-FLOW-v1.html) генерируется командой `python scripts/generate_data_flow.py`. Это карта реализованного поведения, не новый бизнес-контракт и не подтверждение готовности всего календаря.

## Индекс

| ID | Source | Persisted data | Consumers | Invariant | Section |
|---|---|---|---|---|---|
| DF-MODEL-ROUTE | ProductModelRoutingLink + ProductModelOperationNorm | whitelist, norm_qty_per_item/unit | binding, route editor | norm scoped model + route + operation/workshop | [Открыть](#df-model-route) |
| DF-MODEL-ASSEMBLY | AssemblyVariant + AssemblyOperationLine | order-item snapshots; TK model/assembly refs | TK sewing lines, Demand | cost/time/multiplicity принадлежат строке сборки | [Открыть](#df-model-assembly) |
| DF-ROUTE-SNAPSHOT | ShopRoutingTemplate + stage lines/dependencies | TechnicalCardStageResult + RouteEdge; frozen manifest + detach audit | graph, Demand, Scheduler, Kanban | template edit не заменяет граф ТК; fact plan защищён, future plan retired atomically | [Открыть](#df-route-snapshot) |
| DF-TK-OPERATION-VOLUME | variant norm + TK.quantity | volume_qty_per_item + volume | UI/API/readiness, meter Demand | frozen basis × quantity, manual total защищён | [Открыть](#df-tk-operation-volume) |
| DF-ONE-OF | template route_variant_groups | TK groups/selections JSON; plan-removal audit | effective graph, Demand, Scheduler, facts | только выбранный member участвует | [Открыть](#df-one-of) |
| DF-SEWING-DEMAND | applied sewing + verified time sources | order-item time snapshot или live assembly | ResourceDemand, Scheduler | Σ(seconds × multiplicity) × quantity / 3600 | [Открыть](#df-sewing-demand) |
| DF-PRINT-DEMAND | TK routing operation volume | accepted total meters | ResourceDemand, Scheduler | одна совместимая строка, без повторного × quantity | [Открыть](#df-print-demand) |
| DF-CUTTING-DEMAND | TK.quantity + cutting_method | method on operation line; resource norm_rates | Demand, Scheduler | item demand = whole-card quantity | [Открыть](#df-cutting-demand) |
| DF-DEMAND-CAPACITY | live operation/resource links + norms | CapacityResource + dated exceptions | Demand, Scheduler, queue preview, load | amount unit = capacity unit | [Открыть](#df-demand-capacity) |
| DF-WORKCENTER | physical WorkCenter | unique CapacityResource adapter | machine selection, allocations/load | equipment identity — WorkCenter | [Открыть](#df-workcenter) |
| DF-SCHEDULER-CALENDAR | effective graph + Demand + occupancy + explicit workshop waiting order | CalendarAssignment/queue_position + CalendarAllocation + lifecycle/reorder AuditEvent/input stamp | weekly current/future/history board, exact operation status, detail/list PlanningHealth + persisted ETA/overdue, editable manual scope, manual route preview/apply, queue/load/replanning/debug/readiness | fresh queue revision; same-card snapshot -> fresh saved assignment -> owned allocations -> fact | [Открыть](#df-scheduler-calendar) |
| DF-KANBAN-FACT | selected snapshot/DAG + operation facts; valid plan for planned metadata | ProductionState; derived current_stage cache; lifecycle audit | list/detail/Kanban/Calendar/queue/diagnostics/readiness, release and completion gates | calendar operation не стартует без saved plan | [Открыть](#df-kanban-fact) |
| DF-DIAGNOSTICS | Demand + saved allocations + scheduler/config + lifecycle audit | DTO only, no readiness cache | operations/routes/TK UI, TechnicalCardReadiness and release guard | доказанная provenance или unknown | [Открыть](#df-diagnostics) |

## Границы и формулы

| Правило | Реализация / ограничение |
|---|---|
| Operation total | `volume = ROUND_HALF_UP(norm_per_item × quantity, 0.001)`; Numeric(14,3), overflow отклоняется |
| Piece input | совместимая variant norm; default1 только если подходящая норма отсутствует; это не переопределяет whole-card item Demand |
| Sewing hours | `Σ(duration_seconds × quantity_per_item) × card.quantity / 3600`; только применённые строки текущего шага |
| Print meters | сохранённый `volume`, vocabulary `linear_meters → linear_meter`; не quantity × total |
| Explicit hours | TechOperation seconds /3600 для `fixed_per_order` (реально once per card); seconds × quantity /3600 для `per_item` |
| Capacity/day | dated exception заменяет расчёт; нерабочий день →0; иначе hours_per_day × shifts_per_day × efficiency × count, throughput дополнительно × rate |
| Capacity count | machine count1; остальные resource_count; team_rate требует count1; team_hour возвращает часы одной команды |
| Snapshot boundary | граф/копии объёма защищены от live template/model norm edits; explicit reapply заменяет их. Facts, ONE OF selection, quantity и manual inputs изменяемы явными командами |
| Live boundary | TechOperation demand_rule/duration, resource links/capacity и standalone assembly times читаются текущими; полной заморозки всех норм в ТК нет |
| Plan/fact | CalendarAssignment/Allocation — план; StageResult и shop факты — исполнение; Kanban имеет один current workshop, не несколько параллельных колонок |

## DF-MODEL-ROUTE

**Purpose:** whitelist маршрутов модели и нормы объёма на изделие.

**Flow:** ProductModel → ProductModelRoutingLink + OperationNorm → TK binding/reapply → frozen operation input

**Source entity/field:** `ProductModel.default_routing_template_id`; `ProductModelRoutingLink.product_model_id/shop_routing_template_id/is_active/sort_order`; `ProductModelOperationNorm.production_stage_id/tech_operation_id/norm_qty_per_item/unit`.

**Persisted/copy/snapshot field:** whitelist/norms хранятся в своих таблицах; маршрут не клонируется в link. При binding/reapply коэффициент копируется в `TechnicalCardOperationLine.volume_qty_per_item`.

**Derived values:** total объёма, material planned-qty hints; это плановые входы, не факт расхода.

**Consumers:** model route editor; `replace_routing_link_norms`; `_ensure_routing_template_allowed_for_model`; `_fill_missing_routing_operation_volumes`. API: `/product-models/{model_id}/routings`, `/{link_id}/norms` под тем же model prefix.

**Update/reapply semantics:** редактор сохраняет норму link. Новая ТК/explicit reapply принимает текущую совместимую норму; старые marked volumes при quantity change используют сохранённую копию. Empty whitelist сохраняет существующий доступ к global routing catalog, не является ошибкой сам по себе.

**Invariants:** exact operation/stage match приоритетнее уникального workshop default; active link; совпадающая unit; norm>0; чужая операция/неоднозначность не дают meter input.

**Failure modes / Diagnostic codes:** отсутствующий/invalid source оставляет meter0 → `missing_linear_meters`; несоответствие применения → `route_snapshot_mismatch`. Validation/conflict whitelist — исключения сервиса, отдельного diagnostic code для каждой CRUD ошибки нет.

**Files/modules involved:** [model](../../backend/app/models/product_model.py), [service](../../backend/app/services/product_model_routings.py), [repository](../../backend/app/repositories/product_model_routings.py), [binding](../../backend/app/services/technical_cards.py), [API](../../backend/app/api/product_models.py), [editor](../../frontend/components/settings/product-model-routings-block.tsx).

## DF-MODEL-ASSEMBLY

**Purpose:** связать модель/вариант сборки с производственным документом, не смешивая SewingOperation и TechOperation.

**Flow:** AssemblyVariant + AssemblyOperationLine → SalesOrderItem assembly snapshots или standalone assembly reference → TK sewing operation rows

**Source entity/field:** `AssemblyVariant.product_model_id`; `AssemblyOperationLine.sewing_operation_id/operation_name/cost/quantity_per_item/duration_seconds`. SewingOperation — каталог идентичности, не источник cost/time.

**Persisted/copy/snapshot field:** `SalesOrderItemAssemblyOperationSnapshot` копирует cost/qty/time на позицию заказа. `TechnicalCard` хранит model/assembly refs и display snapshots; sewing operation lines хранят name/ref, pieces и привязку к шагу, не duration_seconds.

**Derived values:** assembly total cost = Σ(cost × multiplicity); sewing displayed volume = multiplicity × card.quantity.

**Consumers:** order-item model/assembly binding, TK model/assembly binding, `_sync_sewing_operation_lines`, sewing Demand.

**Update/reapply semantics:** явный выбор сборки заменяет applied sewing rows; order contour использует order-item snapshots; standalone contour читает выбранную live assembly при синхронизации и при Demand time resolution. Только volume basis frozen на operation line.

**Invariants:** assembly принадлежит выбранной модели; unrelated assembly не источник нормы. Applied rows и time sources должны однозначно сопоставляться.

**Failure modes / Diagnostic codes:** чужая/неактивная новая сборка — validation; missing time → `missing_sewing_norm`; missing/ambiguous provenance → `sewing_norm_unverified`.

**Files/modules involved:** [assembly model](../../backend/app/models/product_model.py), [order snapshots](../../backend/app/models/sales.py), [TK binding](../../backend/app/services/tech_card_model_assembly.py), [order binding](../../backend/app/services/sales_order_items.py), [Demand sources](../../backend/app/services/production_demand_snapshot.py).

## DF-ROUTE-SNAPSHOT

**PC-05.8:** applied/reapplied snapshot edge refresh synchronizes derived current-stage cache through `production_state.resolve_fact_state`; no independent first-node pointer calculation. View-only route_edges ORM relation changes no persistence/schema.

**IC-RS05 retained identity (2026-10-12):** TechOperation hard delete takes the existing scheduler transaction lock before checking retained TechnicalCardStageResult.tech_operation_id and TechnicalCardOperationLine.tech_operation_id. Any retained reference rejects before repository deletion, regardless of card/fact status, live route FK, selected alternative, or display name. Existing live route FK protection remains. Copy/append snapshot helpers acquire that same lock before reading operation identity, serializing supported producers against deletion. Unreferenced operations remain deletable; audit-only historical IDs are not rewritten, matched by name or used to fabricate retained nodes. No automatic archive/deactivation/remap or model/migration change. Direct SQL/bulk bypass stays outside the service guard and is diagnosed as legacy corruption.

**IC-RS01 route review policy (2026-10-12):** canonical complete copy/bind/reapply records version1 frozen manifest in existing AuditEvent (entity technical_card_route_manifest, action route.manifest_created), in the same transaction. It preserves the complete applied node IDs/operation/workshop/order/required/equipment, explicit edge pairs and variant groups; fact status and operation volumes remain separate sources. Identical application does not append duplicate evidence. Canonical append can extend only previously verified evidence, never certify legacy survivors. Read-only verification compares persisted structure with that manifest, not the latest template; missing/invalid evidence, missing node/edge, lost route binding or changed identity requires review. No backfill, guessed completeness, automatic reapply or schema migration. Explicit existing reapply may establish a new verified graph only without protected IC-G01 evidence; unverified fact-bearing refresh rejects before business/audit persistence. Verified reapply continues IC-G01 identity/fact preservation. Legacy bare markers without route/operation retain existing missing-route semantics. Manager action does not repair production facts.

**IC-G02 consumers:** route reapply, template replacement/deletion and graph line removal share saved-plan retirement guards. Graph save checks removed source lines before editing retained rows. Template replacement checks all affected source lines before header/stage changes. Started/completed/other confirmed evidence rejects HTTP409 INTEGRITY; frozen operation mapping does not require equality with the live edited template. Legacy future assignments can be retired only by exact stored node/source identity and same-card ownership, never by order.

**IC-G02 binding lifecycle (2026-10-11):** snapshot/template removal preflights the entire affected plan batch before mutations. Fact-bearing mapping cannot be deleted/detached; future assignments are retired atomically with their allocations, followed by snapshot/template deletion. Audit preserves historical node/operation/assignment IDs: `assignment_detached` has new_state=NULL for retired mappings, then `assignment_deleted`. No active detached assignment is left behind, and no binding is guessed from position/order. Existing bare workshop/entry markers without operation identity or allocations remain queue markers, not operation plans. Legacy corruption is reported without auto-repair.

**IC-G01 production fact protection (2026-10-11):** supported reapply takes scheduler/card locks and compares the proposed graph before mutation. in_progress/completed/skipped, recorded stage facts, material fact_qty (including zero), confirmed unit transfers/FG/scrap, sewing ledger and stock ledger protect their nodes (unscoped evidence conservatively protects all). A protected node cannot change identity, operation/workshop/order/required/label/equipment, applied volume unit, selected ONE OF membership or effective predecessors. Conflict: HTTP409 `route_reapply_conflicts_with_production_fact`, category INTEGRITY, no business/audit writes. Identical and future-only changes retain protected StageResult/operation-line IDs, statuses, all fact fields, selected-member confirmation and CalendarAssignment/Allocation/audit links. Only untouched future routing inputs are refreshed; only removed future nodes retire their assignment/allocations with lifecycle reason `future_snapshot_reapplied` (IC-G02). Bare legacy fact identity is not inferred. Completed cards permit an identical proven snapshot only. Empty/nonempty legacy completeness remains a separate IC-G05 gap.

**Purpose:** один применённый граф операций для ТК вместо чтения live template topology.

**Flow:** ShopRoutingTemplate + StageLine + NodeDependency → TK StageResult + RouteEdge → effective graph consumers

**Source entity/field:** template/stage `production_stage_id/tech_operation_id/stage_order/is_required/work_center_id`; dependencies и variant groups.

**Persisted/copy/snapshot field:** `TechnicalCardStageResult.source_routing_stage_line_id/tech_operation_id/operation_name/operation_code/production_stage_id/is_required`; `TechnicalCardRouteEdge.predecessor_stage_result_id/successor_stage_result_id`.

**Derived values:** read graph/workshop grouping, effective dependencies, traversal/predecessor ordering.

**Consumers:** `read_card_graph`, `load_card_demand_snapshot`, Scheduler, stage fact predecessor gates. API: `GET /shop-routings/{id}/graph`, `GET /technical-cards/{id}/route-graph`.

**Update/reapply semantics:** apply copies template; draft reapply replaces stage/operation snapshot; fact-bearing reapply retains protected rows and refreshes only future routing inputs after IC-G01 preflight. Template edit does not rewrite an existing graph; read projections do not silently build a missing graph from the template. Runtime still reads live operation/resource definitions, see live boundary.

**Invariants:** same-card valid DAG; source line ID is provenance, snapshot node ID is card identity. Quantity import does not replace nodes/edges. Empty legacy edge set can use sequential fallback where implemented; ONE OF explicit independent nodes do not acquire that fallback.

**Failure modes / Diagnostic codes:** invalid graph — validation errors; absent route → `missing_route`; operation/stage disagreement → `route_snapshot_mismatch`; unresolved variant → `variant_not_selected`.

**Files/modules involved:** [models](../../backend/app/models/shop_routing.py), [TK models](../../backend/app/models/technical_card.py), [copy](../../backend/app/services/route_snapshot.py), [graph read](../../backend/app/services/routing_graph.py), [graph write](../../backend/app/services/routing_graph_write.py), [apply](../../backend/app/services/technical_cards.py).

## DF-TK-OPERATION-VOLUME

**PC-06.0A readiness consumer:** personalization step compares persisted UnitLine count (one row per piece) with canonical TechnicalCard.quantity; mismatch is a nonblocking manager warning. It never changes quantity, rebases volumes, writes personalization or invents missing norm inputs. Required real Demand/norm diagnostics feed the norms step.

**IC-G04 input freshness (2026-10-11):** The accepted persisted total volume/unit and matching operation/stage/workshop, not the latest model norm, feed the input stamp. Quantity is stamped only for adapters consuming it. A quantity update may change frozen-basis totals; a manual meter total remains its own source. Future drift requires explicit replan; consumed-input edits affecting started/completed saved plans fail the ORM transaction. Master norm edits without reapply do not silently update a frozen card.

**Purpose:** сохранить принятый total input и его коэффициент для последующего quantity change.

**Flow:** compatible model-route norm + quantity → volume_qty_per_item + volume → API/UI + meter Demand

**Source entity/field:** routing norms, card.quantity; для sewing displayed pieces — assembly multiplicity.

**Persisted/copy/snapshot field:** `TechnicalCardOperationLine.source_kind/tech_operation_id/sewing_operation_id/stage_order/production_stage_id/volume_unit/volume/volume_qty_per_item`.

**Derived values:** Decimal basis × quantity с точностью0.001. Например0.700 ×8 =5.600 meters;1 ×8 =8 pieces. Canonical piece count is `TechnicalCard.quantity` from creation or an explicit quantity command. Personalization import/replacement does not rewrite it; a sum mismatch is a warning. An explicit quantity change still rebases marked rows.

**Consumers:** `to_technical_card_read`, detail operations UI, Demand `_linear_meters`; whole-card item/time adapters не используют произвольный pieces total как новую формулу.

**Update/reapply semantics:** `_fill_missing_routing_operation_volumes` заполняет только нулевые routing rows. Marked basis frozen; manual shop volume write очищает basis, quantity не меняет такой total. Positive unmarked legacy values сохраняются; explicit model change очищает только derived old-model routing inputs; explicit draft route reapply принимает новую норму и заменяет прежние route volumes. IC-G01 сохраняет все operation lines на защищённых fact-bearing stage orders, включая manual volume/NULL basis и sewing-ledger refs; нулевые защищённые inputs также не заполняются автоматически. Новые нормы принимаются только для будущих routing rows.

**Invariants:** NULL basis = legacy/manual/unknown, не implicit0/1; missing meter source не вычисляется из количества изделий; overflow отклоняется явно. Migration d0e1f2a3b456 не backfills legacy data.

**Failure modes / Diagnostic codes:** `missing_linear_meters`, `ambiguous_operation_volume`, `route_snapshot_mismatch`, `invalid_quantity`; overflow — `TechnicalCardValidationError`, не diagnostic code.

**Files/modules involved:** [model](../../backend/app/models/technical_card.py), [producer/quantity/manual write](../../backend/app/services/technical_cards.py), [model binding](../../backend/app/services/tech_card_model_assembly.py), [regressions](../../backend/tests/test_operation_input_population_pc_04_4t.py), [frontend DTO](../../frontend/lib/sales/order-tech-cards-api.ts).

## DF-ONE-OF

**PC-05.1B lifecycle:** removing a replaced variant's AUTO assignment appends `assignment_deleted` with reason `route_variant_changed`, old snapshot/operation/assignment identity and actor in the same transaction. Existing selection protections and replan semantics remain; failed transactions leave no audit events.

WIP/QR follows `active_stage_results` like stage commands so excluded alternatives neither acquire fact nor require an alternative plan.

**Purpose:** хранить альтернативы в snapshot, но планировать/исполнять только выбранную операцию группы.

**Flow:** template variant groups/default → TK groups/selections → effective snapshot → Demand/Scheduler/fact gates

**Source entity/field:** `ShopRoutingTemplate.route_variant_groups`, members/default_operation_node_id/active/selection_mode.

**Persisted/copy/snapshot field:** `TechnicalCard.route_variant_groups/route_variant_selections`, selected_operation_snapshot_node_id, preliminary/confirmed, selection/confirmation actor/time; audit events.

**Derived values:** excluded alternatives, unresolved groups, selected graph/dependencies. Preliminary valid default уже участвует; confirmed не является обязательным условием всякого Demand.

**Consumers:** `selection_resolution`, `active_stage_results`, Demand snapshot, Scheduler, Kanban/current workshop. API: `/technical-cards/{id}/route-variants` и selection write endpoints в technical_cards API.

**Update/reapply semantics:** draft copy remaps template IDs в snapshot IDs и применяет preliminary default. IC-G01 fact-bearing reapply сохраняет допустимый прежний selected member, confirmation/actor/time; смена started member, его membership/active state либо effective predecessors отклоняется до записи. Selection change берёт scheduler transaction lock; started/completed downstream facts, plan locks и old manual assignments защищены. Возможен replan; blocked result возвращает requires_replan, не выдумывает новый успешный план.

**Invariants:** node принадлежит группе этой ТК; alternatives сохранены, но не contribute; unresolved active group блокирует; confirmed не понижается без смены member.

**Failure modes / Diagnostic codes:** `variant_not_selected`; protected change — conflict exception. Read-only diagnostics не выполняют selection/replan.

**Files/modules involved:** [variant service](../../backend/app/services/route_variants.py), [schema](../../backend/app/schemas/route_variants.py), [effective Demand read](../../backend/app/services/production_demand_snapshot.py), [fact gates](../../backend/app/services/technical_card_stages.py), [API](../../backend/app/api/technical_cards.py).

## DF-SEWING-DEMAND

**IC-G04 input freshness (2026-10-11):** The stamp includes matched applied sewing rows and verified duration/multiplicity from the existing order-item frozen source or live standalone assembly source, plus source-verification state and consumed quantity. Unrelated assembly lines are excluded. Live consumed duration/multiplicity/binding drift makes future plans stale; a transaction affecting a started/completed saved plan rejects with INTEGRITY. Neither a silent freeze nor an automatic historical replan is introduced.

**Purpose:** трудоёмкость пошива в labor_hour по применённому набору, один раз на шаг.

**Flow:** scoped applied sewing rows + verified assembly/order times → ResourceDemand labor_hour → Scheduler allocations

**Source entity/field:** order card — `SalesOrderItemAssemblyOperationSnapshot`; standalone — current `AssemblyOperationLine` выбранной model-owned assembly. Поля duration_seconds/quantity_per_item; matching sewing_operation_id, иначе operation_name.

**Persisted/copy/snapshot field:** order-item time snapshots; standalone сохраняет ref сборки, а не frozen time в ТК. Card operation rows определяют applied set и stage scope; ResourceDemand DTO вычисляется read-only, отдельно не хранится.

**Derived values:** `Σ(seconds × multiplicity) × card.quantity /3600`; пример720 ×2 ×8 /3600 =3.2 labor_hour. Displayed sewing piece volume не умножается второй раз.

**Consumers:** `_sewing`, `_match_unit`, Scheduler; time source IDs/table и card input IDs возвращаются в details.

**Update/reapply semantics:** live edit standalone assembly time может изменить следующий Demand; order-item snapshots изолированы до явного binding update. Quantity меняет трудоёмкость. Этот реальный предел отличается от frozen routing-volume coefficient.

**Invariants:** только применённые строки текущего stage_order/workshop; однозначный source, без повторного использования одного source row; duration>0, multiplicity>=1. Неиспользованные строки не суммируются.

**Failure modes / Diagnostic codes:** `missing_sewing_norm`, `sewing_norm_unverified`, `invalid_quantity`, `capacity_unit_mismatch`.

**Files/modules involved:** [source resolution](../../backend/app/services/production_demand_snapshot.py), [formula](../../backend/app/services/production_demand.py), [norm models](../../backend/app/models/product_model.py), [order snapshots](../../backend/app/models/sales.py).

## DF-PRINT-DEMAND

**IC-G04 input freshness (2026-10-11):** The saved stamp retains effective persisted meter input for the matching step and explicit operator duration/rule where used, separately from resource capacity and dated overrides. A manual total or explicit norm change invalidates the future saved plan even before a Scheduler command. Display names and live frozen-route master labels are not freshness inputs; formulas and unit conversion remain unchanged.

**Purpose:** передать принятые meters в throughput resource и отдельно определить labor потребность оператора.

**Flow:** accepted TK operation meters → ResourceDemand linear_meter → machine throughput capacity → allocation

**Source entity/field:** card routing operation line, scoped card/op/stage_order/production_stage_id, unit linear_meters, positive volume.

**Persisted/copy/snapshot field:** total volume на ТК; allocated_amount/unit/date на CalendarAllocation после успешного планирования.

**Derived values:** meter Demand = один сохранённый total (5.600), не5.600 ×8. Throughput hours вычисляются в capacity placement, не меняют единицу Demand. Operator explicit_hours uses TechOperation.demand_rule/demand_duration_seconds; machine hours не копируются в labor.

**Consumers:** `_linear_meters`, `_explicit_hours`, machine selection Scheduler, calendar/equipment load.

**Update/reapply semantics:** meter total frozen/manual contract DF-TK-OPERATION-VOLUME; operation hours rule и resource links live. Shared print operator сохраняется одним ресурсом, каждый реальный print step создаёт свою потребность.

**Invariants:** exactly one compatible meter row; units linear_meters→linear_meter — vocabulary, не conversion. Несколько машин — compatible alternative choice, обязательный labor ресурс не исчезает.

**Failure modes / Diagnostic codes:** `missing_linear_meters`, `ambiguous_operation_volume`, `route_snapshot_mismatch`, `missing_operator_norm`, `capacity_unit_mismatch`, `no_compatible_active_machine`.

**Files/modules involved:** [Demand](../../backend/app/services/production_demand.py), [snapshot loader](../../backend/app/services/production_demand_snapshot.py), [machine selection](../../backend/app/services/production_scheduler.py), [diagnostics](../../backend/app/services/production_diagnostics.py).

## DF-CUTTING-DEMAND

**IC-G04 input freshness (2026-10-11):** The stamp captures consumed whole-card quantity, selected operation code/method rows and the relevant resource norm_rates key resolved by the existing adapter. Changes to those effective inputs require replan; no guessed cutting rate or new formula. Unused norm_rates keys do not invalidate a step.

**Purpose:** item Demand и выбор существующего метода ручного раскроя без смешения units.

**Flow:** card.quantity + selected cutting operation/method → item Demand + chosen rate → resource capacity/day

**Source entity/field:** `TechnicalCardOperationLine.cutting_method=manual_single/manual_lay`; TechOperation.code=manual-cut; `CapacityResource.norm_rates.manual_single_items_per_person_hour/manual_lay_items_per_person_hour`.

**Persisted/copy/snapshot field:** method на строке ТК; rates в resource; selection ONE OF на ТК; result allocations после Scheduler.

**Derived values:** Demand = card.quantity item; selected method rate используется для daily capacity, не для перевода Demand в hours. Laser/rate-item также whole-card quantity; opt-cut с cutting_methods остаётся unresolved без подходящего правила.

**Consumers:** `_cutting_method`, `_item_quantity`, `_cut_rate`, `_capacity`; эффективный выбор ONE OF исключает альтернативы.

**Update/reapply semantics:** method — явный write на ТК; rates/resource config live; selection change регулируется ONE OF gates.

**Invariants:** только одна matching op/stage row и валидный method; positive selected rate; pieces volume coefficient не означает новую item-demand формулу. Laser capacity linear_meter при pieces input не конвертируется автоматически.

**Failure modes / Diagnostic codes:** `missing_cutting_mode`, `missing_cutting_rate`, `route_snapshot_mismatch`, `capacity_unit_mismatch`, `invalid_quantity`.

**Files/modules involved:** [Demand adapters](../../backend/app/services/production_demand.py), [capacity/rates](../../backend/app/services/production_scheduler.py), [TK method write](../../backend/app/services/technical_cards.py), [resource model](../../backend/app/models/production_capacity.py).

## DF-DEMAND-CAPACITY

**PC-05.6C consumer:** workshop queue preview reuses existing `_build`/Demand/capacity placement. Replaceable affected occupancy is excluded only from the in-memory simulation; other queues and protected allocations remain occupied. Proposed earlier queue plans consume virtual resource/date budgets for subsequent items. Decimal totals, machine alternatives, mandatory shared resources, exceptions, units and guards remain unchanged. Actual assignments/allocations are replaced only after explicit successful apply; no frontend capacity formula.

**IC-RS05:** the live TechOperation identity/norm source consumed by retained applied nodes/operation lines cannot be destructively removed through the supported delete service/API. This preserves existing Demand sources and fact/plan identity without a copied operation catalog, changed formula or unit conversion. Guard covers all retained statuses, including cancelled/completed cards. Deactivation and unrelated capacity policy are unchanged; no implicit archive/deactivate action is introduced.

**IC-G04 input freshness (2026-10-11):** A version1 deterministic SHA256 input stamp uses canonical Decimal/date/ordered values and selected machine resources; labor/mandatory resources and current links are included. It records consumed quantity/norms/volumes, effective graph dependencies, card planning constraints, resource unit/mode/count/hours/shifts/efficiency/working days, consumed rate, physical equipment availability and capacity overrides inside the saved inclusive span. A capacity change may invalidate ETA while Demand amount stays equal. Metadata names/notes, unused machine alternatives, unused rate fields and latest frozen master norms do not force stale. Existing adapters and allocation rounding remain authoritative.

**IC-G03 allocation consistency (2026-10-11):** current selected step Demand is calculated by the existing adapters; no new formula or unit conversion. Planned totals per mandatory resource equal Decimal Demand rounded once upward to0.0001; exactly one eligible physical-machine alternative contributes its own total. Daily chunks sum to that rounded total, not independently rounded Demand copies. Missing/unverified Demand produces an explicit DATA_FLOW amount diagnostic, not a fabricated expected amount. Resource unit/identity/scope and enabled flag cannot change while saved allocations reference the key; used operation/resource links cannot be detached. Rates, quantity/norm revision approval and broader capacity-impact policy remain IC-G04.

**Purpose:** отделить сколько работы нужно от того, сколько ресурс может выполнить за дату.

**Flow:** live TechOperation + resource M:N links → read-only ResourceDemand → CapacityResource + exceptions → dated budget

**Source entity/field:** TechOperation demand_rule/demand_duration_seconds; `TechOperationCapacityResource.tech_operation_id/resource_key`; CapacityResource calculation_mode/capacity_unit/resource_type/base_rate/resource_count/hours_per_day/shifts_per_day/efficiency/working_days/include_in_calendar_load.

**Persisted/copy/snapshot field:** operation/resource catalogs и `ProductionCapacityException(resource_key,date)`; Demand DTO не persisted. Allocation сохраняет amount и unit для занятости.

**Derived values:** formula table above; exceptions override обычную мощность, unavailable→0; unknown config→None, не fake0. Demand statuses ready/missing_input/manual_required/not_applicable.

**Consumers:** `calculate_demands`, scheduler `_capacity/_place_step`, work-center day load; legacy calendar load-state — отдельная warning projection со своими hourly показателями, не ResourceDemand DTO.

**Update/reapply semantics:** текущая resource config применяется при новом расчёте, сами старые assignments не становятся новым планом без явного replanning. Мутации, участвующие в Scheduler, используют общий transaction gate где реализовано.

**Invariants:** exact unit equality, Decimal amounts; milestone не требует allocation; excluded resource not_applicable. Ни staff_count, ни speed не множат количество работы второй раз. fixed_per_order означает once per technical card в текущем adapter, межкарточной дедупликации заказа нет.

**Failure modes / Diagnostic codes:** `missing_resource_link`, `unsupported_calculation_mode`, `capacity_unit_mismatch`, `missing_operator_norm`, `resource_capacity_not_configured`, `resource_unavailable`; config failures не маскируются демонстрационными данными.

**Files/modules involved:** [models](../../backend/app/models/production_capacity.py), [operation model](../../backend/app/models/tech_operation.py), [Demand](../../backend/app/services/production_demand.py), [resource writes](../../backend/app/services/capacity_resources.py), [legacy load](../../backend/app/services/production_capacity.py), [Scheduler](../../backend/app/services/production_scheduler.py).

## DF-WORKCENTER

**IC-G03:** new allocation/persist checks require an enabled resource and existing active physical WorkCenter with matching workshop. Reuses Scheduler eligible_machine_keys so inactive/incompatible alternatives do not block the selected valid machine. Physical adapter identity remains unique in the existing DB constraint; no second capacity source introduced. WorkCenter deactivation/move and adapter detach/unit change with stored allocations reject409 before mutation; delete already rejects saved allocations. Nonphysical explicit M:N sharing across workshops remains supported.

**Purpose:** физическое оборудование имеет одну идентичность и одну каноническую capacity adapter запись.

**Flow:** WorkCenter physical identity → unique machine CapacityResource → operation M:N compatibility → assignment + allocations/resource identity

**Source entity/field:** `WorkCenter.id/production_stage_id/is_active/name` в shop_routing.py; CapacityResource.work_center_id unique nullable.

**Persisted/copy/snapshot field:** adapter key сохраняется при capacity updates; stage template work_center_id копируется в StageResult planned equipment. Выбранная планировщиком машина persisted через CalendarAllocation.resource_key → CapacityResource.work_center_id; CalendarAssignment не имеет work_center_id column. StageResult.work_center_id относится к planned/fact equipment на исполнении. PC-05.2 исправляет прежнюю ошибку текста карты, не добавляет новый store/field.

**Derived values:** configured capacity, allocated=sum amounts, remaining=max(0,capacity−allocated), utilization=allocated/capacity ×100 при positive configured capacity.

**Consumers:** eligible_machine_keys, Scheduler resource-option choice, `/work-centers/{id}/capacity`, `/allocations`, `/capacity/load`; exceptions используют существующий resource store.

**Update/reapply semantics:** save_capacity переиспользует adapter/key/links, новый default key work_center_{id}; explicit_hours для machine_hour, rate для throughput. Нет второго store скорости/исключений на WorkCenter.

**Invariants:** active compatible physical center + workshop + adapter; одна машина на выбранный шаг, обязательные labor/team constraints сохраняются. Machine capacity count1.

**Failure modes / Diagnostic codes:** `no_compatible_active_machine`, `machine_binding_missing`, `resource_stage_inactive`; отсутствующий capacity adapter — HTTP404; allocation unit mismatch на equipment load — HTTP409, не новая автоматически исправленная норма.

**Files/modules involved:** [WorkCenter](../../backend/app/models/shop_routing.py), [adapter model](../../backend/app/models/production_capacity.py), [adapter service](../../backend/app/services/work_center_capacity.py), [API](../../backend/app/api/shop_routings.py), [Scheduler](../../backend/app/services/production_scheduler.py).

## DF-SCHEDULER-CALENDAR

**PC-06.3F Planning Health:** selected snapshot + saved assignments + ProductionState + PersistedPlanSummary + canonical stage/material/unit/sewing/stock protection feed batch load_planning_health. Authenticated GET `/technical-cards/{id}/planning-health` returns operation detail; GET `/production-calendar/manual-planning/cards` returns identical slim summary plus number for active standalone cards, limit1-500/offset. No route array on list or per-card SQL/HTTP. [Canonical contract/examples](production-planning-health-pc-06-3f.md).

Overdue = selected pending/no-fact saved start DATE < platform timezone planning DATE, active card; earliest date then snapshot order. Date alone is not protection; command/read share manual_replan_is_protected. Locks do not erase overdue; can_replan is eligibility, not date feasibility. Counts/current/next use selected snapshot/fact. ETA/slack/on_time reuse saved summary, risk reuses unknown/on_time/late. Health not_planned/actual/stale/invalid/completed does not alter ProductionState. Fresh actual can require replan for overdue. Terminal suppresses active attention, retains historical forecast. No Scheduler/plan/fact/cache/audit writes. PC-06.3E backend gap resolved.

**PC-06.3G consumers:** the technical-card plan block and `/production/calendar/planning` read these two GET payloads for ETA, shipping, slack, risk, overdue, progress and operation status. The browser does not derive them from planned dates. Preview/apply remains the PC-06.3C response.

**PC-06.3D overdue pending exception (current contract):** an original planned date in the past is no longer protection for manual preview/apply. Eligible selected nodes are pending/unstamped/without canonical material/unit/ledger/stage fact; pending waiting/current/ready placement alone is not a fact or lock. TechnicalCard completed/cancelled/shipped, card plan lock and explicit assignment locks remain protected. Target date stays today/future; missing/unselected saved nodes and past target dates are other canonical blockers, not generic protected errors. In downstream mode the manual service supplies `editable_overdue_node_ids` only for eligible pending nodes in its effective selected scope. `_protected(..., allow_overdue=False)` remains unchanged by default for ordinary Scheduler and Queue; the optional trusted input relaxes only date protection, never manual/fact locks. Nonselected manual/locked/factual anchors remain unchanged; explicitly selected manual_adjusted can be moved again as before.

Manual proposals additionally validate every effective planned predecessor edge, including old preserved anchors. Thus overdue `single` violating a pending successor returns manual_replan_dependency with the manager suggestion «Эту и последующие», without silent cascade; downstream can replan eligible old pending descendants. If a dependency hits a protected downstream anchor, the blocker remains manual_replan_protected and names its operation, snapshot_node_id and downstream_protected reason. Existing capacity/freshness/revision/atomic rollback and persisted ETA remain canonical; no production fact/current-workshop/queue-order-field mutation. Tests: test_overdue_manual_replan_pc_06_3d.py (11 cases) plus existing3B/Queue/Scheduler cases,64 targeted total. Safe local planning-only163 reproduces14→30 October, single dependency and downstream apply; no changes to157/158/159. No migration or frontend patch.

**PC-06.3B manual route command:** POST `/production-calendar/manual-planning/preview` and `/apply` use ManualReplanRequest (technical_card_id, snapshot_node_id, target_date, single/downstream, optional preview revision; apply requires revision+preview_fingerprint). After PC-06.3D, selected means pending/unstamped/non-fact-bearing operation with a saved assignment, regardless of original past/today/future date or waiting placement. Whole-card lock, explicit assignment lock, terminal/shipped cards and fact remain protected; missing/unselected nodes are canonical blockers. Selected manual_adjusted can be explicitly replaced; other protected/manual anchors remain. `single` scopes only that node; `downstream` uses effective selected snapshot predecessor closure. Independent parallel branches/other cards stay anchored. Exact-date dependency/capacity conflict returns apply_allowed=false, not a silent cascade/date substitution.

The existing `_build` accepts optional `not_before_by_node` only for the selected node, reusing current replan_node_ids, Demand/duration,120-date horizon, machine alternatives, daily capacity/work calendar, inclusive DATE DAG and anchor guards. Preview reads only, without ORM/savepoint writes. Revision hashes card/effective snapshot/Demand/facts, own plan, relevant occupancy/resources/exceptions/operations/centers and current planning day; fingerprint additionally binds the actual result and target/mode. Apply takes the existing scheduler gate, reloads state, replays/compares revision+fingerprint and atomically reuses persist_plan/retirement/allocation consistency. Selected date becomes manual_adjusted/manual_lock; auto descendants remain auto and stored queue_position survives. Shared lifecycle events + canonical actor audit record selected/mode/old-new dates/allocations/affected nodes/revision. Current workshop, production facts and quantity do not change. Old ETA/slack reuse persisted summary; new ETA/slack/risk reuse ScheduleRead; returned/reloaded persisted summary matches Calendar. No second planner or frontend arithmetic. [Cursor handoff](manual-planning-route-replan-pc-06-3b.md); [13 regressions](../../backend/tests/test_manual_route_replan_pc_06_3b.py), including one-winner concurrent PostgreSQL apply and full rollback. No migration.

**PC-06.3C planning screen:** `/production/calendar/planning` sends the 3B preview/apply body and renders returned selected/affected dates, ETA, slack, risk and diagnostic messages. It does not derive those values, does not call the single-row assignment PUT for this move, and discards revision/fingerprint after a successful apply or `manual_replan_changed`. Calendar board and card detail are reloaded; Kanban, queue fact and current workshop stay untouched.

**PC-06.3E plan attention:** the same screen labels a list row from the board `planning_state` already on each assignment. The opened card additionally shows detail-only `planning_summary` ETA, shipping date, slack and `on_time`/`replan_required`. Overdue day count and the earliest overdue operation are not on AssignmentRead or the technical-card list, so the screen does not compare `planned_date` with a client clock. Route words follow `operation_status`. Preview/apply semantics are unchanged.

**PC-06.2 operation and plan read contract:** AssignmentRead includes `snapshot_node_id`, `operation_name`, `operation_status` from the assignment's exact retained node, not from the shared current workshop. Pending/in_progress/completed/skipped stay independent even inside one workshop. `operation_state` current/future/completed remains placement metadata, not an execution status. Weekly Calendar shows every overlapping saved assignment including future and completed history; no frontend current-only filter. PC-06.2A may hide stickers by the loaded `operation_status` in the browser; the board payload, queue load, and saved plan stay complete. PC-06.3A groups that same editable board by technical card. PC-06.3C moves a future assignment only through the 3B preview/apply command. Kanban/current_workshop and editable-only manual planning keep their existing semantics.

**Persisted ETA:** TechnicalCardRead (detail only, not list DTO) embeds `planning_summary` from existing selected operation CalendarAssignment dates: minimum start, maximum end, shipping date and the same `(shipping_date - completion).days` slack/deadline formula as Scheduler. Entry markers/unselected alternatives do not contribute. `planning_state` comes from the shared batch resolver (manifest, selected coverage, linkage, allocation consistency and input freshness); `is_current` requires a valid planned state, `replan_required` flags noncurrent saved plans/stale/invalid state. Existing dates may be displayed as historical forecast with an explicit noncurrent warning, never silently recalculated. Invalid variant JSON does not infer a selected branch/ETA. Read calls never run Scheduler or write plan/fact. Client restores this backend summary after reload and resets transient command results when it changes; no frontend ETA/risk arithmetic. Current means saved-input validity, not a fresh forecast of delays from today's real execution.

**Dependency audit:** the existing planner uses inclusive DATEs: successor earliest is max(card start, predecessor end dates); same-day sequential boundaries are valid. Daily occupancy prevents reuse of shared exhausted capacity; the model does not define intraday timestamps or sub-day predecessor finish instants. A seven-operation short sequential regression fits70 units into a100-unit day, all dates equal, without violating this contract. Existing sequential/multi-day, explicit parallel/join and ONE OF selected-only regressions verify temporal edges and capacity. No Scheduler algorithm or production core change was needed. Defensive joined Calendar/manual scope, protected completed history, allocation ownership and delete retirement remain PC-06.1B contracts. Evidence: test_calendar_consistency_pc_06_2.py plus existing snapshot/variants/scheduler/deletion suites and ignored logs/pc-06-2.

**PC-06.1B delete/read boundary:** TechnicalCard is hard-deleted (no soft-delete/archive field). A safe draft delete now takes existing scheduler/card locks, rejects protected snapshot/material/unit/ledger fact through shared guards and retires all its plan rows via `retire_assignments` before deleting the card in the same transaction. Allocation deletion is explicit; assignment retirement also removes queue_position and appends existing assignment_deleted AuditEvent (reason=technical_card_deleted). Previous audit/history evidence is not purged. FK card→assignment and assignment→allocation CASCADE remain a second line of protection; no schema migration. Any failure/rollback retains card, plan, allocations and audit together. Existing completed/in-progress cards remain protected; completed != deleted.

**PC-06.1B manual scope:** default /board remains historical and inner-joins existing TechnicalCard/order/stage, never returning truly absent-card rows. Optional editable_only=true restricts manual planning to existing draft/in_progress cards and either bare entry markers or owned same-workshop pending snapshot nodes without started_at/completed_at. Canonical completed/cancelled state is also excluded after the existing batch resolver; no per-row fetch or source/status inference in UI. Historical completed assignments remain available on default board; valid pending future work of existing in-progress cards remains editable (test-name prefixes are not deletion evidence). Manual planning requests the explicit scope; successful TK deletion revalidates the existing Calendar/planning/capacity routes. /production/calendar/manual-planning is a query-preserving redirect to existing /production/calendar/planning, not a second layout/read store. Current runtime has no orphan assignments: no live cleanup was applied.

**PC-06.0A readiness consumer:** standalone contour B planning step consumes canonical complete valid fresh saved-plan state and existing diagnostics/evidence (including ETA from saved assignment end dates). Missing/partial/stale/invalid plan blocks release. Prospective dry-run plan_locked/horizon messages are warning-only when a valid saved plan already exists; they are not saved-plan validity checks. Contour A receives no new standalone date/plan/Demand requirement. Scheduler, placement, allocation/freshness formulas and fact-start invariants are unchanged.

**PC-05.8:** Calendar board includes the same batch `production_state` as list/detail and `operation_state` current/future/completed. Saved plan affects derived planned lifecycle only after manifest/readiness, selected-node coverage, linkage, allocation totals/units and freshness checks. Fact core alone determines current workshop. Demand/input_stamp accept a supplied read batch without changing formulas/fingerprints or Scheduler writes.

**PC-05.6C:** current selected pending standalone operation + effective completed predecessors -> workshop waiting queue; protected fact/manual/locked/past/current in_progress workshop excluded. Nullable positive CalendarAssignment.queue_position stores manual waiting order separately from dated position and card priority (migration f2a3b4c5d678, existing values NULL). GET/preview/apply `/production-calendar/workshops/{id}/queue` expose slim item + revision, read-only virtual preview and explicit atomic apply. Shared Scheduler `_build` scopes replacement to changed suffix/current nodes + effective future descendants; other steps stay anchors, unsaved out-of-scope predecessors block. Preview overlays allocations in memory, zero SQL writes. Existing Demand/Capacity/IC-G01..G04 protections apply; no Kanban/status/fact writes. Revision covers planning day, queue inputs and shared occupancy/config; result fingerprint also covers effective live Demand. Apply rechecks under scheduler advisory gate, stale=HTTP409 workshop_queue_changed, failure rolls back all plans/order/audit. Single replacement retains queue_position; mass scheduler respects manual order within workshop batch slots. Audit action production_calendar.workshop_queue_reordered carries actor/time/source/old-new/affected/replan. ETA=max step end, including parallel branches. [Contract](workshop-queue-pc-05-6c.md).

**IC-RS01:** single and mass Scheduler preflight reject unverified retained routes with INTEGRITY route_requires_review_before_planning; no new plan/allocation persistence, old plans remain. Manual enqueue also rejects that route before creating CalendarAssignment. Shared planned-B execution gate checks route review before new execution; existing plan/linkage/freshness guards remain. Malformed variant JSON produces the manager review blocker instead of a validation/server error when route evidence is unverified. Explicit future-only reapply records fresh route evidence, retires old plans through existing lifecycle, then readiness and explicit scheduling can run again. No silent recovery using live template. Sales-order execution is not given an invented standalone Scheduler contract.

**IC-G04 input freshness (2026-10-11):** assignment_created now stores demand_input_snapshot(version, fingerprint, inputs, demand) in the existing canonical lifecycle AuditEvent, in the assignment transaction; Scheduler supplies chosen resource keys before allocations are inserted. Freshness is derived by comparing this immutable saved evidence with current effective inputs, with no second status table/migration. Shared assert_saved_plan also rejects stale execution for start/fact/complete/reopen/QR/WIP. ORM Session before_flush takes the scheduler lock for tracked input mutations; after_flush_postexec rejects consumed drift on started/completed saved plans, requiring transaction rollback (DML can execute before rejection, nothing persists). Future input edits leave the old assignment/allocations for review but replan_required prevents execution; protected/manual/past anchors cannot be silently reused. Existing explicit AUTO replan replaces assignments/allocations atomically and stores fresh stamps. Route/ONE OF future retirement keeps a stale-generation diagnostic until a successful new generation; old/new node correspondence is not guessed. Missing legacy stamps are unverifiable; no backfill or mass replan. Raw SQL bypass remains outside the ORM guard.

**IC-G03:** CalendarAllocation.date is a local planning DATE, one daily chunk; assignment bounds are inclusive DATEs, start<=end, same-day valid. No nonexistent allocation start/end timestamps or timezone conversions introduced. Manual assignment edits must keep every stored date within the proposed span and keep totals/units/resources consistent; span expansion preserving chunks is allowed, exclusion requires explicit replan. add_allocation validates the complete prospective assignment before commit, so a low-level single write cannot commit an incomplete/unverified multi-resource plan. Scheduler persist validates all proposed steps before old plan/audit deletion; existing atomic replacement creates only new-date/new-unit allocations. Milestone produces no capacity allocation, unselected ONE OF member cannot receive one. Read-only amount comparison uses current Demand; it is not a stored input revision or an automatic repair. Quantity/norm writers and execution revision gates remain IC-G04.

**IC-G02 saved plan linkage:** `calendar_plan_linkage` checks same-card node, frozen source identity/workshop and saved operation audit evidence; allocations must reference an existing resource and correctly scoped physical WorkCenter; unscoped resources and explicit nonphysical M:N sharing across workshops retain the existing contract. Missing/foreign/wrong-operation assignments block Scheduler before replacing occupancy, including queue replay. persist_plan validates proposed mappings/resources before deleting old plans; shared retirement preflights all rows, protects confirmed facts, deletes allocations explicitly and emits lifecycle audit in the same transaction. Manual remap/promotion of a bare queue marker to an operation is rejected; valid metadata edits retain the node. Low-level add_allocation requires a saved snapshot and matching resource/WorkCenter. Locks follow scheduler -> card/assignment. valid_assignment now rejects structural linkage diagnostics before start/fact/QR. Amount/Demand revision and date/unit move policy are unchanged and remain IC-G03/IC-G04.

**IC-G01 route reapply:** assignments/allocations and lifecycle history of protected nodes remain bound to the same snapshot IDs. Unchanged graph edges retain IDs. Removed future nodes alone get audited retirement (`future_snapshot_reapplied`) and their assignments/allocations are removed; no guessed rebinding or new plan is produced. Rejected preflight creates no detach/delete/audit event. IC-G02 now protects manual deletion/template removal across shared retirement writers; dates/units/input revisions remain IC-G03/IC-G04.

**PC-05.1B lifecycle/start contract:** `planned operation -> saved CalendarAssignment -> start fact`. Calendar participation follows the existing standalone contour B (`order_group_id` set, `sales_order_id` NULL) scheduler contract; its snapshot nodes with `tech_operation_id` are calendar operations. Sales-order contour A and workshop-only/FG markers are outside that planning contract. Before start, implicit fact/QR/WIP start, direct completion or reopen, the existing locked services require an assignment for the same card, current snapshot node, scheduler routing identity and workshop with a valid date span. There is no supported `manual_unplanned_start` mode; missing/invalid binding raises HTTP409 `cannot_start_without_saved_plan`, category INTEGRITY, before fact mutation. Existing auto/manual/locked assignments can satisfy this gate; entry markers cannot. Calendar CRUD shares the scheduler advisory lock with fact/QR commands to serialize plan deletion/movement against start.

HTTP409 preserves the existing string `detail` so current stage/QR frontend consumers display the Russian message without changes. Machine metadata is returned in `X-Diagnostic-Code: cannot_start_without_saved_plan` and `X-Diagnostic-Category: INTEGRITY`.

Canonical append-only `AuditEvent` (ADR-025), entity_type `calendar_plan_lifecycle`, entity_id=card ID, action `calendar.<event_type>` stores `assignment_created`, `assignment_replanned`, `assignment_detached`, `assignment_deleted`, `operation_started`, `operation_completed` in the mutation transaction. Safe payload contains technical_card_id, snapshot_node_id, tech_operation_id, nullable calendar_assignment_id, previous_state/new_state and reason; row stores UTC occurred_at, authenticated actor ID/login or system actor=NULL, and source. Scheduler replacement retains old assignment ID/state in replan evidence; manual CRUD, variant-plan removal, route-line deletion and explicit snapshot reapply record deletion/detachment before identity is lost. Audit IDs are historical values, not cascading FKs to assignments/snapshots. Rollback/dry-run leaves no events. No new event store/migration/event-sourcing. External SQL/FK changes outside these service commands cannot establish provenance retrospectively. [Lifecycle service](../../backend/app/services/calendar_plan_lifecycle.py), [tests](../../backend/tests/test_calendar_plan_lifecycle_pc_05_1b.py).

**Purpose:** явное атомарное планирование по effective route, мощностям и уже занятому календарю.

**Flow:** effective TK snapshot + Demand + capacity/exceptions/occupancy → ScheduleRead → CalendarAssignment → CalendarAllocation → board/load

**Source entity/field:** TK.quantity/planning_start_date/shipping_date/priority/plan_locked; effective predecessors; existing plan/facts; current resource config.

**Persisted/copy/snapshot field:** assignment technical_card_id/stage_result_id/routing_stage_line_id/production_stage_id/planned_date/planned_end_date/planning_mode/manual_lock/position; allocations assignment_id/resource_key/date/allocated_amount/capacity_unit. Selected WorkCenter derives from allocation.resource_key → CapacityResource.work_center_id; no assignment.work_center_id storage column.

**Derived values:** inclusive date spans, remaining budgets, planned end/deadline risk/buffer; forward horizon120 dates. Queue order priority NULL-last, then planning date/created/id; deadlines may be missed and reported, not hidden.

**Consumers:** `POST /technical-cards/{id}/schedule`, `POST /production-calendar/schedule`; `GET /production-calendar/board?from=...&to=...`, equipment load and replanning. PC-05.0D `card_calendar_evidence` читает сохранённые назначения/allocations для read-only card diagnostic summary и fact/plan trace; см. DF-DIAGNOSTICS. Никакого persisted scheduling при этом чтении нет.

**Update/reapply semantics:** dry-run persist=False writes no plan; successful explicit command replaces only replaceable AUTO plan. Entry launch_preparation marker preserved; manual/fact/past/locked anchors protected. Single and queue commands use advisory scheduler lock; queue SAVEPOINT replay preserves blocked old plans. Manual create/move/delete use existing calendar API; minimal create chooses entry stage/date tail server-side.

**Invariants:** no over-allocation/lost Decimal work; all mandatory resources simultaneously available; predecessors respected; assignment.plan ≠ StageResult.fact. Board range uses overlap of inclusive date span. Scheduler source line ID is provenance; stage_result_id binds current snapshot identity.

**Failure modes / Diagnostic codes:** `no_available_capacity` (reason120_day_horizon_exhausted), `locked_assignment_conflict` with concrete reason, `missing_input`, `no_compatible_active_machine`; card data requirements and underlying Demand issues propagate. These are Scheduler codes/reasons, not always identical to shared diagnostic codes.

**Files/modules involved:** [engine](../../backend/app/services/production_scheduler.py), [queue](../../backend/app/services/production_queue_scheduler.py), [locking/read repository](../../backend/app/repositories/production_scheduler.py), [calendar CRUD](../../backend/app/services/production_calendar.py), [assignment](../../backend/app/models/calendar_assignment.py), [allocation](../../backend/app/models/calendar_allocation.py), [API](../../backend/app/api/production_calendar.py).

## DF-KANBAN-FACT

**PC-06.1A v2 — separate fulfillment:** `TechnicalCard.fulfillment_status` (NULL / ready_to_ship / shipped), `ready_to_ship_at` and `shipped_at` are the one persisted whole-card fulfillment source. Final required selected production completion calls `sync_ready` in the same transaction; the production lifecycle remains completed, current workshop is empty, active Kanban/queue exclude the card. Explicit authenticated/permission-checked POST `/technical-cards/{id}/mark-shipped` takes the existing scheduler/card locks, validates canonical completed production + stored ready state, sets shipped/time and appends `fulfillment.shipped` to the existing AuditEvent with actor and canonical quantity. Duplicate shipment or production reopen after shipment rejects HTTP409. Pre-shipment guarded rollback clears ready state. Shipment changes no snapshot/stage/unit/material/Calendar/quantity facts.

**Legacy boundary / deferred warehouse:** catalog-code-identified workshop-only ready_to_ship/shipped snapshot markers remain stored unchanged, but are excluded from the production fact projection. Newly applied routes no longer auto-append them; real operations still use the unchanged selected-node/DAG algorithm and existing execution gates. Explicit legacy stock adapter code is retained for compatibility and is not called by the new pages/action. ADR-019/030 are preserved as future warehouse/QR/partial-unit integration. `on_ready_to_ship(db, card)` / `on_shipped(db, card)` are transactional no-op extension boundaries today: no balances, stock documents, ledger or unit flags. Future implementations must preserve rollback and must not redefine production completion. Conservative migration initializes proven already-completed cards, skips missing required facts/unresolved selection and historical posted FG issues rather than inventing a new shipment history.

**Fulfillment consumers:** GET `/technical-cards/fulfillment/{ready_to_ship|shipped}` returns scalar card/order/model/canonical quantity/dates through one joined query, without stage/unit arrays or per-row fetch. Existing `/production/stages/ready_to_ship` and `/production/stages/shipped` use this DTO; the former has explicit Отгрузить, the latter read-only history. Server actions forward the session and invalidate both lists/detail after successful shipment. Reads do not synchronize or repair persisted lifecycle. Regressions: `backend/tests/test_fulfillment_pc_06_1a.py` and `frontend/lib/production/fulfillment.test.mjs`.

**PC-06.0A launch alignment:** `start_technical_card` gates release through the same readiness service as GET readiness, then retains the locked saved-plan invariant before commit. Release remains waiting (no status/started_at/fact/audit creation); actual `start_stage`/complete/material/quantity/snapshot progression are unchanged. Basic/model/verified route and applicable existing diagnostic blockers now consistently prevent card launch. Completed/cancelled/in-progress availability is explicit, with no repeated launch action. Unverified legacy/generated snapshots need the existing explicit apply-routing; no auto-certification/repair is introduced.

**PC-05.8:** `production_state.resolve_fact_state` is the only fact/DAG core; `load_states` adds route manifest/readiness and valid fresh saved Calendar plan using scoped batch Demand/fingerprint reads. List/detail/Calendar/queue/diagnostics consume the same `ProductionState`. Required in-progress operation takes priority; otherwise the first open workshop visit with completed required predecessor visits is waiting. Selected ONE OF and snapshot DAG govern availability; all required operations completed clears current workshop. Future assignments never select current workshop. `production_state.lifecycle_status` is draft/planned/in_progress/completed/cancelled; planned is derived read metadata only (ready verified route + complete valid fresh plan + no fact), stored command enum is unchanged. Mutable current_stage_order/label are derived caches synchronized by the fact core in route/stage/WIP writes; reads never repair them. Queue takes canonical current waiting workshop + ready nodes, then existing protections and queue_position order. Existing fact/plan gates and Scheduler remain unchanged.

**PC-05.1B start invariant:** calendar operation facts require a valid saved assignment as specified in DF-SCHEDULER-CALENDAR. The gate covers card/stage start, fact update, completion from pending, both reopen commands and QR/WIP implicit transitions. QR checks current/destination/location-derived operation plans before unit/material/ledger mutation and uses the existing scheduler/card locks; WIP validates all affected transitions before changing status and emits source=unit_wip lifecycle events. `operation_started`/`operation_completed` are transactional events in the existing platform audit, not a second fact source. Legacy broken facts are not silently repaired; planned-operation commands reject further execution without a plan.

**Purpose:** текущий цех и выполненные операции определяются фактом исполнения на ТК.

**Flow:** explicit start/complete/fact/rollback → StageResult persisted fact → current_stage_order/label → Kanban/shop projection

**Source entity/field:** stage commands и fact payload; active selected snapshot nodes, predecessor statuses, material gates, card status.

**Persisted/copy/snapshot field:** StageResult.status/started_at/completed_at/performer_name/work_done/duration_seconds/work_center_id и fact fields согласно payload; TechnicalCard.status/current_stage_order/current_stage_label; composition planned_qty/fact_qty, unit-line execution locations в соответствующих сервисах.

**Derived values:** first open workshop visit по stage_order; required children control visit completion; active ONE OF only. Kanban — projection, отдельного второго fact store нет.

**PC-05.11 / PC-05.13:** Kanban «Завершить» does not invent a second gate. The gate checks MATERIAL lines of the current snapshot operation only (`tech_operation_id`, or the operation's required nomenclatures). It does not collect materials of the whole workshop, route, or a later operation. On `MATERIAL fact_qty required` the dialog lists those lines, writes `composition.fact_qty` through the existing shop PATCH, then retries `complete_stage`. Planned qty is only a prefilled input. Manager composition replace still does not accept fact.

**PC-05.13 launch:** `POST /technical-cards/{id}/start` releases a routed card that already has a saved plan. It does not set `in_progress`, `started_at`, or `operation_started`. The first workshop stays waiting until `Принять в работу` (`start_stage`). Canonical quantity on Kanban, queue and demand is `TechnicalCard.quantity`.

**Consumers:** technical_cards detail/shop boards, `technical_card_stages.current_stage_result/_sync_current_stage`, stage start/complete/fact/rollback endpoints; scheduler protection of started/completed facts.

**Update/reapply semantics:** явные commands под row lock обновляют факт/current stage; rollback имеет доменные ограничения и аудит. Calendar drag/date change не выполняет start/complete. Применение route может заменить snapshot только через explicit apply gates.

**Invariants:** predecessor required completed или optional skipped по реализованным gates; unresolved group не считается завершённой; unselected alternative не выполняется. Current workshop один даже при DAG fork; полноценный multi-workshop parallel Kanban не заявлен.

**Failure modes / Diagnostic codes:** `variant_not_selected` в validation; unmet predecessor/material gate/current shop — validation/conflict exceptions, не универсальные readiness DTO codes. Не приписывать им вымышленные коды.

**Files/modules involved:** [fact service](../../backend/app/services/technical_card_stages.py), [TK models/read](../../backend/app/services/technical_cards.py), [API](../../backend/app/api/technical_cards.py), [shop projection](../../backend/app/api/technical_cards.py).

## DF-DIAGNOSTICS

**PC-06.1A v2:** shared fact integrity adds `production_fulfillment_mismatch` (INTEGRITY): completed production without fulfillment, or fulfillment on noncompleted production. This reports uncertain historical backfill cases without write-on-read. Manager shipment failures explain incomplete production, missing readiness or duplicate shipment; existing production/Calendar diagnostics remain.

**PC-06.1B orphan ownership:** platform health includes shared `calendar_assignment_without_technical_card` INTEGRITY diagnostics, including assignments that cannot be visited through card diagnostics. A scoped outer join proves missing TechnicalCard; a single allocation batch provides exact assignment/card/allocation refs. Manager message: «В производственном плане найдено назначение без техкарты.» No guessed deletion from names, no read-side cleanup. Existing calendar_allocation_orphan diagnostics remain. [Regression](../../backend/tests/test_deleted_planning_pc_06_1b.py).

**PC-06.0D completed readiness:** readiness progress is independent of action availability. GET readiness adds `overall_status=completed` when the canonical lifecycle is completed and no real blocker exists; all nonblocking steps are completed (7/7), including launch with «Производство завершено. Повторный запуск не требуется.». Warning evidence remains in issues but does not undo completed progress. `can_launch=false` for completed/in_progress/cancelled independently of step blockers. Completed/in-progress launch prohibition is no longer emitted as launch_not_available/readiness_incomplete error; the in-progress launch step reflects production lifecycle. Completed cards do not receive new launch-only missing-plan/date adapter issues, while original diagnostics (including genuine missing saved bindings, cache mismatches, invalid routes/configuration) and required header/model errors remain visible/blocking. Genuine errors can make completed readiness blocked; no auto-repair or blanket suppression. Cancelled/draft behavior and all production command/fact/plan algorithms are unchanged. The readonly DTO adds one enum value, no new persistent field or DB migration. PC-06.0B/0C readiness type/label explicitly maps completed to «Производство завершено», preserves backend 7/7/check state and hides completed CTA; no frontend heuristics, JSX or layout edits. [Regressions](../../backend/tests/test_completed_readiness_pc_06_0d.py).

**PC-06.0A:** authenticated GET `/technical-cards/{id}/readiness` returns `TechnicalCardReadiness`: overall_status/can_launch/progress and seven ordered steps basic/model/route/personalization/norms/planning/launch. `technical_card_readiness` is a read-only adapter over `card_diagnostics`, canonical ProductionState/saved plan and required header fields; it does not calculate norms or run a new Scheduler. Manager issue messages/actions are separate from the retained original ProductionDiagnostic in `issues[].diagnostic` (Debug). Unknown applicable blockers remain visible. Diagnostic-to-step routing, scope and compatibility are documented in the task. Read-only API uses no_autoflush, no commit/repair/production mutation. New readiness DTO does not expand existing list DTOs or add per-row requests.

**PC-06.0B:** the manager technical-card page is a consumer of that same GET. It renders the seven steps, progress and messages as returned and scrolls to existing card sections or follows `fix_url`. «Запустить ТК» calls the existing release action only when `can_launch` is true. Successful card saves, route apply, personalization save, schedule and launch refresh the page so the next read replaces the roadmap. No second readiness calculation and no production-core change.

**PC-05.6C:** new queue endpoints reuse ProductionDiagnostic for queue_item_not_waiting, queue_cross_workshop_reorder, queue_contains_protected_fact, workshop_queue_changed and queue_replan_failed; HTTP409 detail has plain message + shared diagnostic and code/category headers. Preview blockers expose safe scheduler reasons/IDs in Debug; deadline warning queue_shipping_risk_increased does not imply failure. No stored diagnostic cache or inferred causal history. Failed attempts do not persist reorder audit; successful apply uses existing universal audit.

**PC-05.8:** shared `production_state_projection_mismatch` INTEGRITY replaces separate lifecycle/workshop fact mismatch codes. Manager message: «Состояние техкарты отображается по-разному в разных разделах. Обновите данные или обратитесь к администратору.» Expected state, actual consumer state and consumer ID are Debug-only trace; no automatic repair. Legacy raw draft + canonical planned is intentional compatibility.

**IC-RS05:** one existing ProductionDiagnostic contract supplies tech_operation_retained_by_technical_card for blocked hard delete and technical_card_operation_reference_missing for existing missing soft identities. Both INTEGRITY; command conflict keeps HTTP409 string manager detail + diagnostic headers. Plain manager message says the operation is used in technical cards, or asks for production review when an operation is missing. IDs/references/status/reason/trace remain technical/debug fields; no identifiers in the manager message. Shared card/platform resolver adds missing-identity evidence even on the malformed-route early return. Read-only scan compares exact integer IDs, never names, and reports production/unknown and name-based test/stress candidates separately. No repair or fact mutation.

**IC-RS01:** shared diagnostic contract adds route_requires_review_before_planning/INTEGRITY with manager field_label/message/fix_action and existing debug_details/trace; no DTO fork. No protected fact: «Не удалось проверить производственный маршрут», explanation about старый маршрут and necessary operations, action «Обновить маршрут». Protected fact: «Маршрут техкарты требует проверки», explanation that started/completed work prevents automatic refresh, action «Открыть маршрут»/manual production review. RouteReviewNotice and route-review.ts reuse existing presentation primitives/action flow; schedule deviation also maps to plain manager text. Technical IDs, verification state, reason, protected fact nodes, expected IDs and technical action stay in Debug Center. Arbitrary malformed JSON/unknown secret-bearing fields are never echoed in diagnostics; safe structural summaries replace raw group payload. Local audit splits status fact/no fact and name-based test/stress candidates, with no writes/repair.

**IC-G04 input freshness (2026-10-11):** Shared card/platform read resolver adds calendar_plan_stale_after_demand_change: DATA_FLOW for future plans, INTEGRITY for protected facts. Debug includes TK/node/op/assignment, changed input groups, previous/current fingerprint and input values, old/current Demand and replan_required, fix_action «Пересчитать производственный план». Missing saved stamp means legacy_inputs_unverifiable, old Demand/fingerprint=NULL and changed_inputs=[]; no invented revision delta. After retired route/ONE OF mapping, current node fingerprint/Demand remain NULL rather than fabricating historical correspondence. String HTTP409 and diagnostic headers reuse the existing conflict contract. Reads never write or repair.

**IC-G03:** shared read-only card/platform resolver adds/refines calendar_allocation_outside_assignment, calendar_allocation_unit_mismatch, calendar_allocation_amount_mismatch and calendar_allocation_resource_mismatch. Structural date/unit/resource faults are INTEGRITY; current amount drift or unverified Demand is DATA_FLOW. Details identify TK/node/op/assignment/allocation/resource/WorkCenter and expected/actual value/date/unit. Unknown current Demand has expected=NULL with reason current_demand_unverified, not a guessed amount. Global unit/date duplicates are replaced by the detailed card resolver (legacy missing-card fallback remains). HTTP conflict preserves string detail and diagnostic headers including actual category. Local audit scans existing allocations, classifies production/unknown vs name-based test/stress candidates, and never infers repair permission from a label.

**IC-G02 diagnostics:** shared card/platform resolver adds INTEGRITY `calendar_assignment_snapshot_mismatch`, `calendar_assignment_missing_snapshot`, `calendar_assignment_operation_mismatch`; global outer-join scan adds `calendar_allocation_orphan`. Details: technical_card_id, snapshot_node_id, operation_id, assignment_id, allocation IDs/count, expected/actual mapping and recommended action. Missing owner on an orphan remains NULL. Saved operation evidence comes from canonical assignment_created audit, not the live template; legacy without evidence is not assigned a guessed historical operation. HTTP409 keeps string detail and X-Diagnostic-Code/Category. Scheduler blocked reason reuses the diagnostic code; generic duplicate messages are removed in favour of detailed calendar diagnostics. Resolver is read-only, with no auto-fix or automatic recovery of existing facts.

**IC-G01:** shared card/platform resolver reports INTEGRITY `route_reapply_conflicts_with_production_fact` when the current live template conflicts with recorded facts. It includes protected snapshot ID, operation/name, status, attempted changes and recommended action without auto-fix. A request against another template returns the same diagnostic code/category plus thin machine-readable `X-Diagnostic-Details`; string HTTP detail remains compatible. Rejected attempts are not persisted, so Debug Center reads current proposed template drift rather than reconstructing arbitrary historical requests.

**PC-05.1B lifecycle provenance:** the same missing-plan resolver now verifies the current snapshot/workshop binding as well as scheduler identity. It batch-loads this card's canonical lifecycle history and includes nullable `last_lifecycle_event` with audit ID/type/time, actor ID/login, source, historical assignment ID, reason and safe before/after state. A latest `assignment_deleted` or `assignment_detached` event supplies that exact reason_code; an unmatched assignment without such evidence remains `snapshot_mapping_missing`, and a missing assignment without causal audit remains `unknown`. A creation/start event alone does not prove when or why the assignment disappeared. Scan time never substitutes for event time. The new command rejection `cannot_start_without_saved_plan` is HTTP409/INTEGRITY, distinct from the read-only legacy state diagnostic `started_step_without_saved_plan`. Lifecycle audit identifies the service mutation where a saved mapping was lost; no guessed reason, auto-reset or auto-scheduling.

**Purpose:** одинаково показать причину и место исправления на catalog/route/TK поверхностях.

**PC-05.0D calendar fact/plan provenance:** `started_step_without_saved_plan` формируется общим card resolver как INTEGRITY/calendar для active snapshot операции с фактом in_progress/completed без назначения по той же routing identity, которую использует Scheduler. Trace: snapshot node → status/started_at → CalendarAssignment mapping → allocation count. Safe details содержат snapshot_node_id, operation_id/name, workshop_id/name, fact_status, started_at/actual_start, nullable calendar_assignment_id/planning_mode/planned_start/planned_end/manual_lock, plan_locked, reason_code, occurred_at из stored started_at (не время diagnostic scan). Same-node assignment с отсутствующим/неподходящим routing mapping даёт snapshot_mapping_missing; без назначения и достоверной истории reason=unknown, а не предположение never_created/deleted/manual_started. Existing valid auto/manual/locked mapping не даёт ложного missing-plan issue. Проверка факта выполняется независимо от того, на каком более раннем blocker остановился read-only Scheduler, сам Scheduler не меняется. `ProductionDiagnosticsRead.calendar_assignments` возвращает summaries всех назначений этой ТК, включая entry marker: IDs/mapping/workshop/mode/date span/lock/source timestamps/allocation_count; отдельного debug store нет. API entity и platform card trace используют одинаковый resolver. [Calendar evidence service](../../backend/app/services/calendar_diagnostics.py), [regressions](../../backend/tests/test_calendar_diagnostic_provenance_pc_05_0d.py).

**Flow:** Demand/config/Scheduler reasons → shared diagnostic resolver → ProductionDiagnostic DTO → UI readiness indicators

**Source entity/field:** operation/resource/stage/work-center context; effective selected nodes; actual card Demand issues и read-only scheduler preflight.

**Persisted/copy/snapshot field:** отсутствует отдельная таблица готовности/кеш. `ProductionDiagnostic` frozen DTO: code/severity/entity_type/entity_id/entity_name/field/field_label/message/fix_scope/operation_id/resource_key. PC-05.0C добавляет category (CONFIGURATION/DATA_FLOW/RUNTIME/INTEGRITY), module, expected_source/source_value/actual_value, formula, trace(source/value/broken), reason/fix_action/fix_url/fix_target и safe debug_details. Старые поля сохранены; новых DB fields нет.

**Derived values:** deduplicated diagnostics; ready/blocked; exact owner field mapping. missing_operator_norm направляет в TechOperation.demand_rule или demand_duration_seconds, не capacity base_rate.

**Consumers:** operation catalog readiness, graph_diagnostics, `GET /technical-cards/{id}/production-diagnostics`; frontend route/TK readiness surfaces, including the manager card roadmap `tech-card-readiness-roadmap.tsx`. Debug foundation: authenticated + existing audit.read permission `GET /platform-health` (category/module/severity/entity_type/entity_id, limit1..200/offset; total/counts after filters) и `GET /platform-health/technical-cards/{id}/trace`. Scope первой версии — production, не вся ERP. Агрегатор использует тот же DTO/resolver, дедуплицирует одинаковые root diagnostics, читает operation/template/card diagnostics, active equipment missing adapters и calendar allocation consistency. Pagination ограничивает ответ, а не стоимость полного diagnostic scan; endpoint предназначен для явного Debug read, не per-row list fetching.

**Update/reapply semantics:** пересчитываются из текущего сохранённого состояния; resolver ничего не заполняет, не изменяет selection и не запускает persisted scheduling. Catalog context batch-loaded; ошибки API не заменяются demo fallback.

**Invariants:** единый backend resolver; alternate ONE OF не блокирует selected path; diagnostic code не равен любому HTTP exception message. Field mapping — указатель исправления, не доказательство конкретной первопричины (например route_snapshot_mismatch может быть unit mismatch).

**Failure modes / Diagnostic codes:** `missing_linear_meters`, `missing_sewing_norm`, `sewing_norm_unverified`, `variant_not_selected`, `missing_operator_norm`, `missing_cutting_mode`, `missing_cutting_rate`, `capacity_unit_mismatch`, `route_snapshot_mismatch`, `resource_capacity_not_configured`, `no_compatible_active_machine`. PC-05.0C lineage: existing source + absent graph → DATA_FLOW/route_snapshot_missing; configured norm + zero/null copied input → DATA_FLOW/operation_input_snapshot_missing; frozen basis × quantity disagrees with volume → DATA_FLOW/derived_volume_mismatch (manual NULL basis не проверяется этой формулой). Broken soft refs/invalid variant shape → INTEGRITY/broken_reference/invalid_variant_snapshot. Calendar codes: calendar_broken_reference/calendar_allocation_unit_mismatch/calendar_allocation_outside_assignment/calendar_allocation_amount_mismatch/calendar_allocation_resource_mismatch. Active equipment without adapter → CONFIGURATION/work_center_capacity_missing. Empty working_days в settings — CONFIGURATION; реальный dry-run exhausted horizon — RUNTIME. Sewing trace показывает table/IDs/time/multiplicity applied sources; сырые exception payloads/credentials не возвращаются. Неизвестный code получает общий production_plan mapping.

**Files/modules involved:** [resolver](../../backend/app/services/production_diagnostics.py), [lineage checks](../../backend/app/services/production_lineage.py), [platform aggregation](../../backend/app/services/platform_health.py), [health API](../../backend/app/api/platform_health.py), [contract tests](../../backend/tests/test_platform_health_pc_05_0c.py), [operation readiness](../../backend/app/services/route_readiness.py), [DTO](../../backend/app/schemas/production_diagnostics.py), [API](../../backend/app/api/technical_cards.py), [UI](../../frontend/components/production/readiness-stickers.tsx).

## Использование и проверка

Найдите ID по сущности в индексе, затем проверьте Source → Persisted → Consumer перед изменением producer или adapter. Не добавляйте live fallback к snapshot чтению и не переносите capacity rates в demand norms. При изменении поведения обновляйте эту карту и регенерируйте HTML в одной итерации.

Связанные договорённости: [ADR-014](decisions/ADR-014-pattern-base-product-models-boundary.md), [ADR-016](decisions/ADR-016-technical-card-domain.md), [ADR-017](decisions/ADR-017-shop-routing-domain.md), [Demand contract](production-demand-pc-04-2.md), [routing graph](unified-routing-graph-pc-04-4g.md), [ONE OF](variant-routing-one-of-pc-04-4i.md), [WorkCenter](work-center-capacity-pc-04-4d.md), [Scheduler](production-scheduler-core-pc-04-3a.md).

Карта не утверждает, что все реальные карточки готовы к планированию. Стрессовые ТК удалены по отдельному запросу владельца после U; исторические результаты S/T/U не являются текущим наличием dataset. Эта задача не создаёт новые карточки и не закрывает PC-04.4S или весь PC-05.

Проверка twin: `python scripts/generate_data_flow.py --check`. Кодовые ссылки должны существовать; все13 ID должны присутствовать один раз как раздел; HTML использует тот же текст, без CDN, с search/navigation, раскрываемыми цепочками и flow blocks. Owner visual review остаётся отдельным действием владельца.
