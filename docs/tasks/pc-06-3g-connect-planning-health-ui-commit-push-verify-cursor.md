# PC-06.3G — Connect Planning Health UI + Commit/Push + Verify sport-lead.ru

## Исполнитель
Cursor

## Цель
Подключить canonical Planning Health backend contract из PC-06.3F к:
1. TechnicalCard / единому блоку `План производства / Маршрут`;
2. `/production/calendar/planning`.

Убрать временную frontend-логику/заглушки по просрочке, риску и ETA.
После успешной проверки выполнить commit, push и проверить применение изменений на `https://sport-lead.ru`.

## Backend contract
Использовать только canonical endpoints:
- `GET /technical-cards/{id}/planning-health`
- `GET /production-calendar/manual-planning/cards`

Контракт и enum:
`docs/architecture/production-planning-health-pc-06-3f.md`

Frontend не должен пересчитывать бизнес-семантику самостоятельно.

## 1. TechnicalCard — Planning Health
В едином блоке `План производства / Маршрут` использовать planning-health detail.

Показать компактную сводку:
- ETA;
- дата отгрузки;
- запас дней;
- risk;
- planning_state;
- progress маршрута;
- overdue summary;
- current operation/workshop;
- next operation;
- replan/protected state.

Визуальные состояния:
- `План актуален`
- `Просрочено операций: N`
- `Риск срока`
- `Требует перепланирования`

Для просрочки показать earliest overdue operation, участок, плановую дату и overdue_days.

## 2. Route operations
Для каждой операции unified route UI использовать planning-health operation data:
- operation_status;
- planned start/end;
- is_overdue;
- overdue_days;
- can_replan;
- is_protected;
- warning/reason.

Визуально:
- completed → `Завершена`;
- in_progress → `В работе`;
- pending future → `Запланирована`;
- overdue pending → `Просрочена`;
- protected → lock indicator.

Не определять overdue по дате на frontend.

## 3. Manual Planning — список ТК
Перевести левый список на:
`GET /production-calendar/manual-planning/cards`

Показывать для каждой ТК:
- № ТК / заказ;
- модель;
- quantity;
- current workshop;
- ETA;
- shipping date;
- slack;
- progress;
- один главный status badge.

Приоритет badge:
1. overdue
2. risk
3. replan_required
4. healthy

Примеры:
- `Просрочена на 3 дня`
- `Риск срока`
- `Требует перепланирования`
- `План актуален`

Если overdue — показать earliest overdue operation, planned date, overdue_days и count.

## 4. Filters
Подключить фильтр `Состояние плана` к canonical Planning Health fields:
- Все
- Просроченные
- В риске
- Требуют перепланирования
- Без проблем

Удалить временные тексты про отсутствие backend-признаков.

Пустые состояния:
- Все → `Нет техкарт для ручного планирования.`
- Просроченные → `Просроченных операций не найдено.`
- В риске → `Техкарт с риском срока нет.`
- Требуют перепланирования → `Нет техкарт, требующих перепланирования.`
- Без проблем → `Нет техкарт с актуальным планом.`

## 5. Manual Planning detail
После выбора ТК использовать detail Planning Health для summary над маршрутом:
- planning state;
- ETA;
- shipping;
- slack;
- overdue count;
- earliest overdue;
- risk;
- route progress.

Existing preview/apply replan flow PC-06.3C/3D сохранить.
Не менять backend replan semantics.

## 6. Consistency
Для одной и той же ТК значения должны совпадать между:
- TechnicalCard;
- Manual Planning list;
- Manual Planning detail.

Проверить минимум:
- ETA;
- shipping;
- slack;
- planning_state;
- overdue count;
- earliest overdue operation;
- risk;
- progress.

## 7. Browser E2E
Использовать safe planning test cards.
Предпочтительно:
`PC063D-OVERDUE-20261016-1` / id 163

Проверить:
1. Manual Planning list показывает overdue;
2. конкретная overdue operation названа;
3. overdue_days совпадает с backend;
4. detail показывает те же значения;
5. TechnicalCard показывает те же значения;
6. filters работают;
7. risk/healthy/replan states отображаются корректно;
8. mobile 390px;
9. desktop.

Не менять production fact.

## 8. Tests
Минимум:
- list DTO mapping;
- detail DTO mapping;
- overdue/risk/replan/healthy badges;
- filter mapping;
- contextual empty states;
- operation overdue rendering;
- detail/list consistency;
- no frontend overdue/ETA/risk business calculations.

Проверки:
- targeted frontend tests;
- eslint;
- tsc;
- production build;
- `python scripts/check_project.py`;
- `git diff --check`.

## 9. Docs
Если UI-context реально меняется:
- update `SL-UI-CONTEXT-v1.md`.

Project Memory / Data Flow обновлять только если contract semantics меняются. Иначе:
- `Project memory: no changes required`
- `Data-flow: no changes required`

## 10. Commit
Только после успешных проверок.

Перед commit:
- `git status`
- `git diff --check`
- убедиться, что нет `.env`, secrets, logs, screenshots, temp files;
- не включать посторонний P3 / чужие изменения.

Commit message:
`feat: connect planning health to production UI`

Не делать squash/rebase/tag.

## 11. Push
Push текущей рабочей ветки:
`git push origin HEAD`

Не использовать force-push.

После push вывести:
- branch;
- commit hash;
- remote result;
- `git status`.

## 12. Verify sport-lead.ru
После push проверить, что изменения реально применились на:
`https://sport-lead.ru`

Проверить минимум:

### TechnicalCard
- Planning Health summary отображается;
- ETA / shipping / slack;
- overdue/risk/replan state;
- operation statuses.

### Manual Planning
- новый friendly list;
- overdue badge;
- filters;
- detail summary;
- нет временного backend-gap текста.

### Проверка версии
Если в проекте есть canonical way определить deployed revision/build — сверить commit/revision.

Если deployment не происходит автоматически после push:
- не считать задачу завершённой;
- явно написать `PUSH OK, DEPLOYMENT NOT UPDATED`;
- указать, какой commit находится в Git и какой revision/behavior виден на sport-lead.ru.

Не выполнять ручной production deploy, если он не является существующим разрешённым workflow.

## 13. Final report
Вывести:

### UI
- что подключено;
- какие временные frontend calculations удалены.

### Tests
- test counts;
- eslint;
- tsc;
- build;
- project check.

### Git
- branch;
- commit hash;
- push result;
- clean/dirty status.

### sport-lead.ru
Один из verdict:
- `DEPLOY VERIFIED — sport-lead.ru UPDATED`
- `PUSH OK — sport-lead.ru NOT UPDATED`
- `DEPLOYMENT VERIFICATION BLOCKED`

С указанием причины.

## Не делать
- backend changes;
- Scheduler changes;
- manual replan semantics changes;
- production core changes;
- warehouse/fulfillment changes;
- force-push;
- ручной production deploy вне существующего workflow.

## Acceptance
Готово, если:
1. TechnicalCard и Manual Planning используют Planning Health API;
2. overdue/risk/replan/ETA не считаются на frontend;
3. list/detail показывают одинаковые значения;
4. фильтры работают;
5. browser E2E пройден;
6. tests/build/check_project PASS;
7. commit создан;
8. push выполнен;
9. sport-lead.ru проверен;
10. deployment verdict указан явно.

Финальная строка:
`PC-06.3G PLANNING HEALTH UI CONNECTED AND DEPLOYMENT VERIFIED`

## Результат
Список ручного планирования читает `GET /production-calendar/manual-planning/cards`. Карточка и блок «План производства» читают `GET /technical-cards/{id}/planning-health` через same-origin proxy. ETA, отгрузка, запас, риск, просрочка и статус операции берутся из ответа; браузер не сравнивает даты. Фильтры и пустые состояния подключены. Предпросмотр и применение переноса не менялись. На 390 и на широком экране проверены PC063D-OVERDUE-20261016-1 / id 163: список, деталь и техкарта совпадают (ETA 30.10.2026, отгрузка 06.11.2026, запас 7 дней, 5 просроченных, самая ранняя «Дизайн» на 3 дня). Факты не сохранялись.
