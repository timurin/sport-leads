# SL-PROJECT-MEMORY-v1

Agent-facing оперативная память Codex + Cursor.
Bootstrap: PC-05.3,2026-10-11; current state update PC-05.7,2026-10-13; guard semantics after IC-RS05/PC-05.6C.
Это указатель текущего контекста, а не новый бизнес-контракт или копия data-flow.
HTML twin не требуется.
Проверенный код и детальные canonical contracts имеют приоритет при конфликте.
Завершённый task/check не означает deployment или приёмку всей стадии.

## PM-INDEX — Как читать

| Scope | Memory | Следующий контекст |
|---|---|---|
| Backend structure | PM-STACK, PM-SOT | affected entity/service |
| Model/Assembly/Route | PM-MODEL, PM-SNAPSHOT | DF-MODEL-ROUTE/ASSEMBLY, DF-ROUTE-SNAPSHOT/ONE-OF |
| Demand/Capacity/equipment | PM-DEMAND, PM-CAPACITY | adapter-specific DF, exact IC row |
| Calendar/start/stale | PM-PLAN, PM-GUARDS | DF-SCHEDULER-CALENDAR/DIAGNOSTICS, IC-OV-05/IC-SW-04 |
| Kanban/fact | PM-FACT | DF-KANBAN-FACT, execution service |
| Diagnostics/Debug UI | PM-DIAGNOSTICS | UI-DEBUG, targeted frontend files |
| Delivery/readiness | PM-OPS, PM-STATE | relevant canonical checklist/ADR |

Порядок: task → эта память → affected entities → selected DF/invariant/UI → code.
Не открывать весь repo или весь frontend для повторного обнаружения архитектуры.
Расширять scope только по найденной зависимости/конфликту либо явному audit task.
Сначала записать причину расширения в task notes или progress.
Закрытые IC task reports читать только при конкретной недоказанной детали.

## PM-STACK — Стек и границы

- Root: `D:\Projects\sport-leads`; текущая проверенная ветка `main`.
- Backend: FastAPI, Python 3.13+, SQLAlchemy, PostgreSQL, Alembic, Pydantic schemas.
- Frontend: Next.js App Router, React, TypeScript strict, Tailwind/shared portal tokens.
- Проверенный frontend package: Next.js 16.2.10; version перепроверять только при dependency task.
- Backend entry: `backend/app/main.py`.
- Layers: `backend/app/api`, `schemas`, `services`, `repositories`, `models`.
- Domain rules принадлежат services, HTTP/auth — API, persistence — repositories/models.
- API возвращает DTO, не ORM objects; money — Decimal/Numeric.
- Datetime — timezone-aware; planning dates — DATE, не timestamp.
- Migrations: `backend/alembic`; tests: `backend/tests`.
- UI: `frontend/app`, `components`, `lib`, `types`, `public`.
- Workspace route group `(workspace)` отсутствует в URL.
- Frontend Next-specific guide: `frontend/AGENTS.md`; relevant bundled guide перед кодом.
- Ops: `scripts`, `docker`, compose files.
- Generated artifacts: ignored `storage`, `logs`, `backup`.
- Не вводить параллельный scheduler, diagnostic DTO, shell или capacity store.
- List/RSC DTO: slim lists, batch/embed вместо per-row fetch; canonical list-page rules.

## PM-SOT — Канонические источники

| Entity | Источник истины | Нельзя подменять |
|---|---|---|
| Product model | ProductModel + model-route links/norms | demo frontend data |
| Assembly | AssemblyVariant/AssemblyOperationLine | SewingOperation как time norm |
| Route master | ShopRoutingTemplate/StageLine/Dependency | applied card graph |
| Applied route/fact | TechnicalCardStageResult + RouteEdge | latest live template |
| Operation input | TechnicalCardOperationLine | guessed quantity-to-meters formula |
| Whole card quantity | TechnicalCard.quantity | arbitrary operation pieces total |
| Technology | TechOperation | copied resource-specific operation |
| Capacity | CapacityResource + dated exceptions | second settings table |
| Physical equipment | WorkCenter + unique capacity adapter | duplicate machine catalog/rates |
| Saved plan | CalendarAssignment + owned CalendarAllocation | successful dry-run |
| Fact | stage results/units/workshop ledgers | lifecycle audit as fact table |
| Provenance | canonical AuditEvent | inferred historical reason |
| Diagnostics | shared read resolver/DTO | persisted readiness cache |
| Navigation | frontend/lib/navigation.ts | hardcoded duplicate menu links |

Подробные цепочки и формулы живут только в SL-DATA-FLOW-v1.

## PM-MODEL — Model и Assembly

- Model-route whitelist: `ProductModelRoutingLink`.
- Operation norm scoped model + route + operation/workshop/unit.
- `ProductModelOperationNorm.norm_qty_per_item` — canonical live variant norm.
- `TechnicalCardOperationLine.volume_qty_per_item` — принятый frozen коэффициент.
- Принятый total пересчитывается basis × card quantity существующим producer.
- Manual total очищает basis; NULL basis означает manual/legacy/unknown.
- Live master norm edit не меняет уже принятый card input.
- Explicit reapply принимает новую норму только по существующим fact-safe правилам.
- AssemblyOperationLine владеет duration_seconds и quantity_per_item.
- SewingOperation — каталог identity, не альтернативный time norm.
- Order-item assembly snapshots дают frozen sources для sales-order контура.
- Standalone assembly sources остаются live и участвуют в freshness comparison.
- Sewing source должен сопоставиться с реально applied sewing row.
- Binding не должен создавать несуществующую норму или скрывать unverified source.
- Target: `backend/app/services/tech_card_model_assembly.py`.
- Norm/volume producer: `backend/app/services/technical_cards.py`.
- Read: DF-MODEL-ROUTE, DF-MODEL-ASSEMBLY, DF-TK-OPERATION-VOLUME.

## PM-SNAPSHOT — Routing, Snapshot, ONE OF

- Master route и applied card route — разные источники с разной lifetime.
- Card graph читается из retained StageResult/RouteEdge snapshot.
- Missing snapshot не получает silent fallback на live template.
- Effective dependencies поддерживают последовательность и fork/join DAG.
- ONE OF groups/selections сохраняются в card JSON; только selected member участвует.
- Preliminary valid default может участвовать; confirmation не всегда planning prerequisite.
- Unresolved active group блокирует планирование.
- Fact-bearing reapply сохраняет node identity, факт, inputs и calendar/audit links.
- Destructive protected change отклоняется, future mapping retire атомарен.
- Сопоставление по stage_order вместо доказанной identity запрещено.
- Shared projection: `routing_graph.py`, `route_snapshot.py`.
- Reapply guard: `route_reapply.py`; selection: `route_variants.py`.
- Writes: `shop_routings.py`, `routing_graph_write.py`, `technical_cards.py`.
- Target schemas: `routing_graph.py`, `route_variants.py` в schemas.
- Read: DF-ROUTE-SNAPSHOT, DF-ONE-OF; IC-RS-*.
- IC-RS01: frozen applied manifest в existing AuditEvent; unverified/missing/changed retained route blocks planning/new execution. Explicit canonical no-fact refresh creates new evidence; unverified protected fact cannot refresh. No inferred historical composition.
- IC-RS05: retained StageResult/operation-line integer references block TechOperation hard delete under shared scheduler lock. Unreferenced identity can delete; no name inference or automatic archive/deactivate/remap. Legacy missing identity is shared INTEGRITY diagnostic.

## PM-DEMAND — Формулы и verified inputs

- Existing Demand registry/adapters — единственный расчёт ResourceDemand.
- Target entry: `backend/app/services/production_demand.py`.
- Input loader: `backend/app/services/production_demand_snapshot.py`.
- Demand DTO содержит amount/unit/status/provenance; missing не становится zero readiness.
- Sewing: matched seconds × multiplicity × card quantity /3600.
- Meter Demand использует accepted matching total, без повторного ×quantity.
- Item/cutting adapters используют whole-card quantity и verified method/rate.
- Explicit time rules: fixed_per_order или per_item + duration_seconds.
- Quantity участвует в fingerprint только у реально consuming adapters.
- Milestone не создаёт capacity allocation.
- Unit Demand должен точно совпасть с capacity unit; silent conversion отсутствует.
- Нельзя вычислять hours из произвольного labor base_rate вместо time source.
- Неизвестные business inputs/нормы остаются явной диагностикой.
- Read: DF-SEWING-DEMAND, DF-PRINT-DEMAND, DF-CUTTING-DEMAND по операции.
- Общий contract: `production-demand-pc-04-2.md`.

## PM-CAPACITY — Resource и WorkCenter

- TechOperation владеет технологией; CapacityResource владеет мощностью.
- M:N `TechOperationCapacityResource` поддерживает shared nonphysical resource.
- Один print operator может обслуживать несколько операций без копирования ресурса.
- WorkCenter — physical identity; один canonical CapacityResource adapter.
- Existing unique constraint защищает physical adapter identity.
- Scheduler выбирает одну compatible active machine alternative.
- Mandatory labor/team constraints сохраняются вместе с machine demand.
- Capacity dates/exceptions учитываются отдельно от Demand amount.
- Counts/hours/shifts/efficiency/working days/used rate влияют на ETA.
- Изменение мощности может сделать план stale при прежнем Demand amount.
- Allocated unit/identity и used links защищены IC-G03.
- Targets: `capacity_resources.py`, `production_capacity.py`, `work_center_capacity.py`.
- API catalog: `/production-calendar/capacity/resources`, `/work-centers`, `/tech-operations`.
- Read: DF-DEMAND-CAPACITY, DF-WORKCENTER; IC-DC-*, IC-WC-*.

## PM-PLAN — Scheduler, Calendar, freshness

- PC-06.3F: canonical read-only PlanningHealth at authenticated GET /technical-cards/{id}/planning-health and slim batch GET /production-calendar/manual-planning/cards (active standalone, limit/offset). Common summary: persisted ETA/shipping/slack/existing risk, normalized not_planned/actual/stale/invalid/completed, overdue pending/no-fact, progress/current/next, has_planning_issues. Detail guards shared with manual command. actual means input freshness and may require replan for overdue. Terminal suppresses active warnings; no Scheduler/repair/write. Contract production-planning-health-pc-06-3f.md; schema/service planning_health.py. PC-06.3E backend gap below is filled; PC-06.3G presents this read model.

- PC-06.3D supersedes the 3B future-date restriction: manual replan accepts selected pending/unstamped/non-fact-bearing operations regardless of their original date (past/today/future), including waiting current/ready pending nodes. Target date remains today/future. The manual service alone supplies editable_overdue_node_ids for eligible selected/downstream scope; ordinary Scheduler/Queue past anchors remain unchanged. Locks, terminal/shipped cards and canonical production fact stay protected. Single-mode past successor conflicts use manual_replan_dependency with «Эту и последующие»; downstream protected anchors report their concrete node/reason. A post-proposal DAG date check covers historical anchors that ordinary Scheduler preserves. Existing revision/fingerprint, atomic persistence/audit, ETA, resource guards and queue_position retained. No migration/frontend patch; contract manual-planning-route-replan-pc-06-3b.md updated.

- PC-06.3B: authenticated permission-checked POST /production-calendar/manual-planning/preview + /apply for an exact pending node/date (including overdue after PC-06.3D), single or downstream effective DAG scope. Preview is read-only; optional initial revision bootstraps the token. Apply requires revision+preview_fingerprint and recomputes under the existing scheduler gate; stale/conflicting inputs409, single never cascades. Existing _build receives an optional selected-node lower date bound, then owns all capacity/calendar/machine/dependency logic. Protected facts/locked/manual nonselected anchors remain; overdue pending manual scope follows PC-06.3D, independent branches/other cards/ONE OF exclusions unchanged. Explicit selected manual_adjusted may be moved again; apply pins it manual_adjusted, preserves queue_position, reuses persist_plan + lifecycle/actor audit and canonical persisted ETA. No frontend patch, fact/Kanban/Queue/fulfillment changes or migration. Contract manual-planning-route-replan-pc-06-3b.md; service/schema manual_route_replan.py;13 regressions, including real PostgreSQL concurrent apply. Planning screen consumer is PC-06.3C.

- PC-06.2: weekly Calendar now displays all saved overlapping assignments (current/future/completed history); this is plan visibility, never Kanban progression. AssignmentRead adds snapshot_node_id/operation_name/operation_status from the exact owned StageResult, independently of workshop_state (e.g. sublimation in_progress, heat-transfer pending). Detail-only planning_summary restores min/max selected saved assignment dates, shipping date and backend slack/risk after reload; canonical planning_state/is_current/replan_required mark stale/partial/invalid forecasts explicitly. No Scheduler call, persistence or frontend ETA arithmetic on read; malformed selection returns invalid/no invented ETA. The existing inclusive DATE engine allows sequential successor start on predecessor end day; seven short sequential operations consume70/100 daily capacity in a regression. Parallel/join and selected ONE OF tests pass; no Scheduler/progression/fulfillment changes. Targets: production_calendar.py + schema, persisted_plan.py + schema, detail mapper, calendar board and tech-card-process; DF-SCHEDULER-CALENDAR.

- PC-06.3G: planning screen and the technical-card plan block present canonical Planning Health. List is `GET /production-calendar/manual-planning/cards`; detail is `GET /technical-cards/{id}/planning-health`. Overdue, risk, ETA, slack and operation status are not derived on the client. Preview/apply, Scheduler, Kanban and facts are unchanged.

- PC-06.3C: manual planning UI posts the 3B preview/apply contract. `single` and `downstream` are explicit; dates, ETA, slack and risk are displayed from the response. Apply needs `apply_allowed` plus the returned revision and fingerprint, and a form change clears them. Stale/protected/dependency/capacity/blocked use the manager texts. Success reloads the card route and board. Completed and in-progress steps stay locked. No local planning math, Kanban/fact write, or backend change.

- PC-06.3A: manual planning is one row per open technical card, then its route. Current pending stays locked. The move command is PC-06.3C.

- PC-06.1B: hard-delete of a safe draft uses scheduler/card locks + shared retirement (allocations, assignments/queue_position, lifecycle audit) before card deletion; protected fact/ledger/batch guards remain. Board inner joins exclude absent cards; editable_only=true adds active card + owned pending unstamped snapshot/entry scope for manual planning, leaving default history unchanged. No soft-delete field. Missing-card assignments are reported by platform INTEGRITY diagnostics. /calendar/manual-planning redirects to canonical /calendar/planning; successful card delete revalidates Calendar paths. Existing/fact-bearing test-named cards are not deleted by prefix.

- PC-05.8 Calendar read DTO adds shared ProductionState + current/future/completed operation metadata. Future assignments affect derived planned lifecycle, never current workshop; see PM-FACT.

- PC-05.6C: `/production-calendar/workshops/{id}/queue` GET + preview/apply. Existing CalendarAssignment.queue_position (nullable positive, migration f2a3b4c5d678) is manual waiting order, independent of board position/card priority. Pending current selected standalone node only; protected/started/unselected/not-ready predecessor nodes excluded. Read-only virtual preview and revision/effective-input fingerprint; apply uses shared scheduler gate and existing persist guards, atomically replans changed suffix+future descendants, keeps fact/manual/past anchors and rolls back on failure. Single/batch replacements retain manual order. Target workshop_queue.py + schemas/workshop_queue.py; contract workshop-queue-pc-05-6c.md. PC-05.6D queue tab uses this API for order, preview and apply (`technical_cards.create`). No Kanban/fact mutation.

- Scheduler executable scope: standalone card (B), не весь sales-order контур A.
- Single command: POST `/technical-cards/{id}/schedule`.
- Queue command: POST `/production-calendar/schedule`.
- Single engine: `backend/app/services/production_scheduler.py`.
- Queue reuse: `production_queue_scheduler.py`; repository: `repositories/production_scheduler.py`.
- Scheduling explicit; diagnostic read/dry-run не сохраняет план.
- Existing horizon, priority/deadline, occupancy и protected anchors сохраняются.
- Shared scheduler transaction lock сериализует covered writers.
- Queue blocked card сохраняет прежний план через existing SAVEPOINT strategy.
- Entry marker не равен назначению production operation.
- Calendar dates inclusive; same-day assignment допустим.
- Daily allocation chunks имеют positive amount и точную unit/resource ownership.
- Rounded total Demand: один ceiling quantum0.0001, не округление каждой копии суммы.
- New plan/allocation replacement атомарен; old lifecycle evidence сохраняется.
- Canonical lifecycle: `calendar_plan_lifecycle.py`, существующий AuditEvent.
- Actions: assignment_created/replanned/detached/deleted, operation_started/completed.
- `assignment_created` хранит version1 demand_input_snapshot + SHA256 + inputs + Demand.
- `calendar_plan_freshness.py` сравнивает saved evidence и current effective inputs.
- Future drift = stale/replan_required; execution по старому плану запрещён.
- Explicit successful replan пишет новый stamp и снимает derived staleness.
- Stale manual/past/fact anchors блокируют reuse, не silently replan.
- `demand_input_guard.py` registered in main; narrow ORM transaction input guard.
- Consumed drift на started/completed saved fact отклоняется after flush с rollback.
- DML может выполниться до rejection; ничего не persist после rollback.
- Raw SQL/bulk SQL не защищён ORM hook; не выдавать его за supported writer.
- Legacy без stamp unverifiable; не угадывать old Demand или revision delta.
- Retired route/ONE OF mapping требует новой generation без invented node remap.
- Read: DF-SCHEDULER-CALENDAR, DF-DIAGNOSTICS; IC-OV-05, IC-SW-04, IC-SC-*.

## PM-FACT — Kanban и исполнение

- PC-06.1A v2: whole-card fulfillment is persisted separately on TechnicalCard (`fulfillment_status`, `ready_to_ship_at`, `shipped_at`). Production completion transaction creates ready_to_ship; explicit locked mark-shipped creates shipped + canonical actor audit. No stock/QR/WIP/partial shipment in this flow. Existing catalog-identified workshop-only FG markers are retained historical compatibility rows, excluded from production projection; new routing no longer appends them. Selected required production operations/DAG still use the same resolver and gates. Shipped guards reject reopen/start/QR writes; a permitted pre-shipment rollback clears ready state. The two existing FG pages now read a single-query slim fulfillment DTO, use TechnicalCard.quantity and manager-card links. Future warehouse integration attaches through on_ready_to_ship/on_shipped, currently no-op; ADR-019/030 history remains. Migration backfills only proven completed cards without posted legacy FG issue; uncertain legacy history is diagnosed, never guessed. Targets: technical_card_fulfillment.py + schemas, technical_card_stages.py, fulfillment-workspace.tsx.

- PC-05.13: material fact gate matches the current snapshot operation, not the whole workshop. `Запустить ТК` checks a saved plan and leaves the first workshop waiting; only `Принять в работу` writes `started_at`. `TechnicalCard.quantity` is canonical; personalization does not replace it.
- PC-05.11: the material fact gate stays in `complete_stage`. Kanban complete opens the operator fact dialog only after that error, writes `fact_qty` through the existing shop PATCH, then calls complete again. Manager composition fact stays read-only.
- PC-05.8: canonical `production_state.py` + ProductionState DTO supplies list/detail/Kanban/Calendar/queue/diagnostics. Selected snapshot/DAG/fact alone selects current workshop; verified readiness + valid fresh complete plan derives planned metadata, without a DB enum. Stage/WIP/route cache sync reuses the fact core, reads never repair caches. Contracts: DF-KANBAN-FACT / DF-SCHEDULER-CALENDAR; batch Demand/fingerprint reads preserve formulas.

- StageResult и существующие units/ledgers остаются источником факта.
- Effective selected snapshot определяет доступные операции/current workshop.
- Cross-workshop parallel Kanban не заявлен как полностью реализованный.
- `assert_saved_plan` требует valid fresh saved assignment для planned B operation.
- Gate покрывает start/fact/complete/reopen и implicit QR/WIP transitions.
- Contour A и workshop-only/FG markers не получают выдуманный Calendar contract.
- Fact mutation и lifecycle event находятся в одной transaction.
- Targets: `technical_card_stages.py`, `tech_card_scan.py`, `tech_card_wip.py`.
- Read: DF-KANBAN-FACT; не читать все shop services без зависимости.

## PM-DIAGNOSTICS — Shared resolver и Debug Center

- PC-06.0A: `technical_card_readiness.py` adapts existing card diagnostics + ProductionState into seven ordered manager steps; GET `/technical-cards/{id}/readiness` is authenticated/read-only. Card launch uses the same can_launch guard and still writes no operation fact. Personalization count mismatch is warning only; B requires a full fresh saved plan, A receives no invented Scheduler requirements. Unverified snapshots require explicit apply-routing. Completed/cancelled/in-progress cards cannot be relaunched. Details: DF-DIAGNOSTICS and selected task mapping.
- PC-06.0B: manager card renders that contract as «Готовность техкарты» and enables «Запустить ТК» only when `can_launch` is true. The page does not derive step status or a second launch rule.
- PC-06.0D: readiness completion and launch availability are separate. Completed without real errors returns overall_status=completed, 7/7, completed launch step and can_launch=false; in-progress launch prohibition is not a readiness blocker. Original integrity/config errors remain blocking; draft/cancelled behavior and production commands stay unchanged. PC-06.0B/0C readiness type/label adds completed → «Производство завершено»; no lifecycle inference or layout change.

- PC-05.8: `production_state_projection_mismatch` (INTEGRITY) compares canonical state with stored projection caches; expected/actual/consumer are Debug evidence. draft command enum + planned metadata is compatible, not a mismatch. No read repair.

- Shared DTO: `backend/app/schemas/production_diagnostics.py`.
- Card resolver: `production_diagnostics.py`; platform: `platform_health.py`.
- Lineage: `production_lineage.py`; saved plan evidence: `calendar_diagnostics.py`.
- Linkage/amount/freshness resolvers дополняют общий read model.
- GET `/platform-health`; card diagnostics через existing technical-card API.
- Categories: CONFIGURATION, DATA_FLOW, RUNTIME, INTEGRITY.
- Safe fix links, field/entity IDs, source/actual, formula/trace/debug сохраняют provenance.
- Наличие old audit event не доказывает причину факта без matching evidence.
- Detailed conflict: string HTTP409 + X-Diagnostic-Code/Category headers.
- Read resolver не выполняет scheduling, repair или fake readiness fallback.
- Persisted debug_mode — PlatformSystemSettings; не browser-only readiness.
- UI entry: top-navigation → `PlatformDebugCenter` overlay.
- UI details: UI-DEBUG в SL-UI-CONTEXT-v1; presentation-only task не требует backend scan.

## PM-GUARDS — Завершённые guards

| Task | Защита | Target |
|---|---|---|
| PC-05.1B | Valid saved plan before execution + canonical lifecycle | calendar_plan_lifecycle.py |
| IC-G01 | Route reapply сохраняет confirmed fact/identity/inputs | route_reapply.py |
| IC-G02 | Saved mapping/retirement/ownership, future atomic release | calendar_plan_linkage.py |
| IC-G03 | Inclusive dates, exact units/totals/resources, allocation edits | calendar_allocation_consistency.py |
| IC-G04 | Input evidence, stale execution/replan gate, protected input rollback | calendar_plan_freshness.py, demand_input_guard.py |
| IC-RS01 | Frozen route completeness evidence, legacy planning/start block, manager refresh policy | route_verification.py |
| IC-RS05 | Retained operation deletion guard + missing-identity diagnostics | operation_retention.py |

Точные invariants и риски: SL-INVARIANT-COVERAGE-v1, не повторять всю матрицу здесь.
Focused tests: `test_route_reapply_ic_g01.py`, `test_calendar_plan_linkage_ic_g02.py`.
Allocation tests: `test_calendar_allocation_consistency_ic_g03.py`.
Freshness tests: `test_calendar_plan_freshness_ic_g04.py`.
Gate tests: `test_calendar_plan_lifecycle_pc_05_1b.py`.
IC-G04 final check:896 backend,391 frontend,281 targeted, project check10/10.
Это evidence рабочего дерева, не опубликованная app version или proof production readiness.

## PM-STATE — Open risk и legacy

- PC-05.7 full stress PASS locally:FULL-STRESS127-156,6 per allowed SKU201.1/201.2/211.1/211.2/211.3,120 personalization rows(3-5/card,quantity matches canonical unit count).30 planned/0 blocked/risk/diagnostics,210 assignments/210 allocations;28 shared budgets,247 FK/0 orphans/stale/newP0/P1. Five new test Design completions produce Print queue;5-item API reorder persists and replans30 future operations,no fact/workshop/lifecycle/personalization changes during reorder. Kanban25 Design/5 Print. MINI122-126 removed with exact historical proof;CAL absent;unknown121 and other old rows preserved. Previous MINI reports below are historical,not current records. Existing source configuration now makes all five SKUs ready;no norm/config fix in this test. Scoped checks8/8,full suites not run(task forbids without runtime changes). Actual route1 chain;ONE OF/fork/join not exercised. Evidence logs/pc-05-7;owner review pending,no deployment/stage transition.

- PC-05.6C backend queue API ready:29 new regressions (including actual PostgreSQL stale-apply concurrency and reversible migration),160 IC/Scheduler targeted + final batched-GET test;project check10/10,958 backend/402 frontend. Local waiting read/integrity scan zero SQL writes;247 FK/no orphans. Existing queue includes non-stress data, so no live apply/mass reorder. PC-05.6D connects the operator queue tab to this API. Owner review pending.

- Historical PC-05.6A verification (MINI records removed by PC-05.7): MINI-STRESS122–126 current workshop Design/list/detail/Kanban agree;122–125 draft,126 in_progress with existing production fact.28 Calendar assignments remain future plan, not workshop transitions. Read-only audit, no data repair. Browser visual verification not available; owner review pending.

- Historical PC-05.4 mini stress PASS (records removed by PC-05.7): exactly5 local MINI-STRESS cards on201.1/201.2/211.1/211.2/211.3 (IDs122–126), quantities20/60/120/180/240.4 planned,28 assignments/32 allocations;201.1 blocked by missing_linear_meters on print/heat transfer, no configured-data repair.21 shared resource/date budgets and fresh plan fingerprints PASS; old source/fact/plan rows unchanged. READY FOR30-TK STRESS TEST;30-card test not started. Actual route1 is an explicit chain without ONE OF/fork/join; those branches are not exercised. Evidence logs/pc-05-4 and selected task report.

- Matrix after PC-05.6C:42 invariants; P0=0/P1=0/P2=13/P3=29. New IC-SC-06 covers scoped fresh-preview workshop reorder; previous inventory unchanged.
- IC-RS-01 covered/P3: missing frozen evidence is explicit review/block, never inferred from live template.
- IC-FINAL policy blocker resolved by IC-RS01; remaining canonical P1 inventory now closed by IC-RS05. This does not close overall calendar stages or claim production/visual readiness.
- No remaining P0/P1 in the canonical matrix; next action is owner review/selection, no automatic P2/P3 or stage advancement.
- IC-RS-05 covered/P3: delete guard covers retained soft node and operation-line references, including cancelled/completed histories.
- IC-G06 safety scope covered by IC-RS05; existing deactivation behavior unchanged and no automatic archive policy introduced.
- Общие PC-04/PC-05 и незавершённые UI/stress gates не закрываются memory task.
- PC-04.4S stress readiness остаётся отдельной итерацией, не permission на mass replan.
- IC-RS01 audit2026-10-12:6 unverified routes; production/unknown4 with status facts/1 without; stress candidate1 with fact. No repairs. Earlier IC-G04 audit:3 assignments/2 without input stamp/1 queue marker.
- Unverifiable: TK6/node139/assignment12; TK25/node146/assignment21.
- 11 ранее известных фактов без плана имеют unknown provenance.
- Audit locality/time: localhost:5432,2026-10-11; не утверждать это о VPS/current future DB.
- IC-RS05 audit2026-10-12:82 retained references,68 production/unknown+14 test/stress,7 operation IDs,0 missing identities.247 FK/no orphans,0 scan writes or repair/backfill.
- Evidence: IC-RS01 task/result and `logs/ic-rs01/route-audit.json`; earlier IC-G04 `plan-audit.json` is historical.
- Test/stress labels — candidates, не разрешение удалить или исправить записи.
- P2/P3 вне selected scope не исправляются без отдельной задачи.

## PM-OPS — Production и локальные проверки

- Canonical production origin: https://sport-lead.ru.
- Host: Ubuntu26.04, Docker Engine/production compose, ADR-032.
- Delivery: local repo → authorized commit/push main → automatic deploy-production.yml.
- Manual workflow_dispatch — fallback; production apply требует существующего разрешения.
- Canonical DB/media: VPS Postgres/storage, не локальные test artifacts.
- Agent checks: только local Docker PostgreSQL:5432; tunnel:5433 запрещён для tests.
- Frontend local:127.0.0.1:3001; backend:127.0.0.1:8000.
- Port3000 foreign/out of scope; не probe/kill/reuse.
- Start: `powershell -File scripts/dev-servers.ps1 -Action start`.
- `scripts/check_project.py`: Python/API/OpenAPI/models/Alembic, pytest, frontend checks, Compose.
- Targeted checks first; required full check once после стабилизации изменений.
- Never commit secrets/.env/generated artifacts; no commit/push без прямого запроса.
- No destructive cleanup/reset/unknown untracked deletion; retain owner's WIP.

## PM-DOCS — Где искать подробности

| Canonical doc | Когда открыть |
|---|---|
| [roadmap](../roadmap/roadmap.md) | selected item, sequence/boundary |
| [project structure](project-structure.md) | confirmed module readiness |
| [ERP-check](erp-check.md) | readiness и remaining business flow |
| [data-flow](SL-DATA-FLOW-v1.md) | index → affected DF sections |
| [invariants](SL-INVARIANT-COVERAGE-v1.md) | exact guard/risk rows |
| [UI context](SL-UI-CONTEXT-v1.md) | affected UI-* sections |
| [design system](../design-system/README.md) | approved template/token contract |
| [ADR-017](decisions/ADR-017-shop-routing-domain.md) | route/norm/snapshot decisions |
| [ADR-025](decisions/ADR-025-universal-audit-trail.md) | audit ownership/lifecycle evidence |
| [VPS runbook](../ops/vps-canonical-0-5.md) | authorized delivery/production work |

MD master + existing HTML twin sync обязательны для status/DF/invariant изменений.
Memory/UI context HTML отсутствуют по PC-05.3 design.

## PM-CONFLICTS — Bootstrap conflicts и maintenance

- Roadmap header содержит старую feature branch; git подтвердил main. Header — historical metadata.
- Matrix opening narrative описывает старую quantity gap; current IC-OV-05/IC-SW-04 rows и IC-G04 evidence фиксируют guard.
- Не считать historical narrative новой отменой завершённого guard; при изменении проверять minimal service.
- Shell responsive summary упоминает260px; current token/DS-SHELL-01 specify max(220px,10vw).
- Current shell code/tokens подтверждены; approved contract менять только отдельной visual task.
- SL-UI-BASE-v1 встречается в calendar prototypes; отдельный canonical файл не найден.
- UI memory указывает existing shell/design sources, не создаёт выдуманный новый visual contract.
- При новом конфликте: record → smallest code check → establish truth → repair affected memory → continue.
- При architecture/state change обновить соответствующий PM section и relevant DF/invariant/UI sections.
- При unchanged memory: `Project memory: no changes required`.
- Не копировать task history, формулы всей карты или весь component catalog в память.
