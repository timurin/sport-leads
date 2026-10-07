# PC-03.7B — Unified Tech Operation Capacity UI

## Owner decision / scope update — 2026-10-06

The approved source contract supersedes the original inline 1:1 proposal below: TechOperation owns technology, CapacityResource owns capacity; they have M:N links and share physical resources without copies. Follow `docs/architecture/production-calendar-shared-capacity-pc-03-7a.md`. Owner-selected visual microtask [PC-03.7B-B1](pc-03-7b-b1-tech-operation-edit-modal.md) replaces inline operation editing with a guarded modal and header Save/Cancel only; it does not close this complete integration task.

## Контекст
Backend PC-03.7A делает `TechOperation` единым источником истины по мощности.

Нужно объединить UX:
- `/settings/catalogs/tech-operations` — основное место редактирования операции;
- `/production/calendar/capacity` — специализированное представление тех же данных, без отдельного локального каталога.

Scheduler пока не реализовывать.

## Цель
Добавить в карточку Tech Operation настройки мощности и перевести экран «Мощности» на тот же backend-контракт.

## Scope
Frontend only.

### 1. Tech Operations
В `/settings/catalogs/tech-operations` сохранить текущий список.

В edit/create карточке добавить блок/таб:
**Мощность и планирование**

Поля:
- Тип ресурса
- Единица мощности
- Базовая производительность
- Количество ресурсов
- Часов в смене / день
- Количество смен
- Коэффициент эффективности
- Рабочие дни
- Учитывать в загрузке календаря
- Тип расчёта нагрузки
- Примечание

Для `milestone` скрывать/отключать бессмысленные hourly/throughput поля.

### 2. Исключения календаря
Добавить отдельный блок:
**Исключения по датам**

Для даты:
- недоступно;
- override capacity;
- note.

### 3. Capacity screen
`/production/calendar/capacity` оставить как удобный обзор.

Но:
- не хранить отдельное состояние мощности;
- читать/редактировать те же TechOperation;
- изменения в одном экране сразу видны в другом после reload.

### 4. Список Tech Operations
При необходимости добавить компактную колонку:
**Мощность**
например:
- `15 м.п./ч × 4`
- `20 шт./ч × 2`
- `68 чел.-ч/день`
- `Milestone`

Не перегружать таблицу.

### 5. UX
Сохранить текущий дизайн платформы.
Не переделывать справочник целиком.

### 6. Не делать
- не менять backend/DB;
- не реализовывать Scheduler;
- не менять routings;
- не менять TechnicalCard;
- не менять weekly board;
- не делать commit/push/merge.

## Tests
Минимум:
- load/edit capacity fields in TechOperation;
- milestone UI;
- exceptions;
- capacity screen reads same source;
- edit in TechOperation reflected in capacity screen;
- edit in capacity screen reflected in TechOperation after reload;
- existing list/search/status actions not broken.

## Проверки
- targeted frontend tests;
- full frontend tests;
- lint;
- tsc;
- production build;
- git diff --check;
- project check.

## Acceptance
Пользователь имеет одно логическое место хранения:
`TechOperation`.

Оба интерфейса:
- справочник операций;
- Производственный календарь → Мощности
работают с одними и теми же данными.

## Отчёт Cursor
Указать:
- изменённые компоненты/routes;
- как устроен общий adapter;
- как реализован milestone;
- tests/checks;
- backend/DB не менялись;
- commit/push не выполнялись.
