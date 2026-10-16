# IC-G04 — Invalidate Stale Plan on Demand Change

## Исполнитель
Codex

## Источник
PC-05.2 `SL-INVARIANT-COVERAGE-v1`

## Priority
P1

## Контекст
После IC-G01–G03 остаётся P1: уже сохранённый календарный план может стать устаревшим после изменения входных данных, влияющих на Demand.

Критичный пример:
`TechnicalCard.quantity` изменился → operation volume / sewing labor / Demand изменились → старые CalendarAssignment/Allocation могут остаться рассчитанными под прежний объём.

## Цель
Не допускать использования stale plan после изменения данных, влияющих на Demand.

## Targeted data-flow
Использовать только:
- `DF-TK-OPERATION-VOLUME`
- `DF-SEWING-DEMAND`
- `DF-PRINT-DEMAND`
- `DF-CUTTING-DEMAND`
- `DF-DEMAND-CAPACITY`
- `DF-SCHEDULER-CALENDAR`
- `DF-DIAGNOSTICS`

Не читать весь `SL-DATA-FLOW-v1`.

## Найти реальные Demand inputs
По коду определить все persisted inputs, изменение которых способно изменить Demand/ETA, минимум проверить:
- TechnicalCard.quantity;
- route operation norm / copied snapshot norm;
- assembly variant / sewing durations / multiplicity;
- ONE OF selected member;
- manual operation volume, если поддерживается;
- другие реально используемые Demand inputs.

Не расширять список догадками.

## Инвариант
Если после сохранения плана меняется input, влияющий на Demand:

### Future/unstarted operation
- текущий plan помечается `stale` / `replan_required` существующим canonical механизмом либо минимальным новым полем;
- старый plan не должен считаться актуальным;
- Scheduler должен потребовать/rebuild plan до использования.

### in_progress/completed operation
- нельзя молча пересчитать или заменить исторический plan/fact;
- изменение, которое нарушает факт, блокируется либо обрабатывается существующей fact-safe semantics.

## Detection
Предпочтительно использовать deterministic fingerprint/version:

`demand_input_fingerprint`

или эквивалент существующей архитектуры.

Нужно уметь сравнить:
- inputs, под которые сохранён assignment;
- текущие effective inputs.

Не сравнивать только quantity, если Demand зависит от большего набора данных.

## Diagnostics
Добавить/уточнить:

`calendar_plan_stale_after_demand_change`

Category:
`DATA_FLOW` или `INTEGRITY` согласно принятому diagnostic contract.

Показывать:
- TK;
- snapshot node / operation;
- assignment id;
- changed input(s);
- previous value/fingerprint;
- current value/fingerprint;
- old demand;
- current demand, если безопасно вычисляется;
- `replan_required`;
- fix_action: `Пересчитать производственный план`.

## Replan
После успешного replan:
- stale state очищается;
- assignment/allocation соответствуют текущему Demand;
- lifecycle audit фиксирует replan;
- IC-G03 guards должны пройти.

## Existing data audit
Проверить существующие сохранённые планы на stale state, насколько это возможно из текущих данных.

Не выполнять массовый auto-fix.

Исторические записи без достаточных данных:
- report as unverifiable/legacy;
- не угадывать старый Demand.

## Tests
Минимум:
- quantity change after plan -> stale/replan required;
- operation norm change/reapply -> stale future plan;
- ONE OF change -> stale future plan;
- sewing demand input change -> stale future plan;
- replan clears stale state;
- unchanged inputs -> plan remains valid;
- started/completed fact is not silently replanned;
- allocation amount after replan matches current Demand;
- diagnostic identifies changed input.

## Data-flow update
Если semantics изменены:
обновить релевантные `DF-*` sections и HTML twin согласно AGENTS.md.

## Проверки
- targeted tests;
- backend full tests;
- frontend only if DTO/read model minimally touched;
- project check;
- DB integrity;
- git diff --check.

## Не делать
- broad Scheduler rewrite;
- массовый replan;
- fake Demand data;
- UI redesign;
- commit/push.

## Отчёт
Коротко:
1. какие Demand inputs реально влияют на plan;
2. как определяется stale;
3. guard/invalidation locations;
4. diagnostics;
5. existing data findings;
6. tests;
7. следующий P1 backlog item.

Финальная строка:
`IC-G04 STALE PLAN INVALIDATION PROTECTED`

## Результат IC-G04 — 2026-10-11

Выбран IC-G04 по прямому заданию владельца, после завершённого IC-G03. Итерация ограничена актуальностью сохранённого плана; IC-G05/IC-G06 и переход стадии не начаты.

Причина дефекта: сохранённые assignment/allocation доказывали привязку и сумму, но не входную ревизию. Quantity, manual volume, live time norm или мощность могли измениться, а execution gate продолжал принимать старое назначение. Новый dry-run не доказывал актуальность уже сохранённого плана.

1. **Реальные входы.** Используются существующие Demand adapters: consumed quantity, принятые operation volume/unit/method, explicit time rule/duration, matched sewing duration × multiplicity из order-item snapshot либо live standalone assembly, effective selected node/dependencies/ONE OF. Для ETA отдельно учитываются card planning constraints, выбранный ресурс/оборудование, capacity mode/unit/count/hours/shifts/efficiency/working days/used rates и overrides в сохранённом диапазоне. Неиспользуемые machine alternatives/rate fields и изменения названий не создают stale. Frozen model/route norms не становятся live: изменение master без reapply не меняет принятый вход. Формулы, Decimal и округление IC-G03 сохранены.
2. **Хранение и stale.** `calendar.assignment_created` в существующем AuditEvent хранит `demand_input_snapshot` version1, SHA256 канонических inputs и исходный Demand. Scheduler передаёт ключи реально выбранных resources до вставки allocations. Состояние stale/replan_required вычисляется сравнением с текущими inputs; отдельной status table/cache нет. Смена future inputs сохраняет прежний план для review, но исполнение запрещено. Явный успешный AUTO replan заменяет assignments/allocations атомарно и пишет новый stamp плюс существующий lifecycle replan. Retirement после route reapply/ONE OF требует новой успешной generation; сопоставление старых/новых узлов не угадывается.
3. **Guards.** `calendar_plan_freshness.py`; `calendar_plan_lifecycle.assert_saved_plan` покрывает start/fact/complete/reopen/QR/WIP; Scheduler не переиспользует stale manual/past/fact anchors. `demand_input_guard.py`, зарегистрированный в FastAPI startup module, отслеживает узкий перечень ORM input writers, берёт scheduler transaction lock и после flush отклоняет consumed drift для started/completed saved facts. Исключение требует rollback: SQL DML может быть выполнен до отклонения, но входы, факт, план, allocations и audit не сохраняются. Direct SQL/bulk SQL вне ORM guard; legacy facts без saved assignment не получают выдуманную input revision.
4. **Diagnostics/контракт.** Shared card/platform resolver: `calendar_plan_stale_after_demand_change`, DATA_FLOW для future / INTEGRITY для protected fact. TK/node/op/assignment, changed input groups, previous/current inputs и fingerprint, old/current Demand, replan_required, fix_action «Пересчитать производственный план». HTTP409 сохраняет string detail + diagnostic headers; публичная DTO shape не менялась. Legacy без stamp: `legacy_inputs_unverifiable`, old Demand/fingerprint=NULL и changed_inputs=[], без выдуманного изменения. Для retired mapping current fingerprint/Demand=NULL. Чтение не записывает данные.
5. **Existing data audit.** Только local Docker PostgreSQL localhost:5432, read-only transaction, 0 SQL writes/0 repairs.3 assignments:2 mapped legacy/unverifiable — TK6/node139/assignment12 и TK25/node146/assignment21;1 unbound queue marker.11 ранее известных фактов без плана остаются unknown. Исторические входы не восстанавливались, auto-fix/backfill/mass replan не выполнялись. Подробности: `logs/ic-g04/plan-audit.json`.247 FK проверены,0 orphan references (`db-integrity.json`). Эта проверка локальных legacy данных не является приёмкой production.
6. **Проверки.**15 новых регрессий: quantity/current totals, explicit norm, manual meter volume, live sewing duration/multiplicity, ETA drift при неизменном Demand, route/ONE OF retirement, metadata/fresh plan, legacy uncertainty, started/completed rollback, replan clearing и lifecycle.281 targeted PASS;896 backend PASS;391 frontend PASS; `scripts/check_project.py`10/10 PASS (OpenAPI, Alembic drift, lint/tsc/tests/build, Compose). Data-flow и invariant HTML generators --check PASS; git diff --check PASS. Первый полный прогон выявил два устаревших ожидания в тестах ONE OF/manual anchor: обновлены на stale/replan_required и atomic blocked reuse; последующая полная проверка прошла. Existing lint warnings/dependency deprecations и локальное pytest cache warning не маскировались, вне этой итерации не исправлялись. Evidence: `logs/ic-g04/project-check.log`, `targeted.log`.
7. **Файлы.** Новые services `calendar_plan_freshness.py`, `demand_input_guard.py`; integration `main.py`, `calendar_plan_lifecycle.py`, `production_scheduler.py`, repository `production_scheduler.py`, `production_diagnostics.py`; новый `test_calendar_plan_freshness_ic_g04.py`, уточнены invariant/explicit-norm/scheduler-scenarios tests. Обновлены семь DF sections/index + HTML, invariant matrix + HTML, ADR-017/025, текущий task report, root roadmap/project-structure/ERP и их HTML twins. Models/persistence columns/migrations: отсутствуют. Frontend/UI: изменений этой задачи нет; прежний WIP сохранён.
8. **Severity и canonical sync.** IC-OV-05/IC-SW-04: covered/P3; матрица P0=0/P1=2/P2=13/P3=26. Оставшиеся P1: IC-RS-01 completeness (IC-G05), IC-RS-05 destructive operation deletion (IC-G06). Новых P0/P1 в завершённом scope не обнаружено; legacy unverifiable требует отдельного review/явного решения по плану. Только IC-G04 отмечен выполненным, owner review pending; общая стадия не закрыта. **HTML twin synced**. Canonical git diff: `logs/ic-g04/canonical-docs.diff`.

Data-flow updated: DF-TK-OPERATION-VOLUME, DF-SEWING-DEMAND, DF-PRINT-DEMAND, DF-CUTTING-DEMAND, DF-DEMAND-CAPACITY, DF-SCHEDULER-CALENDAR, DF-DIAGNOSTICS.

Рекомендуемая следующая итерация: IC-G05 — completeness metadata/validation применённой версии, без сравнения с latest template. Не начата. Commit/push не выполнялись.

IC-G04 STALE PLAN INVALIDATION PROTECTED
