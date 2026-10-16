# PC-04.3A — Scheduler Engine Core

## Контекст
Завершены:
- PC-04.0 Scheduler Architecture
- PC-04.1 Data prerequisites
- PC-04.2 Demand contract
- PC-04.2B read-only Demand
- PC-04.2C unit alignment
- PC-04.2F cutting_method + resource links

Scheduler ещё не реализован.

Текущая модель:
- standalone TechnicalCard;
- routing / routing stage lines;
- TechOperation;
- CapacityResource;
- ResourceDemand[];
- CalendarAssignment;
- CalendarAllocation;
- planning_start_date;
- shipping_date;
- priority;
- plan_locked;
- manual_lock / planning_mode.

## Цель
Реализовать детерминированный backend Scheduler MVP, который раскладывает готовую ТК по маршруту и свободной мощности.

Frontend пока не менять.

---

## 1. Entry point

Добавить service-level scheduler и минимальный command endpoint:

`POST /technical-cards/{id}/schedule`

Допустимо иное имя по текущему API style.

На этом этапе запуск только явный:
**Пересчитать план**

Не добавлять background jobs.

---

## 2. Readiness

Перед планированием проверить:

- TechnicalCard существует;
- quantity > 0;
- routing есть;
- planning_start_date есть;
- shipping_date есть;
- plan_locked = false;
- routing steps доступны;
- Demand для обязательных шагов рассчитывается;
- CapacityResource связан;
- units совместимы.

Если обязательный шаг имеет:
- missing_input;
- manual_required;
- capacity_unit_mismatch;
- missing resource;

автоматический производственный план НЕ строить дальше.

Вернуть deviation/reason.

ТК остаётся на «Подготовке к запуску».

Не создавать ложные allocations.

---

## 3. Priority

Для будущего массового scheduler зафиксировать сортировку:

1. priority ASC, null после явных значений;
2. shipping_date ASC;
3. planning_start_date ASC;
4. created_at ASC;
5. stable id.

Для endpoint одной ТК priority пока не влияет на выбор самой ТК, но engine должен использовать совместимую структуру.

---

## 4. Route traversal

Использовать текущие routing stage lines.

Не создавать отдельный calendar route.

Для каждого обязательного шага:
1. получить TechOperation;
2. получить ResourceDemand[];
3. определить earliest start;
4. найти capacity;
5. создать CalendarAssignment;
6. создать CalendarAllocation rows;
7. передать planned_end следующему шагу.

---

## 5. Earliest start

Для первого производственного шага:

`earliest_start = planning_start_date`

Для следующего:

не раньше окончания predecessor.

Если текущая route semantics требует следующий рабочий день — использовать существующий контракт или явно задокументировать решение.

Не планировать прошлые даты автоматически.

---

## 6. Capacity by day

Для каждого CapacityResource учитывать:

- capacity_unit;
- base_rate;
- resource_count;
- hours_per_day;
- shifts_per_day;
- efficiency;
- working_days;
- exceptions;
- unavailable;
- existing CalendarAllocation.

Доступный остаток:

`available = configured_day_capacity - existing_allocations`

### Throughput
Для item / linear_meter:

`configured_day_capacity =
 base_rate × effective_resource_count × hours_per_day × shifts_per_day × efficiency`

Учитывать semantics team resource:
- packing_team resource_count=1;
- не умножать повторно на численность сотрудников.

### labor_hour
Рассчитать дневную доступную labor capacity по текущим полям ресурса.

Не смешивать разные units.

---

## 7. Horizon

Использовать:
`SCHEDULER_HORIZON_DAYS = 120`

Не искать мощность бесконечно.

Если Demand невозможно разместить в пределах horizon:
`no_available_capacity`.

Горизонт — технический предел, не deadline.

---

## 8. Daily allocation

Для каждого размещённого Demand создать `CalendarAllocation`:

- assignment_id
- resource_key
- date
- allocated_amount
- capacity_unit

Распределять остаток demand по рабочим дням до нуля.

Не превышать доступную capacity дня.

---

## 9. Multi-resource operation

Если routing step требует несколько обязательных ресурсов:

- операция должна учитывать все ResourceDemand;
- не суммировать разные units;
- allocation создаётся отдельно по каждому resource.

Для MVP выбрать понятную стратегию и задокументировать:

### Concurrent constraint
Если machine + operator относятся к одному времени выполнения:
размещать только там, где обязательные ресурсы доступны совместно.

### Sequential resources
Если route/model уже выражает их отдельными шагами — планировать как отдельные шаги.

Не придумывать скрытую последовательность внутри операции.

---

## 10. CalendarAssignment

Для каждого route step:

- technical_card_id
- routing_stage_line_id
- planned_start_date
- planned_end_date
- planning_mode = auto
- manual_lock = false
- stage/workshop fields по текущему contract
- position/order при необходимости текущего board contract

Span должен соответствовать первой и последней дате его allocations.

---

## 11. Recalculation

При повторном explicit schedule:

Scheduler может удалить/пересоздать только будущие AUTO assignments и их allocations для этой ТК.

НЕ трогать:
- прошлые assignments;
- manual_adjusted;
- locked;
- manual_lock=true;
- начатые/завершённые фактические этапы, если такой status уже существует.

Если сохранённый manual assignment конфликтует с auto plan:
вернуть deviation, а не молча двигать его.

---

## 12. Existing manually-created queue item

Текущая «Подготовка к запуску» assignment может существовать без routing_stage_line_id.

Не создавать дубль.

После успешного расчёта:
- сохранить её как entry/readiness marker по текущему контракту;
или
- завершить/заменить согласно существующей модели.

Выбрать минимальный вариант без потери текущего create-flow и задокументировать.

---

## 13. Planned completion / deadline

После успешного плана:

`planned_completion_date = planned_end_date последнего обязательного шага`

Сравнить с `shipping_date`.

Вернуть:
- on_time;
- buffer_days;
- delay_days;
- deadline_missed, если применимо.

Не изменять shipping_date.

---

## 14. Deviations

Минимальные причины:

- readiness_not_complete
- demand_calculation_missing
- manual_required
- capacity_missing
- no_available_capacity
- capacity_unit_mismatch
- locked_assignment_conflict
- deadline_missed

Не создавать отдельную ручную issue-сущность, если это можно вычислить в response.

---

## 15. Transactionality

Расчёт одной ТК должен быть атомарным.

Если обязательный шаг не удалось спланировать:
- не оставлять половину нового auto-plan;
- rollback новых auto assignments/allocations.

Существующие manual/locked данные не повреждать.

---

## 16. Dry-run

Если архитектурно просто, предусмотреть service method:

`calculate_plan(..., persist=False)`

или эквивалентный internal dry-run.

Public endpoint dry-run необязателен в этой задаче.

Главное — отделить расчёт от persistence настолько, чтобы его можно было тестировать.

---

## 17. Не делать

- не менять frontend;
- не делать drag/drop;
- не писать массовый scheduler всех ТК;
- не делать background recalc;
- не делать backward scheduling;
- не вводить ProductionJob/Batch;
- не делить одну ТК на партии;
- не добавлять новые design/operator norms;
- не подставлять missing inputs;
- не менять фактическое производство;
- не делать commit/push/merge.

---

## 18. Tests

Минимум:

### Readiness
- missing shipping_date;
- missing Demand input;
- plan_locked;
- missing capacity link.

### Capacity
- one-day allocation;
- multi-day allocation;
- existing allocations reduce free capacity;
- working day skip;
- unavailable exception;
- override exception;
- efficiency;
- 120-day horizon.

### Route
- two sequential steps;
- two steps same workshop;
- multi-resource step;
- milestone handling.

### Recalc
- auto plan replaced;
- manual_adjusted preserved;
- locked preserved;
- rollback on failure.

### Deadline
- on time;
- buffer;
- missed deadline.

### Persistence
- CalendarAssignment span matches allocations;
- allocations unique per assignment/resource/date;
- no capacity overflow.

---

## 19. Проверки

- targeted scheduler tests;
- full backend tests;
- migration не должна понадобиться;
- project check;
- git diff --check.

Если для реализации нужна новая migration — остановиться и объяснить причину, не расширять scope автоматически.

---

## Acceptance

PC-04.3A готов, если полностью рассчитываемая standalone ТК может по explicit action:

1. пройти readiness;
2. пройти route;
3. получить Demand;
4. занять доступную capacity по дням;
5. создать CalendarAssignment;
6. создать CalendarAllocation;
7. получить planned completion;
8. получить deadline status;

а ТК с missing/manual Demand не получает ложный автоматический план.

## Отчёт Codex
Указать:
- scheduler service structure;
- exact endpoint;
- capacity formula;
- treatment of multi-resource operations;
- recalc semantics;
- entry «Подготовка к запуску» behavior;
- deadline result;
- tests/checks;
- migrations;
- frontend не менялся;
- commit/push не выполнялись.

## Execution report — completed 2026-10-07

Selected PC-04.3A explicitly by the owner after the prerequisite tasks stated above. Git branch main; the pre-existing untracked task file was preserved and extended with this report.

Implemented **POST `/technical-cards/{card_id}/schedule`** (`schedule_technical_card`), requiring session + `technical_cards.create`. Readiness failures return 200/blocked with deviations, 404 for unknown card, 401/403 auth/permission, 409 integrity/concurrent-link conflicts. Response contains complete step spans and daily allocations, persisted flag, completion, on_time, signed buffer_days, delay_days and deviations. Shipping date and factual execution are not changed.

Files: new `backend/app/services/production_scheduler.py`, `repositories/production_scheduler.py`, `schemas/production_schedule.py`; command handler in `api/technical_cards.py`; new `test_production_scheduler_pc_04_3a.py` and `test_scheduler_concurrency_pc_04_3a.py`; [exact implementation contract](../architecture/production-scheduler-core-pc-04-3a.md), PC-04.0 precedence notes, this report and canonical MD/HTML twins/generator. Existing Demand adapters are reused. Models/DB tables/old API schemas unchanged; **no migration**.

Calculation is separated from persistence; `schedule_card(..., persist=False, today=...)` is internal read-only dry-run. Write commands lock the card, protected input rows and shared resources, read occupancy after locks, then calculate the whole route before deleting future replaceable AUTO rows. New rows are saved in one transaction; any readiness/horizon/lock/storage failure preserves the old plan and all manual rows. Partial plans are never committed.

Daily throughput = base_rate × effective_resource_count × hours_per_day × shifts_per_day × efficiency, less retained allocations in the same unit. Machine count=1; packing team count=1, without an extra employee multiplier. Working days, zero/unavailable dates and complete dated overrides apply. For cutters, verified selected method rates are used; the conservative MVP keeps one method rate per resource/date, deferring a different method to a later day rather than inventing a mixed item budget. Multi-resource steps allocate the minimum concurrent fraction separately in every resource's unit. Decimal demand rounded up once to 0.0001; partial shares/available amounts round down, preventing overflow and lost positive work.

First new date=max(platform today, planning_start_date); next step can reuse predecessor end_date if shared capacity remains. **Exactly 120 candidate calendar dates** for the card's new placements (through planning_from+119), not a shipping-date extension; documented override of the older PC-04.0 proposal. Existing compatible protected anchors remain intact, including historical/factual steps. Missing mapped plan for started/completed fact, ambiguous unmapped production assignment, or changed anchor demand/span yields a lock deviation. Entry launch_preparation assignment remains an unallocated marker with its original id/note/position/locks; no duplicate is created or deleted.

Deadline_missed is saved on a successful complete plan; buffer_days may be negative, delay_days is its positive inverse. No current_stage/status transition, group-date fallback, mass Scheduler, background work, backward search, new design/operator norm, ProductionJob/Batch or split.

Checks:

- **31 targeted tests passed** (Scheduler + real PostgreSQL concurrency + Demand/unit regressions).
- **601 full backend tests passed**; `python scripts/check_project.py` **10/10 / PROJECT CHECK PASSED**, including OpenAPI, SQLAlchemy/Alembic, frontend lint/typecheck/334 tests/build, Compose. Initial test fixture missed required group desired_date; fixture was corrected, final checks passed.
- Actual local PostgreSQL :5432 concurrent single-card commands against one shared resource were verified in a UUID-owned test schema: both cards persisted, on different dates, daily sum never exceeded capacity. Test schema removed; no owner card was scheduled and VPS was not used.
- Tests cover one/multiple days, same-workshop route steps, concurrent resources, exception/weekday/efficiency behavior, horizon, locks/historical/facts, missing/manual input and capacity, milestones, dry-run purity, deterministic repeat, deadline risk, rounding and rollback after injected persistence failure.
- `git diff --check`, Git status and generator `--check` passed. Roadmap/project-structure/ERP-check updated for this single backend slice. **HTML twin synced**; PC-04 queue checkpoint and the remaining calendar module stay open.

No new P0/P1 found. Existing deprecation/cache warnings unchanged. Limits: one method per shared cutting day may leave unused capacity; independent external allocation writers must use the same resource lock discipline; unavailable business norms continue to block Demand. These are documented boundaries, not guessed fallbacks. Frontend was not changed; no production apply, commit/push/merge. Recommended next iteration: separate explicit UI/command integration or additional Scheduler microtask chosen by the owner; do not auto-start it.
