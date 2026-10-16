# PC-05.1B — Calendar Plan Lifecycle Audit + Start Invariant

## Исполнитель
Codex

## Контекст
Global Debug Center выявил нарушение целостности:

`STRESS_TEST-1`
- snapshot node: 867
- operation: Дизайн
- fact status: `in_progress`
- `CalendarAssignment`: отсутствует
- `CalendarAllocation`: 0
- diagnostic: `started_step_without_saved_plan`
- `reason_code`: `unknown`

Диагностика видит разрыв, но не знает, как он возник.

## Цель
1. Добавить минимальный audit жизненного цикла плана.
2. Запретить незаметный `in_progress` без сохранённого плана для планируемой операции.
3. Безопасно восстановить только `STRESS_TEST-1`, если это тестовая запись без реального факта.

## 1. Lifecycle audit
Добавить canonical audit/events:

- `assignment_created`
- `assignment_replanned`
- `assignment_detached`
- `assignment_deleted`
- `operation_started`
- `operation_completed`

Хранить минимум:
- technical_card_id
- snapshot_node_id
- tech_operation_id
- calendar_assignment_id nullable
- event_type
- occurred_at
- actor/source
- previous_state nullable
- new_state nullable
- reason/details safe for diagnostics

Не делать тяжёлый event-sourcing.

## 2. Start invariant
Для операции, участвующей в календарном планировании:

нельзя переводить snapshot node в `in_progress`, если отсутствует валидный `CalendarAssignment`.

Исключение только для явно поддержанного режима `manual_unplanned_start`.

Если такого режима в контракте нет — не добавлять silently, а блокировать start.

Diagnostic:
- code: `cannot_start_without_saved_plan`
- category: `INTEGRITY`

Message:
операция не может быть запущена, пока для неё не сохранён производственный план.

## 3. Existing state repair
Для `STRESS_TEST-1` сначала подтвердить:
- это тестовая ТК;
- нет реального производственного факта;
- нет связанного реального учета/выпуска.

Если подтверждено:
- безопасно сбросить ложный `in_progress` в предыдущее допустимое состояние;
- не менять маршрут/snapshot;
- не трогать другие ТК;
- перепланировать только эту ТК;
- проверить создание `CalendarAssignment`.

Если подтверждение невозможно:
- данные не менять;
- только report.

## 4. Diagnostic provenance
Обогатить `started_step_without_saved_plan`:
- последнее lifecycle event;
- event timestamp;
- actor/source;
- assignment_id, если был;
- точный `reason_code`, если выводим из audit.

Не угадывать неизвестную причину.

## 5. Data-flow / invariants
Обновить:
- `DF-SCHEDULER-CALENDAR`
- `DF-DIAGNOSTICS`

Добавить invariant:

`planned operation -> saved CalendarAssignment -> start fact`

И правило: lifecycle audit должен позволять определить точку разрыва.

Синхронизировать HTML twin.

## 6. Regression tests
Минимум:
- planned op + assignment -> start allowed;
- planned op without assignment -> start rejected;
- completed flow writes lifecycle events;
- replan writes event;
- delete/detach writes event;
- diagnostic uses audit when available;
- legacy broken row without audit остаётся `unknown`.

## 7. Проверки
- backend tests;
- migration upgrade/downgrade, если нужна;
- project check;
- DB integrity;
- git diff --check.

## Не делать
- broad reset;
- массовое исправление всех ТК;
- Scheduler rewrite;
- frontend changes;
- fake assignment creation;
- commit/push.

## Отчёт
Коротко:
1. root cause for STRESS_TEST-1 if established;
2. repaired or not and why;
3. audit model/event storage;
4. new start invariant;
5. diagnostic before/after;
6. updated DF chains;
7. tests.

Финальная строка:
`PC-05.1B CALENDAR PLAN LIFECYCLE AUDIT AND START INVARIANT READY`

## Отчёт выполнения — 2026-10-11

Выбрана только PC-05.1B по прямому запросу владельца после PC-05.1A. Перехода roadmap stage и запуска следующей задачи нет; исходный WIP на main сохранён.

1. **Root cause.** Подтверждён дефект исполнения: card/stage start, implicit start через fact/complete/reopen и QR/WIP могли записать in_progress без проверки сохранённого назначения. Создание/перепланирование/удаление/отвязка назначений не оставляли canonical lifecycle evidence. Какая именно историческая команда привела к STRESS_TEST-1/node867, установить нельзя: достоверного audit этой операции нет. Never-created/deleted/manual-start не приписываются задним числом.

2. **STRESS_TEST-1 не исправлена и не перепланирована.** Local PostgreSQL localhost:5432: card121, standalone group104/STRESS_TEST, quantity210, node867/operation6 «Дизайн» in_progress; assignments0/allocations0. Нет связанных stock documents/stock ledger, production batch links, specification output или sewing ledger; performer/work_done/duration/scrap/rework/completed_at и material fact_qty пусты, FG receipt/issue/scrap/transfer flags всех210 units не выставлены. Однако одна штука уже имеет production_stage_id=1, остальные209 — NULL. Отдельного достоверного признака test-only/no-real-start нет; имени STRESS_TEST и отсутствия учётных документов недостаточно для безопасного сброса этого факта. Применена предусмотренная задачей ветка «Если подтверждение невозможно: данные не менять; только report». Маршрут, snapshot, unit locations, план и остальные ТК не менялись. SQL observer при проверке зарегистрировал0 INSERT/UPDATE/DELETE. Evidence: ignored logs/pc-05-1b/inspection.json.

3. **Canonical audit storage.** Использована существующая модель/table AuditEvent/audit_events по ADR-025; новых моделей, store, endpoints или migration нет. Entity calendar_plan_lifecycle/card ID; action calendar.assignment_created/replanned/detached/deleted, calendar.operation_started/completed. Safe payload хранит technical_card_id, snapshot_node_id, tech_operation_id, nullable historical calendar_assignment_id, previous_state/new_state и reason; строка — UTC occurred_at, actor ID/login и source. Actor берётся из authenticated session или явного service actor; system commands имеют NULL actor. Events записываются вместе с успешной мутацией; rollback/dry-run не сохраняют audit. Before/after и старые IDs сохраняются при AUTO replan, manual CRUD, смене ONE OF, удалении template line и explicit snapshot reapply. Исторические IDs в JSON переживают FK detachment/deletion. Existing audit.read API позволяет читать эти events.

4. **Start invariant.** planned operation -> saved CalendarAssignment -> start fact. Граница следует реальному Scheduler: операции standalone-контура B (order_group_id задан, sales_order_id=NULL, snapshot.tech_operation_id задан). Контур A пока не поддерживается календарным Scheduler, а workshop-only/FG markers не являются планируемыми операциями; существующий A-flow сохранён. Для B отсутствие norm/resource links не отменяет gate. Нужен assignment той же ТК/current snapshot/scheduler routing identity/workshop с корректным date span; entry marker не подходит. Auto/manual_adjusted/locked подходят при валидной привязке. Проверены card/stage start, fact update, completion из pending, оба reopen, QR current/destination и WIP implicit transitions. Manual_unplanned_start не добавлен. Отказ HTTP409: строковый detail «Операция не может быть запущена, пока для неё не сохранён производственный план.» сохраняет совместимость текущего frontend; X-Diagnostic-Code=cannot_start_without_saved_plan, X-Diagnostic-Category=INTEGRITY. Calendar CRUD использует общий Scheduler advisory lock; QR использует scheduler/card locks и проверяет планы до unit/material/ledger mutation. WIP следует active_stage_results, чтобы не запускать/не требовать план для исключённых ONE OF alternatives.

5. **Diagnostic before/after.** started_step_without_saved_plan сохраняет общий read-only resolver. Проверяется current snapshot/workshop binding, а не только routing ID. last_lifecycle_event содержит audit ID/type/time, actor/source, historical assignment ID/reason и safe before/after. Последнее подтверждённое assignment_deleted/assignment_detached даёт точный reason_code; creation/start без доказательства исчезновения не превращается в выдуманную причину. Текущий calendar_assignment_id остаётся NULL при удалённом назначении, historical ID находится в audit provenance. Legacy без audit остаётся unknown; same-node invalid binding без causal audit — snapshot_mapping_missing. У STRESS_TEST-1 после итерации тот же legacy issue/unknown; новый start отклоняется cannot_start_without_saved_plan/INTEGRITY. На регрессионном start->delete примере вместо unknown видны assignment_deleted, время, source=calendar_api и ID удалённого назначения. Диагностика не выполняет repair/replan.

6. **Data-flow updated:** DF-SCHEDULER-CALENDAR, DF-DIAGNOSTICS; зависимые DF-KANBAN-FACT (QR/WIP/start consumers), DF-ROUTE-SNAPSHOT (detach before snapshot/template deletion), DF-ONE-OF (variant plan removal/effective WIP route). Обновлены индекс и ADR-025 action catalog; HTML twin регенерирован и --check PASS. **HTML twin synced.**

7. **Проверки.** 25 новых regression cases PASS: planned/missing/invalid bindings, implicit start paths, start-complete-reopen events, replan before/after, manual move/detach/delete, actual service template-line replacement, legacy unknown, transactional rollback/dry-run, actor/safe payload, HTTP error compatibility, QR rejection without unit mutation, WIP и selected ONE OF. Полный scripts/check_project.py **10/10 PASS**, **800 backend / 388 frontend tests**, OpenAPI/Alembic/schema/frontend lint/tsc/test/build/Compose included. Final targeted lifecycle + provenance31 PASS; после проверки размещения audit в service layer lifecycle + routing27 PASS. Local DB integrity: **247 FK references checked,0 orphans,0 SQL writes**. git diff --check и оба generator --check PASS. Миграция не нужна; Alembic сообщает No new upgrade operations detected. Evidence ignored logs/pc-05-1b/project-check-final.log, focused-final.log, db-integrity.json. Ранний запуск pytest из backend без root PYTHONPATH упёрся в импорт scripts.seed_sales_dev (config invocation); исправлен каноническим PYTHONPATH/check_project, suite проходит. Existing lint/deprecation/cache warnings не маскировались; новых ошибок нет.

**Изменённые файлы этой итерации:**

- Backend API/auth: app/api/deps_auth.py, technical_cards.py, tech_card_scan.py.
- Backend services: calendar_plan_lifecycle.py (new), calendar_diagnostics.py, production_calendar.py, production_scheduler.py, shop_routings.py, route_variants.py, routing_graph_write.py, technical_card_stages.py, technical_cards.py, tech_card_scan.py, tech_card_wip.py. Audit и domain rules остаются в services; repository layer не получает audit business rules.
- Tests: test_calendar_plan_lifecycle_pc_05_1b.py (new), test_route_variants_pc_04_4i.py (existing variant audit assertion scoped to its domain; added lifecycle removal evidence).
- Docs/status: этот task report; ADR-025; SL-DATA-FLOW-v1.md/HTML; roadmap.md/HTML; project-structure.md/HTML; erp-check.md; roadmap-v1.1.md/HTML; production-calendar-v0.1.md/HTML; scripts/generate_production_calendar_roadmap.py.

**Models/contracts/migrations:** AuditEvent/CalendarAssignment/CalendarAllocation/StageResult storage models unchanged; additive audit actions/payload and error headers, stricter supported-operation start gate. Migration not required. Frontend, shell, Demand/Capacity formulas and scheduling algorithm не менялись. Новых P0/P1 реализации не обнаружено; existing legacy fact/plan integrity gap STRESS_TEST-1 остаётся явно видимым, его безопасный repair не доказан. P2/P3 вне задачи не исправлялись.

**Canonical status:** закрыта только PC-05.1B; roadmap/project-structure/ERP-check и HTML twins синхронизированы. Общие PC-05/PC-04.4S остаются открытыми. Diff review: git diff -- docs/roadmap/roadmap.md docs/erp/status/roadmap.html docs/architecture/project-structure.md docs/erp/status/project-structure.html docs/architecture/erp-check.md; сохранён ignored logs/pc-05-1b/canonical-docs.diff, включает также прежний WIP. Git status проверен; commit/tag/push/production apply не выполнялись.

**Remaining / recommended next iteration:** owner review start rejection/audit trace и достоверное подтверждение test-only/no-real-production-fact для STRESS_TEST-1 перед отдельным адресным repair. Автоматически следующий item не начинать.

PC-05.1B CALENDAR PLAN LIFECYCLE AUDIT AND START INVARIANT READY
