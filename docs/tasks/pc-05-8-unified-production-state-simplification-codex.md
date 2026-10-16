# PC-05.8 — Unified Production State: Simplify Calendar + Kanban

## Исполнитель
Codex

## Проблема
После серии точечных исправлений Calendar и Kanban продолжают расходиться.

Сейчас:
- Calendar строит недельный план по `CalendarAssignment`;
- Kanban использует отдельную логику `current_workshop/current_stage`;
- TechnicalCard list использует ещё один набор полей/status;
- из-за этого одна и та же ТК может выглядеть по-разному в трёх местах.

Нужна не очередная patch-логика, а упрощение до одного источника производственного состояния.

## Цель
Создать один canonical `ProductionStateResolver` (название условное), который определяет состояние ТК из:

`TechnicalCard snapshot + operation facts + CalendarAssignment`

И использовать его для:
- списка ТК;
- Kanban;
- Calendar read model;
- operator queue;
- diagnostics.

Не переписывать Scheduler.

## Ключевой принцип

### Calendar
Показывает ПЛАН:
- где;
- когда;
- какая операция должна выполняться.

### Kanban
Показывает ТЕКУЩЕЕ СОСТОЯНИЕ ТК:
- один текущий workshop;
- `Ожидает` / `В работе`;
- переход только после факта завершения required operations.

Calendar и Kanban не обязаны визуально совпадать по будущим операциям, но обязаны использовать один production-state resolver.

## 1. Убрать независимые вычисления
Найти все места, где отдельно вычисляются:
- `current_workshop_id`;
- `current_stage_label`;
- lifecycle status;
- Kanban column;
- waiting/in_progress state.

Составить таблицу:
`consumer -> current source -> replacement`

После этого оставить один canonical resolver/service.

## 2. Canonical production state

### Targeted discovery / consumer replacement — 2026-10-13

| Consumer | Current source | Replacement |
|---|---|---|
| TK list/detail | stored status + fact_projection/workshop visits | shared ProductionState + derived lifecycle metadata; stored enum retained for commands |
| Kanban | backend pointer + frontend stage/label fallback | resolver workshop ID/name/state; no frontend state inference for canonical DTO |
| Calendar | CalendarAssignment only | assignments + one batched ProductionState map/current-future-completed metadata |
| Operator queue | current_fact_stage + independent effective DAG/waiting checks | resolver current waiting/ready node; existing protected/order/replan guards retained |
| Diagnostics | independent lifecycle/workshop expected values | same resolver + production_state_projection_mismatch expected/actual consumer trace |
| Execution/WIP caches | workshop visit/lag pointer writes | resolver fact core/sync after guarded fact producers; no planned DB enum or read repair |

Dependency recorded: plan validity must reuse Demand/fingerprint semantics without list N+1. Targeted batch row inputs will feed existing snapshot/stamp functions; Scheduler placement is unchanged. Route copy/reapply/ONE OF and unit WIP are pointer producers, so their affected sync call sites are in scope.
Для каждой ТК resolver должен вернуть минимум:
- `lifecycle_status`
- `current_workshop_id`
- `current_workshop_name`
- `workshop_state`: waiting | in_progress | completed
- `current_snapshot_nodes`
- `next_workshop_id`
- `has_started_fact`
- `has_completed_fact`
- `planning_state`
- `diagnostics`

### Current workshop rule
1. Если есть `in_progress` required operation:
   - current workshop = workshop этой операции.
2. Иначе:
   - найти первый workshop snapshot DAG, у которого есть незавершённые required operations и все predecessor workshops завершены;
   - current workshop = этот workshop;
   - state = `waiting`.
3. Если все required workshops завершены:
   - lifecycle = completed;
   - current workshop = null / completed state.

Future Calendar assignments сами по себе current workshop не меняют.

## 3. Lifecycle status
Минимальная semantics:
- `draft` — нет готового verified production route / ТК не готова к запуску;
- `planned` — маршрут готов и есть план, производство ещё не стартовало;
- `in_progress` — есть production fact `in_progress` либо уже завершён хотя бы один required workshop при незавершённом маршруте;
- `completed` — все required workshops завершены.

Если enum уже другой — адаптировать без лишних новых статусов.

`Черновик` недопустим для ТК, которая уже имеет валидный производственный план и production-ready snapshot.

## 4. Kanban projection
Kanban API строить только из canonical production state.

Для одной ТК:
- ровно одна Kanban column;
- future Calendar assignments не создают дубликаты;
- column = `current_workshop_id`;
- badge = `waiting` / `in_progress`.

Без DnD.

## 5. Calendar projection
Calendar продолжает читать assignments.

Для assignment можно добавить read-only metadata из того же resolver:
- lifecycle status;
- current workshop;
- current/future/completed.

Не менять placement algorithm.

## 6. TechnicalCard list
Колонки:
- Статус
- Участок

берут данные только из canonical resolver/read model.

Frontend не вычисляет их сам.

## 7. Queue
Queue использует только:
- current workshop from resolver;
- waiting state;
- backend queue_position.

ТК не попадает в очередь будущего workshop только потому, что там есть future CalendarAssignment.

## 8. Duplicated state
Если `current_workshop_id` хранится в БД как mutable field:
- определить, можно ли оставить как derived cache;
- обновлять только через canonical resolver/sync;
- запретить независимые writes из Kanban/Calendar/UI.

Destructive migration отдельно не делать без необходимости.

## 9. Stress verification
Использовать текущие `FULL-STRESS-*` 30 ТК.

Для каждой:
`TK | lifecycle | current_workshop | kanban_column | current assignment | next assignment`

Ожидается:
- Kanban = resolver current workshop;
- TechnicalCard list = тот же workshop/status;
- Calendar может показывать будущие workshops, но не меняет факт;
- Queue содержит только waiting для current workshop.

## 10. Diagnostics
Если consumer отличается от resolver:
- category `INTEGRITY`
- code `production_state_projection_mismatch`

Показывать:
- expected state;
- actual consumer state;
- affected entity.

Manager-facing:
`Состояние техкарты отображается по-разному в разных разделах. Обновите данные или обратитесь к администратору.`

Technical trace — Debug only.

## 11. Tests
Минимум:
- planned/not started;
- waiting first workshop;
- in_progress workshop;
- completed workshop advances next;
- future calendar assignment does not move Kanban;
- completed route -> completed lifecycle;
- parallel required operations;
- ONE OF selected member;
- TechnicalCard list == Kanban resolver;
- Queue uses same current workshop;
- no duplicate Kanban placement.

После targeted PASS:
- backend full tests once;
- frontend only if contract/read model changed;
- project check;
- DB integrity;
- git diff --check.

## Ограничения
Не делать:
- новый Scheduler;
- новые business statuses без необходимости;
- UI redesign;
- Kanban DnD;
- broad refactor всей production architecture;
- массовое изменение production facts;
- commit/push.

## Acceptance
Готово, если:
1. существует один canonical production-state resolver;
2. список ТК, Kanban и Queue используют его;
3. Calendar остаётся планом, но получает тот же state metadata;
4. `current_workshop/status` больше не вычисляются независимо в нескольких местах;
5. FULL-STRESS dataset не имеет projection mismatch;
6. новых P0/P1 нет.

Финальная строка:
`PC-05.8 UNIFIED PRODUCTION STATE ACTIVE`

## PC-05.8 implementation and verification — 2026-10-13

Selected microtask: PC-05.8, explicitly requested after PC-05.7. No next stage started.

Canonical service: `backend/app/services/production_state.py`; DTO: `backend/app/schemas/production_state.py`. Fact core handles required operations, workshop DAG visits and selected ONE OF. Batch loader reuses existing Demand and freshness formulas to derive planned metadata. Stored TechnicalCardStatus enum stays compatible; no migration. `technical_card_fact_projection` is a thin compatibility adapter. Stage/WIP/snapshot/reapply caches synchronize through the same core. List/detail/Calendar/queue/diagnostics and frontend list/Kanban presentation share its state. Canonical status/workshop filters apply before pagination; filtered queries read the matching header candidate set in one batch rather than per-row fetches. This can read more cards than an unfiltered bounded list and is an explicit performance limit, not N+1.

New INTEGRITY code: `production_state_projection_mismatch`; manager text is the task-approved message; Debug contains expected/actual/consumer. Malformed ONE OF returns explicit invalid_variant_snapshot diagnostics without arbitrary JSON payload. Reads do not repair legacy caches or persist planned.

Changed backend scope: schemas/production_state.py, schemas/technical_card.py, schemas/production_calendar.py, models/technical_card.py (view-only relation), services/production_state.py, technical_card_fact_projection.py, technical_card_stages.py, technical_cards.py, tech_card_wip.py, route_snapshot.py, route_reapply.py, route_verification.py, production_demand_snapshot.py, calendar_plan_freshness.py, production_calendar.py, production_diagnostics.py, workshop_queue.py. Tests: new test_production_state_pc_05_8.py; updated fact diagnostic contract and Calendar bounded-batch regression.

Changed frontend scope: sales/order-tech-cards-api.ts, sales/order-tech-cards.ts, production/tech-cards.ts, production/shop-stage-modules.ts, production/calendar.ts, tech-cards-workspace.tsx, tech-card-detail-workspace.tsx and production/production-state.test.mjs. PT-02 list / PT-03 Kanban patterns and existing detail layout preserved. No shell edits. Functional DTO/builder verification covers /production/tech-cards, /production/kanban and Calendar read model; browser/viewport visual verification unavailable in this session, no responsive acceptance claimed.

FULL-STRESS verification: real local PostgreSQL :5432 and actual HTTP routes with authorized test harness; 30 cards, 0 projection mismatch; actual Kanban builder 25 Design / 5 Print, 0 duplicates. All Calendar states equal list state; eligible queue current workshop matches. SQL observer: 0 INSERT/UPDATE/DELETE; hashes across 26 source/business tables unchanged; 247 FK checks, 0 orphans. Existing production facts, personalization, assignments and allocations preserved. Evidence: logs/pc-05-8/stress-proof.json, stress-list.json, stress.py, kanban.mjs.

| TK | Lifecycle | Current workshop | Kanban | Current assignment IDs | Next future assignment ID |
|---|---|---|---|---|---|
| FULL-STRESS-001-2011 (127) | in_progress | Печать | Печать | 345, 346 | 347 |
| FULL-STRESS-002-2011 (128) | planned | Дизайн | Дизайн | 111 | 114 |
| FULL-STRESS-003-2011 (129) | planned | Дизайн | Дизайн | 216 | 219 |
| FULL-STRESS-004-2011 (130) | planned | Дизайн | Дизайн | 251 | 254 |
| FULL-STRESS-005-2011 (131) | planned | Дизайн | Дизайн | 286 | 289 |
| FULL-STRESS-006-2011 (132) | planned | Дизайн | Дизайн | 181 | 184 |
| FULL-STRESS-007-2012 (133) | in_progress | Печать | Печать | 339, 340 | 341 |
| FULL-STRESS-008-2012 (134) | planned | Дизайн | Дизайн | 118 | 121 |
| FULL-STRESS-009-2012 (135) | planned | Дизайн | Дизайн | 223 | 226 |
| FULL-STRESS-010-2012 (136) | planned | Дизайн | Дизайн | 258 | 261 |
| FULL-STRESS-011-2012 (137) | planned | Дизайн | Дизайн | 293 | 296 |
| FULL-STRESS-012-2012 (138) | planned | Дизайн | Дизайн | 188 | 191 |
| FULL-STRESS-013-2111 (139) | in_progress | Печать | Печать | 333, 334 | 335 |
| FULL-STRESS-014-2111 (140) | planned | Дизайн | Дизайн | 125 | 128 |
| FULL-STRESS-015-2111 (141) | planned | Дизайн | Дизайн | 230 | 233 |
| FULL-STRESS-016-2111 (142) | planned | Дизайн | Дизайн | 265 | 268 |
| FULL-STRESS-017-2111 (143) | planned | Дизайн | Дизайн | 300 | 303 |
| FULL-STRESS-018-2111 (144) | planned | Дизайн | Дизайн | 195 | 198 |
| FULL-STRESS-019-2112 (145) | in_progress | Печать | Печать | 327, 328 | 329 |
| FULL-STRESS-020-2112 (146) | planned | Дизайн | Дизайн | 132 | 135 |
| FULL-STRESS-021-2112 (147) | planned | Дизайн | Дизайн | 237 | 240 |
| FULL-STRESS-022-2112 (148) | planned | Дизайн | Дизайн | 272 | 275 |
| FULL-STRESS-023-2112 (149) | planned | Дизайн | Дизайн | 307 | 310 |
| FULL-STRESS-024-2112 (150) | planned | Дизайн | Дизайн | 202 | 205 |
| FULL-STRESS-025-2113 (151) | in_progress | Печать | Печать | 321, 322 | 323 |
| FULL-STRESS-026-2113 (152) | planned | Дизайн | Дизайн | 139 | 142 |
| FULL-STRESS-027-2113 (153) | planned | Дизайн | Дизайн | 244 | 247 |
| FULL-STRESS-028-2113 (154) | planned | Дизайн | Дизайн | 279 | 282 |
| FULL-STRESS-029-2113 (155) | planned | Дизайн | Дизайн | 314 | 317 |
| FULL-STRESS-030-2113 (156) | planned | Дизайн | Дизайн | 209 | 212 |

Checks before final full run: first focused suite 84 PASS; new task tests 5 PASS (including terminal fact/cancelled readiness priority); corrected integration regressions 51 PASS; state/fact/queue 41 PASS; tsc PASS; actual Kanban PASS. First full project run exposed 18 backend integration regressions (944 passed); corrected and rerun (962 backend PASS, project10/10). Final review adds terminal-state regression and date-span validity; targeted26/26 PASS, final full rerun required. Frontend first full run 405 tests PASS, lint/tsc/build PASS. Final full result recorded below after completion.

Data-flow updated: DF-ROUTE-SNAPSHOT, DF-SCHEDULER-CALENDAR, DF-KANBAN-FACT, DF-DIAGNOSTICS. Project memory PM-FACT/PM-DIAGNOSTICS and UI-TK updated; IC-DI-01 evidence updated without changing invariant inventory. Generated DF/invariant HTML twins checked. Status checkboxes close only after final project PASS.

No commit/push, production apply, data cleanup, mass fact repair or stage transition. New P0/P1: none after passing final checks. Known unrelated P3: pre-existing frontend/components/settings/shop-routing-detail-workspace.tsx EOF whitespace. Remaining: owner review and browser visual verification; next iteration only on explicit selection.


Final validation: `python scripts/check_project.py` PASS 10/10; 963 backend tests, 405 frontend tests, lint/tsc/build, Alembic and Compose PASS. Final read-only FULL-STRESS proof and actual Kanban builder PASS. OpenAPI generated by project import/test execution; ProductionState and Calendar operation_state additive schema checked. Scoped diff PASS; global diff only known unrelated EOF P3. Roadmap/Project structure/ERP-check PC-05.8 closed; HTML twin synced with matching code and done=true. Data-flow updated: DF-ROUTE-SNAPSHOT, DF-SCHEDULER-CALENDAR, DF-KANBAN-FACT, DF-DIAGNOSTICS. Project memory PM-PLAN/PM-FACT/PM-DIAGNOSTICS and UI-TK/UI-CALENDAR updated. No next iteration auto-started.

PC-05.8 UNIFIED PRODUCTION STATE ACTIVE
