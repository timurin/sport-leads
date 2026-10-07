# PC-03.4D — Queue Load Indicators

## Контекст
PC-03.4A:
- backend capacity settings готов;
- load state reserve / near / over / unknown реализован;
- persistence подтверждён;
- backend tests 513;
- project check 10/10.

PC-03.4C:
- UI-F подключён к live API;
- fallback при 404 удалён;
- frontend tests 314;
- lint/typecheck/build зелёные.

## Цель
Добавить в основной недельный экран **Очередь производства / UI-A** лёгкую подсветку загрузки по уже существующему backend-контракту.

Не создавать новую бизнес-логику расчёта на frontend.

## Scope
Только frontend / Cursor.

### 1. Источник данных
Использовать существующий backend load-state contract из PC-03.4A.

Если board endpoint уже возвращает load state — использовать его.
Если нужен отдельный read endpoint, использовать уже опубликованный backend endpoint без изменения backend.

Не дублировать формулы в frontend.

### 2. Состояния
Поддержать только:
- `reserve` — есть резерв;
- `near` — близко к пределу;
- `over` — перегрузка;
- `unknown` — недостаточно данных.

### 3. UI-A
На недельной очереди показать состояние компактно:
- на уровне участок × дата;
- без лишних карточек и таблиц;
- визуально не перегружать очередь.

Допустимо:
- небольшой badge;
- тонкая цветовая индикация;
- краткое значение загрузки, если оно уже приходит из API.

Не менять утверждённую структуру weekly board.

### 4. Поведение
- индикация только информирует;
- `over` не блокирует создание/перенос;
- `unknown` не трактуется как 0%;
- пользователь не обязан исправлять предупреждение перед сохранением.

### 5. Детали
По hover/click/focus можно показать короткую подсказку:
- известная нагрузка;
- доступная мощность;
- статус;
- количество назначений без нормы, если backend это отдаёт.

Не строить отдельный экран конфликтов в этой задаче.

## Не делать
- не менять backend;
- не менять DB/migrations;
- не менять UI-F;
- не реализовывать Dashboard UI-G;
- не реализовывать Center UI-H;
- не добавлять auto-scheduling;
- не добавлять hard blocking;
- не менять navigation;
- не делать commit/push/merge.

## Tests
- reserve state;
- near state;
- over state;
- unknown state;
- unknown != 0;
- rendering for empty day;
- indicators do not block create/move;
- full frontend tests.

## Проверки
- targeted frontend tests;
- full frontend tests;
- npm run lint;
- npx tsc --noEmit;
- production build;
- git diff --check;
- project check.

## Acceptance
Готово, если:
1. пользователь на недельной очереди сразу видит загрузку участка по дням;
2. четыре состояния отображаются корректно;
3. перегрузка не блокирует ручное планирование;
4. неизвестные нормы не выглядят как свободная мощность;
5. frontend не содержит отдельной копии расчётной логики backend.

## Отчёт Cursor
Кратко:
- откуда берётся load state;
- какие компоненты изменены;
- как выглядит индикатор;
- tests/checks;
- подтвердить отсутствие изменений backend/DB/UI-F;
- подтвердить отсутствие commit/push.


## Результат — 2026-10-05

**PC-03.4D CLOSED.** Прямой выбор владельца после PC-03.4A и live adapter PC-03.4C (контекст текущей задачи). Выполнен frontend-срез индикаторов, общий PC-03 не закрывается. Старые handoff заметки PC-03.4A описывают историческое состояние адаптера, текущий адаптер использует `/capacity/settings`.

### Откуда данные и что изменено

- `/board` не отдаёт load state. **Один GET `/capacity/settings`** получает реальные ресурсы/привязки; **POST `/capacity/load-state`** по ресурсу и дате возвращает authoritative state/percentage/capacity/known_planned_hours/unknown_demand_count/reason. В frontend proxy allowlist добавлен только этот опубликованный POST; cookie, no-store, Origin check и existing mutations сохранены.
- Новый `lib/production/calendar-queue-load.ts`: только сбор входных фактов и orchestration, validation DTO, formatting процентов; нет арифметики трудоёмкости/мощности/порогов, lookup ставок/формул или frontend расчёта state. Sewing demand передаёт technical_card_id, backend читает ТК/норму; packing demand передаёт существующее quantity. Иные ресурсы получают unknown demand (unit без вымышленных часов/метража/метода/станка).
- `components/production/calendar-queue-load.tsx`: общий provider для desktop/mobile, один batch на board snapshot; компактный native details badge в каждой stage×date ячейке. Single resource: цвет + status + backend percent. Multi-resource stage: компактные colored dots с названиями для каждого ресурса, по раскрытию раздельные состояния/единицы; общего процента или вычисленного frontend aggregate-state нет. Unsupported stage без ресурса в контракте явно показывает «Недостаточно данных».
- Раскрытие по click/keyboard focus+Enter: имя ресурса, known hours, available capacity/unit, backend unknown count/reason. Unknown не содержит 0%; known partial hours могут быть 0 и обозначены именно «Известно». Для milestone нет часовых строк. Error 404/503/invalid DTO не превращается в reserve или demo: видимый локальный error и retry; очередь продолжает работать.
- `calendar-weekly-board.tsx`: добавлены provider и badges в существующие desktop table/mobile cards; структура board/назначений/модалки и правила disabled не менялись. Load state не используется в create/move/save conditions. После mutations/week/filter refresh загрузка предыдущего snapshot отменяется, не публикует устаревшие данные.
- Request budget: <=1 settings + 14 resources×7 dates = **<=99 requests**, независимо от числа назначений; максимум **6** load requests одновременно. Оба responsive views используют один provider. Single filtered sewing stage: 1+7. Published API лимит 100 demands/day: >100 не обрезается/не считается частично, индикатор явно сообщает ограничение; CRUD доступен. Backend batch endpoint этой задачей не вводится.

### Файлы итерации

Frontend: `components/production/calendar-weekly-board.tsx`, `components/production/calendar-queue-load.tsx`, `lib/production/calendar-queue-load.ts`, `lib/production/calendar-queue-load.test.mjs`, `app/api/production-calendar/[...path]/route.ts`.

Документы: эта задача; `architecture/production-calendar-implementation-v0.1.md`, `architecture/project-structure.md`, `architecture/erp-check.md`, `roadmap/roadmap.md`, `roadmap/roadmap-v1.1.md`, `roadmap/production-calendar-v0.1.md`; twins `erp/status/roadmap.html`, `erp/status/roadmap-v1.1.html`, `erp/status/project-structure.html`, `roadmap/production-calendar-v0.1.html`; генератор учитывает PC-03.4D и 29 карточек.

### Проверки

- Targeted calendar load/queue/planning frontend: **17 passed**, из них **9 новых**: reserve/near/over/unknown, authoritative state, unknown≠0, empty-day demands, independent resource units, no guessed work inputs, fixed request budget/concurrency, errors/DTO validation, no mutation gating, oversized day, abort.
- **Project check 10/10 / exit 0**: frontend **323 passed**, backend **513 passed / 71 warnings**, lint **0 errors / 84 прежних warnings**, TypeScript, production build, OpenAPI, Compose/Alembic checks passed. Backend tests/code не менялись; migrations не добавлялись/не выполнялись.
- **Live local app/API/Postgres Chromium**: actual sewing norm (360 sec/item), near 80%, over 160%, unknown missing norm, reserve 0% на пустом известном рабочем дне; weekend zero capacity остаётся unknown по backend. Все **1440/1366/1280/1024/768/390/320 px**: одинаковые состояния/проценты, раскрытие unknown/count/reason, no horizontal document overflow. Desktop1440/mobile390 screenshots просмотрены. Template **PT-02** — текущая weekly matrix/mobile cards; новые страницы/таблицы не создавались, визуальных B1+ не найдено.
- Настоящий **перенос** с overloaded дня на день с существующей работой принят API: новый день over 160%, прежний пустой день reserve. **Создание** ещё одного назначения на уже overloaded день принято, backend показывает over 240%; никаких checkbox/reason gates. Note/date/CRUD сохранились. Keyboard Enter раскрывает details.
- Test-injected HTTP503 для load-state показывает visible indicator error, create button остаётся enabled; retry после снятия injection успешен. Foreign Origin POST через proxy →403. JavaScript errors нет. Production responses не заменялись demo; injection только отдельный error-path QA.
- Использованы временные marker-checked локальные QA user/model/variant/TC/group/assignments/settings/exception; существующие owner records не менялись. В finally удалены только свои QA fixtures. Scope «backend/DB unchanged» означает код/контракт/схема и рабочие записи; live QA временные fixtures не считаются реализацией backend. Только local Docker DB :5432, без VPS/tunnel.
- Evidence ignored: `storage/pc-03-4d-project-check.log`, `pc-03-4d-ui-check.py`, `pc-03-4d-ui-check.log`, `pc-03-4d-board-{width}.png`. `git diff --check` passed. Canonical diff reviewed; existing WIP preserved. **HTML twin synced**: PC-03.4D [x] ↔ done:true в active roadmap/project-structure; PC-03 [ ] ↔ done:false. Generator --check passed.

### Границы / следующий шаг

Backend/API/DB schema/migrations, UI-F, navigation, UI-G/H **не менялись**. **DS-SHELL-01 visual contract preserved. DS-SHELL-02 visual contract preserved.** Нет auto-scheduling/hard blocking/launch/fact/conflict screen. PC-03.4B/C checkboxes автоматически не закрываются.

P0/P1 новых нет. P2 — существующие warnings и ограничения published contract: до 100 demands на ячейку, нет batch нагрузки, отсутствуют work-kind/method/meters/manual-hours на CalendarAssignment. Для этих данных показан unknown; трудоёмкость не угадывается. P3 новых не подтверждено. ERP-check оставляет полный календарь [ ]; закрыта только индикация очереди. Следующий шаг — отдельный выбор владельцем следующей задачи; backend batch/обогащение входных фактов при необходимости отдельным scoped решением. **Commit/push/merge/tag не выполнялись.**
