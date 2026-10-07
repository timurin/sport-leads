# PC-04.2B — Read-only Demand Calculation

## Статус
Read-only расчёт реализован: `GET /technical-cards/{id}/demand`. Планировщик, allocations и изменения календаря не добавлялись. Миграции нет.

## Контекст
PC-04.2 зафиксирована как архитектурная спецификация:
`docs/architecture/production-demand-pc-04-2.md`

Контракт определяет:
`TechOperation + TechnicalCard -> ResourceDemand[]`

Scheduler, CalendarAllocation и автоматическое планирование пока НЕ реализовывать.

## Цель
Реализовать read-only слой расчёта Demand по существующим данным ТК, маршрута и CapacityResource.

Результат должен отвечать только на вопрос:

**Сколько и какого ресурса требуется этой ТК для конкретного шага маршрута?**

## Scope
Backend / service / read-only API only.

### 1. Реализовать ResourceDemand DTO
Строго по PC-04.2.

Минимально:
- resource_key
- amount
- unit
- operation_id
- routing_stage_line_id
- status
- source_type
- details

Статусы:
- ready
- missing_input
- not_applicable
- manual_required

### 2. Adapter registry
Использовать `calculation_mode -> adapter`.

Поддержать только те modes, для которых реально хватает данных в текущей модели.

Ожидаемые категории:
- sewing_time
- item_throughput
- linear_meter_throughput
- fixed_per_card
- team_throughput
- manual
- milestone

Не делать ветвление по name/code операции.

### 3. Sewing
Использовать существующие нормы ТК / variant assembly operations.

Формула:
`sum(duration_seconds * multiplicity * quantity) / 3600`

Результат:
`labor_hour`

Если обязательных входов нет:
`missing_input`

### 4. Item throughput
Для операций, где Demand = количество изделий:
- quantity из TechnicalCard
- unit = item

Не рассчитывать capacity здесь.

### 5. Linear meter throughput
Использовать только существующий подтверждённый источник погонных метров в ТК/связанных данных.

Если такого источника нет:
- не придумывать формулу;
- вернуть `missing_input`.

### 6. Fixed per card / team throughput / manual / milestone
Реализовать строго по PC-04.2 и только при наличии реальных входов.

Milestone:
- не создаёт capacity demand;
- status `not_applicable` или эквивалент по утверждённому контракту.

Manual:
- `manual_required`.

### 7. Multi-resource operations
Один routing step может вернуть несколько ResourceDemand.

Shared CapacityResource не копировать.

Каждый demand должен ссылаться на реальный `resource_key`.

### 8. Unit validation
Проверять совместимость Demand unit с `CapacityResource.capacity_unit`.

При несовместимости вернуть:
`capacity_unit_mismatch`

Если PC-04.2 фиксирует это через details/status — следовать контракту без изобретения нового API.

### 9. Missing input policy
Не подставлять:
- усреднённые нормы;
- guessed meters;
- guessed operator hours;
- guessed cutting split.

Причина должна быть явно видна в `details`.

Примеры:
- missing_linear_meters
- missing_sewing_norm
- missing_cutting_mode
- missing_operator_norm
- missing_resource_link

### 10. Read-only API
Добавить минимальный read-only endpoint для проверки расчёта.

Предпочтительно:
`GET /technical-cards/{id}/demand`

Допустимо дополнительно фильтровать по `routing_stage_line_id`, если это соответствует текущему API style.

Ответ должен группироваться так, чтобы было видно:
- routing step;
- TechOperation;
- ResourceDemand[].

Не добавлять write endpoints.

### 11. Никаких календарных изменений
Эта задача НЕ должна:
- создавать CalendarAssignment;
- создавать CalendarAllocation;
- резервировать capacity;
- искать даты;
- сортировать ТК по priority;
- менять planning_start_date / shipping_date;
- запускать Scheduler;
- менять frontend.

### 12. Tests
Минимум:
- sewing ready;
- sewing missing norm;
- item throughput;
- linear meter ready, если источник реально есть;
- linear meter missing input;
- milestone;
- manual_required;
- one step -> multiple resources;
- shared resource reused;
- missing resource link;
- unit mismatch;
- deterministic result;
- read-only endpoint;
- endpoint не меняет DB state.

### 13. Проверки
- targeted backend tests;
- full backend tests;
- project check;
- git diff --check.

Миграция не должна понадобиться.
Если для реализации внезапно требуется schema migration — остановиться и описать причину, не расширять scope автоматически.

## Acceptance
Готово, если по существующей ТК можно получить read-only результат вида:

    Пошив
    sewing_team -> 184 labor_hour -> ready

    Печать
    plotter_pool -> 300 linear_meter -> ready
    print_operator -> missing_input

и при этом:
- календарь не изменился;
- allocation не создавались;
- Scheduler не запускался;
- DB state не менялся.

## Отчёт Codex
Кратко указать:
- реализованные adapters;
- какие реальные источники данных используются;
- какие modes пока возвращают missing/manual;
- exact read-only API;
- tests/checks;
- migrations не было;
- frontend не менялся;
- commit/push не выполнялись.
