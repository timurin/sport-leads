# PC-03.3 — Manual Scheduling on CalendarAssignment

## Контекст
PC-03.1 реализовал рабочую недельную очередь на persistent-модели `CalendarAssignment`.
PC-03.2 интегрировал контур календаря в левое меню:
**Производство → Очередь производства**.

Сейчас:
- основной экран `/production/calendar` работает;
- ручное планирование пока заглушка;
- мощности, дашборд и центр отклонений тоже пока заглушки.

Главный принцип Production Calendar:
лёгкий инструмент формирования очереди загрузки, минимум ручных действий, без MES/APS-усложнений.

## Цель
Подключить реальный экран **«Ручное планирование» UI-E** к существующей `CalendarAssignment`.

Пользователь должен быстро:
1. открыть существующее назначение;
2. изменить дату;
3. изменить участок;
4. изменить плановое количество, если оно хранится в assignment;
5. сохранить;
6. вернуться в недельную очередь и увидеть обновлённые данные.

## Scope

### 1. Использовать существующий backend
Сначала проверить текущие endpoints PC-03.1.

Если текущий update endpoint уже умеет менять:
- planned_date;
- section/stage;
- planned_quantity;
- position/order,

использовать его.

Не создавать новые endpoints без необходимости.

### 2. Экран ручного планирования
Маршрут должен соответствовать уже добавленному подпункту меню.

Экран строить в стиле утверждённого UI-E / SL-UI-BASE-v1, но оставить только реально нужные действия MVP.

Поля:
- связанный заказ / ТК — read-only;
- текущий участок;
- новая дата;
- количество, если применимо;
- краткое примечание, если note уже есть в модели.

Не добавлять обязательные поля "на будущее".

### 3. Быстрый вход из очереди
Из карточки/назначения UI-A добавить действие:
**«Перенести / спланировать»**

Оно открывает UI-E с конкретным `CalendarAssignment`.

Не заставлять пользователя повторно искать назначение.

### 4. Preview
Перед сохранением показать компактно:
- было: дата / участок / количество;
- станет: дата / участок / количество.

Без сложного capacity engine.

Если существующий API уже возвращает warning — показать его.
Если warning-механизма нет — не создавать отдельную систему в этой задаче.

### 5. Save
После сохранения:
- показать успешный результат;
- предложить/автоматически вернуться в `/production/calendar`;
- недельная очередь должна показывать обновлённое назначение после reload.

### 6. Необязательный режим создания
Если текущая архитектура UI-E легко позволяет использовать тот же экран для создания нового assignment без усложнения — можно поддержать.
Если требуется отдельная сложная логика — оставить создание на UI-A и использовать UI-E только для редактирования.

## UX-принцип
Обычный перенос назначения должен занимать считанные действия:
**Открыть → выбрать дату/участок → сохранить.**

Не превращать UI-E в форму ERP-документа.

## Не делать
- не реализовывать мощности UI-F;
- не реализовывать Dashboard UI-G;
- не реализовывать Center of deviations UI-H;
- не добавлять dependency engine;
- не добавлять auto-scheduling;
- не добавлять production execution/fact;
- не создавать новые справочники;
- не менять модели БД и миграции, если это не требуется из-за реального дефекта PC-03.1;
- не делать commit/push/merge.

## Тесты frontend
Минимум:
- открытие assignment в UI-E;
- prefill текущих значений;
- смена даты;
- смена участка;
- смена quantity, если применимо;
- save;
- error state;
- возврат в очередь;
- данные после reload соответствуют сохранённым.

## Backend tests
Только если затрагивается backend.
Если backend не меняется — повторно подтвердить существующий update contract targeted tests.

## Обязательные проверки
- targeted frontend tests;
- full frontend tests;
- backend tests, если backend изменён;
- npm run lint;
- npx tsc --noEmit;
- production build;
- project check;
- git diff --check;
- browser check основных размеров, если доступен.

## Acceptance
Готово, если пользователь из недельной очереди может:
1. открыть конкретное назначение;
2. быстро изменить дату и/или участок;
3. сохранить;
4. вернуться в очередь;
5. после перезагрузки увидеть новое состояние.

## Отчёт Codex
Кратко:
- какие существующие API использованы;
- backend менялся или нет;
- route/component UI-E;
- как реализован вход из UI-A;
- тесты и проверки;
- что намеренно не реализовано;
- подтвердить отсутствие commit/push.


## Результат — 2026-10-05

**PC-03.3 CLOSED.** Прямой выбор владельца после PC-03.1/PC-03.2; реализован компактный редактор существующего назначения. PC-03 остаётся открытым; следующий этап автоматически не запускался.

### Реализация и контракты

- **Существующий GET `/production-calendar/board?from=&to=`**: одна выборка выбранной недели с embed summary ТК и каталогом участков, без per-row fetch. Из UI-A передаются `assignment` + `date`; UI-E выбирает конкретный ID из ответа. Прямой вход из меню показывает назначения недели и переключатель недель. Некорректный ID и назначение, перенесённое/удалённое со старой недели, показывают отдельное сообщение; свежая ссылка берётся из очереди.
- **Существующий PUT `/production-calendar/assignments/{id}`**: `planned_date`, `production_stage_id`, `position`, `note`. TechnicalCard ID/номер/заказ/изделие/quantity показаны из источника, не отправляются в update. В модели CalendarAssignment нет planned_quantity; редактирование количества не добавлялось. API не имеет warning DTO; отдельная warning/capacity-система не создана.
- **UI-E `/production/calendar/planning`**: отдельный статический route поверх существующего dynamic `[section]`, компонент `CalendarManualScheduling`; список назначений + компактная форма, prefill, дата/участок/позиция/примечание, сравнение «Было → Станет». Нативная валидация даты/целой позиции/длины note, блокировка повторного submit, сохранение введённых значений при ошибке. Read-only количество из ТК, один редактор без ERP-документа.
- **UI-A**: ссылка «Перенести / спланировать» в каждой карточке ведёт на конкретное назначение. Старый modal edit/delete сохранён под «Изменить / удалить». После PUT — успешный статус и возврат на `/production/calendar?date=<новая дата>&saved=<id>`; страница запрашивает новую неделю no-store, reload сохраняет выбранную неделю и читает реальные записи.
- Создание нового назначения остаётся в UI-A. UI-F/G/H остаются явными заглушками. Нет capacity engine, зависимостей, автоматического планирования, production execution/fact, новых справочников или MES.
- Backend/API/schemas/models/repositories/business logic **не менялись**. **Новых миграций нет**. Proxy и права прежние. Изменения локальной БД только временные QA fixtures; рабочие ТК/назначения/пользователи не менялись, созданные QA записи удалены.

### Файлы этой итерации

Frontend: `app/(workspace)/production/calendar/planning/page.tsx`, `components/production/calendar-manual-scheduling.tsx`, `app/(workspace)/production/calendar/page.tsx`, `components/production/calendar-weekly-board.tsx`, `lib/production/calendar.ts`, `lib/production/calendar-planning.test.mjs`; комментарий `app/(workspace)/production/calendar/[section]/page.tsx` уточнён для UI-F/G/H. Shared shell компоненты и navigation config не менялись.

Docs: эта задача; `architecture/production-calendar-implementation-v0.1.md`, `architecture/project-structure.md`, `architecture/erp-check.md`, `roadmap/roadmap.md`, `roadmap/roadmap-v1.1.md`, `roadmap/production-calendar-v0.1.md`; twins `erp/status/roadmap.html`, `erp/status/roadmap-v1.1.html`, `erp/status/project-structure.html`, `roadmap/production-calendar-v0.1.html`; `scripts/generate_production_calendar_roadmap.py` учитывает PC-03.3/27 карточек.

### Проверки

- Targeted frontend calendar + navigation: **23 passed** (5 новых tests: deep link/week return, дата/ID query validation, prefill без source/quantity в PUT, save/reload, видимый 409). Полный frontend: **305 passed**.
- Существующий backend update contract повторно подтверждён: `python -m pytest backend/tests/test_production_calendar.py -q` — **11 passed**, 2 warning (Starlette/httpx deprecation + существующая pytest cache path). Backend tests не менялись.
- **Project check 10/10, PROJECT CHECK PASSED** системным Python: полный backend **479 passed / 71 warnings**, frontend **305 passed**, lint **0 errors / 84 прежних warnings**, TypeScript, production build, OpenAPI, Alembic, Compose passed. Проверки только на локальном Docker Postgres :5432; production/tunnel не затрагивались.
- **Live Chromium / real local app + API + DB**: UI-A deep link → prefill UI-E → перенос даты через границу недели и участка → настоящий server 409 при конфликте → введённые значения сохранены → retry после удаления собственного конфликтующего QA назначения → PUT → целевая неделя → reload → новый deep link/prefill. Position/note и неизменное source quantity подтверждены GET API. Отмена без сохранения, меню/list entry, устаревший deep link, invalid ID, HTTP 503 (test injection)/retry и неизменные UI-F/G/H заглушки проверены. API/данные рабочего приложения не заменялись демо.
- **Template / визуальная проверка:** UI-E / ближайший **PT-02**, PageLayout → PageContent, утверждённые плотные панели UI-E без будущих полей. UI-E **1440/1366/1280/1024/768/390/320 px**: prefill/preview, отсутствие горизонтального переполнения; screenshots 1440/390 дополнительно просмотрены. UI-A desktop перенос/return/reload проверен. Новых визуальных B1+ не найдено. **DS-SHELL-01 visual contract preserved. DS-SHELL-02 visual contract preserved.**
- Bootstrap password/учётные записи не менялись: браузерный тест с отдельным временным QA пользователем, admin role из существующего каталога, собственной QA группой/ТК/назначениями. В finally удалены только созданные marker-checked fixtures и связанные session/role/SalesUser; credentials не выводились.
- Evidence ignored: `storage/pc-03-3-project-check.log`, `pc-03-3-ui-check.py`, `pc-03-3-ui-check.log`, `pc-03-3-planning-{width}.png`. Первый browser прогон прошёл save/reload, но остановился на неоднозначном locator role=alert (Next route announcer); locator уточнён, финальный прогон прошёл полностью. Это ошибка QA harness, не приложения.
- `git diff --check` passed. Генератор `--check` passed; **HTML twin synced**: PC-03.3 [x] ↔ done:true в active roadmap и project structure, PC-03 [ ] ↔ done:false. Global MD/HTML note синхронизирован. ERP-check оставляет полный календарь [ ]; добавлено только доказательство реализации UI-E. Canonical diff просмотрен, ранний WIP сохранён.

### Итог и ограничения

P0/P1 новых нет. P2 — прежние lint/dependency/cache warnings; P3 новых в UI-E не подтверждено. Без нового GET detail deep link содержит ID и дату: после внешнего переноса на другую неделю старая ссылка явно сообщает, что назначение не найдено; актуальный вход доступен из очереди. Concurrency/versioning, capacity warnings и partial quantities не вводились — текущий контракт PC-03.1 сохранён.

Следующее — владелец проверяет `/production/calendar/planning` и перенос из недельной очереди; дальнейшая микрозадача отдельно выбирается владельцем. **Commit/push/merge/tag не выполнялись.**
