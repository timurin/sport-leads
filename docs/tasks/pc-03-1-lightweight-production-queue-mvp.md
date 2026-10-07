# PC-03.1 — Lightweight Production Queue MVP

## Контекст
Production Calendar v0.1 спроектирован и утверждён.
Preflight зелёный:
- PostgreSQL работает;
- Alembic на head;
- backend tests: 468 passed;
- frontend tests: 296 passed;
- lint: 0 errors;
- TypeScript проходит;
- git diff --check проходит.

Главный принцип:
Production Calendar — лёгкий инструмент формирования очереди загрузки производства.
Не строить MES/APS. Минимум ручного ввода, максимум использования уже существующих данных.

## Цель
Сделать первый рабочий вертикальный срез Production Calendar:
1. хранение производственной очереди;
2. простое назначение заказа/работы на участок и дату;
3. получение очереди по периоду;
4. базовый экран календаря/очереди на основе утверждённого UI-A;
5. без сложного расчёта мощностей и без аналитических экранов.

## Scope backend

### 1. Сначала проверить существующие сущности
Переиспользовать существующие:
- Sales Order / Customer Order;
- production order / technical card / model;
- organization / work center / section / employees / equipment,
если они уже подходят.

Не создавать дубликаты справочников.

### 2. Минимальная persistent-модель календаря
Создать только сущность, необходимую для назначения работы в очередь.

Минимально необходимый контракт назначения:
- id;
- order/reference id или snapshot/reference на существующий заказ/производственный объект;
- section/stage;
- planned_date;
- sort/order position внутри даты и участка;
- planned_quantity, если нужна для текущего сценария;
- optional note;
- created_at / updated_at.

Не добавлять:
- сложные статусы MES;
- фактическое выполнение;
- автоматическое планирование;
- отдельный workflow engine;
- risk entities;
- capacity snapshots;
- machine-hour ledgers;
- audit/event subsystem,
если они не обязательны для этого slice.

### 3. API
Минимальный API:
- получить очередь по диапазону дат;
- создать назначение;
- изменить дату / участок / позицию;
- удалить назначение;
- получить доступные участки из существующего источника.

API должен позволять UI работать без лишних round-trips.

### 4. Service layer
Валидации только базовые:
- корректный существующий reference;
- дата;
- участок;
- quantity > 0, если quantity используется;
- no silent duplication при повторном запросе.

Не блокировать размещение по мощности на этом этапе.
Если есть очевидный конфликт — можно вернуть warning, но не строить отдельную систему конфликтов.

## Scope frontend

### UI-A — основной рабочий экран
Реализовать утверждённый weekly-board как реальный экран.

Главные действия:
- быстро добавить заказ/работу в очередь;
- выбрать участок;
- выбрать дату;
- увидеть назначения по дням;
- перенести назначение;
- открыть связанный заказ;
- удалить назначение.

UX-принцип:
диспетчер должен делать обычное назначение за минимальное количество действий.

### Поведение
- данные из API;
- неделя по умолчанию;
- переключение предыдущая/следующая неделя;
- фильтр по участку;
- компактные карточки;
- drag/drop только если уже безопасно поддерживается текущим стеком; иначе простое действие "Перенести";
- mobile/adaptive в стиле SL-UI-BASE-v1.

## Не делать в PC-03.1
- UI-G Dashboard;
- UI-H Center of deviations;
- auto-scheduling;
- прогноз сроков;
- полноценный расчёт мощностей;
- machine/operator split logic;
- dependency engine;
- execution/fact tracking;
- notifications;
- AI;
- новые сложные справочники;
- массовый рефакторинг production-модуля.

## Миграция
Если нужна новая таблица:
- одна минимальная обратимая Alembic migration;
- без изменения существующих бизнес-данных;
- upgrade/downgrade проверить.

## Тесты

Backend:
- CRUD назначения;
- range query;
- move/change assignment;
- delete;
- invalid reference/date/section;
- повторное действие не создаёт неожиданные дубли.

Frontend:
- загрузка недели;
- отображение назначений;
- create;
- move/change;
- delete;
- фильтр участка;
- basic empty/error/loading states.

## Обязательные проверки
- targeted backend tests;
- full backend tests;
- frontend tests;
- npm run lint;
- npx tsc --noEmit;
- production build, если окружение позволяет;
- Alembic upgrade/check/downgrade/upgrade;
- project check;
- git diff --check.

## Ограничения
- Не менять утверждённый дизайн UI-A без необходимости.
- Не трогать UI-G/H.
- Не добавлять функциональность "на будущее".
- Не делать commit / push / merge.
- Если для MVP можно выбрать между более сложной и более простой реализацией — выбрать простую.
- Не считать warnings blockers, если tests/build/typecheck зелёные.

## Критерии готовности
PC-03.1 готов, если пользователь может:
1. открыть календарь;
2. увидеть неделю;
3. добавить существующий заказ/работу на участок и дату;
4. перенести его;
5. удалить назначение;
6. отфильтровать участок;
7. открыть связанный объект;
8. перезагрузить страницу и увидеть сохранённые данные.

## Отчёт Codex
Кратко:
- какие существующие сущности переиспользованы;
- какая минимальная модель добавлена;
- migration id;
- endpoints;
- frontend routes/components;
- тесты и проверки;
- что намеренно НЕ реализовано;
- список изменённых файлов;
- подтвердить отсутствие commit/push.

## Completion — 2026-10-05

**PC-03.1 CLOSED.** Выбрана владельцем после восстановления локальной БД и frontend preflight. Выполнен первый persistent вертикальный срез: недельная очередь, добавление существующей standalone ТК, выбор участка/даты, перенос/позиция/примечание, удаление назначения, фильтр, ссылка на ТК и сохранение после перезагрузки. Общий PC-03 и следующие этапы не закрыты.

### Переиспользование и модель

Источник — TechnicalCard / TechnicalCardOrderGroup (контур B) и ProductionStage. Номер заказа, номер ТК, изделие и количество читаются из существующих записей; SalesOrder/ProductionOrder не требуются и не создаются. Новая таблица только одна: CalendarAssignment с FK на ТК/участок, planned_date, position >= 0, note и aware timestamps. UNIQUE (technical_card_id, production_stage_id) задаёт одну работу данной ТК на данном участке; разбивка одной работы по нескольким дням и частичные объёмы в этом MVP отсутствуют. Повтор идентичного POST возвращает тот же id, попытка создать несовместимое повторное назначение — 409. Перенос делается явным PUT. FK участка RESTRICT сохраняет явный 409 при удалении используемого участка; FK ТК CASCADE удаляет только её плановые назначения при явном удалении исходной черновой ТК. Действующий delete ТК и соседние ТК сохраняют прежнее поведение; отдельная регрессия подтверждает это.

Миграция **u0v1w2x3y456**, parent t9u0v1w2x345, только добавляет новую таблицу/index/constraints. На локальной Docker БД 127.0.0.1:5432 выполнены upgrade/check/downgrade/upgrade/check; перед downgrade проверена пустота новой таблицы. Исходные количества строк ТК/участков (4/8) сохранены. VPS, tunnel и существующая ERP-схема/бизнес-данные не менялись.

### API и экран

- GET /production-calendar/board?from=&to=&stage_id= — slim назначения + справочник участков; joined summary без per-row fetch, два query для queue/stages.
- GET /production-calendar/sources?search=&limit= — поиск доступных standalone ТК (draft/in_progress), limit 1…100.
- POST /production-calendar/assignments — назначение и идемпотентный повтор.
- PUT /production-calendar/assignments/{id} — дата/участок/позиция/примечание.
- DELETE /production-calendar/assignments/{id} — удаляет только назначение.

Чтение требует PlatformUser session; изменения — существующего technical_cards.create. Ограничения кабинета швеи сохранены. Невалидные дата/reference/участок/позиция — 422; отсутствующее назначение — 404; конфликт работы — 409. Изменения не записывают производственный факт.

Frontend: /production/calendar, CalendarWeeklyBoard, frontend data layer calendar.ts и same-origin proxy /api/production-calendar/[...path]. Proxy передаёт session cookie backend, ограничивает маршруты/методы, отвергает чужой Origin и показывает upstream/502 ошибки явно. Это устранило несовпадение host cookie между loopback и LAN API в текущем dev запуске. Навигация добавлена только в frontend/lib/navigation.ts. PT-02 / UI-A: desktop weekly matrix с локальной горизонтальной прокруткой; mobile — дни участка карточками. Перенос через форму, без drag/drop.

**DS-SHELL-01 visual contract preserved. DS-SHELL-02 visual contract preserved.** Shell компоненты не менялись.

### Проверки и доказательства

- Targeted backend: **11 passed** (CRUD, range/filter, move, duplicate retry/conflict, invalid reference/date/section/position, authentication/permission, source preservation и постоянный query count joined list).
- Targeted frontend: **3 passed** (локальная Monday–Sunday неделя и годовая граница, фильтр/позиция, API read/create/move/delete/error).
- Итоговый scripts/check_project.py: **10/10**, PROJECT CHECK PASSED. Backend **479 passed / 71 warnings**; frontend **299 passed**; lint **0 errors / 84 warnings** (81 прежнее + 3 warning о setState in effect нового экрана); tsc, production build, Alembic, Compose и OpenAPI **488 уникальных operationIds** прошли.
- Live Chromium с настоящими локальными API/БД: create → filter → move → reload → delete; удаление дополнительно подтверждено прямым чтением API. Неизвестный proxy path — 404, чужой Origin при записи — 403. Пустая неделя и восстановление после тестового HTTP 503 проверены; рабочие данные не подменяются.
- Responsive: **1440, 1024, 768, 390, 320 px**, документ без горизонтального переполнения, назначения одинаковы в desktop/mobile; screenshots сохранены. Desktop 1440 и mobile 390 дополнительно просмотрены. Новых визуальных B1+ не найдено.
- Bootstrap credentials в .env дали 401; существующие пароли не менялись. Проверка выполнена через временную локальную QA-учётную запись с существующей admin ролью; созданные assignment/user/session/role links и связанный временный SalesUser удалены. Неудачные ранние попытки не используются как доказательство готовности.
- git diff --check — passed. Evidence ignored: storage/pc-03-1-migration.log, pc-03-1-project-final.log, pc-03-1-ui-check.log, pc-03-1-board-{width}.png. Это проверка локального приложения, не production deployment.

### Изменённые файлы этой задачи

Backend: app/models/calendar_assignment.py, app/models/__init__.py, app/schemas/production_calendar.py, app/repositories/production_calendar.py, app/services/production_calendar.py, app/api/production_calendar.py, app/main.py, alembic/versions/u0v1w2x3y456_calendar_assignments.py, tests/test_production_calendar.py.

Frontend: app/(workspace)/production/calendar/page.tsx, app/api/production-calendar/[...path]/route.ts, components/production/calendar-weekly-board.tsx, lib/production/calendar.ts, lib/production/calendar.test.mjs, lib/navigation.ts.

Документы: эта задача; architecture/production-calendar-implementation-v0.1.md, architecture/project-structure.md, architecture/erp-check.md, roadmap/roadmap.md, roadmap/roadmap-v1.1.md, roadmap/production-calendar-v0.1.md; их HTML twins erp/status/roadmap.html, erp/status/roadmap-v1.1.html, erp/status/project-structure.html, roadmap/production-calendar-v0.1.html; scripts/generate_production_calendar_roadmap.py теперь учитывает PC-03.1.

**HTML twin synced.** PC-03.1 [x] ↔ done:true; PC-03 остаётся [ ] ↔ done:false. Генератор сверяет 25 статусов/карточек. ERP-check сохраняет полный календарь незавершённым, checklist структуры закрывает только MVP очереди. Canonical diff просмотрен; ранний незакоммиченный WIP сохранён.

### Границы и следующий шаг

P0/P1 новых нет. P2 — три warning React effects нового экрана (не блокируют tests/build); P3 визуальных багов не подтверждено. По прямому scope этой задачи не реализованы мощности/нормы/аналитика UI-G/H, DAG/dependency engine, execution/fact/workflow, snapshots/audit subsystem, autoscheduling, notifications и MES. Количество живое из ТК, не ручная копия; план не доказывает готовность запуска.

Следующий шаг — просмотр владельцем /production/calendar и отдельный выбор следующей микрозадачи PC-03; автоматического старта нет. **Commit/push/merge/tag не выполнялись.**

