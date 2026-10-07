# PC-03.5C — Entry Flow Live Integration

## Контекст
PC-03.5A завершён Codex:
- `POST /assignments` принимает только:
  - `technical_card_id`
  - `planned_date`
  - optional `note`
- backend автоматически назначает стадию **«Подготовка к запуску»**;
- backend автоматически ставит новую работу в конец очереди даты;
- переданные `stage` / `position` отклоняются с 422;
- существующий `PUT` для диспетчерского редактирования сохранён;
- migration `w2x3y4z5a678` проверена;
- backend tests: 529;
- project check: 10/10.

PC-03.5B завершён Cursor:
- UI создания уже упрощён;
- поиск ТК/заказа объединён в одно поле;
- участок и позиция удалены из create UI;
- payload frontend уже подготовлен как minimal create contract.

Источник истины backend-контракта:
`docs/architecture/production-calendar-entry-pc-03-5a.md`

## Цель
Подключить frontend PC-03.5B к живому create-контракту PC-03.5A и подтвердить полный пользовательский сценарий.

## Scope
Только frontend / Cursor.

### 1. API integration
Проверить, что create request отправляет ровно:
- `technical_card_id`
- `planned_date`
- optional `note`

Не отправлять:
- stage;
- section;
- position;
- quantity, если backend contract его не требует;
- frontend-only поля.

### 2. Response handling
После успешного create:
- принять фактически назначенную backend стадию;
- принять фактически назначенную позицию;
- обновить очередь;
- показать созданную работу в **«Подготовка к запуску»**;
- не вычислять позицию на frontend.

### 3. UX
Сохранить текущую упрощённую форму:
- `Техническая карта / заказ`;
- дата;
- примечание;
- CTA `Добавить в очередь`.

Не возвращать поля участка или позиции.

### 4. Error states
Корректно показывать:
- 404/invalid technical card;
- 422;
- network/server error.

Не подменять ошибку локальным success state.

### 5. Совместимость
Проверить, что редактирование существующего назначения через UI-E по-прежнему работает:
- участок;
- дата;
- позиция;
- примечание.

Create и edit — разные сценарии.

## Не делать
- не менять backend;
- не менять DB/migrations;
- не менять business logic;
- не менять UI-F/G/H;
- не менять navigation;
- не делать commit/push/merge.

## Tests
Минимум:
- create payload exact shape;
- успешное создание;
- backend stage отображается как `Подготовка к запуску`;
- position берётся из response;
- no stage/position in request;
- 422 error state;
- invalid TK error;
- existing UI-E edit flow не сломан;
- reload показывает созданное назначение.

## Проверки
- targeted frontend tests;
- full frontend tests;
- npm run lint;
- npx tsc --noEmit;
- production build;
- git diff --check;
- project check.

Если доступна авторизованная локальная сессия:
- проверить реальный create в браузере.
Если сессия недоступна:
- подтвердить интеграцию contract/integration tests и не блокировать задачу только из-за login.

## Acceptance
Готово, если менеджер может:
1. найти ТК;
2. выбрать дату;
3. при необходимости написать примечание;
4. нажать `Добавить в очередь`;
5. увидеть новое назначение в стадии `Подготовка к запуску`;
6. не знать и не выбирать участок/позицию.

## Отчёт Cursor
Кратко:
- какие frontend файлы изменены;
- exact create payload;
- как обработан response;
- tests/checks;
- подтверждение, что backend/DB не менялись;
- отсутствие commit/push.
