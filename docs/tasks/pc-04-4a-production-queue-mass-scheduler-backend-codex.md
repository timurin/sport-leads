# PC-04.4A — Production Queue & Mass Scheduler Backend

## Контекст
Завершены:
- PC-04.3A Scheduler Engine Core
- PC-04.3B Scheduler UI Integration
- PC-04.3C Scheduler Scenario Validation

Single-card Scheduler проверен:
- route sequencing;
- CalendarAssignment;
- CalendarAllocation;
- shared CapacityResource;
- deadlines;
- manual/locked protection;
- repeated recalculation;
- atomic persistence.

Следующий этап — массовое планирование нескольких standalone TechnicalCard.

## Цель
Реализовать backend mass scheduler, который строит будущий production plan сразу для всех готовых к автоматическому планированию ТК.

Frontend пока не менять.

## 1. Entry point
Добавить explicit command endpoint, например:

`POST /production-calendar/schedule`

или эквивалент по текущему API style.

Назначение:
**Пересчитать производственный план**

Не запускать автоматически и не добавлять background jobs.

## 2. Какие ТК участвуют
В массовое планирование входят только TechnicalCard, которые:
- существуют;
- имеют planning_start_date;
- имеют shipping_date;
- quantity > 0;
- имеют routing;
- plan_locked = false;
- могут пройти readiness;
- не завершены / не закрыты по текущему production status;
- не имеют причины, запрещающей автоматическое планирование.

Standalone flow остаётся основным.

Lead / SalesOrder не участвуют.

## 3. Сортировка очереди
Использовать deterministic order:
1. `priority ASC`, explicit values first;
2. `shipping_date ASC`;
3. `planning_start_date ASC`;
4. `created_at ASC`;
5. stable `technical_card.id`.

`priority = null` идёт после любого явного priority.

Меньший priority = выше.

## 4. Общий принцип
Mass scheduler должен планировать ТК последовательно в порядке очереди.

Каждая следующая ТК видит CalendarAllocation, уже занятые предыдущими ТК этого же запуска.

То есть:
- ТК A занимает capacity;
- ТК B получает только остаток;
- ТК C получает остаток после A+B.

Shared resources должны учитываться глобально.

## 5. Rebuild future auto-plan
При запуске массового пересчёта можно удалить/пересоздать только будущие assignments/allocations с:
- planning_mode = auto;
- manual_lock = false;
- относящиеся к участвующим ТК.

НЕ трогать:
- manual_adjusted;
- locked;
- manual_lock=true;
- завершённые;
- начатые фактически;
- прошлые даты;
- plan_locked TechnicalCard.

Очистка и новый расчёт должны происходить атомарно.

## 6. Readiness failures
ТК с:
- manual_required;
- missing_input;
- capacity_missing;
- capacity_unit_mismatch;
- missing routing;
- readiness_not_complete

не должны останавливать весь mass schedule.

Они:
- пропускаются;
- получают result status `blocked`;
- reason/deviations возвращаются в summary.

Остальные ТК продолжают планироваться.

## 7. Capacity conflicts
Если конкретная ТК не помещается в horizon:
- status = blocked / no_available_capacity;
- уже успешно спланированные ТК сохраняются;
- следующая ТК может продолжить расчёт, если это возможно.

Но внутри одной ТК план должен быть атомарным:
- либо её auto-plan полностью сохранён;
- либо не сохранён.

## 8. Deadline
Deadline не должен автоматически блокировать план.

Если ТК можно разместить, но planned_completion > shipping_date:
- план сохранить;
- status = planned;
- deviation = deadline_missed;
- delay_days вернуть.

## 9. Priority override effect
Проверить ключевой сценарий:

До:
- TK-A priority 20
- TK-B priority 10

После mass schedule:
TK-B должна занимать общий ресурс раньше TK-A при одинаковой доступности.

После изменения priority и повторного schedule:
будущий auto-plan должен перестроиться согласно новой очереди.

Manual/locked данные при этом не двигаются.

## 10. Existing single-card scheduler
Не дублировать алгоритм.

Mass scheduler должен переиспользовать существующий PC-04.3A engine/service.

Желательно:
- shared planning engine;
- отдельная orchestration layer для batch.

Single-card endpoint должен продолжить работать.

## 11. Result contract
Вернуть summary.

Минимально:
- status;
- total_cards;
- planned_cards;
- blocked_cards;
- deadline_missed_cards;
- preserved_cards;
- results[];

Для каждой ТК:
- technical_card_id;
- technical_card_number;
- priority;
- status;
- planned_completion_date;
- on_time;
- buffer_days;
- delay_days;
- steps_count;
- deviations[].

Если backend already has equivalent DTO — reuse.

## 12. Bottleneck summary
Если это можно сделать без большого scope, вернуть вычисляемую сводку ресурсов:
- resource_key;
- allocated;
- available/configured;
- utilization;
- affected_cards.

Это read-only result.

Не создавать отдельную analytics table.

Если это требует большой новой логики — отложить и отметить в отчёте.

## 13. Concurrency
Mass schedule должен быть защищён от конкурентного запуска.

Использовать текущую стратегию транзакций/locking.

Проверить:
- два одновременных mass schedule не создают двойные allocations;
- single-card schedule во время mass schedule не портит capacity.

Если нужна advisory/db lock — использовать минимально и описать.

## 14. Horizon
Использовать существующий:
`SCHEDULER_HORIZON_DAYS = 120`

Не менять.

## 15. Не делать
- не менять frontend;
- не добавлять automatic/background scheduling;
- не добавлять cron;
- не делать backward scheduling;
- не вводить ProductionJob/Batch;
- не делить ТК на партии;
- не добавлять новые Demand norms;
- не менять UI priority;
- не делать drag/drop;
- не делать commit/push/merge.

## 16. Tests
Минимум:

### Queue order
- explicit priority;
- null priority after explicit;
- equal priority -> shipping_date;
- stable tie ordering.

### Shared capacity
- two cards one resource;
- three cards one resource;
- remaining capacity respected.

### Recalc
- priority change reorders future auto-plan;
- old auto allocations replaced;
- manual/locked preserved.

### Blocked cards
- one blocked does not stop others;
- missing_input;
- no_available_capacity.

### Deadline
- missed deadline still planned.

### Concurrency
- two mass schedule requests;
- mass + single-card schedule.

### Persistence
- no duplicate allocations;
- no capacity overflow;
- deterministic repeated schedule.

## 17. Проверки
- targeted mass scheduler tests;
- full backend tests;
- project check;
- git diff --check.

Миграция не должна понадобиться.
Если понадобится — остановиться и описать причину.

## Acceptance
PC-04.4A готов, если одним explicit action backend может:
1. выбрать готовые ТК;
2. отсортировать их по priority/deadline;
3. построить будущий auto-plan;
4. учесть shared capacity;
5. сохранить allocations/assignments;
6. пропустить blocked ТК без остановки остальных;
7. показать deadline risks;
8. сохранить manual/locked планы;
9. детерминированно перестроить план после изменения priority.

## Отчёт Codex
### Выполнение 2026-10-07 — PC-04.4A закрыта

Реализован `POST /production-calendar/schedule`, без body; session + permission `technical_cards.create`. Orchestration: `backend/app/services/production_queue_scheduler.py`; общий engine/persistence в `production_scheduler.py`, queue selection/locks в repository; новые summary DTO в `schemas/production_schedule.py`. Single-card endpoint сохраняет прежний контракт.

Выбираются standalone draft/in_progress ТК. Неготовые и plan_locked возвращаются blocked с причинами; completed/cancelled и SalesOrder не участвуют. Порядок: priority ASC/null last, shipping/start/created/id ASC. Меньший explicit priority получает мощность первым.

Одна внешняя транзакция: общий rebuild будущего AUTO-плана, последовательный расчёт/flush, сохранение полных успешных планов. Если blocked ТК имела очищенный AUTO-план, SAVEPOINT rollback восстанавливает его; оставшаяся очередь рассчитывается с его занятостью. Manual/locked/fact/past/plan_locked/entry защищены. SQL-ошибка откатывает всю команду. PostgreSQL advisory transaction lock `704044001` общий для mass и single и берётся до row locks. Dry-run не блокируется.

Summary: status empty/planned/partial/blocked; total/planned/blocked/deadline_missed/preserved_cards; results в порядке очереди с id, stored number, priority, planned/blocked, persisted/preserved, completion/on_time/buffer/delay/steps_count/deviations. Preserved count пересекается с planned/blocked; entry marker сам по себе не считается preserved production plan. [Полный контракт](../architecture/production-queue-scheduler-pc-04-4a.md) фиксирует точные правила и границы.

Проверен priority override: TK2 priority10 занимает60 item, TK1 priority20 получает40 в тот же день; после TK1 priority1 порядок меняется, TK1 занимает60 первой, TK2 получает40. Третья null-priority ТК использует остатки следующих дней; общий Demand220, каждый дневной total≤100. Повтор детерминирован, старые AUTO allocations не занимают мощность повторно. Blocked TK2 со старым планом100 сохраняет первый день, TK1 переносится на следующий — подтверждено SQLite и PostgreSQL.

Bottleneck summary отложена: нужна отдельная точная агрегация дат/exceptions/методов раскроя. Приближённая сводка и analytics table не добавлены. Сохраняются ограничения PC-04.3A по одному cutting method rate на resource/day и locks для внешних allocation writers.

Frontend, модели и миграции не менялись; прежний незакоммиченный WIP сохранён. Тесты работают только на isolated fixtures и UUID-схемах локального PostgreSQL :5432; пользовательские планы/VPS не затронуты. Commit/push/merge, production apply, background/cron/jobs/batches/split не выполнялись.

Проверки: 55 targeted tests (mass/core/scenarios/PG concurrency) passed, `logs/pc-04-4a-targeted.log`; дополнительно новый PostgreSQL replay regression —1 passed, `logs/pc-04-4a-replay.log`. Полный `python scripts/check_project.py` —10/10, PROJECT CHECK PASSED: 631 backend tests (до добавления последнего replay test) и 340 frontend tests, OpenAPI/models/Alembic/Compose/lint/tsc/build. Новый replay тест также выполнен отдельно на итоговом коде. Лог: `logs/pc-04-4a-project-check.log`. `git diff --check` и генератор roadmap HTML `--check` прошли. Известные warnings dependency/cache/lint не маскировались; новых P0/P1 не найдено, P2/P3 вне scope не исправлялись.

Файлы этой итерации: API production_calendar.py; shared services/repository/schema production_scheduler/production_schedule; новый production_queue_scheduler.py, два файла queue-тестов; новый architecture contract, уточнение single-core locking, этот отчёт; canonical roadmap/project-structure/ERP-check, HTML twins и generator. Закрыта только PC-04.4A; исторический PC-04 и полный календарь остаются открытыми. **HTML twin synced**. Следующая итерация — выбранная владельцем frontend-интеграция queue command или следующий отдельный микротаск; автоматически не начата.

Указать:
- exact endpoint;
- orchestration structure;
- selection rules;
- sorting;
- transaction/locking strategy;
- summary response;
- concurrency checks;
- tests/checks;
- migrations;
- frontend не менялся;
- commit/push не выполнялись.
