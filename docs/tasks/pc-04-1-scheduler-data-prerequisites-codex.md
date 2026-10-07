# PC-04.1 — Scheduler Data Prerequisites

## Статус
Схема данных подготовлена. Планировщик, расчёт потребности и автоматические allocations не реализованы.

Миграция `z5a6b7c8d901`. Горизонт поиска — константа `SCHEDULER_HORIZON_DAYS = 120`, не поле техкарты. Пункт дорожной карты PC-04 этой задачей не закрывается.

## Контекст
PC-04.0 уже зафиксирована как архитектура:
`docs/architecture/production-scheduler-pc-04-0.md`

Scheduler пока НЕ реализовывать.

Нужно подготовить backend/DB-модель под будущий Scheduler:
- поля планирования в TechnicalCard;
- планировочные блокировки;
- корректная идентичность CalendarAssignment по шагу маршрута;
- сущность дневного распределения мощности CalendarAllocation.

## Цель
Подготовить минимальную и безопасную схему данных для PC-04 Scheduler MVP без изменения текущего production workflow и без автоматического планирования.

## Scope
Backend / DB / API only.

### 1. TechnicalCard — поля планирования
Добавить:
- `planning_start_date`
- `shipping_date`
- `priority`
- `plan_locked`

#### planning_start_date
Для новой standalone ТК:
- по умолчанию = дата создания ТК.

Для ранее созданной ТК:
- поле редактируемое вручную.

#### shipping_date
Отдельная дата отгрузки, согласованная с клиентом.

ВАЖНО:
- существующая «дата желания» / желаемая дата группы заказа НЕ становится `shipping_date`;
- не мигрировать её автоматически;
- если shipping_date не задана, оставлять null.

#### priority
Меньшее значение = выше приоритет.

Предпочтительно integer с безопасным default для существующих ТК.

#### plan_locked
Блокирует автоматический пересчёт будущего плана всей ТК.
Default: `false`.

Не смешивать с lock отдельного CalendarAssignment.

### 2. CalendarAssignment — привязка к шагу маршрута
Текущую уникальность вида:
`TechnicalCard + workshop/section`

заменить на:
`TechnicalCard + RoutingStep`

или эквивалентную устойчивую ссылку на конкретный шаг маршрута.

Перед миграцией:
- провести аудит текущего routing step/entity;
- переиспользовать существующий id/foreign key;
- не создавать новый дублирующий RouteStep.

Если однозначно сопоставить существующие assignments с route step невозможно:
- остановиться;
- описать конфликт;
- не угадывать.

### 3. CalendarAllocation
Добавить сущность дневного распределения мощности.

Минимально:
- `id`
- `assignment_id`
- `capacity_resource_id`
- `date`
- `allocated_amount`
- `capacity_unit`
- timestamps, если соответствуют conventions проекта.

Назначение:
- хранить плановую дневную загрузку ресурса;
- не хранить факт;
- не смешивать разные units.

Рекомендуемая уникальность:
`assignment + capacity_resource + date`

### 4. CalendarAssignment planning flags
Проверить существующие поля.

Если их нет, подготовить минимально:
- `planning_mode`
- `manual_lock`

Предлагаемые значения:
- `auto`
- `manual_adjusted`
- `locked`

Если `manual_lock` и `planning_mode=locked` дублируют друг друга — выбрать один непротиворечивый контракт и описать решение.

### 5. Horizon
Не хранить 120 дней как бизнес-поле ТК.

Это техническая константа будущего Scheduler:
- поиск мощности максимум 120 календарных дней;
- если мощность не найдена, будущий Scheduler вернёт `no_available_capacity`.

Сам поиск НЕ реализовывать.

### 6. API
TechnicalCard API должен читать/принимать:
- planning_start_date
- shipping_date
- priority
- plan_locked

CalendarAssignment API:
- сохранить backward compatibility где разумно;
- добавить route-step identity/reference;
- не менять create-flow больше необходимого.

CalendarAllocation:
- достаточно model/repository/schema/service foundation;
- отдельный public CRUD endpoint не обязателен.

### 7. Migration
Нужна reversible migration.

Требования:
- existing TechnicalCard data сохранить;
- planning_start_date backfill из даты создания, если безопасно и дата доступна;
- shipping_date не заполнять из «даты желания»;
- priority безопасный default;
- plan_locked=false;
- CalendarAssignment migration не должна терять назначения;
- CalendarAllocation — новая пустая таблица.

При неоднозначной миграции route step — остановиться и описать конфликт.

### 8. Что НЕ делать
- не реализовывать Scheduler engine;
- не рассчитывать Demand;
- не формировать allocations автоматически;
- не менять frontend;
- не менять capacity logic;
- не менять routings semantics;
- не добавлять ProductionJob/Batch;
- не делать commit/push/merge.

## Tests

### TechnicalCard
- create with defaults;
- planning_start_date default;
- explicit planning_start_date;
- shipping_date nullable;
- priority semantics;
- plan_locked persistence;
- «дата желания» не попадает в shipping_date.

### CalendarAssignment
- two steps in same workshop can coexist;
- unique per TechnicalCard + route step;
- existing assignments preserved where mapping is unambiguous.

### CalendarAllocation
- create/persist;
- unique assignment/resource/date;
- multiple days;
- multiple resources;
- unit preserved;
- deleting assignment handles allocations consistently.

### Migration
- upgrade;
- downgrade;
- upgrade;
- data preservation.

## Проверки
- targeted backend tests;
- full backend tests;
- migration cycle;
- project check;
- git diff --check.

## Acceptance
После PC-04.1:
- TechnicalCard содержит все планировочные входные поля;
- CalendarAssignment однозначно привязан к шагу маршрута;
- CalendarAllocation готов для дневной загрузки;
- ручные/автоматические блокировки имеют понятный контракт;
- Scheduler ещё не реализован;
- текущий Production Calendar не сломан.

## Отчёт Codex
Указать:
- какие модели/таблицы изменены;
- migration id;
- как сделан backfill;
- как решена route-step identity;
- exact API schema changes;
- tests/checks;
- frontend не менялся;
- commit/push не выполнялись.
