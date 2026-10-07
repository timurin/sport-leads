# PC-04.2 — Demand Calculation Contract

## Статус
Архитектурная спецификация. Без Scheduler engine.

## Выполнение — 2026-10-07

Результат: [ResourceDemand contract](../architecture/production-demand-pc-04-2.md). Это завершение архитектурной спецификации, а не реализации Demand layer. Документ зафиксировал DTO/step identity, registry adapters, реальные источники ТК/сборки, mixed cutting/team/fixed/design ограничения, missing-data и unit policy, M:N/shared-resource семантику, детерминизм и матрицу будущих тестов. API, модели, схемы, сервисы, DB, frontend и Scheduler engine этой итерацией не менялись.

PC-04.0 Demand table явно помечена как историческое предложение там, где PC-04.2 запрещает неявную конверсию throughput в часы. Legacy capacity/load-state остаётся работающим по своему контракту; часовые plotter/team ресурсы не переименовывались в meter/item, исключения не пересчитывались. Нормы fixed/operator/design и mixed split не обнаружены в текущих моделях: расчёт будет явно возвращать manual_required/missing_input, а не придумывать значения.

Проверки: `python scripts/check_project.py` — **10/10 / PROJECT CHECK PASSED**, 565 backend tests; frontend lint/typecheck/tests/build, OpenAPI, SQLAlchemy, Alembic и Compose passed на локальной БД :5432. Прикладные тесты Demand не добавлялись: §17 относится к будущей реализации. Проверены ссылки/JSON-примеры/арифметика спецификации, generator `--check`, `git diff --check` и состояние Git.

Roadmap и project-structure: PC-04.2 `[x]` означает только архитектурный контракт. **HTML twin synced**, включая v1.1 и generated Production Calendar roadmap. PC-04/PC-03 и функциональная реализация Scheduler не закрывались. ERP-check: changes not required — readiness приложения не менялась; прежний WIP сохранён. Изменённые файлы: новый `docs/architecture/production-demand-pc-04-2.md`, precedence note в `production-scheduler-pc-04-0.md`, этот task report, roadmap/project-structure MD+HTML twins и generator. Модели/таблицы/API-схемы/миграции/код backend и frontend не менялись; предложенный ResourceDemand DTO — спецификация, не публичный API.

P0/P1 в этой документационной итерации не выявлены; unit/rule gaps — явные ограничения будущей реализации, не замаскированные ошибки работающего load-state. Никаких записей в пользовательские данные, production apply, commit/push/merge. Следующая рекомендуемая отдельная итерация: реализация read-only Demand по этому контракту с approved stored rule inputs и тестами; Scheduler engine не начинать автоматически.

## Контекст
PC-04.1 завершена:
- TechnicalCard содержит planning_start_date, shipping_date, priority, plan_locked;
- CalendarAssignment привязан к routing_stage_line_id;
- CalendarAllocation подготовлена;
- CapacityResource используется как источник мощности;
- Scheduler ещё не реализован.

Следующий шаг — определить, как для каждого шага маршрута вычислять потребность конкретной ТК в ресурсах.

## Цель
Зафиксировать контракт:

`TechOperation + TechnicalCard -> ResourceDemand[]`

где каждый ResourceDemand содержит:
- `resource_key`
- `amount`
- `unit`
- `calculation_source`
- `calculation_details`
- `status`

Scheduler позже будет использовать этот результат для раскладки по мощности.

---

## 1. Общий контракт ResourceDemand

Минимальная структура:

- `resource_key`
- `amount`
- `unit`
- `operation_id`
- `routing_stage_line_id`
- `status`
- `source_type`
- `details`

### status
- `ready`
- `missing_input`
- `not_applicable`
- `manual_required`

### source_type
Примеры:
- `sewing_operation_times`
- `technical_card_quantity`
- `technical_card_linear_meters`
- `fixed_per_card`
- `fixed_per_batch`
- `manual`
- `milestone`

Не создавать универсальную формулу для всех операций.

---

## 2. Sewing / labor time

### Источник
Технологические операции/вариант сборки ТК.

Базовая формула:

`sum(duration_seconds * multiplicity * quantity) / 3600`

Результат:
`labor_hour`

### Требования
- использовать фактические операции ТК;
- quantity берётся из ТК;
- не округлять до дней;
- Scheduler позже сам разложит часы по дням;
- если нет duration_seconds или multiplicity — `missing_input`.

### Пример
- норма на изделие: 0.184 labor_hour
- quantity: 1000
- demand: 184 labor_hour

---

## 3. Throughput by items

Для операций, где потребность прямо связана с количеством изделий.

Примеры:
- ручной раскрой;
- лазерный раскрой;
- упаковка;
- некоторые контрольные/подготовительные операции.

### Источник
`TechnicalCard.quantity`

### Результат
`item`

Пример:
- quantity = 1000
- resource demand = 1000 item

Scheduler сравнит это с throughput ресурса.

---

## 4. Throughput by linear meters

Для операций печати/каландрирования.

### Источник
ТК должна предоставить рассчитанный объём в погонных метрах.

Результат:
`linear_meter`

### Важно
Scheduler НЕ должен самостоятельно вычислять метры из количества изделий, если в ТК нет подтверждённого правила расчёта.

Если linear meters отсутствуют:
`missing_input`

Не подставлять усреднённую норму.

---

## 5. Machine + operator

Одна операция может требовать несколько обязательных ресурсов.

Пример сублимационной печати:

- `plotter_pool` -> 300 linear_meter
- `print_operator` -> operator demand
- `calender` -> 300 linear_meter
- `calender_operator` -> operator demand

### Принцип
Machine demand и labor demand — разные ResourceDemand.

Не сводить их в одну единицу.

### Operator demand
Если для оператора есть подтверждённая норма:
- использовать её.

Если нормы оператора нет:
- `manual_required` или `missing_input`;
- не считать автоматически из machine hours без явного правила.

---

## 6. Team throughput

Для операций, где мощность задаётся бригадой.

Пример:
- упаковка;
- ВТО + упаковка.

### Потребность
`TechnicalCard.quantity`

### Unit
`item`

CapacityResource хранит производительность команды.

Не умножать throughput на количество сотрудников повторно, если resource_count уже описывает бригаду как ресурс.

---

## 7. Fixed per card / fixed per batch

Для операций типа:
- подготовка файла;
- базовая настройка;
- запуск заказа;
- техническая подготовка.

### Источник
Фиксированная норма операции.

Примеры:
- 1 labor_hour на ТК;
- 0.5 labor_hour на запуск.

### Важно
Fixed norm должна храниться в существующих данных операции/ТК/ресурса.
Не хардкодить в Scheduler.

Если такой настройки ещё нет:
- `manual_required`.

---

## 8. Design

Дизайн нельзя считать напрямую как `quantity × time`.

Для первой версии допустим только явный rule source.

Предлагаемый контракт:

- base_hours;
- unique_size_sets;
- unique_design_variants;
- details_count / complexity, если уже есть данные.

Пример формулы:
`base_hours + unique_variants * variant_hours`

Но:
- НЕ внедрять формулу, если этих параметров нет в текущей модели;
- зафиксировать как отдельный calculation adapter;
- при отсутствии входов — `manual_required`.

Ожидание согласования клиента НЕ является ресурсной загрузкой.

---

## 9. Cutting

### Manual cutting
Demand:
`quantity item`

CapacityResource:
throughput items/hour/person/team.

### Laser cutting
Demand:
`quantity item`

CapacityResource:
throughput items/hour/machine.

### Mixed mode
Если часть объёма идёт ручным способом, часть лазером:
- demand должен быть разбит по количеству;
- scheduler не делит объём сам без входных данных ТК.

То есть ТК/операция должна предоставить:
- manual_quantity
- laser_quantity

Или другой однозначный split.

Если split не задан:
`manual_required`.

---

## 10. Milestone

Для readiness/контрольных точек.

Примеры:
- материалы готовы;
- ТК готова;
- дизайн согласован;
- готово к отгрузке.

ResourceDemand:
- либо пустой список;
- либо status `not_applicable`.

Milestone не создаёт CalendarAllocation.

---

## 11. Missing data policy

Критически важно:

Scheduler не должен придумывать недостающие нормы.

Если расчёт невозможен:
- ResourceDemand.status = `missing_input` или `manual_required`;
- причина сохраняется в details;
- ТК не должна занимать мощность по этой операции;
- отклонение передаётся в будущий deviations layer.

Примеры причин:
- missing_linear_meters;
- missing_sewing_norm;
- missing_cutting_mode;
- missing_operator_norm;
- missing_resource_link.

---

## 12. Multiple resources per operation

Один RoutingStep может вернуть несколько ResourceDemand.

Пример:

`SublimationPrint`

возвращает:
- plotter_pool -> 300 linear_meter
- print_operator -> 5 labor_hour
- calender -> 300 linear_meter
- calender_operator -> 5 labor_hour

Все обязательные demands должны быть `ready`, иначе операция считается не полностью рассчитываемой.

---

## 13. ResourceDemand unit validation

Unit demand должна быть совместима с CapacityResource.capacity_unit.

Примеры:
- labor_hour <-> labor_hour
- linear_meter <-> linear_meter
- item <-> item
- machine_hour <-> machine_hour

Несовместимость:
- `capacity_unit_mismatch`

Scheduler не должен пытаться конвертировать несовместимые units автоматически.

---

## 14. Calculation adapter registry

Предлагаемый backend pattern:

`calculation_mode -> adapter`

Примеры:
- `sewing_time`
- `item_throughput`
- `linear_meter_throughput`
- `fixed_per_card`
- `team_throughput`
- `manual`
- `milestone`

TechOperation / CapacityResource уже содержит `calculation_mode`.

Не делать if/else по name/code операции.

---

## 15. Ответ adapter

Условный результат:

```text
[
  {
    resource_key: "sewing_team",
    amount: 184,
    unit: "labor_hour",
    status: "ready",
    source_type: "sewing_operation_times"
  }
]
```

или:

```text
[
  {
    resource_key: "plotter_pool",
    amount: 300,
    unit: "linear_meter",
    status: "ready"
  },
  {
    resource_key: "print_operator",
    amount: null,
    unit: "labor_hour",
    status: "manual_required",
    details: "Operator norm is not configured"
  }
]
```

---

## 16. Demand calculation scope

PC-04.2 implementation позже должна:
- только рассчитывать demand;
- не искать даты;
- не резервировать capacity;
- не создавать CalendarAllocation;
- не создавать CalendarAssignment;
- не менять priority;
- не выполнять scheduler.

---

## 17. Tests будущей реализации

Минимум:
- sewing hours;
- item throughput;
- linear meters;
- fixed per card;
- milestone;
- multi-resource operation;
- missing input;
- manual required;
- unit mismatch;
- shared resource;
- one TechOperation -> multiple demands;
- deterministic result.

---

## 18. Не входит

- календарная раскладка;
- поиск свободной мощности;
- deadline scheduling;
- priority sorting;
- manual locks;
- backward scheduling;
- batch splitting;
- actual production facts.

---

## 19. Acceptance

Demand layer готов, если для каждого routing step можно получить:

`ResourceDemand[]`

без знания календаря и без ручных догадок Scheduler.

Главный принцип:
**Demand отвечает только на вопрос "сколько ресурса нужно этой ТК для этой операции?".**
