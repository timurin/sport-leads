# PC-05.7 — Full Stress Test: 30 TK + Personalization

## Исполнитель
Codex

## Цель
Удалить только ранее созданные подтверждённые stress-test ТК, затем создать новый чистый dataset из 30 ТК и провести полный end-to-end stress-test. В каждой новой ТК должно быть 3–5 строк персонализации.

## Разрешённые модели
Использовать ТОЛЬКО:
- `201.1`
- `201.2`
- `211.1`
- `211.2`
- `211.3`

Распределение: по 6 ТК на каждый SKU.

Запрещено использовать другие модели, создавать fake norms/routes/resources или автоматически донастраивать модели ради зелёного теста.

## Context
Использовать:
1. task;
2. `SL-PROJECT-MEMORY-v1`;
3. только релевантные `DF-*`/invariants;
4. targeted code/API/DB.

Без repo-wide scan.

## 1. Safe cleanup
Найти ранее созданные stress-test ТК.

Разрешено удалять только записи с доказанным test origin, например:
- `MINI-STRESS-*`
- `CAL-STRESS-*`
- другие явно маркированные stress records из прошлых task/report.

Перед удалением вывести:
`prefix | count | ids`

НЕ удалять production/unknown, legacy или обычные пользовательские ТК. `STRESS_TEST-*` удалять только если происхождение безопасно доказано.

Удаление должно корректно очистить связанные:
- snapshot;
- personalization;
- assignments;
- allocations;
- queue data;
- lifecycle audit.

После cleanup — orphan/FK check.

## 2. Новый dataset
Префикс: `FULL-STRESS-`

Создать ровно 30 ТК:
- 201.1 — 6
- 201.2 — 6
- 211.1 — 6
- 211.2 — 6
- 211.3 — 6

Разнообразить реалистично:
- quantity;
- priority;
- planning_start_date;
- shipping_date;
- route variant / ONE OF только если реально поддерживается.

## 3. Персонализация
В КАЖДОЙ ТК создать 3–5 persisted строк персонализации через существующий canonical contract.

Использовать только реально существующие поля модели персонализации. Допустимые примеры, если contract их поддерживает:
- фамилия;
- имя/инициалы;
- номер;
- надпись;
- позиция/размер нанесения;
- дополнительный текст.

Не добавлять новые поля/schema.

Проверить:
- 3–5 строк в каждой ТК;
- reload/API сохраняет их;
- scheduling/replan не удаляет персонализацию.

## 4. Preflight каждой ТК
Проверить:
- Model;
- Routing;
- verified route;
- snapshot;
- Assembly Variant;
- ONE OF;
- operation volumes;
- personalization count;
- Demand;
- CapacityResource;
- WorkCenter;
- queue readiness;
- Scheduler readiness;
- diagnostics.

Таблица:
`TK | SKU | Qty | Pers.Rows | Route | Demand | Capacity | Ready/Blocked`

Если найден новый P0/P1 — остановить массовое планирование и дать blocker report.

## 5. Scheduling / Calendar
Если preflight чистый — массово спланировать 30 ТК.

Проверить:
- planned/blocked/risk;
- CalendarAssignment/Allocation;
- weekly Calendar;
- queue_position;
- Workshop queue;
- WorkCenter/shared resources;
- DAG sequential/parallel/join;
- ONE OF only selected member;
- stale-plan fingerprint;
- deadlines/ETA;
- duplicate/orphan/stale records.

Canonical:
- Calendar = план;
- Queue = порядок ожидающих работ;
- Kanban = факт.

## 6. Queue test
На одном участке с минимум 3 waiting ТК:
1. GET queue;
2. изменить порядок 3+ строк;
3. preview;
4. проверить old/new dates/ETA;
5. apply;
6. повторный GET;
7. проверить persistence;
8. проверить Calendar replan;
9. убедиться, что Kanban/current_workshop/lifecycle fact не изменились.

## 7. Personalization persistence
Минимум на 5 ТК — по одной на каждый SKU:
- DB rows присутствуют;
- API возвращает все строки;
- reload не теряет данные;
- schedule/replan не удаляет строки;
- route reapply, если разрешён и тестируется, не теряет персонализацию.

## 8. Debug log
Для каждого blocked case сохранить diagnostic:
- code;
- category;
- module;
- entity;
- field;
- expected_source;
- source_value;
- actual_value;
- reason;
- fix_action;
- lineage trace.

Если Debug export доступен — сохранить JSON в `logs/pc-05-7/`, без секретов.

## 9. Integrity
Проверить:
- FK;
- orphan snapshots;
- orphan assignments;
- orphan allocations;
- orphan personalization rows;
- duplicate queue positions;
- stale plans;
- invalid current_workshop;
- lifecycle/status consistency.

## 10. Не исправлять данные автоматически
Если SKU блокируется из-за реального отсутствия норм/маршрута — указать точное место, не создавать fake value.

Если найден platform bug — остановить тест и зафиксировать exact data-flow/invariant. Не делать broad fix внутри stress-test.

## 11. Token efficiency
Если runtime code не менялся:
- scoped project check;
- DB integrity;
- targeted API/E2E;
- git diff --check.

Full suites не запускать без code changes.

## 12. Отчёт
Не более 20 строк:
- сколько старых test TK удалено;
- 30 новых создано;
- распределение SKU;
- personalization total/min/max;
- planned/blocked;
- queue reorder result;
- Calendar result;
- diagnostics count;
- P0/P1;
- integrity verdict.

Успех:
`PC-05.7 FULL STRESS 30 TK WITH PERSONALIZATION PASSED`

При новом P0/P1:
`PC-05.7 BLOCKED — NEW P0/P1 FOUND`

Commit/push не выполнять.

## Результат — 2026-10-13

1. PC-05.7 выполнена по прямому выбору владельца; только local Docker PostgreSQL:5432. Runtime/frontend/API/models/migrations не менялись; общий stage остаётся open.
2. Cleanup:5 MINI-STRESS122–126 удалены по exact ID/name proof PC-05.4;CAL-STRESS уже отсутствуют. Prefix|count|ids выведены до удаления. STRESS_TEST-1/121 с неизвестным origin и обычные/legacy ТК сохранены; external ledger/batch/stock refs отсутствовали.
3. Удалены только test-owned35 snapshots/40 operation lines/620 unit lines/11 composition/30 edges/28 assignments/32 allocations/34 lifecycle/manifest audit events. После cleanup247 FK/0 orphans,прочие строки неизменны.
4. Новый FULL-STRESS127–156:ровно30 ТК,по6 на201.1/201.2/211.1/211.2/211.3;разные priority/planning_start/shipping dates.120 persisted personalization rows,min3/max5;Qty3–5 соответствует canonical standalone quantity=row count.
5. Personalization,size_type,size,print_number,notes — existing UnitLine contract;create/model+assembly binding/apply route/replace-unit-lines выполнены штатными services. Справочники/norms/routes/resources не менялись,fake values не добавлялись. Existing source configuration теперь обеспечивает готовность всех5 SKU.
6. Preflight Model/route1 whitelist/active Assembly/snapshot/operation volumes/Demand/Capacity/WorkCenter/verification PASS:30 Ready/0 Blocked,новых INTEGRITY/P0/P1 нет. Actual route1 —7-step chain;ONE OF/fork/join отсутствуют и не синтезировались.
7. Schedule:30 planned/0 blocked/0 shipping risk,ETA13–16 октября;30 scoped POST /technical-cards/{id}/schedule с canonical engine. Global mass endpoint не имеет ID scope и затронул бы обычные ТК,поэтому использован batch точных30 HTTP commands. Auth/Session dependencies контролируются local TestClient harness;business services/RBAC/PostgreSQL реальны.
8. Weekly Calendar API содержит все30 ТК:210 assignments/210 allocations;DAG predecessors,selected nodes,amount totals/units/dates,active physical WorkCenter и fresh saved fingerprints PASS.28 глобальных resource/date budgets в пределах capacity.
9. Design queue содержит чужую ТК6,поэтому её не переставляли. Для Print queue у5 новых test TK(по1/SKU) штатно завершён сохранённый Design — единственные5 новых test fact completions. Старые production facts не менялись.
10. Print queue GET→preview→apply→GET:5 waiting nodes reversed,30 future operations replanned,order/queue_position/audit persisted. Dates/ETA не изменились:capacity хватает на тот же день. Preview не писал plan/fact SQL;protected/unaffected assignments сохранены. Во время reorder lifecycle/current_workshop/stage facts неизменны.
11. Все120 personalization rows и IDs полностью совпадают до/после schedule/replan;DB/new Session/detail+unit-lines API reload проверены на всех30,включая5 SKU. Actual Kanban builder:30 unique cards,25 draft/Design и5 in_progress/Print,одна колонка/ТК,no DnD. Optional route reapply после personalization не выполнялся;browser visual acceptance не заявлена.
12. Debug export для FULL-STRESS сохранён без credentials/QR/session secrets;diagnostics_count=0 на новых30 ТК. Это не claim отсутствия legacy diagnostics платформы. Integrity PASS:247 FK/0 orphan snapshots/assignments/allocations/personalization,duplicate queue positions,stale plans,current-workshop/lifecycle mismatches;новыхP0=0/P1=0.
13. 26 baseline old-row tables неизменны после authorized cleanup;source/catalog/stock/sewing таблицы полностью сохранены. Scoped project check8/8 PASS:compile/import/OpenAPI/models/collector/mock/Alembic/Compose;targeted API/DB E2E PASS. Full suites не запускались по§11(runtime unchanged),новый full10/10 не заявлен.
14. Scoped git diff --check PASS. Global:прежнийP3 вне scope — frontend/components/settings/shop-routing-detail-workspace.tsx:237 new blank line at EOF,owner WIP сохранён. Warning stderr создал native shell error status для queue phase;assertions/proof завершились,последующая verify phase exit0 подтверждает результат;это не platform/test failure.
15. Roadmap/project structure/ERP-check иHTML twins синхронизированы:PC-05.7[x]↔done:true. Project memory updated;Data-flow:no changes required;invariant semantics/inventory unchanged(42;P0=0/P1=0/P2=13/P3=29). Existing DF/invariant HTML --check PASS.
16. Файлы задачи:task report,SL-PROJECT-MEMORY-v1 и5 canonical status MD/HTML;скрипты/JSON только ignored logs/pc-05-7. Evidence:inventory,cleanup,manifest,preflight,schedule-results,queue-preview,queue-after,queue-proof,verification,db-integrity,debug-export,project-static,kanban-proof JSON + canonical-docs.diff. Новые test records сохранены для review;git commit/push/VPS/production apply/stage transition не выполнялись. Следующая итерация — выбор владельца;throughput/ONE OF/parallel/visual acceptance отдельно.

PC-05.7 FULL STRESS 30 TK WITH PERSONALIZATION PASSED
