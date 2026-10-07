# PC-03.7C — M:N Capacity Resources Frontend Integration

## Контекст
PC-03.7A завершён.

Backend теперь использует:
- `CapacityResource` как источник истины по мощности;
- M:N-связь `TechOperation ↔ CapacityResource`;
- shared resources;
- `print_operator` используется одной записью сразу несколькими операциями печати;
- capacity settings / exceptions сохранены;
- старый capacity API и load-state совместимы;
- migration `y4z5a6b7c890`.

PC-03.7B frontend уже добавил UI мощности, но пока использует временный плоский контракт capacity-полей прямо в `TechOperation`.

Нужно перевести этот UI на реальный M:N-контракт без переделки общего дизайна.

Источник истины API:
`docs/tasks/pc-03-7a-tech-operations-capacity-source-codex.md`

## Цель
Подключить `/settings/catalogs/tech-operations` и `/production/calendar/capacity` к реальной модели `CapacityResource` и shared resources.

## Scope
Frontend only / Cursor.

### 1. Убрать временный плоский контракт
Не отправлять capacity-поля как свойства `TechOperation`, если backend-контракт PC-03.7A теперь использует связанные ресурсы.

Адаптер:
`frontend/lib/tech-operation-capacity.ts`

перевести на exact M:N API contract PC-03.7A.

### 2. Tech Operation → Resources
В карточке техоперации блок:

**Мощность и планирование**

должен показывать список связанных `CapacityResource`.

Для каждой операции:
- список ресурсов;
- добавить существующий ресурс;
- при необходимости создать новый ресурс через поддерживаемый backend-контракт;
- удалить связь ресурса с операцией;
- редактировать параметры ресурса.

Не создавать дубликат shared resource при добавлении к второй операции.

### 3. Shared resources
Если ресурс общий, например `print_operator`:
- одна сущность ресурса;
- может отображаться в нескольких TechOperation;
- изменение мощности ресурса видно во всех связанных операциях после reload;
- UI должен явно показывать, что ресурс общий, если backend отдаёт соответствующую информацию.

### 4. Resource fields
Использовать exact backend contract PC-03.7A.

Ожидаемо отображать параметры:
- name / code;
- resource_type;
- capacity_unit;
- base_rate / productivity;
- resource_count;
- hours_per_day / shift_hours;
- shifts_per_day;
- efficiency;
- working_days;
- include_in_calendar_load;
- calculation_mode;
- note;
- exceptions.

Не выдумывать поля, отсутствующие в backend contract.

### 5. Milestone
Если `resource_type = milestone`:
- не показывать бессмысленные hourly / throughput controls;
- не отправлять их;
- сохранить текущий UX PC-03.7B.

### 6. Exceptions
Исключения по датам редактируются у `CapacityResource`, а не у TechOperation.

Если один ресурс shared:
- одно и то же исключение должно влиять на все связанные операции;
- UI не должен создавать копии exception.

### 7. Capacity screen
`/production/calendar/capacity` остаётся обзором ресурсов мощности.

Он должен:
- читать те же `CapacityResource`;
- показывать связи с TechOperation;
- сохранять изменения через тот же resource adapter;
- не иметь отдельного локального каталога или storage.

### 8. Tech Operations list
Колонку `Мощность` сохранить.

Если у операции несколько ресурсов:
- показывать компактно 1–2 основных;
- далее `+N ресурсов` или аналогичный компактный summary;
- не расширять строку таблицы чрезмерно.

Пример:
`Плоттеры 15 м.п./ч × 4 · Оператор +2`

### 9. Не менять
- backend;
- DB/migrations;
- routings;
- TechnicalCard;
- weekly board;
- Scheduler;
- navigation;
- общий дизайн страницы;
- commit/push/merge.

## Tests
Минимум:
- TechOperation loads linked resources;
- one operation with multiple resources;
- one shared resource linked to two operations;
- editing shared resource reflected in both after reload;
- adding existing resource does not duplicate it;
- unlink does not delete shared resource;
- exceptions belong to resource;
- milestone UI;
- capacity screen and TechOperation use same data;
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
После задачи:
- `CapacityResource` — единственный frontend/backend источник мощности;
- `TechOperation` хранит связи с ресурсами;
- shared resources работают без дублирования;
- `/settings/catalogs/tech-operations` и `/production/calendar/capacity` показывают и редактируют одни и те же данные;
- временный плоский PC-03.7B contract удалён.

## Отчёт Cursor
Кратко:
- какие frontend файлы изменены;
- exact M:N API usage;
- как реализованы shared resources;
- как реализован unlink vs delete;
- tests/checks;
- backend/DB не менялись;
- commit/push не выполнялись.
