# PC-04.0 — Production Scheduler v0.1 Architecture

## Статус
Архитектурная спецификация зафиксирована. Кода, миграций и API нет.

Результат: `docs/architecture/production-scheduler-pc-04-0.md`. Планировщик опирается на существующие техкарту, маршрут цеха и общий CapacityResource. Поля срока, приоритета, блокировки и дневных allocations в базе ещё отсутствуют и в этой итерации не добавлялись. Пункт дорожной карты PC-04 («Добавление существующей ТК в очередь») этой спецификацией не закрывается.

## Цель
Определить минимальный автоматический планировщик производства для standalone TechnicalCard.

Scheduler должен:
- брать ТК без обязательной связи с Lead / SalesOrder;
- использовать ручной номер заказа из ТК;
- учитывать маршрут ТК;
- использовать CapacityResource;
- автоматически формировать CalendarAssignment;
- рассчитывать загрузку ресурсов по дням;
- сравнивать плановую готовность с датой отгрузки;
- позволять начальнику производства вручную менять приоритет и фиксировать отдельные этапы.

## 1. Источники данных

### TechnicalCard
Минимально нужны:
- id / номер ТК;
- ручной номер заказа;
- created_at;
- planning_start_date;
- shipping_date;
- quantity;
- routing_id;
- priority;
- данные, необходимые для расчёта нагрузки по операциям;
- readiness / допустимость запуска.

Для новой ТК:
`planning_start_date = created_at/date_created`.

Для ранее созданной ТК:
пользователь может задать planning_start_date вручную.

`shipping_date` — дата отгрузки, согласованная с клиентом.

## 2. Route

Источник маршрута:
`settings/catalogs/routings`.

Маршрут определяет:
- какие TechOperation участвуют;
- порядок операций;
- обязательность операции;
- связи predecessor/successor, если они уже существуют в текущем контракте.

Не создавать отдельный calendar route.

## 3. TechOperation

Источник:
`settings/catalogs/tech-operations`.

TechOperation определяет:
- производственную операцию;
- единицу объёма;
- принадлежность к участку/цеху;
- связанные CapacityResource;
- материалы/другие существующие параметры.

TechOperation не хранит отдельную копию мощности.

## 4. CapacityResource

Источник истины по мощности.

Один CapacityResource может использоваться несколькими TechOperation.

Примеры:
- plotter_pool;
- print_operator;
- calender;
- calender_operator;
- manual_cutters;
- laser;
- laser_operator;
- sewing_team;
- packaging_team.

Параметры берутся из текущего PC-03.7A contract:
- resource type;
- capacity unit;
- base rate;
- resource count;
- hours/day;
- shifts/day;
- efficiency;
- working days;
- include in calendar load;
- calculation mode;
- exceptions.

## 5. Что Scheduler должен получить от операции

Для каждой операции маршрута Scheduler должен вычислить `Demand` — сколько ресурса требуется конкретной ТК.

### Пошив
`Σ(duration_seconds × multiplicity × quantity) / 3600`

Результат: `labor_hours`.

### Печать
Demand может включать несколько ресурсов:
- linear meters на plotter;
- labor hours print_operator;
- linear meters на calender;
- labor hours calender_operator.

### Раскрой
Demand:
- quantity items;
- selected cutting mode;
- соответствующий resource.

### Упаковка
Demand:
- quantity items;
- packaging team throughput.

### Milestone
Не создаёт hourly capacity demand.

## 6. Load Calculation Adapter

Не создавать универсальную формулу для всех операций.

Нужен слой расчёта:

`TechOperation + TechnicalCard -> ResourceDemand[]`

Пример:

    Sublimation print / TK 1760/1
    -> plotter_pool: 300 linear_meter
    -> print_operator: 5 labor_hour
    -> calender: 300 linear_meter
    -> calender_operator: 5 labor_hour

Расчёт должен использовать существующие данные ТК.

Если данных недостаточно:
- Scheduler не придумывает норму;
- операция получает состояние `calculation_missing`;
- ТК попадает в отклонение / требует ручного решения.

## 7. Readiness

До автоматического планирования ТК проходит readiness check.

Минимальные условия:
- ТК существует;
- quantity > 0;
- routing задан;
- planning_start_date задан;
- shipping_date задан;
- обязательные данные выбранных операций доступны;
- необходимые CapacityResource существуют.

Если readiness не выполнен:
- ТК остаётся в `Подготовка к запуску`;
- производственные операции не резервируют мощности.

## 8. Очередность ТК

MVP sorting:
1. manual priority;
2. shipping_date ASC;
3. planning_start_date ASC;
4. created_at ASC;
5. stable id/order.

Приоритет должен быть явным и предсказуемым.

## 9. Forward Scheduling

MVP планирует вперёд.

Для первой операции:
`earliest_start = planning_start_date`.

Для следующей:
`earliest_start = previous_operation_end`.

Scheduler:
1. получает Demand;
2. получает связанные ресурсы;
3. идёт по рабочим дням;
4. смотрит свободный остаток ресурса;
5. резервирует доступную мощность;
6. переносит остаток Demand на следующий рабочий день;
7. продолжает до полного размещения операции.

## 10. Daily Allocation

Для корректной загрузки нужен дневной результат.

Рекомендуемая сущность:
`CalendarAllocation`.

Минимально:
- assignment_id;
- resource_id;
- date;
- allocated_amount;
- capacity_unit.

Пример:

    1760/1 / Sewing
    07.10 -> 40 labor_hour
    08.10 -> 68 labor_hour
    09.10 -> 42 labor_hour

`CalendarAssignment` хранит span:
- planned_start_date;
- planned_end_date.

`CalendarAllocation` хранит плановое распределение мощности по дням.

## 11. Multi-resource operation

Если операция требует несколько ресурсов, она считается выполнимой только с учётом всех обязательных ресурсов.

### Sequential sub-resources
Например:
plotter -> calender.

Scheduler планирует их последовательно внутри операции/маршрута, если текущая модель route это позволяет.

### Concurrent constraint
Если ресурс является ограничением одной и той же операции:
например machine + operator,
Scheduler должен найти дни, где доступны оба.

Не суммировать machine hours и labor hours в одну единицу.

## 12. Working Calendar

При расчёте учитывать:
- working_days;
- hours/day;
- shifts/day;
- efficiency;
- resource_count;
- date exceptions;
- unavailable dates;
- override capacity.

Нерабочий день:
`capacity = 0`.

## 13. Capacity formula

Scheduler не должен использовать жёсткие константы.

Доступная мощность дня берётся из CapacityResource:

`available_capacity = configured_capacity - existing_allocations`

Конкретный `configured_capacity` рассчитывается в соответствии с resource type / calculation mode.

## 14. CalendarAssignment

Scheduler создаёт/обновляет assignment для каждой производственной операции ТК.

Минимально:
- technical_card_id;
- tech_operation_id / stage reference;
- planned_start_date;
- planned_end_date;
- position/order;
- planning_mode;
- manual_lock;
- note.

Предлагаемые planning_mode:
- auto;
- manual_adjusted;
- locked.

## 15. Ручная корректировка

### Priority override
Начальник производства меняет priority ТК.

После этого Scheduler пересчитывает только будущий незаблокированный план.

### Operation lock
Можно зафиксировать конкретную операцию:
- date/span;
- stage/resource placement.

Такой assignment получает:
`manual_lock = true`.

Scheduler не двигает его автоматически.

### Whole-card lock
Архитектурно предусмотреть возможность заблокировать весь будущий план ТК.
UI можно отложить.

## 16. Что нельзя пересчитывать

Scheduler не должен автоматически менять:
- завершённые операции;
- уже начатые фактически операции;
- прошлые даты;
- manual_lock assignments.

MVP пересчитывает только будущий план.

## 17. Planned completion

`planned_completion_date` = окончание последней обязательной производственной операции.

Сравнение:
`shipping_date - planned_completion_date`

Результат:
- positive -> reserve/buffer;
- zero -> в срок;
- negative -> delay risk.

## 18. Deviations

Scheduler должен уметь возвращать причины:
- readiness_not_complete;
- demand_calculation_missing;
- capacity_missing;
- no_available_capacity;
- deadline_missed;
- locked_assignment_conflict;
- resource_exception_conflict.

Не создавать отдельные ручные issue-карточки для каждого случая, если отклонение может быть вычислено.

## 19. Пересчёт

MVP triggers:
- ТК передана в производство;
- изменён priority;
- изменён routing;
- изменились нормы ТК;
- изменился CapacityResource;
- изменилось resource exception;
- manual assignment changed/unlocked.

На первом этапе допустим explicit action:
`Пересчитать план`.

Не обязательно делать автоматический background recalc после каждого изменения.

## 20. Scope MVP

PC-04 Scheduler MVP должен уметь:
1. выбрать готовые к планированию ТК;
2. отсортировать;
3. пройти route;
4. получить resource demand;
5. найти capacity;
6. создать Daily Allocations;
7. создать CalendarAssignments;
8. вычислить planned completion;
9. определить deadline risk;
10. сохранить результат;
11. уважать manual locks.

## 21. Не входит в MVP

- Lead / Bitrix24 integration;
- SalesOrder sync;
- полноценная 1С УНФ sync;
- ProductionJob/Batch;
- оптимизация по математической модели;
- APS solver;
- автоматический backward scheduling;
- split batch production;
- фактическое исполнение;
- purchase planning;
- AI planner.

## 22. Главный принцип

Scheduler должен быть детерминированным и объяснимым.

Для любой ТК пользователь должен понимать:
- почему она стоит именно в эти дни;
- какая мощность занята;
- какой ресурс является ограничением;
- почему заказ не успевает к shipping_date;
- какое ручное изменение повлияло на план.

Никакой скрытой «магии» в MVP.
