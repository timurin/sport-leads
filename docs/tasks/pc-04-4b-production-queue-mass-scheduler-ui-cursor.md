# PC-04.4B — Production Queue & Mass Scheduler UI

## Контекст
PC-04.4A завершена.

Backend уже имеет:
`POST /production-calendar/schedule`

Mass Scheduler:
- выбирает standalone TechnicalCard;
- сортирует по priority;
- учитывает shipping_date / planning_start_date;
- использует общую CapacityResource;
- сохраняет CalendarAssignment / CalendarAllocation;
- пропускает blocked ТК;
- сохраняет manual / locked / fact;
- безопасен при конкурентных запусках.

Frontend массового планирования ещё нет.

## Цель
Дать начальнику производства понятный интерфейс очереди ТК и одно действие:
**Пересчитать производственный план**

Frontend не должен планировать даты сам.

## Scope
Frontend only / Cursor.

### 1. Основной экран
Использовать существующий раздел:
`/production/calendar`

Не создавать второй параллельный модуль очереди.

Добавить в toolbar календаря действие:

**Пересчитать производственный план**

Вызывает:
`POST /production-calendar/schedule`

Не запускать автоматически.

### 2. Состояние пересчёта
Во время запроса:
- кнопка disabled;
- текст `Пересчитываем...`.

После успеха:
- перечитать weekly board;
- перечитать load-state;
- обновить calendar-related routes;
- показать summary результата.

При ошибке:
- текущий календарь не скрывать;
- показать backend error;
- не строить локальный fallback plan.

### 3. Очередь ТК
Добавить компактное представление очереди, желательно без отдельной страницы.

Варианты реализации:
- панель / drawer;
- компактный блок над календарём;
- modal по кнопке `Очередь`.

Не перегружать недельную доску.

Для каждой ТК минимально показать:
- номер ТК / заказа;
- priority;
- shipping_date;
- planning_start_date;
- status:
  - planned
  - blocked
  - deadline risk
  - locked
- planned_completion_date, если есть.

### 4. Priority
Начальник производства должен уметь менять priority ТК.

Правило backend:
- меньшее число = выше;
- null = после всех явных priority.

UI:
- простой numeric priority;
- не использовать drag/drop как единственный источник порядка;
- после изменения priority НЕ запускать scheduler автоматически;
- показать, что требуется `Пересчитать производственный план`.

Если есть dirty priority changes:
- сохранить их через существующий TechnicalCard planning API;
- затем пользователь отдельно запускает пересчёт.

### 5. Summary результата
После mass schedule показать компактно:

- всего ТК;
- спланировано;
- blocked;
- с риском срока;
- preserved, если backend возвращает.

Не делать отдельный dashboard.

### 6. Result per card
Для blocked / risk ТК дать возможность посмотреть причину.

Показывать backend deviations:
- readiness_not_complete
- demand_calculation_missing
- manual_required
- capacity_missing
- no_available_capacity
- capacity_unit_mismatch
- locked_assignment_conflict
- deadline_missed

Не интерпретировать причины самостоятельно.

### 7. Calendar
После успешного пересчёта недельная доска должна показывать новый auto-plan:
- один assignment = одна полоска;
- диапазон только из backend dates;
- пастельные цвета стадий;
- manual/locked визуально не теряются.

Frontend не вычисляет allocations или duration.

### 8. Locked/manual
В очереди визуально различать:
- auto;
- manual_adjusted;
- locked / plan_locked.

Не давать массовому UI команду “force override”.

### 9. Production Calendar toolbar
Сохранить текущие вкладки:
- Календарь
- Ручное планирование
- Мощности
- Дашборд
- Центр отклонений

Mass schedule action разместить отдельно как primary action, не как новую вкладку.

### 10. Не делать
- не менять backend;
- не менять DB/migrations;
- не реализовывать scheduler logic на frontend;
- не добавлять background/auto schedule;
- не добавлять drag/drop scheduling;
- не добавлять bottleneck analytics;
- не менять Demand;
- не менять CapacityResource;
- не делать commit/push/merge.

## Tests
Минимум:
- mass schedule CTA calls correct endpoint;
- loading state;
- summary rendering;
- planned result;
- blocked result;
- deadline risk result;
- priority save;
- null priority;
- dirty priority does not auto-schedule;
- calendar refresh after persisted plan;
- backend error preserves current board;
- locked/manual display;
- no frontend date calculation.

## Проверки
- targeted frontend tests;
- full frontend tests;
- lint;
- tsc;
- production build;
- git diff --check;
- project check.

Если доступна авторизованная browser session:
1. открыть Production Calendar;
2. открыть очередь;
3. изменить priority двух ТК;
4. сохранить;
5. нажать `Пересчитать производственный план`;
6. проверить порядок;
7. проверить полоски;
8. проверить blocked/risk summary.

Если login недоступен — не блокировать задачу, покрыть integration tests.

## Acceptance
Начальник производства может:

1. увидеть очередь готовых ТК;
2. изменить priority;
3. явно запустить массовый пересчёт;
4. увидеть summary;
5. понять blocked/risk ТК;
6. увидеть новый план на недельном календаре.

## Отчёт Cursor
Указать:
- изменённые routes/components;
- exact mass schedule API usage;
- как реализована очередь;
- как меняется priority;
- как показаны summary/deviations;
- как обновляется board;
- tests/checks;
- backend/DB не менялись;
- commit/push не выполнялись.
