# PC-04.4G — Unified Routing Graph for Kanban & Calendar

## Исполнитель
Codex

## Контекст

Сейчас в проекте существует потенциальное дублирование производственной логики:

- `/settings/catalogs/routings` описывает маршрут изделия;
- маршрут используется Model / TechnicalCard;
- `/production/tech-cards?view=kanban` показывает движение ТК;
- Production Calendar имеет собственную dependency/planning logic.

Это нужно объединить.

## Каноническое решение

`/settings/catalogs/routings` = **единственный источник производственного маршрута**.

Маршрут имеет два уровня:

### Родительский уровень
**Цех**

Используется Kanban.

Пример:
- Печать
- Раскрой
- Пошив
- Контроль качества

### Дочерний уровень
**Технологические операции внутри цеха**

Используется Production Calendar.

Пример:

Печать
- Подготовка макетов к печати
- Сублимационная печать
- Каландрирование

Kanban показывает:
`Печать`

Calendar планирует:
- Подготовку;
- Печать;
- Каландр.

---

# 1. Главные бизнес-правила

## 1.1 Родитель = именно Цех

Не вводить отдельную абстрактную сущность "родительский этап",
если Workshop/Shop уже существует.

Kanban должен отвечать:

**В каком цеху сейчас находится ТК?**

Это критичный пользовательский смысл.

---

## 1.2 Дочерние элементы = TechOperation

Каждый узел внутри цеха маршрута ссылается на существующую TechOperation.

Не создавать CalendarOperation / SchedulerOperation.

Использовать существующий каталог технологических операций.

---

## 1.3 Последовательность по умолчанию

Внутри цеха операции по умолчанию выполняются последовательно:

`A -> B -> C`

Это безопасный default.

Параллельность должна задаваться только явно.

Не выводить параллельность автоматически из совпадающих цехов, ресурсов или дат.

---

## 1.4 Параллельность опциональна

Routing graph должен поддерживать явные зависимости.

Например:

Design ─┐
        ├─> Print
Procure ─┘

или внутри одного цеха:

A ─┬─> B
   └─> C
B + C -> D

Но пользователь должен создать такую ветку намеренно.

---

## 1.5 Автоматическое движение Kanban

ТК находится в родительском цехе до тех пор,
пока не завершены все обязательные операции этого цеха.

Когда все обязательные дочерние операции завершены:

- текущий цех считается завершённым;
- ТК автоматически переходит в следующий родительский цех маршрута.

Не требовать ручного переноса Kanban как основной flow.

Manual override можно сохранить только если он уже существует и нужен для compatibility.

---

# 2. Цель задачи

Провести аудит и привести backend architecture к модели:

`Model`
→ `Routing`
→ `Workshop nodes + TechOperation nodes + dependencies`
→ `TechnicalCard route snapshot`
→ одновременно:
  - Kanban = фактический родительский Workshop;
  - Calendar = план дочерних TechOperation.

Calendar не должен иметь отдельную маршрутизацию.

---

# 3. Сначала аудит

До правок проверить:

- Routing model;
- routing stage lines;
- shop/workshop routing structures;
- ProductionStage;
- TechnicalCard route snapshot;
- TechnicalCardOperationLine;
- Kanban backend;
- CalendarAssignment;
- CalendarAllocation;
- Scheduler;
- dependency/calendar graph;
- фактические production status transitions.

Составить карту:

`Routing -> TechnicalCard -> Kanban`
и
`Routing -> Scheduler -> Calendar`

Указать точки, где сейчас создаётся второй/дублирующий маршрут.

---

# 4. Canonical Routing structure

Проверить возможность использовать текущие сущности без создания новых.

Предпочтительная модель:

## Routing
Шаблон производственного маршрута.

## Workshop / Shop node
Родительская группа операций.

## Routing operation node
Ссылка на TechOperation.

Минимальные свойства operation node:

- id;
- routing_id;
- workshop_id;
- tech_operation_id;
- order/position;
- required;
- optional dependency metadata.

Не дублировать:
- operation name;
- capacity rules;
- equipment rules.

Они берутся из TechOperation / WorkCenter.

---

# 5. Dependencies

Нужно поддержать dependency graph.

По умолчанию:
если пользователь просто добавляет операции по порядку:

`op1 -> op2 -> op3`

Для явной параллельности dependency хранится явно.

Предпочтительный contract:

`routing_node_dependency`
или эквивалент существующей модели.

Например:
- predecessor_node_id
- successor_node_id

Не хранить calendar-specific dependency.

Routing dependency должен использоваться:
- Scheduler;
- read-only graph TechnicalCard;
- будущий visual route editor.

---

# 6. Межцеховая зависимость

По умолчанию:

последние обязательные операции Workshop A
→ первые обязательные операции Workshop B.

Если graph позволяет явную параллельность между цехами:
это задаётся специально.

Не создавать скрытые parallel branches.

---

# 7. TechnicalCard snapshot

При создании standalone TechnicalCard / production TechnicalCard:

копировать текущую структуру Routing в snapshot ТК.

Snapshot должен содержать достаточные данные, чтобы:

- изменение шаблона Routing позже не изменило уже запущенную ТК;
- Kanban понимал текущий Workshop;
- Calendar/Scheduler понимал операции и dependencies.

Проверить существующие snapshot structures и переиспользовать их.

Не заставлять активную ТК постоянно читать live Routing template.

---

# 8. Kanban contract

`/production/tech-cards?view=kanban`

Kanban columns = Workshop/Shop из snapshot маршрута ТК.

Не TechOperation.

Пример:

Routing:
Печать
  - Подготовка
  - Сублимация
  - Каландр
Раскрой
  - Ручной раскрой

Kanban:
- Печать
- Раскрой

ТК остаётся в `Печать`, пока обязательные операции:
- Подготовка;
- Сублимация;
- Каландр

не завершены.

После завершения всех:
автоматический переход → `Раскрой`.

---

# 9. Calendar contract

Production Calendar не создаёт свои stages/routes.

CalendarAssignment должен ссылаться на конкретную operation node / snapshot operation.

Calendar показывает операции:

- Подготовка макетов;
- Сублимационная печать;
- Каландр;
- Ручной раскрой;
- Пошив;
- ВТО;
- Упаковка.

Для каждой операции:
- planned_start;
- planned_end;
- allocations;
- resource;
- work_center.

Родительский Workshop используется для группировки строк/фильтра,
но не заменяет конкретную операцию.

---

# 10. Scheduler

Scheduler должен обходить dependency graph snapshot ТК.

Не использовать отдельный calendar route.

Правила:

### Sequential
Successor не начинается до завершения predecessor.

### Parallel
Если два узла имеют одного predecessor,
они могут планироваться параллельно,
если resources/capacity позволяют.

### Join
Операция с несколькими predecessors
может стартовать только после завершения всех обязательных predecessors.

Не вводить сложный APS.

Использовать существующий forward scheduler.

---

# 11. Production fact

Нужно чётко разделить:

## Calendar
План.

## Kanban
Факт текущего цеха.

## Operation status
Факт выполнения конкретной технологической операции.

Проверить, где сейчас хранится fact/status операции.

Если status operation отсутствует:
не придумывать большой execution module в этой задаче.

Зафиксировать минимальный необходимый contract.

Но automatic workshop transition должен иметь однозначный источник "операция завершена".

---

# 12. ProductionStage

Особенно проверить `/settings/catalogs/production-stages`.

Если ProductionStage сейчас ещё раз задаёт последовательность:
- Дизайн;
- Печать;
- Раскрой;
- Пошив;

это duplicate routing concern.

Определить фактическую роль.

Допустимые роли после рефакторинга:
- status vocabulary;
- visual grouping;
- execution state.

Недопустимая роль:
отдельный источник порядка операций параллельно Routing.

Не удалять сущность без аудита.

---

# 13. Existing "Зависимости календаря"

Текущая схема dependency в Production/TechnicalCard должна стать:

**read-only visualisation одного Routing snapshot graph.**

Не отдельным редактором calendar dependencies.

Все изменения dependency делаются в:
`/settings/catalogs/routings`

Для уже созданной ТК snapshot остаётся стабильным.

---

# 14. Route editor future contract

Backend должен подготовить контракт для будущего DnD-конструктора.

UI должен иметь возможность получить:

- workshops;
- operation nodes;
- node coordinates/order if needed;
- edges/dependencies;
- required/optional flag;
- tech operation;
- equipment constraints if already part of route.

Не хранить pixel coordinates в backend, если можно восстановить layout по graph/order.
Если future UI layout metadata действительно нужно — только документировать, не внедрять без причины.

---

# 15. Example target route

Пример:

## Цех Печать

1. Подготовка макетов к печати
2. Сублимационная печать
3. Каландрирование

## Цех Раскрой

4. Ручной раскрой

## Цех Пошив

5. Пошив

## Цех Контроль качества

6. ВТО
7. Упаковка

Kanban:
`Печать -> Раскрой -> Пошив -> Контроль качества`

Calendar:
все 7 TechOperation.

---

# 16. Optional parallel example

Поддержать, но не делать default:

Цех Печать:

Подготовка ─┐
            ├─> Сублимационная печать
Другой prep ┘

или cross-workshop только если пользователь явно задаёт dependency.

---

# 17. Миграции

Сначала определить, можно ли использовать существующие:
- routing stage lines;
- shop routing stage lines;
- TechnicalCardOperationLine;
- CalendarAssignment.routing_stage_line_id.

Предпочтительно минимальная migration или вообще без migration.

Если текущая data model не может хранить graph dependencies:
описать минимальную migration.

Не создавать второй graph model параллельно существующему.

---

# 18. Compatibility

Не сломать:

- существующие Routing templates;
- Model → Routing;
- standalone TechnicalCard;
- Kanban;
- Scheduler single-card;
- mass Scheduler;
- CalendarAssignment;
- CalendarAllocation;
- manual/locked plans;
- VIS-STRESS dataset.

VIS-STRESS не удалять и не пересоздавать.

---

# 19. Scope этой задачи

Главная задача:
**backend architecture + contract + минимальная реализация устранения duplicate routing.**

Frontend DnD editor НЕ делать в PC-04.4G.

После backend contract отдельная задача Cursor:
`PC-04.4H — Visual Routing Graph Editor`.

---

# 20. Tests

Минимум:

### Routing
- sequential workshop route;
- multiple operations one workshop;
- multiple workshops;
- explicit parallel branch;
- join after parallel branches.

### Snapshot
- TK gets immutable route graph snapshot;
- template edit does not mutate existing TK.

### Kanban
- card grouped by current workshop;
- completing one child operation does not move card early;
- completing all required operations moves automatically;
- next workshop selected correctly.

### Scheduler
- reads same route graph;
- sequential operations;
- parallel operations;
- join;
- allocations remain operation-specific.

### Calendar
- assignments map to route operation nodes;
- no separate calendar stage required.

### Regression
- single schedule;
- mass schedule;
- locked/manual assignments;
- existing routing APIs.

Full:
- targeted tests;
- full backend tests;
- project check;
- git diff --check.

---

# 21. Deliverable / report

До/после архитектурная схема:

## BEFORE
Показать реальные текущие sources:
- Routing;
- Kanban;
- Calendar/Scheduler.

## AFTER

`Routing template`
↓
`TechnicalCard route snapshot`
├── `Kanban -> Workshop fact`
└── `Scheduler/Calendar -> TechOperation plan`

Отчёт должен содержать:

1. текущие duplicate points;
2. существующие сущности, которые переиспользованы;
3. какие сущности перестали быть источником route order;
4. snapshot contract;
5. dependency graph contract;
6. automatic Kanban transition;
7. CalendarAssignment linkage;
8. migrations;
9. backward compatibility;
10. tests/checks;
11. что должен реализовать Cursor в следующей задаче.

---

# 22. Ограничения

НЕ:
- делать DnD frontend;
- создавать новый calendar routing catalog;
- удалять ProductionStage без аудита;
- менять Demand/Capacity rules;
- менять WorkCenter capacity;
- запускать stress test;
- удалять VIS-STRESS;
- commit/push/merge.

---

# Acceptance

PC-04.4G готова, если:

1. Routing является единственным source of truth структуры производства;
2. родитель route = Workshop;
3. child nodes = TechOperation;
4. Kanban использует Workshop;
5. Calendar использует child TechOperation;
6. parallel dependency только explicit;
7. default order sequential;
8. TechnicalCard имеет immutable snapshot graph;
9. Kanban автоматически переходит после завершения всех required child operations;
10. Scheduler читает тот же graph;
11. отдельная calendar routing logic устранена/депрекейтнута;
12. текущие production flows не сломаны.

Финальная строка отчёта:
`UNIFIED ROUTING GRAPH CONTRACT READY FOR VISUAL EDITOR`

## Выполнение первой итерации — 2026-10-07

Из-за объёма migration + Scheduler + fact/WIP/FG cutover задача разделена согласно AGENTS.md. **Выполнена только PC-04.4G-A**: аудит, общий contract/validator/topological helper и read-only projections. [Подэтап G-A](pc-04-4g-a-routing-graph-contract-projections.md); [полный BEFORE/AFTER, snapshot/dependency/migration/compatibility contract](../architecture/unified-routing-graph-pc-04-4g.md). Общая PC-04.4G не закрыта, её12 acceptance points целиком ещё не выполнены.

В коде переиспользованы ShopRoutingStageLine, ProductionStage, TechnicalCardStageResult и TechnicalCardOperationLine; новый календарный маршрут/каталог не создан. Добавлены GET `/shop-routings/{id}/graph`, GET `/technical-cards/{id}/route-graph`. Nodes ссылаются на существующие Workshop/TechOperation; default sequential, explicit edges валидируются как DAG. Карточка читается только из собственных snapshot rows, пробелы явные. Workshop progress — read-only completion projection; current workshop берётся из существующего fact pointer. Автоматическое движение Kanban и Scheduler пока не переключены.

Existing P1 подтверждён отдельно в SQLite dry-run: после вставки нового live template step copied snapshot сохраняет2 nodes, а старый Scheduler планирует3; persisted=false, live данные не затронуты. Исправление требует G-B/G-C. G-A не выдаётся за его устранение. Описана минимальная миграция: template required/edges; расширение существующих snapshot/fact rows и card-scoped copied edges; CalendarAssignment snapshot node FK с legacy provenance compatibility. Миграции пока не выполнялись; protected plans, norms, WorkCenter capacity и frontend не менялись.

Остаются G-B immutable persistence/backfill/assignment binding, G-C Demand/Scheduler/fact/scan/WIP/FG integration, затем PC-04.4H. Для cross-workshop параллельного факта нужен явный договор primary/active workshop; новая скрытая физическая принадлежность не выбрана. Разделение подэтапов ограничивает эту итерацию одним reviewable результатом, а не закрывает незавершённую архитектуру.

Проверки G-A:11 targeted,653 backend,352 frontend; project check10/10, exit0; graph-only читающие API не пишут в БД. Source VIS-STRESS30 ТК, их125 fact и125 operation rows, planning/assignments/allocations сверены before/after без изменений. No migration/frontend/live schedule/stress/commit/push. **HTML twin synced**; PC-04.4G-A закрыт, PC-04.4G открыт, P1 snapshot drift явно не устранён. Подробные checks/files/границы — в отчёте G-A.

UNIFIED ROUTING GRAPH CONTRACT READY FOR VISUAL EDITOR
