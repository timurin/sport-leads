# PC-06.3F — Production Planning Health Read Model

## Исполнитель
Codex

## Цель
Создать единый canonical backend read model состояния производственного плана (`Planning Health`), который будет использоваться:

- карточкой ТК / единым блоком маршрута;
- ручным планированием;
- позже общим Production Dashboard.

Не создавать отдельную бизнес-логику в каждом UI.
Production core не менять.

## 1. Общий принцип

Нужен один backend contract:

`Route snapshot + CalendarAssignments + planning summary + production fact`
→ `PlanningHealth`

Он должен отвечать на вопросы:

- план актуален или требует пересчёта;
- есть ли просроченные неначатые операции;
- какая операция просрочена первой;
- сколько дней просрочки;
- есть ли риск даты отгрузки;
- текущая ETA;
- запас до отгрузки;
- сколько операций completed / in_progress / pending;
- какой current workshop;
- какая следующая future operation.

Frontend только отображает эти данные.

## 2. TechnicalCard planning health DTO

Добавить/расширить read model минимум:

- `technical_card_id`
- `planning_state`
- `replan_required`
- `eta`
- `shipping_date`
- `slack_days`
- `on_time`
- `risk_level`
- `current_workshop_id`
- `current_workshop_name`
- `route_total_operations`
- `completed_operations`
- `in_progress_operations`
- `pending_operations`
- `has_overdue_operations`
- `overdue_operation_count`
- `earliest_overdue_operation`
- `earliest_overdue_workshop`
- `earliest_overdue_date`
- `overdue_days`
- `next_operation`
- `next_operation_date`

Если подходящие поля уже есть в нескольких DTO — не плодить дубль, а выделить общий canonical schema/service.

## 3. Каноническое определение просрочки

Операция считается overdue, если одновременно:

- snapshot operation status = pending/waiting;
- production fact отсутствует;
- operation planned date < current planning date;
- operation не completed;
- operation не in_progress;
- operation не skipped/cancelled, если такие состояния существуют;
- TechnicalCard не completed/shipped.

Дата в прошлом сама по себе не делает operation protected.
Использовать тот же timezone/date contract, что Calendar.

## 4. Earliest overdue operation

Для одной ТК вернуть:

- count всех overdue pending operations;
- самую раннюю operation;
- workshop;
- planned date;
- overdue_days.

Если несколько имеют одинаковую дату — использовать route/snapshot order как tie-breaker.

## 5. Risk / ETA

Использовать существующий persisted planning summary.
Не пересчитывать ETA отдельной новой формулой.

Если существующий backend уже имеет risk enum — переиспользовать его.
Не создавать ещё одну несовместимую risk taxonomy.

## 6. Planning state

Нормализовать для consumers:

- `not_planned`
- `actual`
- `stale`
- `invalid`
- `completed`

или использовать существующие значения, если contract уже канонический.

`replan_required=true` только когда план реально требует пересчёта.
Completed production не должна считаться stale из-за невозможности нового запуска.

## 7. Operation health summary

Для unified route UI желательно вернуть для каждой snapshot operation/read item:

- `snapshot_node_id`
- `operation_name`
- `workshop_name`
- `operation_status`
- `planned_start`
- `planned_end`
- `is_overdue`
- `overdue_days`
- `is_protected`
- `can_replan`
- `warning_code` / presentation-neutral reason if needed

Не превращать DTO в новый Scheduler.
Это read-only projection существующих фактов и плана.

## 8. Consumers

### TechnicalCard
Единый блок `План производства / Маршрут` получает:
- ETA;
- shipping;
- slack;
- risk;
- overdue summary;
- route progress;
- operation states.

### Manual Planning
Список ТК получает:
- overdue;
- risk;
- replan_required;
- ETA/shipping/slack;
- earliest overdue operation.

Фильтры:
- Просроченные
- В риске
- Требуют перепланирования
- Без проблем

не должны считать бизнес-логику на frontend.

### Future Production Dashboard
Тот же contract должен быть пригоден как источник агрегирования, но Dashboard сейчас не реализовывать.

## 9. API

Предпочтительно:

`GET /technical-cards/{id}/planning-health`

и list-level projection для manual planning.

Если текущий endpoint ручного планирования уже возвращает TK summaries — расширить его теми же canonical fields.

Не заставлять frontend делать N+1 запрос planning-health для списка, если можно вернуть summary одним list endpoint.

## 10. Tests

Минимум:

1. pending yesterday -> overdue=true;
2. pending today -> overdue=false;
3. future pending -> overdue=false;
4. in_progress old date -> not overdue;
5. completed old date -> not overdue;
6. multiple overdue -> correct count + earliest;
7. ETA/shipping/slack from persisted plan;
8. ETA > shipping -> risk/late correctly;
9. stale plan -> replan_required;
10. actual plan -> replan_required=false;
11. completed production -> completed health, no fake overdue;
12. shipped -> no active planning warning;
13. operation `can_replan` matches manual planning guards;
14. no DB writes from read model;
15. list summary and detail health agree.

## 11. Safe E2E data

Использовать planning-only test cards, в том числе:
- `PC063D-OVERDUE-20261016-1` / id 163, если существует;
- другие test cards только на разрешённых SKU:
  - 201.1
  - 201.2
  - 211.1
  - 211.2
  - 211.3

Не менять production facts 157/158/159.

## 12. Frontend handoff

В финальном отчёте дать Cursor:

- detail planning-health DTO;
- list summary DTO;
- field names;
- risk/planning state enum values;
- overdue semantics;
- example responses.

Frontend patch в этой задаче не делать.

## 13. Docs

Если contract становится canonical:
- update `SL-PROJECT-MEMORY-v1`;
- update `DF-SCHEDULER-CALENDAR`;
- update invariant coverage if needed;
- HTML twin sync.

Roadmap менять только если milestone реально меняется.

## Не делать

- UI redesign;
- Scheduler refactor;
- Kanban/Queue changes;
- readiness semantics changes;
- warehouse/fulfillment changes;
- Production Dashboard;
- commit/push.

## Acceptance

Готово, если один backend contract позволяет без frontend business calculations показать:

1. актуальность плана;
2. ETA / shipping / slack / risk;
3. просроченные operations;
4. earliest overdue operation;
5. overdue days;
6. progress маршрута;
7. current/next operation;
8. can_replan/protected state;
9. одинаковые значения в TechnicalCard и Manual Planning.

Финальная строка:

`PC-06.3F PRODUCTION PLANNING HEALTH READ MODEL READY`

---

## Implementation report — 2026-10-17

Selected item: PC-06.3F, explicitly requested by owner. It fills the PC-06.3E/3G backend gap without advancing roadmap stage or changing production core.

Delivered authenticated GET /technical-cards/{id}/planning-health and GET /production-calendar/manual-planning/cards (limit1–500, offset≥0). Canonical PlanningHealthSummary underlies detail and slim list. Summary includes normalized state, replan_required, persisted ETA/shipping/slack/on_time/existing risk taxonomy, overdue count/earliest/date/days, selected-route counts/current/next, has_planning_issues. Detail alone adds operations with protection/eligibility. No frontend patch or migration.

Changed implementation files:

- backend/app/schemas/planning_health.py — summary/detail/operation/slim list contracts.
- backend/app/services/planning_health.py — scoped read-only batch projection, fixed query count.
- backend/app/services/manual_replan_guards.py — existing protection predicate shared by read and command.
- backend/app/services/manual_route_replan.py — delegates unchanged predicate and existing risk classification.
- backend/app/services/persisted_plan.py — optional preloaded assignments; unchanged ETA formula, shared risk helper.
- backend/app/services/route_reapply.py — optional preloaded ledger/stock/sewing facts for unchanged fact protection.
- backend/app/api/technical_cards.py, production_calendar.py — authenticated read endpoints.
- backend/tests/test_planning_health_pc_06_3f.py —21 cases; combined50 targeted cases passed with3B/3D/06.2.

Models/contracts: additive DTO/API; existing command payloads, ProductionState and PersistedPlanSummary enums preserved. Health enum not_planned/actual/stale/invalid/completed; risk unknown/on_time/late. can_replan is guard eligibility, not a promise of capacity/date feasibility. actual can coexist with overdue/replan_required; terminal production suppresses active attention. No new risk or ETA formula. No changes to Scheduler, Kanban, queue, readiness, fulfillment or warehouse semantics.

Safe local E2E: read existing planning-only163 PC063D-OVERDUE-20261016-1 (SKU201.2) through actual routes/services/local PostgreSQL5432 with existing auth/session harness. Detail/list agree;5 overdue pending, earliestOct14/3days, persisted ETAOct30/shippingNov6/slack7. Zero SQL writes; all rows in26 source/business tables unchanged (including157/158/159, stock, sewing, catalogs);249 FK checks,0 orphans. No test card created, plan moved or production fact changed. Evidence ignored logs/pc-06-3f/live_read.py and live-proof.json.

Checks: targeted50 passed. Initial .venv test collection lacked argon2 (local dependency); system Python used by project checks succeeds. Two initial test fixture combinations violated existing planning-mode/manual-lock constraint; fixtures corrected to canonical valid combinations, no database constraint relaxed. Full check result is recorded below after completion.

Documentation: Cursor handoff [production-planning-health-pc-06-3f.md](../architecture/production-planning-health-pc-06-3f.md) includes all DTO fields, enums, overdue/terminal/eligibility semantics and full actual detail/list examples. Updated PM-PLAN and DF-SCHEDULER-CALENDAR; invariant coverage adds read-only evidence,42 inventory/risk rows unchanged. Data-flow updated: DF-SCHEDULER-CALENDAR. HTML twins regenerated.

Roadmap: changes not required (no milestone/stage transition). Project structure checklist: changes not required. ERP-check: changes not required. Their pre-existing MD/HTML changes are preserved. No UI/template/shell changes or visual verification required for backend-only scope.

P0/P1: none discovered in this iteration. P2/P3: none introduced; existing environment/deprecation warnings do not change acceptance. Commit/push not performed. Remaining work / recommended next iteration: owner/Cursor adopts this contract in TechnicalCard and Manual Planning; no frontend business calculations or per-row detail requests. No next task auto-started.

Final validation: python scripts/check_project.py reports PROJECT CHECK PASSED,10/10 OK,0 failed checks;1047 backend and480 frontend tests passed, lint/tsc/build, OpenAPI/Alembic/Compose passed. Full log logs/pc-06-3f/project-check.log. PowerShell wrapped initial Python stderr INFO as NativeCommandError and returned1 for the wrapper despite successful project-check summary; this is output redirection behavior, not a failing project check. Both generated HTML checks and global git diff --check pass. HTML twin synced (13 DF/42 invariants). Required canonical-doc git diff saved logs/pc-06-3f/canonical-docs.diff; this iteration did not change roadmap/project-structure/ERP-check or their twins. Existing unrelated WIP preserved.

PC-06.3F PRODUCTION PLANNING HEALTH READ MODEL READY
