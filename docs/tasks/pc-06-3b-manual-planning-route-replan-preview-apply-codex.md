# PC-06.3B — Manual Planning Route Replan Preview / Apply

## Исполнитель
Codex

## Цель
Закрыть backend gap, выявленный в PC-06.3A.

Сейчас ручное планирование умеет менять одну строку через:

`PUT /assignments/{id}`

Но backend не умеет:
- preview последствий переноса;
- пересчитать downstream operations;
- показать новую ETA;
- оценить риск;
- безопасно применить replan маршрута.

Нужен canonical backend workflow:

`future operation + new date + mode`
→ `preview`
→ `downstream impact`
→ `ETA/risk/capacity`
→ `apply`

Frontend расчёты не добавлять.

## Context
Использовать:
- `SL-PROJECT-MEMORY-v1`
- `DF-SCHEDULER-CALENDAR`
- relevant invariant coverage
- existing Scheduler / CalendarAssignment / CalendarAllocation
- targeted planning symbols only

Без repo-wide scan.

Production core не менять.

## 1. Новый backend contract

Предпочтительно отдельные endpoints:

`POST /production-calendar/manual-planning/preview`

`POST /production-calendar/manual-planning/apply`

или эквивалент в текущем API style.

Не перегружать старый `PUT /assignments/{id}` сложной route semantics.

## 2. Preview input

Минимум:
- `technical_card_id`
- `snapshot_node_id` / assignment id
- `target_date`
- `mode`
- `revision` / fingerprint

### mode

Поддержать:

`single`
- перенос только выбранной future operation;
- разрешать только если dependencies остаются валидными.

`downstream`
- перенос выбранной operation;
- безопасно пересчитать все зависимые future operations.

Если `single` нарушает DAG/capacity:
- preview должен вернуть blocker;
- не делать silent cascade.

## 3. Preview output

Вернуть:
- selected operation old/new date;
- affected assignments;
- downstream operations;
- old ETA;
- new ETA;
- shipping date;
- old/new slack;
- risk before/after;
- capacity warnings;
- dependency warnings;
- blockers;
- plan revision/fingerprint;
- apply_allowed.

Для каждой affected operation минимум:
- snapshot_node_id
- operation name
- workshop
- old start/end
- new start/end
- work_center/resource, если назначено
- reason for shift

## 4. Replan semantics

Backend должен использовать существующие scheduler semantics:
- snapshot DAG;
- sequential dependencies;
- explicit parallel;
- ONE OF selected branch;
- duration;
- capacity;
- WorkCenter/resource allocation;
- current date/work calendar.

Не создавать отдельный frontend planner.

### Защита факта

Нельзя переносить:
- completed;
- in_progress.

Нельзя изменять:
- production fact;
- current_workshop;
- Kanban state;
- Queue fact semantics.

Только future plan.

## 5. Apply

Apply разрешён только если:
- preview был успешным;
- `apply_allowed=true`;
- revision/fingerprint совпадает;
- plan не изменился после preview.

Apply атомарно:
1. обновляет affected CalendarAssignments;
2. обновляет/пересоздаёт CalendarAllocations;
3. сохраняет audit;
4. обновляет persisted ETA/planning summary;
5. не меняет production fact.

При stale preview:
- HTTP 409;
- manager-friendly reason;
- требуется новый preview.

## 6. Capacity behavior

Если target date перегружена:
- Preview не должен молча сохранять невозможный план;
- вернуть warning или blocker согласно существующим capacity rules;
- affected resource/work center;
- load/available capacity, если contract это уже поддерживает.

Не придумывать новые capacity semantics.

## 7. ETA / risk

После preview/apply рассчитывать через существующую canonical planning logic:
- ETA;
- shipping date;
- slack;
- risk.

Не дублировать расчёт.

После apply TechnicalCard persisted planning summary должен совпадать с Calendar.

## 8. Audit

Переиспользовать plan lifecycle audit.

Для apply сохранить:
- actor;
- selected node;
- mode;
- old/new dates;
- affected nodes;
- revision.

Не логировать secrets.

## 9. Tests

Минимум:
1. future single move valid -> preview/apply PASS;
2. single move violates dependency -> blocker;
3. downstream move -> dependent future operations shift;
4. parallel branch unaffected unless dependency requires;
5. ONE OF unselected branch not planned;
6. in_progress cannot move;
7. completed cannot move;
8. stale revision -> 409;
9. capacity conflict reported;
10. apply updates assignments + allocations atomically;
11. ETA changes consistently;
12. Calendar reflects new plan;
13. Kanban/current_workshop unchanged;
14. Queue fact unchanged;
15. no orphan assignments/allocations.

## 10. Safe E2E data

Использовать safe test card на разрешённом SKU:
- 201.1
- 201.2
- 211.1
- 211.2
- 211.3

Не менять production facts 157/158/159.

Допустимо создать отдельную planning-only test card.

## 11. Frontend contract handoff

В финальном отчёте явно дать Cursor contract:
- preview endpoint;
- apply endpoint;
- payload;
- response;
- error codes;
- supported modes.

Frontend patch не делать в этой задаче.

## 12. Не делать

- новый Scheduler;
- Kanban/Queue refactor;
- Calendar redesign;
- Capacity redesign;
- warehouse/fulfillment changes;
- Dashboard;
- commit/push.

## Acceptance

Готово, если:
1. есть server preview;
2. есть atomic apply;
3. downstream replan рассчитывается backend;
4. ETA/risk обновляются;
5. fact защищён;
6. stale preview защищён;
7. allocations consistent;
8. новых P0/P1 нет.

Финальная строка:

`PC-06.3B MANUAL ROUTE REPLAN PREVIEW/APPLY READY`

## Implementation report — 2026-10-16

Selected PC-06.3B explicitly by owner to close the backend gap described by PC-06.3A. Backend-only iteration; no next task/stage started. Canonical Cursor handoff: [manual-planning-route-replan-pc-06-3b.md](../architecture/manual-planning-route-replan-pc-06-3b.md).

Shipped: POST /production-calendar/manual-planning/preview and /apply with existing authenticated session and technical_cards.create permission. Request: technical_card_id,snapshot_node_id,target_date,mode(single/downstream); initial preview may omit revision to bootstrap it, apply requires returned revision+preview_fingerprint. Preview returns selected old/new dates, affected operations/allocations/workshops/resources, effective descendants, old/new ETA/slack/risk, warnings/blockers, plan and authoritative apply_allowed. No SQL/savepoint/ORM mutation on preview. Conflict409 includes detail.message/diagnostic and X-Diagnostic-Code/Category; codes manual_replan_changed/protected/dependency/capacity/blocked. Missing session401,permission403,card404,input422. Exact capacity date cannot silently shift; single cannot cascade. Late but otherwise valid plans expose a shipping risk warning.

Implementation files: new backend/app/schemas/manual_route_replan.py, services/manual_route_replan.py, tests/test_manual_route_replan_pc_06_3b.py; API wiring in api/production_calendar.py; existing production_scheduler._build adds only the optional not_before_by_node lower bound. Existing selected snapshot/DAG, Demand,duration,WorkCenter/machine alternatives,capacity/work calendars,120-date horizon,protected anchors and persist_plan/retirement are reused. Old PUT /assignments/{id} unchanged. No models/migration/new planner/frontend patch. Production fact/core,Kanban/current workshop,Queue fact/order,materials,quantity,readiness,fulfillment,warehouse,Dashboard unchanged.

Future scope: pending unstamped non-fact-bearing selected node, neither current representative nor DAG-ready node, with nonpast original/target dates; dependent pending same-workshop node may qualify. Plan lock/explicit locked and terminal/fact rows cannot move. Selected manual_adjusted can be explicitly superseded; other manual/past/locked/protected rows are anchors. Apply pins selected date as manual_adjusted/manual_lock, preserves queue_position, atomically replaces affected assignments/allocations, writes existing lifecycle events and actor audit production_calendar.manual_route_replanned with node/mode/old-new/affected/revision. Shared persisted summary immediately agrees with Calendar. No artificial production execution or read-side repair.

Tests:13 new cases cover valid single/read-only preview, dependency blocker/no cascade, downstream ETA changes, in_progress/completed guards, capacity conflict, stale inputs/replay409, atomic rollback after plan writes, independent parallel branch/assignment/allocation preservation, selected-only ONE OF,re-moving an explicit manual adjustment, actual API401/403/409, and real PostgreSQL concurrency (two commands,one applied/one manual_replan_changed).58 targeted new+existing queue/Scheduler/summary cases passed. Existing Scheduler commands are unaffected when the new optional constraint is absent.

Safe E2E: newly created planning-only PC063B-PLAN-20261016-1,id162,SKU201.2,quantity4,route/assembly from existing allowed configuration; no source configuration changes. New test data retained with manifest and origin note. Actual local API/RBAC/services/PostgreSQL, existing auth/session dependency harness only:7 original operations planned;preview0 SQL writes and26 table hashes unchanged;downstream moves6 operations,ETA2026-10-23->2026-10-26,slack15->12,still on time;apply200,replay409. Detail persisted ETA and Calendar agree. All earlier rows in26 source/business tables,including157/158/159 and stock/sewing/catalogs,unchanged. New card quantity/personalization/materials/operation lines/snapshot/stage statuses/current workshop/production lifecycle unchanged by apply;249 FKs/0 orphans. Evidence ignored logs/pc-06-3b/live-proof.json,live_e2e.py,manifest.json. No live changes to production facts.

Data-flow updated: DF-SCHEDULER-CALENDAR including index. PM-PLAN and IC-SC-04/05 scoped/atomic coverage updated;42-row invariant risk inventory unchanged. Existing frontend remains PC-06.3A until Cursor integrates this handoff;no UI/visual verification required for this backend-only iteration. Remaining/recommended next iteration: Cursor wiring of preview,impact display,apply and re-fetch;do not implement frontend ETA calculations. No commit/push or production apply.

Required full project check10/10 PASS:1015 backend/450 frontend,lint/tsc/build,OpenAPI/Alembic/Compose. NewP0/P1:none found in checked scope;global and scoped git diff --check PASS. Roadmap/ERP-check/project-structure matching PC-06.3B marked done,HTML twins done:true in the same iteration;PC-06.1B remains open. HTML twin synced.
