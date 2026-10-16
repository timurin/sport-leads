# IC-G02 — Protect Saved Plan Linkage

## Исполнитель
Codex

## Источник
PC-05.2 `SL-INVARIANT-COVERAGE-v1`

## Priority
P1

## Проблема
После закрытия IC-G01 остаётся P1-класс: сохранённый производственный план может потерять связь между snapshot-операцией, `CalendarAssignment` и `CalendarAllocation` при изменениях ТК/маршрута/плана.

Это приводит к состояниям, которые потом диагностируются как:
- assignment отсутствует;
- assignment существует, но не привязан к актуальному snapshot node;
- allocation остаётся orphan/stale;
- fact/status и сохранённый план расходятся.

## Цель
Защитить целостность связей:

`TechnicalCardStageResult`
→ `CalendarAssignment`
→ `CalendarAllocation`

для всех допустимых операций перепланирования и обновления ТК.

## Targeted data-flow
Использовать только:
- `DF-ROUTE-SNAPSHOT`
- `DF-SCHEDULER-CALENDAR`
- `DF-DIAGNOSTICS`

Не читать весь `SL-DATA-FLOW-v1`.

## Инварианты

### 1. Assignment ownership
Каждый активный `CalendarAssignment` должен:
- принадлежать одной ТК;
- ссылаться на существующий snapshot node;
- соответствовать актуальной операции этого node.

### 2. Allocation ownership
Каждый `CalendarAllocation` должен:
- принадлежать существующему assignment;
- не переживать удаление/замену assignment;
- соответствовать ресурсу/WorkCenter этого плана.

### 3. Replan
При replan:
- существующий assignment либо обновляется/заменяется через контролируемый lifecycle;
- старые allocations не остаются orphan/stale;
- новый assignment сохраняет корректный snapshot mapping;
- lifecycle audit фиксирует replacement/replan.

### 4. Snapshot changes
Изменение будущих snapshot nodes:
- не должно оставлять assignment на удалённый node;
- не должно перепривязывать assignment к другой операции только по совпадению position/order.

### 5. Fact protection
Для `in_progress/completed` node:
- assignment mapping не должен теряться;
- удаление/отвязка без явного разрешённого сценария блокируется.

## Preflight / guards
Перед операциями, которые могут изменить plan mapping:
- проверить существование snapshot node;
- проверить соответствие operation_id;
- проверить наличие активного assignment;
- проверить allocations;
- проверить fact status.

При нарушении возвращать контролируемый conflict/diagnostic, а не оставлять повреждённое состояние.

## Diagnostics
Добавить/уточнить diagnostics для:
- `calendar_assignment_snapshot_mismatch`
- `calendar_assignment_missing_snapshot`
- `calendar_allocation_orphan`
- `calendar_assignment_operation_mismatch`

Category:
`INTEGRITY`

Diagnostic должен показывать:
- technical_card_id;
- snapshot_node_id;
- operation_id;
- assignment_id;
- allocation ids/count;
- expected mapping;
- actual mapping;
- recommended action.

## Repair existing data
Не выполнять массовый auto-fix.

Разрешено:
- найти существующие нарушения;
- вывести точный список;
- исправить только явно тестовые записи, если это безопасно и подтверждено.

Все производственные/неизвестные записи — только report.

## Tests
Минимум:
- normal schedule -> valid mapping;
- replan -> no orphan allocations;
- future snapshot change -> stale assignment removed/rebound correctly;
- started node mapping cannot disappear;
- assignment cannot point to wrong operation;
- delete assignment removes/detaches allocations consistently;
- diagnostic catches intentionally corrupted fixture;
- lifecycle audit remains consistent.

## Data-flow update
Если semantics меняются:
обновить:
- `DF-SCHEDULER-CALENDAR`
- `DF-ROUTE-SNAPSHOT`
- `DF-DIAGNOSTICS`

Синхронизировать HTML twin.

## Проверки
- targeted tests;
- backend full tests;
- project check;
- DB integrity / orphan scan;
- git diff --check.

## Не делать
- Scheduler rewrite;
- массовый repair;
- frontend changes;
- Capacity/Demand changes;
- commit/push.

## Отчёт
Коротко:
1. найденные P1 gaps;
2. guard locations;
3. какие invalid states теперь невозможно создать;
4. existing data findings;
5. diagnostics added/changed;
6. tests;
7. следующий P1 backlog item.

Финальная строка:
`IC-G02 SAVED PLAN LINKAGE PROTECTED`

## Отчёт выполнения — 2026-10-11

Выбрана IC-G02, следующий P1 после выполненной IC-G01, прямо назначенный владельцем. Следующий backlog item не запускался.

Найденные gaps: manual delete не проверял факт; manual save мог очистить routing identity при сохранении прежнего snapshot; удаление/replacement template lines оставляло активные detached assignments с allocations; queue/планирование полагались на routing identity без полной проверки snapshot ownership; низкоуровневый add_allocation допускал allocation на entry marker. Старый lifecycle audit фиксировал потерю связи, но не запрещал её.

Общая защита — `backend/app/services/calendar_plan_linkage.py`. Проверяются same-card node, frozen source identity/workshop и operation evidence из canonical assignment_created audit. Сравнение с текущей операцией live template не применяется: законный edit master не переписывает snapshot. Физический WorkCenter должен принадлежать цеху плана; существующие unscoped/nonphysical shared resources и explicit M:N cross-workshop links сохранены. Нормы Capacity/Demand, amounts, даты и единицы не пересчитываются этой задачей.

Guard locations: manual remove/save; lifecycle snapshot/source-line retirement; template replacement/deletion и graph removal preflight; variant old-plan retirement; delete_auto_plan/persist_plan; single/queue scheduler input preflight; add_allocation; saved-plan start/fact gate. Применён порядок scheduler lock → card/assignment locks. Весь retirement batch проверяется до audit/DELETE. Начатый/завершённый и иной подтверждённый факт защищает mapping. Корректный future plan удаляется вместе с allocations; `assignment_detached` сохраняет previous mapping и new_state=NULL, затем `assignment_deleted`. Replacement/replan сохраняет historical IDs и прежний lifecycle. В рамках этих paths активный assignment на удалённый future node не остаётся, position/order не используется для rebinding.

Новые некорректные состояния через проверенные writers: нельзя удалить/отвязать fact plan, вручную сменить его snapshot operation/workshop, назначить allocations bare queue marker, записать proposed plan на чужой node или physical WorkCenter другого цеха. Scheduler/queue блокируют структурно повреждённый существующий план до удаления occupancy; не исправляют его автоматически. Entry/workshop queue markers без operation identity и allocations остаются маркерами, а не объявляются scheduled operations. Legacy без audit evidence не получает выдуманную историческую operation identity; гарантии для произвольного SQL не заявляются.

Diagnostics: INTEGRITY `calendar_assignment_snapshot_mismatch`, `calendar_assignment_missing_snapshot`, `calendar_assignment_operation_mismatch`, `calendar_allocation_orphan`. Shared card/platform resolver показывает card/node/op/assignment, allocation IDs/count, expected/actual mapping и recommended action; orphan owner остаётся NULL. Generic Scheduler duplicate заменяется подробным diagnostic. HTTP409 сохраняет строковый detail и добавляет X-Diagnostic-Code/Category; глобальный handler покрывает calendar/template APIs, existing technical-card handler — card/variant APIs. Frontend и DTO не изменены; новые DB models/миграции не требуются.

Existing data findings — local localhost:5432, read-only, SQL writes0:

| technical_card_id | snapshot nodes без saved plan | operation IDs | reason |
|---|---|---|---|
| 1 | 99,100,101,102,103,104 | 1,2,8,3,4,5 | unknown |
| 2 | 105,106,107 | 6,1,2 | unknown |
| 3 | 112 | 6 | unknown |
| 121 / STRESS_TEST-1 | 867 | 6 | unknown |

У этих11 исторических fact diagnostics assignment отсутствует, allocation_count0; scope старта по-прежнему standalone B, legacy/контур A не превращается автоматически в новый scheduled plan. Новых четырёх-code linkage violations0; FK/orphan scan:247 ссылок, orphan refs0. Полный current read_health:67 diagnostics (CONFIGURATION25/DATA_FLOW22/INTEGRITY20), включая9 уже существующих IC-G01 template conflicts. Ни производственные, ни неизвестные, ни явно тестовые локальные записи не исправлялись. Exact details: ignored `logs/ic-g02/local-health.json`.

Изменены: новый linkage service; интеграции в calendar_plan_lifecycle, production_calendar, calendar_allocations, production_scheduler, production_queue_scheduler, route_variants, shop_routings, routing_graph_write, production_diagnostics, platform_health и scheduler repository; main conflict handler и technical-card HTTP mapper. Добавлен `backend/tests/test_calendar_plan_linkage_ic_g02.py` (30 сценариев). Обновлены PC-05.1B provenance fixtures, IC-SC-04 gap-proof и PC-04.1 legacy/storage fixtures под подтверждённый snapshot contract. Никакой invalid state в local/VPS данными тестами не создавался.

Проверки:183 targeted passed; full backend858 passed; frontend390 passed; project check10/10 (OpenAPI/Alembic/lint/tsc/test/build). Alembic: no new upgrade operations. Data-flow/invariant/production-calendar generators --check и git diff --check passed. Проверки, вызванные изменённым контрактом: прежний PC-04.1 fixture ожидал move без snapshot — теперь409; parallel/join test подтвердил сохранение nonphysical cross-workshop M:N sharing. Это устранённые code/test failures; final required checks проходят. Остались только existing dependency/cache deprecation warnings, без маскировки failures.

P0 IC-G01 regression сохранён. P1 IC-SC-04 закрыт на covered service paths; matrix41 invariants: P0=0/P1=6/P2=13/P3=22. Даты/unit allocations — IC-G03, input/Demand revision — IC-G04, frozen completeness — IC-G05, destructive TechOperation deletion — IC-G06 остаются отдельными открытыми задачами. Destructive unrelated model/assembly binding требует отдельного review. P2/P3 попутно не исправлялись. Следующая рекомендуемая итерация — IC-G03, не запускалась.

Data-flow updated: DF-ROUTE-SNAPSHOT, DF-SCHEDULER-CALENDAR, DF-DIAGNOSTICS. Invariant matrix и ADR-017/025 обновлены. Roadmap/Project structure/ERP-check: IC-G02 выполнен, owner review pending; matching MD[x]/HTML done:true проверены. HTML twin synced. Общие PC-05/PC-04.4S и stage transition не закрывались. Commit/push и массовый repair не выполнялись; существующий WIP сохранён. Evidence: ignored `logs/ic-g02/project-check.log`, `targeted.log`, `db-integrity.json`, `local-health.json`, `canonical-docs.diff`.

IC-G02 SAVED PLAN LINKAGE PROTECTED
