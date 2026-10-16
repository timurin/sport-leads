# PC-04.4D — Work Centers as Capacity Source

## Контекст
В проекте уже есть `/settings/catalogs/work-centers`, где хранится оборудование, привязанное к конкретному цеху.

Нужно проверить этот контур и использовать его как источник физических машин для Production Scheduler, вместо создания параллельного каталога оборудования.

Особенно важно для печатного цеха:
- 4 плоттера;
- у каждого своя производительность;
- своя очередь;
- свой цветовой профиль;
- каждый принадлежит конкретному цеху.

VIS-STRESS-001…030 уже существуют в локальной БД и НЕ должны удаляться.

## Цель
Проверить существующую модель Work Centers, переиспользовать её в расчёте мощности и добавить только реально недостающие поля/связи.

---

# ЧАСТЬ A — CODEX

## 1. Аудит `/settings/catalogs/work-centers`
Проверить:
- backend models;
- migrations;
- schemas;
- API;
- services;
- frontend contracts;
- реальные записи БД;
- связи с workshop/shop;
- связи с TechOperation;
- связи с routing;
- связи с CapacityResource;
- использование Scheduler.

Сначала подготовить карту:
`WorkCenter -> Workshop -> TechOperation -> Capacity/Scheduler`

До окончания аудита код не менять.

## 2. Source of truth
Предпочтительно:
- WorkCenter = конкретная физическая машина/рабочий центр;
- CapacityResource не должен дублировать независимые параметры той же машины.

Если Scheduler требует CapacityResource как adapter:
- связать его с WorkCenter;
- одна физическая машина = один source of truth по скорости/графику.

Не должно быть двух независимых `base_rate` для одного плоттера.

## 3. Печатный цех
Проверить, что 4 плоттера могут существовать как 4 отдельные записи WorkCenter:
- Plotter 1
- Plotter 2
- Plotter 3
- Plotter 4

НЕ использовать `resource_count=4` как замену четырём физическим машинам.

Каждый WorkCenter должен иметь:
- code/name;
- workshop_id;
- active;
- capacity_unit;
- hourly/base rate;
- hours per shift/day;
- shifts;
- efficiency;
- working days;
- exceptions/unavailable;
- color profile, если такого поля сейчас нет — определить минимальный контракт.

## 4. Цветовые профили
Проверить, есть ли существующая сущность/поле.

Если есть — переиспользовать.

Если нет:
- предложить минимальное решение;
- предпочтительно не free-text, если профиль должен переиспользоваться.

Нужный сценарий:
`TechnicalCard / print operation -> required profile -> compatible WorkCenters`.

Если в ТК пока нет места для required profile:
- зафиксировать gap;
- предложить минимальное место хранения;
- не внедрять скрытое правило без обоснования.

## 5. Связь WorkCenter ↔ TechOperation
Scheduler должен понимать:
`routing_stage_line -> TechOperation -> допустимые WorkCenters`.

Проверить существующую relation.
Если уже M:N — использовать.
Если нет — добавить минимальную M:N relation.

Для `Sublimation print` допустимы 4 плоттера.

Scheduler выбирает конкретный свободный WorkCenter автоматически.

## 6. Очередь оборудования
НЕ создавать ручное поле `queue`.

Очередь конкретной машины должна формироваться из Scheduler/CalendarAllocation.

Проверить, может ли текущий CalendarAllocation однозначно показать физическую машину.

Если сейчас хранится только абстрактный `resource_key`:
- определить минимальное изменение, чтобы allocation ссылался на WorkCenter;
- если нужна migration, сначала зафиксировать причину и сделать минимально.

## 7. Формула мощности
Для equipment WorkCenter:
`hourly_rate × hours_per_shift × shifts × efficiency`.

Так как WorkCenter = конкретная машина:
`resource_count` не должен умножать мощность повторно.

Пример:
Plotter 1:
- 15 м.п./ч
- 10 ч
- 1 смена
- efficiency 1.0
= 150 м.п./день.

У каждого плоттера своя скорость.

## 8. Не ломать labor/team resources
Не переносить в WorkCenter без необходимости:
- sewers;
- cutters;
- packing_team;
- designers;
- print_operator.

WorkCenter используется прежде всего для физического оборудования.

Оператор печати остаётся отдельным трудовым ограничением и не равен машине.

## 9. Scheduler integration
Проверить/доработать:
1. операция получает список допустимых WorkCenters;
2. Scheduler проверяет capacity каждой машины;
3. выбирает конкретную свободную машину;
4. создаёт allocation для конкретного WorkCenter;
5. следующая ТК видит занятую capacity именно этой машины;
6. остальные машины остаются свободными;
7. shared print_operator остаётся отдельным resource constraint.

Priority logic не менять.

## 10. Обязательный тест печатного цеха
Использовать 4 плоттера с разной производительностью.

Минимальный сценарий:
- 5+ ТК печати;
- минимум 2 машины реально используются;
- одна машина unavailable;
- Scheduler распределяет нагрузку по оставшимся;
- allocation показывает конкретный WorkCenter;
- double booking отсутствует.

Если color profile уже можно связать с ТК:
- одна ТК должна быть ограничена частью машин.

## 11. VIS-STRESS dataset
НЕ удалять `VIS-STRESS-001…030`.

После интеграции Work Centers повторно использовать этот dataset.

Если часть stress-карточек нужно дополнить для печатного маршрута — менять только собственные VIS-STRESS данные.

Реальные пользовательские ТК не трогать.

## 12. Tests Codex
Минимум:
- individual WorkCenter rates;
- workshop relation;
- inactive machine ignored;
- exceptions;
- operation -> multiple WorkCenters;
- different machine rates;
- parallel machines;
- unavailable machine;
- concrete WorkCenter allocation;
- no double booking;
- deterministic recalc;
- labor/team compatibility;
- mass scheduler regression.

Проверки:
- targeted tests;
- full backend tests;
- project check;
- git diff --check.

Commit/push не выполнять.

---

# ЧАСТЬ B — CURSOR

Начать после backend audit/contract.

## 13. `/settings/catalogs/work-centers`
Использовать эту страницу как основное место настройки физического оборудования.

Для equipment WorkCenter показать/редактировать:
- название;
- код;
- цех;
- active;
- единицу мощности;
- производительность в час;
- часы смены;
- число смен;
- efficiency;
- рабочие дни;
- исключения;
- color profile, если backend добавил.

Не создавать отдельную дублирующую страницу оборудования.

## 14. Печатный цех UI
Показать 4 плоттера как 4 отдельные строки/карточки:
- Plotter 1 — X м.п./ч — Profile A
- Plotter 2 — Y м.п./ч — Profile B
- Plotter 3 — ...
- Plotter 4 — ...

Не показывать агрегат `×4`.

## 15. Терминология
Проверить, где UI показывает тип `Веха`.

Для физического оборудования тип `Веха` недопустим.

Если milestone остаётся в capacity settings, отображать как:
**Контрольная точка — без расчёта мощности**.

Не смешивать milestone и WorkCenter.

## 16. Calendar/load
Если backend отдаёт physical WorkCenter:
- показывать его имя в tooltip/details;
- показывать индивидуальную загрузку машины;
- не создавать ручную очередь;
- не считать capacity на frontend.

## 17. Cursor tests
- WorkCenter edit;
- validation rate/unit;
- four separate plotters;
- color profile field if available;
- calendar/load compatibility;
- full frontend tests;
- lint;
- tsc;
- production build;
- project check;
- git diff --check.

VIS-STRESS dataset не удалять.
Commit/push не выполнять.

---

# Что НЕ делать
- не создавать второй каталог оборудования;
- не моделировать 4 плоттера через `resource_count=4`;
- не добавлять ручное поле `queue`;
- не превращать operator в machine;
- не удалять VIS-STRESS;
- не менять Scheduler priority;
- не делать MES;
- не commit/push/merge.

# Acceptance
Готово, если:
1. `/settings/catalogs/work-centers` подтверждён как source of truth для физических машин;
2. 4 плоттера существуют как 4 отдельных WorkCenter;
3. у каждого своя производительность;
4. оборудование привязано к цеху;
5. TechOperation знает допустимые WorkCenters;
6. Scheduler выбирает конкретную машину;
7. allocation однозначно показывает выбранную машину;
8. нет двойного хранения независимой скорости одной машины;
9. очередь формируется Scheduler автоматически;
10. VIS-STRESS-001…030 сохранены.

## Отчёт Codex

### Выполнение части A — 2026-10-07

Аудит проведён до изменения кода. Карта: WorkCenter → ProductionStage (цех); ShopRoutingStageLine → TechOperation → M:N tech_operation_capacity_resources → CapacityResource → unique work_center_id → WorkCenter; CalendarAllocation → resource_key → та же физическая машина. Поля WorkCenter: id/name/code/production_stage_id/is_active/timestamps. Rate/calendar находятся только в одном связанном CapacityResource. Второй каталог, копии скорости и новый junction не нужны: существующий путь уже эквивалентен M:N operation/equipment. [Аудит и полный backend-контракт](../architecture/work-center-capacity-pc-04-4d.md).

Локальная БД :5432: восемь WorkCenter — Epson F9200 и каландр в печати, шесть центров пошива; четыре настроенных плоттера пока отсутствуют. Машинный ресурс laser без WorkCenter binding остаётся явно не настроенным. Все VIS-STRESS-001…030 найдены. Рабочие записи владельца не изменялись.

Добавлены GET/PUT `/work-centers/{id}/capacity`, PUT `/work-centers/{id}/capacity/exceptions/{date}`, GET `/work-centers/{id}/allocations?from=…&to=…`, GET `/work-centers/{id}/capacity/load?date=…`. Это view/write того же уникального adapter, с authoritative machine/stage из WorkCenter. Четыре отдельных WorkCenter могут иметь четыре скорости/графика/исключения; resource_count не принимается и не множит мощность. Queue — сохранённые allocations, ручного поля нет. List DTO каталога не утяжелён; Cursor должен читать capacity/resources одним batch и соединять по work_center_id.

Scheduler выбирает одну совместимую активную машину на шаг: пробует каждую с сохранённым occupancy и обязательными labor/team demands; выбирает earliest completion/start/resource_key. Только выбранная машина занимает capacity; один шаг остаётся на ней и не делится на партии. Inactive/unbound/foreign-stage/excluded кандидаты игнорируются; без допустимой машины возвращается capacity_missing. Allocation JSON теперь содержит nullable work_center_id; storage FK-путь уже однозначен, поэтому миграции нет. Protected anchors сохраняют конкретную выбранную машину. Priority/horizon/Demand norms не менялись.

Сохранённые allocations защищают физическую identity: нельзя перепривязать их resource_key к другой машине или удалить WorkCenter с allocations. Перенос WorkCenter в другой цех при связанной несовместимой capacity запрещён. Совместимость старого удаления оборудования до появления allocations сохранена: existing SET NULL оставляет ресурс явно unbound. Settings/WorkCenter/exception writes используют общий advisory lock Scheduler.

Цветовые профили в коде/БД отсутствуют. Предложено минимально: ColorProfile с unique code; M:N WorkCenter↔ColorProfile; required_color_profile_id на routing TechnicalCardOperationLine. Нужен отдельный согласованный contract/migration; скрытый профиль и default не внедрялись. Print_operator остаётся shared labor; отсутствие нормы по-прежнему manual_required, машина его не заменяет.

Тест печати: четыре fixture-плоттера 15/20/10/30 м/ч ×10ч; шесть ТК, одна unavailable дата. Использованы несколько машин; сумма allocations ≤ индивидуальному дневному budget, один WorkCenter на assignment, повтор детерминирован. Проверены inactive/foreign/unconfigured машины, protected selection, физическая identity, API validation, capacity/remaining, отдельный missing print_operator и одновременный verified labor constraint. Старые labor/team/mass/concurrency сценарии включены в regression checks.

VIS-STRESS повторно использован командой `python scripts/validate_work_center_stress.py` из backend. Она читает все 30 source ТК и строит изолированную print-only копию в UUID-схеме PostgreSQL; номера/qty/priority/даты/status/locks берутся из dataset, routing/volume адаптируются только в копии. Результат: 30 planned, использованы WorkCenters1–4, недоступная машина4 не занимает 07.10; дневные budgets150/200/100/300 соблюдены, repeat детерминирован. Все колонки исходных 30 ТК проверены неизменными; удалена только собственная test schema. Исходный VIS-STRESS dataset не удалялся и не переписывался. Это backend stress evidence, а не новая persistent readiness или visual acceptance реального оборудования. Лог: `logs/pc-04-4d-stress.log`.

Frontend-часть B не менялась; backend поддержка — отдельный законченный результат PC-04.4D-A. Вся PC-04.4D остаётся открыта до Cursor UI, настройки фактических машин и последующих согласованных profile requirements. Модели/миграции не менялись. Commit/push/merge и production apply не выполнялись.

Проверки: 9 новых equipment tests; 64 targeted scheduler/mass/scenario/PG tests (`logs/pc-04-4d-targeted.log`), 43 equipment+legacy capacity compatibility checks на итоговом коде (`logs/pc-04-4d-compatibility.log`). Изолированный PostgreSQL VIS-STRESS replay — PASS. Финальный `python scripts/check_project.py` — exit0, PROJECT CHECK PASSED, 10/10: 641 backend tests, 346 frontend tests, OpenAPI/models/Alembic/lint/tsc/build/Compose. Лог: `logs/pc-04-4d-project-check-final.log`. Ошибка первой полной проверки — слишком широкий delete guard — исправлена с сохранением старого catalog contract; финальных P0/P1 нет. Известные dependency/cache/lint warnings не маскировались, P2/P3 вне scope не исправлялись. `git diff --check` и HTML generator `--check` passed.

Файлы этой итерации: shop_routings API/service, capacity_resources/production_capacity services, shared production_scheduler и production_schedule response; новые work_center_capacity service/schema, equipment tests, stress validator; architecture contract и этот отчёт; canonical roadmap/project-structure/ERP-check, HTML twins и generator. **HTML twin synced:** PC-04.4D-A `[x]`/done:true, общий PC-04.4D `[ ]`/done:false. Исторический PC-04 и полный календарь не закрыты. Рекомендуемая следующая итерация — часть B Cursor на утверждённом backend-контракте; не начата автоматически. Профили — отдельный минимальный contract/migration после подтверждения бизнес-требований.

- текущая схема WorkCenter;
- найденные gaps;
- выбранная архитектура;
- migrations, если понадобились;
- source of truth;
- связи TechOperation;
- scheduler changes;
- tests;
- VIS-STRESS status.

## Отчёт Cursor
- изменённые страницы/components;
- WorkCenter fields;
- отображение 4 плоттеров;
- terminology;
- calendar/load display;
- tests;
- VIS-STRESS не удалялся.
