# PC-04.3B — Scheduler UI Integration

## Контекст
PC-04.3A завершён.

Backend уже умеет:
- `POST /technical-cards/{card_id}/schedule`;
- readiness check;
- проход маршрута;
- Demand;
- CapacityResource;
- CalendarAssignment;
- CalendarAllocation;
- planned completion;
- deadline status;
- manual/locked protection;
- атомарный пересчёт.

Frontend Scheduler ещё не подключён.

## Цель
Подключить существующий Scheduler backend к интерфейсу TechnicalCard и Production Calendar.

Frontend не должен рассчитывать даты, мощности или загрузку самостоятельно.

## Scope
Frontend only / Cursor.

### 1. Действие в TechnicalCard
В standalone TechnicalCard добавить действие:

**Пересчитать план**

Действие вызывает:
`POST /technical-cards/{id}/schedule`

Не запускать автоматически при открытии/сохранении карточки.

### 2. Состояние запуска
Во время запроса:
- disabled CTA;
- состояние `Рассчитываем...`.

После успеха:
- обновить данные ТК;
- обновить/инвалидировать Production Calendar data;
- показать краткий результат расчёта.

При ошибке:
- не закрывать карточку;
- не терять данные;
- показать backend reason/details.

### 3. Результат расчёта
Показать компактный блок **План производства**.

Минимально:
- плановая готовность;
- дата отгрузки;
- статус:
  - в срок;
  - запас N дней;
  - опоздание N дней;
- количество автоматически спланированных шагов;
- количество блокировок / отклонений, если backend это возвращает.

Не вычислять эти значения на frontend, если backend их отдаёт.

### 4. Шаги маршрута
Если response Scheduler содержит шаги/assignments:
показать read-only список:

`Операция | Начало | Окончание | Режим`

Пример:
- Печать — 08.10–09.10 — auto
- Раскрой — 10.10 — auto
- Пошив — 11.10–14.10 — auto

Если часть маршрута не рассчитана:
показывать backend status/reason.

### 5. Readiness / deviations
Поддержать понятные сообщения для:
- readiness_not_complete
- demand_calculation_missing
- manual_required
- capacity_missing
- no_available_capacity
- capacity_unit_mismatch
- locked_assignment_conflict
- deadline_missed

Не заменять backend reason своими догадками.

### 6. Manual/locked
Если ТК или шаг заблокирован:
- показать это в плане;
- не предлагать frontend-side override;
- Scheduler остаётся источником решения.

### 7. Production Calendar refresh
После успешного Scheduler:
- недельная доска должна перечитать assignments;
- полоски берутся из backend `planned_start_date/planned_end_date`;
- никаких локальных optimistic date calculations.

Если пользователь затем открывает `/production/calendar`, новый auto-plan должен быть виден.

### 8. CalendarAllocation
Не обязательно показывать все allocations в первой версии.

Но если backend board/load-state уже использует их:
- frontend должен корректно показывать обновлённую загрузку;
- не строить свою allocation-модель.

### 9. CTA placement
Предпочтительно разместить `Пересчитать план`:
- в header/actions TechnicalCard;
или
- в блоке планирования.

Не перегружать карточку.

### 10. Shipping / planning fields
Если TechnicalCard UI уже имеет:
- planning_start_date
- shipping_date
- priority
- plan_locked

использовать текущие поля.

Если их нет в UI:
- добавить минимально в существующий подходящий блок;
- не создавать отдельную страницу настроек.

Обязательные для Scheduler:
- planning_start_date
- shipping_date

Priority:
- integer;
- меньше = выше;
- null допустим.

Plan locked:
- простой toggle/read-only state по текущему контракту.

### 11. Не делать
- не менять backend;
- не менять DB/migrations;
- не менять Scheduler algorithm;
- не рассчитывать capacity на frontend;
- не добавлять auto-recalc;
- не добавлять массовое планирование;
- не добавлять drag&drop;
- не менять resource links;
- не делать commit/push/merge.

## Tests
Минимум:
- schedule CTA calls endpoint;
- loading state;
- successful result;
- deadline status;
- readiness error;
- manual_required error;
- capacity error;
- locked state;
- calendar refresh/invalidation;
- no frontend date calculation;
- planning_start_date/shipping_date persisted through existing API;
- existing TechnicalCard edit not broken.

## Проверки
- targeted frontend tests;
- full frontend tests;
- lint;
- tsc;
- production build;
- git diff --check;
- project check.

Если авторизованная browser session доступна:
проверить полный сценарий:
1. открыть standalone ТК;
2. задать planning_start_date;
3. задать shipping_date;
4. `Пересчитать план`;
5. открыть Production Calendar;
6. увидеть auto assignments.

Если сессия недоступна:
не блокировать задачу только из-за 307/login; покрыть integration tests.

## Acceptance
Готово, если пользователь может из TechnicalCard:

1. задать входные даты;
2. нажать `Пересчитать план`;
3. увидеть результат Scheduler;
4. понять плановую готовность и deadline risk;
5. открыть Production Calendar и увидеть автоматически сформированные полоски.

## Отчёт Cursor
Указать:
- изменённые frontend files/routes;
- exact schedule endpoint usage;
- какие поля ТК добавлены/использованы;
- как показаны deviations;
- как обновляется calendar;
- tests/checks;
- backend/DB не менялись;
- commit/push не выполнялись.
