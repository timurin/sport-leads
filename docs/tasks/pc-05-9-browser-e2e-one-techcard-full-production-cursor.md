# PC-05.9 — Browser E2E: One TechnicalCard Through Full Production

## Исполнитель
Cursor

## Цель
Через реальный браузер пройти одну тестовую ТК от создания до полного завершения производства, имитируя работу пользователя. Ничего не исправлять в ходе теста — только фиксировать расхождения.

## Среда
Frontend: `http://127.0.0.1:3001`
Backend: `http://127.0.0.1:8000`

Использовать browser automation/Playwright проекта. UI — основной путь. API/DB только для подтверждения причины найденного расхождения.

## Авторизация
Использовать существующий local auth contract. Не сбрасывать пароль и не обходить auth. Если вход невозможен — STOP и blocker report.

## Модель
Предпочтительно SKU `201.2`.
Допустимо только: `201.1`, `201.2`, `211.1`, `211.2`, `211.3`.

## Создать новую ТК
Префикс: `E2E-PROD-`

Через UI заполнить:
- модель;
- quantity;
- route;
- assembly variant, если требуется;
- planning/shipping dates;
- priority;
- 3–5 строк персонализации.

## Проверка после создания
Зафиксировать:
`screen | lifecycle | current_workshop | kanban_column | queue | calendar | diagnostics`

## Планирование
Через UI выполнить планирование/пересчёт.

Проверить:
- TechnicalCard status/current workshop;
- Calendar assignments;
- Kanban — ровно один текущий участок;
- Queue — только текущий waiting workshop;
- Debug Center.

## Полный производственный цикл
Для каждого участка маршрута:

1. Открыть Kanban.
2. Найти ТК и проверить колонку.
3. Проверить Queue участка.
4. Нажать `Принять в работу`.
5. Проверить lifecycle/current_workshop/Kanban/Queue/Calendar.
6. Открыть ТК и Debug.
7. Нажать `Завершить`.
8. Проверить автоматический переход на следующий workshop.
9. Повторять до полного завершения.

DnD между Kanban columns не использовать.

## Сверка на каждом шаге
Таблица:

`Step | TechnicalCard status | current_workshop | Kanban | Queue | Calendar | PASS/FAIL`

Правила:
- Calendar = план;
- Queue = ожидающие работы текущего участка;
- Kanban = факт;
- future Calendar assignments не двигают Kanban;
- TechnicalCard status/current_workshop должны совпадать с canonical resolver.

## Персонализация
Проверить сохранение 3–5 строк:
- после создания;
- после планирования;
- после replan, если был;
- после завершения.

## Queue test
Если есть 3+ waiting ТК в участке:
- preview reorder;
- apply;
- проверить Calendar;
- убедиться, что Kanban/current_workshop/lifecycle не изменились.

Если нет — `not exercised`.

## Debug evidence
При любом FAIL:
- открыть Debug Center;
- сохранить diagnostic;
- скачать Debug JSON log, если доступно;
- screenshot;
- затем точечно проверить API/DB.

Зафиксировать:
- step;
- expected;
- actual;
- diagnostic code/category;
- entity ids;
- data-flow layer;
- probable root cause;
- reproducible yes/no.

## Screenshots
Сохранять в:
`logs/pc-05-9/screenshots/`

Минимум:
- после создания;
- после планирования;
- before/after start;
- after complete каждого workshop;
- финальный completed state;
- каждый mismatch.

## Финальное ожидаемое состояние
- lifecycle = completed;
- current_workshop = none/completed semantics;
- Kanban не показывает ТК как waiting/in_progress;
- Queue не содержит ТК;
- Calendar сохраняет корректный исторический план;
- personalization сохранена;
- нет новых P0/P1;
- no orphan assignments/allocations.

## Отчёт
Создать:
`docs/tasks/pc-05-9-browser-e2e-one-techcard-full-production-cursor.md`

В отчёте:
- TK number/id;
- SKU/qty/route;
- personalization count;
- пошаговая таблица PASS/FAIL;
- projection consistency TechnicalCard/Kanban/Queue/Calendar;
- incidents с screenshot/log paths;
- severity P0/P1/P2/P3;
- final verdict:

`PASS — FULL USER FLOW CONSISTENT`

или

`FAIL — PRODUCTION FLOW MISMATCHES FOUND`

## Ограничения
- не исправлять код;
- не менять production facts вне действий UI;
- не делать refactor;
- не commit/push.

Цель — получить чистый end-to-end диагностический отчёт, после которого исправляется только конкретный сломанный слой.

## Отчёт прогона — 2026-10-14, повтор

Первый заход в этот же день остановился на форме входа: bootstrap-пароль из `.env` для уже существующего `admin` не подошёл (`logs/pc-05-9/screenshots/01-login-rejected.png`). Этот прогон выполнен заново с переданным логином `admin`. Пароль в отчёт не записывался, не сбрасывался и не обходился. Код не менялся.

### Вердикт

`FAIL — PRODUCTION FLOW MISMATCHES FOUND`

Цикл остановился на участке «Дизайн»: «Принять в работу» записало факт, «Завершить» вернуло «Требуется вход» и факт не изменило.

### Карточка

| Поле | Значение |
|---|---|
| id | 157 |
| номер | `E2E-PROD-001-1` |
| заказ | `E2E-PROD-001` |
| SKU | 201.2 · Футболка, модель id 50 |
| сборка | «Пошив футболки», variant 16 |
| маршрут | шаблон 1 «Дизайн + Сублим + Пошив» |
| количество | 4 (сумма персонализации) |
| даты | начало плана 2026-10-14, отгрузка 2026-10-30, приоритет 10 |
| персонализация | 4 строки: M/Иванов/10/E2E-1, L/Петров/11/E2E-2, S/Сидоров/7/E2E-3, XL/Кузнецов/22/E2E-4 |

Среда: `http://127.0.0.1:3001`, API `http://127.0.0.1:8000`, локальная Postgres `127.0.0.1:5432` / `sport_leads`.

### Пошаговая сверка

| Step | TechnicalCard status | current_workshop | Kanban | Queue | Calendar | PASS/FAIL |
|---|---|---|---|---|---|---|
| Создание и настройка | черновик до плана | — | — | — | — | PASS |
| Персонализация, 4 строки | сохранена, сумма 4 | — | количество 4.000 | — | в превью 4 фамилии и размеры | PASS |
| Пересчитать план | Запланирована | Дизайн | колонка «Дизайн», бейдж «Запланирована», кнопка «Принять в работу» | ожидание «Дизайн», позиция 1, даты 14.10.2026–14.10.2026 | назначения 351–357, все на 2026-10-14 | PASS с оговоркой по прогнозу на карточке |
| До старта, очередь | Запланирована | Дизайн | только «Дизайн» | 2 ожидающие (E2E и 1310-1), порог 3+ не достигнут | стикер только в строке «Дизайн» | PASS, reorder `not exercised` |
| Принять в работу | in_progress | Дизайн | «В работе», та же колонка, кнопка «Завершить» | E2E вышла из ожидания, осталась 1310-1 | превью: статус «В работе», участок «Дизайн», дата участка 2026-10-14 | PASS |
| Завершить Дизайн | in_progress, этап 1 `completed_at` пустой | Дизайн | карточка осталась в «Дизайн», alert «Требуется вход» | не менялась | не менялся | FAIL |
| Печать, Раскрой, Пошив, Контроль качества | не начаты | — | — | — | в «Остальной маршрут» как план на 2026-10-14 | не выполнены: стоп на FAIL завершения |

Финальное состояние не достигнуто. Сейчас: `technical_cards.status = in_progress`, `current_stage_order = 1`, этап «Дизайн» `in_progress` с `started_at` 2026-10-14 15:10:19+02 и пустым `completed_at`. Назначения 7, аллокации 7, персонализация 4. Лишних назначений после неудачного завершения нет.

### Согласованность проекций

- Kanban после плана и после старта показывает тот же текущий участок, что и `current_stage_label`: «Дизайн». Колонки «Печать» и дальше для этой ТК пустые.
- Queue — только ожидающие. До старта E2E была первой в «Дизайн». После старта её в очереди нет.
- Calendar рисует стикер только в строке «Дизайн» на ср, 14 окт. Остальные назначения видны в превью «Остальной маршрут», а не как перенос карточки. Это совпадает с правилом «календарь = план, канбан = факт».
- Персонализация жива на вкладке ТК и в превью календаря после плана и после старта. Повторного пересчёта и завершения не было, эти две проверки не выполнялись.
- `route_variant_groups` у шаблона 1 и у ТК пустой. «Сублимационная печать» и «Термоперенос», а также «ВТО» и «Упаковка», лежат в плане как отдельные операции одного участка, не как исключающий выбор.

### Incidents

#### 1. Kanban «Завершить» не записывает факт

| Поле | Значение |
|---|---|
| step | Завершить участок «Дизайн» |
| expected | этап 1 completed, текущий участок переходит на «Печать», Kanban переносит карточку, Queue «Печать» получает ожидание |
| actual | alert «Требуется вход»; карточка остаётся «В работе» в колонке «Дизайн»; в БД `completed_at` пустой |
| diagnostic | кода нет. Debug Center на странице нет: `debugMode` выключен, кнопки Debug в шапке нет. Ответ API — `AuthUnauthorizedError` «Требуется вход», это отсутствие токена, не производственный diagnostic |
| entity ids | technical_cards 157, stage_result этап 1, assignments 351–357 |
| data-flow layer | UI fact action → `POST /technical-cards/{id}/stages/{order}/complete` |
| probable root cause | `complete_stage_endpoint` требует `PERM_SHOP_KANBAN_TRANSITION`. `completeTechnicalCardStage` / `postTechnicalCardAction` не передаёт `sessionAuthHeaders`. `start_stage_endpoint` такого permission не требует, поэтому «Принять в работу» тем же клиентом проходит. Кнопка карточки «Завершить этап» вызывает тот же action; отдельно не нажималась |
| reproducible | yes |
| screenshot | `logs/pc-05-9/screenshots/10-kanban-complete-requires-login.png` |
| severity | P1 |

#### 2. После перезагрузки карточка снова пишет, что плана нет

| Поле | Значение |
|---|---|
| step | Открыть ТК после «Пересчитать план» |
| expected | на карточке виден уже посчитанный прогноз |
| actual | сразу после кнопки UI показал «Ожидаемая готовность 14.10.2026». После открытия `/production/tech-cards/157` на месте прогноза текст «Прогноз появится после расчёта плана», хотя 7 назначений в БД и календарь их показывает |
| diagnostic | нет |
| entity ids | technical_cards 157, assignments 351–357 |
| data-flow layer | card planning panel vs persisted calendar assignments |
| probable root cause | панель прогноза показывает ответ последнего действия и не поднимает сохранённые назначения при загрузке страницы |
| reproducible | yes |
| screenshot | `logs/pc-05-9/screenshots/07-card-forecast-missing-after-reload.png` |
| severity | P2 |

### Наблюдения, не блокирующие факт

- P3. Поиск модели по `201.2` не отфильтровал список, выбор сделан кликом по «201.2 · Футболка».
- P3. «Дата отгрузки» в форме создания не попала в поле плана, пока её не ввели и не сохранили на карточке. В БД сейчас 2026-10-30.
- P3. До старта шапка ТК показывала «Запланирована» и одновременно WIP «В работе». На канбане бейдж был «Запланирована».
- Все 7 операций плана стоят на 2026-10-14 при отгрузке 2026-10-30. Календарь из-за этого не раскладывает маршрут по дням; хвост виден только в превью.
- Очередь из 3+ ожидающих на участке не собралась. Reorder preview/apply: `not exercised`.
- В dev overlay есть hydration warning (`top-navigation.tsx`, `compact-tabs.tsx`, `calendar-weekly-board.tsx`). На сценарий факта не повлиял.

### Скриншоты

`logs/pc-05-9/screenshots/`: `02-after-create.png`, `03-after-plan.png`, `04-kanban-design-before-start.png`, `05-kanban-design-after-start.png`, `06-queue-design-after-start.png`, `07-card-forecast-missing-after-reload.png`, `08-calendar-design-current.png`, `09-calendar-preview.png`, `10-kanban-complete-requires-login.png`.

### Что не делалось

Код, миграции, права и производственные факты вне нажатий UI не менялись. Участки после «Дизайн» не проходились: завершение первого участка не записалось. Commit и push не выполнялись.
