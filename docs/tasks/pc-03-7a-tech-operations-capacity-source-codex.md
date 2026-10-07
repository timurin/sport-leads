# PC-03.7A — Tech Operations as Capacity Source of Truth

## Решение владельца — 2026-10-06, приоритет над исходным scope

Строгое 1:1 не использовать. TechOperation ↔ CapacityResource — M:N через junction table. `print_operator` — общий ресурс обеих операций `sublimation` и `heat_transfer`. Существующие settings переносятся в CapacityResource без потери данных. TechOperation остаётся источником технологической принадлежности, CapacityResource — источником мощности; физический ресурс не копируется под каждую операцию. Исходные требования ниже о 1:1/мощности непосредственно на операции заменены этим решением. Блокер первоначального аудита снят; запись аудита ниже сохранена как история.

## Контекст
Сейчас данные производственной мощности живут отдельно от справочника:
`/settings/catalogs/tech-operations`.

Принято решение:
- `tech-operations` становится единым источником истины для производственной операции и её мощности;
- `/production/calendar/capacity` остаётся представлением/редактором тех же данных, а не отдельным справочником;
- Scheduler пока не реализовывать.

Существующий справочник техопераций уже содержит:
- name;
- code;
- volume unit;
- required materials;
- workshop/section;
- active status.

Нужно перенести в него данные и контракт мощности, созданные ранее в PC-03.4.

## Цель
Убрать дублирование между Tech Operations и Calendar Capacity и сделать Tech Operation владельцем данных мощности.

## Scope
Backend / DB / API only.

### 1. Аудит текущей модели
Перед изменениями проверить текущие сущности:
- TechOperation;
- ProductionStage / WorkCenter;
- capacity settings / exceptions;
- связи с routing;
- связи с TechnicalCard.

Не создавать новые каталоги, если существующие сущности можно переиспользовать.

### 2. Расширить TechOperation
Добавить/привязать к TechOperation параметры планирования:

- resource_type:
  - labor
  - machine
  - throughput
  - milestone

- capacity_unit:
  - labor_hour
  - machine_hour
  - item
  - linear_meter
  - nullable для milestone

- base_rate / productivity
- resource_count
- hours_per_day / shift_hours
- shifts_per_day
- efficiency
- working_days
- include_in_calendar_load
- calculation_mode / load_rule
- note

Если текущая capacity-модель уже хранит часть этих данных — не дублировать поля без необходимости. Предпочесть перенос/связь 1:1 к TechOperation.

### 3. Exceptions
Сохранить исключения по датам:
- unavailable;
- reduced/override capacity;
- note.

Исключение должно принадлежать конкретной TechOperation.

### 4. Миграция данных
Существующие capacity settings из PC-03.4 не потерять.

Нужно:
- сопоставить их с TechOperation;
- перенести данные;
- сохранить обратимость migration;
- не создавать дубликаты операций.

Если автоматическое сопоставление неоднозначно — остановиться и описать конфликт, не угадывать.

### 5. API
Справочник Tech Operations должен отдавать и принимать capacity-параметры.

Предпочтительный контракт:
- `GET /tech-operations`
- `GET /tech-operations/{id}`
- `POST/PUT/PATCH ...`

Capacity endpoint календаря можно сохранить временно для совместимости, но он должен работать поверх данных TechOperation, без второго независимого хранилища.

### 6. Backward compatibility
Существующие:
- UI-F / capacity screen;
- weekly load-state;
- routings;
- TechnicalCard;
не должны сломаться.

### 7. Что НЕ делать
- не реализовывать Scheduler;
- не рассчитывать нормы ТК;
- не менять frontend;
- не менять routing semantics;
- не создавать ProductionJob;
- не делать commit/push/merge.

## Tests
Минимум:
- CRUD TechOperation с capacity fields;
- milestone без hourly capacity;
- labor/machine/throughput validation;
- capacity exception CRUD;
- old capacity API compatibility;
- existing capacity data migrated;
- routings unchanged;
- weekly load-state still works.

## Проверки
- targeted backend tests;
- full backend tests;
- migration upgrade/downgrade/upgrade;
- project check;
- git diff --check.

## Acceptance
После задачи:
- TechOperation — источник истины по мощности;
- отдельное capacity storage не содержит независимых дублирующих данных;
- календарь и capacity API читают мощность из TechOperation;
- существующие данные сохранены.

## Отчёт Codex
Указать:
- какие модели/таблицы изменены;
- migration id;
- как перенесены данные;
- exact API contract;
- что осталось временно для backward compatibility;
- tests/checks;
- frontend не менялся;
- commit/push не выполнялись.

## Аудит выполнения — 2026-10-06

**Статус: реализация остановлена на согласовании соответствий; задача не закрыта.** Прямой выбор владельца — PC-03.7A после PC-03.6A. Ветка `main`; существующий незакоммиченный WIP сохранён. Проверены model/schema/API/service/repository TechOperation и ProductionCapacity, ADR-016/017, routing и ссылки TechnicalCard. `docs/releases/latest.md` отсутствует; прочитан имеющийся release `v0.5.0.md`.

### Подтверждённые данные локальной БД

Read-only аудит `127.0.0.1:5432`, без VPS. Сохранены две настройки, исключений по датам нет:

| resource_key | stage | staff_count | hours_per_day | working_days | Кандидаты TechOperation |
|---|---|---|---|---|---|
| designers | design, id=1 | 1 | 10 | 0–4 | design-op, id=6 |
| print_operator | print, id=3 | 1 | 10 | 0–4 | sublimation, id=1; heat_transfer, id=2 |

В settings нет `tech_operation_id`; stage/WorkCenter не доказывают владельца операции. `print_operator` не имеет WorkCenter, поэтому дополнительной связи для выбора нет. Обе print-операции используются: каждая в двух строках маршрутов и пяти строках ТК. Выбирать одну по имени/порядку или копировать доступность в обе недопустимо: второе удвоит общий пул.

### Архитектурные вопросы перед изменением

1. Утвердить владельца `print_operator`: `sublimation`, `heat_transfer` либо явно согласованный общий ресурс с другой моделью связи.
2. Утвердить кардинальность. PC-03.4 имеет 14 ключей: четыре отдельных plotter slots, calender, operator pools, общий cutters pool с двумя методами, sewing pool, packing team и procurement milestone. Одна техоперация может потребовать одновременно машину и труд. Строгое 1:1 с одним `resource_type`/`capacity_unit` не сохраняет такие независимые мощности; связь нескольких ресурсов с операцией требует явного решения вместо предположения.
3. Для всех legacy keys зафиксировать точные соответствия, без создания операций-дубликатов. В локальном каталоге у `packaging` (id=5) stage=`qc`, у `wto` (id=4) также stage=`qc`; автоматическое исправление этих связей выходит за scope «routing semantics unchanged». Операции для `launch_preparation` нет. Общий cutters pool не следует копировать в `manual-cut` и `opt-cut` как две независимые доступности.

Предпочтительный технический подход после решения: переиспользовать текущие settings/exceptions как дочерние данные владельца TechOperation, сохранить legacy resource keys только для API-совместимости; не заводить вторую копию capacity fields. Список справочника получает slim summary, detail — настройки/исключения через bounded reads. Точная схема и миграция пока не утверждены и не реализованы.

Владельцу задан вопрос о print_operator и кардинальности. До ответа запрещено угадывать перенос согласно §4 этой задачи. Остальная реализация зависит от этого решения; backend/DB/frontend не изменены, migration id отсутствует. Tests/check_project не запускались: выполнен только read-only аудит и эта запись блокера; `git diff --check` выполнен. Новые P0/P1 не внесены, P2/P3 не исправлялись.

Roadmap: changes not required. Project structure checklist: changes not required. ERP-check не менялся в этой итерации. HTML twins не затронуты; PC-03.7A не отмечен завершённым. Commit/push/merge не выполнялись. Следующая итерация — продолжение PC-03.7A после согласования соответствий; PC-03.7B не начинать как готовую интеграцию.

## Выполнение после решения владельца — 2026-10-06

**PC-03.7A завершён; PC-03 остаётся открытым.** Выбран владельцем после PC-03.6A. Первоначальный блокер снят M:N-решением; остальные соответствия не угадывались.

### Результат и изменённые файлы

- `backend/app/models/production_capacity.py`: CapacityResource вместо независимых settings, import alias для совместимости, junction TechOperationCapacityResource; resource_count — alias staff_count. Датированные исключения ссылаются на тот же ресурс.
- `backend/app/models/tech_operation.py`, `models/__init__.py`: M:N relationship и регистрация моделей.
- `backend/app/schemas/production_capacity.py`, `schemas/tech_operation.py`: canonical resource write/summary/detail, параметры мощности, slim capacity_resource_keys; неверные inline capacity fields возвращают 422.
- `backend/app/services/capacity_resources.py`, `services/production_capacity.py`, `services/tech_operations.py`, `repositories/tech_operations.py`: одна мощность, редактирование связей и общих полей, bounded reads, существующие нормы/weekly load без размножения доступности.
- `backend/app/api/production_capacity.py`, `api/tech_operations.py`: canonical resource CRUD/exception paths, чтение/редактирование связанных ресурсов из техоперации, прежние capacity endpoints сохранены.
- Migration `backend/alembic/versions/y4z5a6b7c890_shared_capacity_resources.py`; два новых test files `test_capacity_resources_pc_03_7a.py`, `test_capacity_resource_migration_pc_03_7a.py`.
- [Exact API contract](../architecture/production-calendar-shared-capacity-pc-03-7a.md), ADR-017 amend, этот task report; roadmap/project structure/ERP-check и HTML twins, generator обновлены для PC-03.7A.

### Модели, данные и миграция

`production_capacity_settings` переименована в `capacity_resources` без копирования/потери availability, keys, timestamps, stage/equipment links и notes. `production_capacity_exceptions` сохраняет строки и FK на переименованную таблицу. Новая junction с composite PK связывает операции и ресурс. Техоперации, маршруты и строки ТК не изменены.

На локальной БД :5432 сохранены `designers` (1 человек × 10 часов) и `print_operator` (1 человек × 10 часов), дни 0–4. `print_operator` связан одновременно с `sublimation` и `heat_transfer`; `designers` с единственной design-op. Ненастроенные legacy slots не превращены в вымышленные ресурсы; остальные сохранённые ресурсы мигрируются без догадок о связях. Junction можно явно редактировать через operation capacity_resource_keys. WorkCenter уникален среди ресурсов; удаление связанного ресурса/ресурса с исключениями возвращает 409.

Downgrade сохраняет legacy availability и exceptions, удаляя новые metadata и M:N links; ограничения для custom keys и повторного upgrade описаны в контракте. Local apply — только upgrade; downgrade/upgrade проверены в изолированной rollback-схеме, без удаления пользовательских данных. VPS не затрагивался.

### Проверки

- 53 targeted tests passed: новые resource CRUD/M:N/shared reload, milestone/labor/machine/throughput validation, exception CRUD, legacy editor↔canonical editor, constant-query list reads, existing operations/routings.
- 555 full backend tests passed в финальном `python -u scripts/check_project.py`; project check **10/10 / PROJECT CHECK PASSED**, включая OpenAPI, SQLAlchemy, Alembic, frontend lint/typecheck/331 tests/build и Compose. Исходный milestone-default дефект найден тестом, исправлен; финальные проверки успешны.
- PostgreSQL migration upgrade/downgrade/upgrade в отдельной схеме: exact old settings/timestamps/exception preservation, 1 print resource → 2 operation links; pytest migration test passed. Local `alembic upgrade head` и `alembic check` passed.
- Read-only local reload: старой settings table нет, 2 shared resources и 3 junction links; два demand по 4 часа против 10 shared hours → 80%, без двойной мощности. Старый settings API возвращает 14 слотов.
- `git diff --check` и генератор production-calendar roadmap `--check` passed. **HTML twin synced:** PC-03.7A `[x]` ↔ `done:true` в v1.1 и project-structure; глобальные roadmap MD/HTML notes совпадают.

Новых P0/P1 не выявлено. Существующие deprecation/pytest-cache warnings вне scope (P2), визуальные P3 не проверялись: frontend этой итерацией не изменён. Другой незакоммиченный WIP сохранён. Commit/push/merge не выполнялись.

Следующая рекомендуемая отдельная итерация — PC-03.7B по shared-resource контракту; его исходный inline 1:1 capacity adapter требуется адаптировать к M:N-решению. Scheduler, ProductionJob, автоматическое распределение/создание операций и изменение норм ТК не реализованы. Следующую задачу/этап автоматически не начинать.
