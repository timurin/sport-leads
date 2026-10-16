# PC-05.4 — Mini Stress Test: 5 Technical Cards

## Исполнитель
Codex

## Цель
После закрытия всех P0/P1 выполнить минимальный end-to-end stress-test на 5 ТК до запуска полного теста на 30 ТК.

## Разрешённые модели
Использовать ТОЛЬКО модели футболок с артикулами:

- `201.1`
- `201.2`
- `211.1`
- `211.2`
- `211.3`

Создать ровно по одной тестовой ТК на каждый артикул.

Запрещено:
- использовать любые другие модели;
- подбирать замену, если одна модель не готова;
- создавать fake norms/routes/resources;
- автоматически донастраивать модель ради зелёного теста.

Если конкретная модель не проходит preflight — зафиксировать точную причину и продолжить анализ, но не подменять модель.

## Context
Использовать:
1. task;
2. `SL-PROJECT-MEMORY-v1`;
3. только релевантные `DF-*`/invariants;
4. targeted code/API/DB.

Не делать repo-wide scan.

## Dataset
Префикс:
`MINI-STRESS-`

Создать:
- `MINI-STRESS-2011`
- `MINI-STRESS-2012`
- `MINI-STRESS-2111`
- `MINI-STRESS-2112`
- `MINI-STRESS-2113`

Количество и сроки должны отличаться, но оставаться реалистичными.

Примерно:
- small;
- medium;
- large;
- tight deadline;
- normal deadline.

Не использовать экстремальные значения, не соответствующие реальной эксплуатации.

## Preflight для каждой ТК
Проверить:

- Model;
- Routing;
- verified route state;
- snapshot;
- ONE OF selection, если есть;
- Assembly Variant;
- operation volumes;
- Demand;
- CapacityResource;
- WorkCenter;
- Scheduler readiness;
- diagnostics.

До планирования вывести краткую таблицу:

`TK | SKU | Qty | Route | Snapshot | Demand | Capacity | Ready/Blocked`

## Scheduling
Планировать только ТК, прошедшие preflight.

Проверить:

- CalendarAssignment;
- CalendarAllocation;
- DAG order;
- parallel/join semantics;
- ONE OF — только selected member;
- shared resource load;
- WorkCenter selection;
- ETA;
- shipping/deadline risk;
- stale-plan fingerprint;
- no orphan/stale allocations.

## Debug Center
Для каждого blocked case сохранить exact diagnostic:

- code;
- category;
- entity;
- field;
- expected source;
- source value;
- actual value;
- reason;
- fix action.

Не исправлять business data автоматически.

## Acceptance
Мини-тест считается успешным, если:

1. все 5 ТК созданы на разрешённых SKU;
2. ни одна другая модель не использована;
3. каждый блокер объясняется Debug Center;
4. нет новых P0/P1 invariant violations;
5. успешные ТК корректно попали в Calendar;
6. no orphan refs;
7. no invalid allocations;
8. production facts не затронуты.

## Если найден новый P0/P1
Остановить дальнейшее расширение теста.

Не запускать 30-TK stress test.

Сформировать короткий blocker report с exact invariant/data-flow.

## Если тест чистый
В отчёте явно написать:

`READY FOR 30-TK STRESS TEST`

Это будет разрешением на следующий этап.

## Existing data
Не удалять:
- production/unknown TK;
- legacy records;
- STRESS_TEST-*;
- CAL-STRESS-*.

Разрешено удалять только созданные в рамках этой задачи `MINI-STRESS-*`, если требуется повторить тест.

## Проверки
- targeted tests only if bug reproduced/fixed;
- project check;
- DB integrity/orphan scan;
- git diff --check.

Не запускать full suite без изменения runtime code.

## Не делать
- runtime fixes без отдельного отчёта;
- P2/P3 cleanup;
- broad audit;
- commit/push.

## Отчёт
Не более 15 строк:
- 5 SKU/status;
- planned/blocked counts;
- diagnostics;
- new P0/P1 count;
- DB integrity;
- verdict: ready/not ready for 30-TK test.

Финальная строка при успехе:
`PC-05.4 MINI STRESS 5 TK PASSED — READY FOR 30-TK STRESS TEST`

## Результат — 2026-10-12

| TK / SKU | Qty | Status / ETA |
|---|---:|---|
| MINI-STRESS-2011 /201.1 |20| Blocked:missing_linear_meters — печать и термоперенос |
| MINI-STRESS-2012 /201.2 |60| Planned:2026-10-13 |
| MINI-STRESS-2111 /211.1 |120| Planned:2026-10-14 |
| MINI-STRESS-2112 /211.2 |180| Planned:2026-10-13,tight deadline2026-10-15 |
| MINI-STRESS-2113 /211.3 |240| Planned:2026-10-16 |

1. Exactly5 approved SKU cards, IDs122–126; existing sorted whitelist route1 and one active assembly per model. All snapshots verified; preflight table emitted before planning. No substitute models/fake norms/routes/resources/config changes. Created via canonical standalone/model-binding/reapply services; exact names assigned only to task-owned new cards. Records retained for review.
2.4 planned/1 blocked;28 CalendarAssignment/32 CalendarAllocation confirmed by persisted canonical Calendar board DTO. Actual7-step explicit chain: DAG predecessor dates, selected nodes, exact allocation units/totals/date bounds/resources, active physical WorkCenter choice and fresh audit fingerprints PASS.21 global shared resource/day budgets within capacity. All four ETA before shipping; no deadline-missed case. ONE OF/fork/join absent in the real selected route, so these branches were not exercised or synthesized.
3.201.1 exact Debug diagnostics:code missing_linear_meters/category CONFIGURATION/entity technical_card122/field volume/expected_source technical_card.volume/source_value=NULL/actual_value=NULL/reason missing_linear_meters/fix_action Review technical_card.volume and save the verified input. Operations1/2, resources epson01_9300/work_center_2. Raw shared DTO and operation volumes preserved in preflight.json; no input invented to turn the card green.
4. New P0/P1=0, no invalid/orphan/stale allocations.23 relevant existing source/fact/plan table row snapshots unchanged; existing stock/sewing ledger counts unchanged; all5 new stage snapshots remain pending. Production/unknown, legacy, STRESS_TEST and CAL-STRESS records not deleted or replanned. Only the new group/cards/snapshots/units and four owned plans/audit events were created in local Docker PostgreSQL:5432; no VPS access.
5.247 FK/0 orphans, scoped existing project checks8/8 PASS (compile/import/OpenAPI/models/collector/mock/Alembic drift/Compose), git diff --check and existing DF/invariant HTML --check PASS. Runtime unchanged, so no targeted bug tests or full backend/frontend suites run, as explicitly required by this task; this is not a claim of a new full10/10 run. No runtime/schema/migration/UI change or repair. Scripts/artifacts are ignored logs/pc-05-4.
6. Evidence:inventory.json,preflight.json,plans.json,verification.json,calendar-board.json,calendar-read-proof.json,db-integrity.json,project-static.json. Root roadmap/project structure/ERP and HTML checkpoint synced once, memory state updated. Data-flow: no changes required. Invariant semantics: no changes required. **HTML twin synced**; canonical diff logs/pc-05-4/canonical-docs.diff. Overall stage not closed; no commit/push.
7. READY FOR 30-TK STRESS TEST — clean mini integrity result with one explained business configuration blocker; not a claim that every model or every branch is production-ready.30-TK expansion not started in this iteration.

PC-05.4 MINI STRESS 5 TK PASSED — READY FOR 30-TK STRESS TEST
