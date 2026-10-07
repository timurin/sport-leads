# PC-04.2C — Capacity / Demand Unit Alignment

## Статус
Единицы каталога выровнены с ResourceDemand. Живые ключи: `plotter_1`…`plotter_4`, `calender`, `cutters`, `laser`, `packing_team`. Дубли `plotter_pool`, `sewing_team`, `manual_cutters` не создавались. Планировщик и формула дневной мощности не реализовывались. Frontend не менялся.

## Контекст
PC-04.2B реализовал read-only Demand.

Он выявил реальные несоответствия между естественной единицей потребности ТК и текущей `capacity_unit` некоторых `CapacityResource`.

Примеры:
- plotter_pool: ТК даёт `linear_meter`, ресурс сейчас `machine_hour`;
- packing_team: ТК даёт `item`, ресурс сейчас `team_hour`;
- sewing_team уже корректно работает через `labor_hour`;
- operator resources требуют отдельной нормы и не должны автоматически наследовать machine load.

Scheduler пока НЕ реализовывать.

## Цель
Привести существующие `CapacityResource` к единицам, которые напрямую совместимы с ResourceDemand, и убрать искусственные `capacity_unit_mismatch`.

## Scope
Backend / data / migration / tests only.

### 1. Аудит живых CapacityResource
Проверить все существующие ресурсы и составить таблицу:
- resource_key;
- current capacity_unit;
- calculation_mode;
- base_rate;
- resource_count;
- связанные TechOperation;
- ожидаемая Demand unit по PC-04.2B.

Не менять данные до завершения аудита.

### 2. Зафиксировать целевые единицы

Предпочтительная модель:

- plotter_pool -> `linear_meter`
- calender -> `linear_meter`
- manual_cutters -> `item`
- laser -> `item`
- sewing_team -> `labor_hour`
- packing_team -> `item`
- print_operator -> `labor_hour`
- calender_operator -> `labor_hour`
- milestone -> null / not applicable

Если реальные resource keys отличаются — использовать существующие ключи, не создавать дубли.

### 3. Throughput semantics
Для throughput-resource хранить:
- `capacity_unit` = натуральная единица Demand (`item`, `linear_meter`);
- `base_rate` = производительность за час;
- `resource_count` = число параллельных единиц ресурса, если применимо;
- `hours_per_day`, `shifts_per_day`, `efficiency` — как сейчас.

Будущий Scheduler сам посчитает дневную capacity:
`base_rate * resource_count * hours_per_day * shifts_per_day * efficiency`

На этом этапе формулу Scheduler НЕ реализовывать.

### 4. Plotters
Не переводить Demand из метров в machine_hour.

Целевая модель:
- demand: linear_meter;
- capacity_unit: linear_meter;
- base_rate: meters/hour per plotter;
- resource_count: number of plotters.

Существующие данные сохранить.

### 5. Calender
Аналогично:
- demand: linear_meter;
- capacity_unit: linear_meter;
- base_rate: meters/hour;
- resource_count: machines.

### 6. Cutting
Manual and laser resources:
- demand unit = item;
- capacity_unit = item;
- base_rate = items/hour;
- resource_count = people/machines according to resource semantics.

Не смешивать manual cutters и laser в один ресурс.

### 7. Sewing
Оставить:
- demand = labor_hour;
- capacity_unit = labor_hour.

Не переводить в item.

### 8. Packaging
Целевая модель:
- demand = item;
- capacity_unit = item;
- base_rate = team throughput items/hour.

Важно:
если `packing_team` описывает уже целую бригаду, не умножать производительность повторно на число сотрудников.

Нужно явно зафиксировать семантику `resource_count` для team resource:
- либо resource_count=1 и base_rate = throughput всей команды;
- либо иная текущая модель, но без двойного умножения.

### 9. Operators
Оставить:
- print_operator -> labor_hour
- calender_operator -> labor_hour

Не конвертировать machine/throughput demand в labor hours автоматически.

Для операций без подтверждённой operator norm read-only Demand должен продолжать возвращать:
- `manual_required`
- `missing_operator_norm`

Это НЕ ошибка модели.

### 10. Milestone
Milestone:
- не имеет capacity demand;
- не участвует в hourly/throughput load;
- capacity_unit не требуется.

### 11. Migration
Если изменение units требует миграции:
- reversible;
- сохранить resource keys;
- сохранить links TechOperation <-> CapacityResource;
- сохранить exceptions;
- не создавать новые ресурсы без необходимости.

Если текущий enum/constraint не поддерживает нужные units — расширить минимально.

### 12. Demand regression
После изменения повторно проверить PC-04.2B.

Ожидаемо:
- plotter_pool demand по meters -> `ready`, если volume есть;
- calender -> `ready`, если volume есть;
- packing_team -> `ready` по quantity;
- sewing_team остаётся `ready` при наличии sewing norm;
- operator resources остаются `manual_required`, если operator norm отсутствует.

### 13. Не делать
- не реализовывать Scheduler;
- не создавать CalendarAllocation автоматически;
- не менять CalendarAssignment;
- не менять TechnicalCard;
- не менять frontend;
- не придумывать operator hours;
- не менять routing semantics;
- не делать commit/push/merge.

## Tests
Минимум:
- resource unit migration;
- plotter linear_meter;
- calender linear_meter;
- manual cutting item;
- laser item;
- sewing labor_hour;
- packaging item/team semantics;
- operator labor_hour stays manual_required without norm;
- milestone unchanged;
- shared resource links preserved;
- exceptions preserved;
- GET /technical-cards/{id}/demand regression.

## Проверки
- targeted backend tests;
- full backend tests;
- migration upgrade/downgrade/upgrade if needed;
- project check;
- git diff --check.

## Acceptance
После PC-04.2C:
- натуральная unit Demand совпадает с CapacityResource для throughput-ресурсов;
- искусственные `capacity_unit_mismatch` устранены;
- реальные отсутствующие нормы остаются явными `missing/manual`;
- Scheduler ещё не реализован.

## Отчёт Codex
Указать:
- audited resources;
- changed units / rates;
- migration id, если есть;
- packaging team semantics;
- какие Demand statuses стали ready;
- какие manual_required остались и почему;
- tests/checks;
- frontend не менялся;
- commit/push не выполнялись.
