# PC-05.0D — Calendar Integrity Diagnostic Provenance

## Исполнитель
Codex

## Контекст
Текущий Debug diagnostic:

`started_step_without_saved_plan`

для ТК показывает:
- operation_id;
- field `production_plan`;
- общий message;

но не показывает:
- snapshot_node_id;
- фактический status/start;
- CalendarAssignment;
- причину отсутствия назначения;
- timestamp.

## Цель
Обогатить diagnostic так, чтобы Debug однозначно объяснял, почему начатая операция не имеет сохранённого плана.

## Сделать

1. Для `started_step_without_saved_plan` проследить цепочку:
`TechnicalCard snapshot node -> operation fact/status -> CalendarAssignment -> allocation`.

2. Diagnostic должен вернуть минимум:
- snapshot_node_id;
- operation_id/name;
- workshop;
- fact status;
- actual_start / started_at, если хранится;
- calendar_assignment_id nullable;
- assignment planning_mode;
- planned_start/planned_end nullable;
- manual_lock/plan_locked;
- reason_code;
- timestamp/occurred_at, если источник реально существует.

3. Если CalendarAssignment отсутствует:
указать точную причину, если её можно определить:
- never_created;
- deleted_or_detached;
- snapshot_mapping_missing;
- manual_started_without_plan;
- other_known_case.

Не угадывать неизвестную причину.

4. Добавить read-only calendar assignment summary в TechnicalCard debug/diagnostic API.
Не менять Scheduler semantics.

5. Улучшить message:
вместо общего
`требуется исправление поля Производственный план`
выдавать конкретное описание состояния.

6. Классифицировать diagnostic как `INTEGRITY`, если факт уже есть, а обязательная связь с планом отсутствует.

## Проверки
На одной проблемной ТК:
- fact node найден;
- snapshot_node_id присутствует;
- assignment state виден;
- message объясняет разрыв;
- диагностический trace совпадает с DB.

Regression:
- started + assignment exists -> no false error;
- started + no assignment -> diagnostic;
- manual/locked plan;
- snapshot mapping missing;
- backend tests;
- project check;
- git diff --check.

## Не делать
- auto-fix;
- replan;
- удаление/создание assignments;
- frontend;
- Capacity/Demand changes;
- commit/push.

## Отчёт
Коротко:
- root cause;
- какие поля добавлены;
- пример enriched diagnostic;
- tests;
- remaining gap.

Финальная строка:
`PC-05.0D CALENDAR INTEGRITY DIAGNOSTIC PROVENANCE READY`

## Отчёт выполнения — 2026-10-10

Выполнена только PC-05.0D по запросу владельца. Root cause диагностического пробела: Scheduler deviation содержал routing identity, но shared resolver сводил его к operation_id/production_plan без фактического snapshot и saved assignment evidence. У проблемной ТК факт есть, а сохранённого назначения соответствующего шага нет; причина отсутствия в истории не доказана.

Добавлен read-only `calendar_diagnostics.card_calendar_evidence` в существующий card resolver. `started_step_without_saved_plan` теперь INTEGRITY/calendar с concrete message и trace snapshot → fact → assignment mapping → allocation count. Проверяются active selected in_progress/completed operation nodes; используется прежняя Scheduler routing identity (source line или node ID), Scheduler не менялся. Проверка факта не теряется за более ранним norm/config blocker dry-run.

Safe debug_details содержат snapshot_node_id, operation_id/name, workshop_id/name, fact_status, stored started_at/actual_start, nullable calendar_assignment_id/assignment_planning_mode/planned_start/planned_end/manual_lock, plan_locked, source routing identity, reason_code, allocation_count/candidate_assignment_ids. occurred_at взят из started_at, а при отсутствии timestamp остаётся NULL; время scan не выдаётся за время события. Если same-node assignment существует, но routing mapping не соответствует шагу, reason=snapshot_mapping_missing. Если назначения и достоверной истории нет — reason=unknown; never_created/deleted_or_detached/manual_started_without_plan не угадываются.

`ProductionDiagnosticsRead.calendar_assignments` возвращает read-only summaries назначений ТК: ID/snapshot/routing/workshop/mode/date span/locks/source timestamps/allocation_count. Existing `/technical-cards/{id}/production-diagnostics` и `/platform-health/technical-cards/{id}/trace` автоматически получают один общий контракт. Platform diagnostics используют те же enriched issues. Auto/manual/locked matching assignment не создаёт ложного missing-plan error.

Реальный пример PostgreSQL: ТК id121 `STRESS_TEST-1`, snapshot867, operation6 «Дизайн», workshop1, fact=in_progress, started_at=`2026-10-10T12:58:07.505060+02:00`, calendar_assignment_id=NULL, plan_locked=false, reason_code=unknown, assignment summary=[]; trace точно совпал с node/status/time и отсутствием назначения в БД. Также найдены факты без saved plan у существующих карточек1/2/3. Данные не исправлялись. SQL observer подтвердил ноль INSERT/UPDATE/DELETE; evidence ignored `logs/pc-05-0d/db-provenance.json`.

6 новых regression cases (14 вместе с C): started без плана, identical entity/platform + read-only; started с auto/manual_adjusted/locked assignment (3 cases); missing snapshot mapping с реально сохранённым manual assignment; missing timestamp не выдумывается. Focused **14 PASS**. Full project check **10/10 PASS**, **775 backend / 384 frontend tests**; OpenAPI/Alembic/frontend/Compose included. Evidence: `logs/pc-05-0d/project-check.log`. Both generator --check and git diff --check PASS.

Изменены существующие schema/resolver, добавлены calendar evidence service/tests, обновлены DF-DIAGNOSTICS и HTML twin; canonical status updates фиксируют только D. Моделей/миграций/frontend/Capacity/Demand/Scheduler semantics изменений нет; assignments/allocations не создавались, не удалялись и не перепланировались. Новый найденный STRESS_TEST-1 не относится к удалённому ранее CAL-STRESS dataset и в этой задаче не тронут. Исходный WIP сохранён. Remaining gap: без persisted history нельзя доказать, никогда ли не создавался план или был удалён; actual_start отражает имеющийся started_at, дополнительного независимого event timestamp нет.

Data-flow updated: DF-DIAGNOSTICS, DF-SCHEDULER-CALENDAR. HTML twin synced. Новых P0/P1 дефектов реализации не обнаружено; обнаруженные integrity gaps — сохранённое состояние данных, не auto-fix scope. PC-04.4S/общий PC-05 остаются открытыми. Следующий шаг — просмотр trace владельцем и отдельно выбранная задача исправления подтверждённых данных, не автоматическое перепланирование. Commit/push не выполнялись.

PC-05.0D CALENDAR INTEGRITY DIAGNOSTIC PROVENANCE READY
