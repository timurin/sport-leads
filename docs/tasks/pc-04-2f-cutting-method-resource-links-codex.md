# PC-04.2F — Cutting Method + Resource Links Cleanup

Статус: выполнено. Миграция `f2a3b4c5d6e7`. Поле `cutting_method` nullable, существующие строки остались пустыми. Связи добавлены только для `sewing`→`sewers`, `packaging`→`packing_team`, `manual-cut`→`cutters`, `laser`→`laser`. Плоттеры, каландр и закупка не связаны. Фронтенд не менялся.

## Контекст
PC-04.2E завершён аудитом missing Demand inputs.

Выводы:
- новых полей почти не требуется;
- единственное подтверждённое новое бизнес-поле — `cutting_method` для ручного раскроя;
- sewing / packaging / laser / manual cutting / linear-meter demand уже могут считаться из существующих данных при корректных связях и заполненных объёмах;
- designers / print_operator / calender_operator / laser_operator остаются manual_required до утверждения норм;
- `TechnicalCardOperationLine.volume` уже существует, новые meter-поля не нужны;
- несколько CapacityResource в живой БД ещё не связаны с TechOperation.

Scheduler пока НЕ реализовывать.

## Цель
Подготовить реальные данные и минимальную схему так, чтобы Demand layer мог корректно считать всё, что уже поддерживается архитектурой.

## Scope
Backend / DB / data cleanup only.

### 1. Добавить cutting_method
Добавить в строку операции техкарты минимальное поле:

`cutting_method`

Допустимые значения:
- `manual_single`
- `manual_lay`

Применение:
- только для ручного раскроя;
- не использовать для laser;
- не использовать для opt-cut;
- nullable для остальных операций.

Не добавлять:
- manual_quantity
- laser_quantity
- mixed split

Лазер и ручной раскрой уже представлены разными операциями.

### 2. Demand adapter update
Для режима `cutting_methods`:
- если операция manual-cut и `cutting_method = manual_single` -> использовать соответствующую ставку;
- если `manual_lay` -> использовать соответствующую ставку;
- если поле пустое -> `manual_required`, `missing_cutting_mode`.

Не менять прочие adapters.

### 3. Resource links audit
Проверить и привести в соответствие связи TechOperation <-> CapacityResource.

Минимально проверить:
- sewers <-> sewing operation;
- packing_team <-> packaging operation;
- cutters <-> manual-cut;
- laser <-> laser operation;
- plotter_1…4 <-> sublimation/print operation;
- calender <-> соответствующая операция, только если такая TechOperation реально существует;
- procurement milestone <-> readiness/procurement operation, если это уже часть текущей модели.

Не создавать связи по догадке.

Если соответствующая TechOperation отсутствует:
- зафиксировать;
- не создавать новую без отдельного решения.

### 4. Shared resources
Не дублировать shared resources.

Пример:
- print_operator остаётся одной записью для нескольких операций.

### 5. Volume audit
Проверить `TechnicalCardOperationLine.volume`.

Нужно:
- определить, какие live routing rows используют linear_meter;
- проверить, где volume = 0/null;
- не добавлять новые колонки;
- не подставлять derived meters из quantity.

Если volume не заполнен:
- Demand остаётся `missing_input`.

Допустимо добавить validation, если текущий контракт операции явно требует положительный volume.
Не делать auto-fill.

### 6. Existing data migration
Если `cutting_method` требует migration:
- reversible;
- existing rows -> null;
- никакого угадывания manual_single/manual_lay.

Resource links:
- если они должны быть добавлены как data migration/seed update, использовать только однозначные mapping по существующим codes/ids;
- при неоднозначности остановиться и описать.

### 7. API
TechnicalCardOperationLine create/update/read должен поддержать `cutting_method`.

Не менять остальные API больше необходимого.

### 8. Frontend
НЕ менять в этой задаче.

Если frontend пока не умеет редактировать cutting_method:
- это отдельный следующий UI-срез;
- backend должен быть готов.

### 9. Не делать
- не реализовывать Scheduler;
- не создавать CalendarAllocation автоматически;
- не менять CalendarAssignment;
- не добавлять operator/design norms;
- не придумывать calender operator rule;
- не менять priority/deadline logic;
- не создавать новые каталоги;
- не делать commit/push/merge.

## Tests

Минимум:
- cutting_method enum validation;
- manual_single demand;
- manual_lay demand;
- missing cutting_method -> manual_required;
- laser unaffected;
- opt-cut unaffected;
- resource links preserved/created only where unambiguous;
- shared resources not duplicated;
- linear_meter volume = 0/null remains missing_input;
- existing sewing/packing/laser demand unchanged.

## Проверки
- targeted backend tests;
- full backend tests;
- migration upgrade/downgrade/upgrade;
- project check;
- git diff --check.

## Acceptance
После PC-04.2F:
- ручной раскрой может быть рассчитан при выбранном method;
- существующие CapacityResource связаны с правильными TechOperation там, где mapping однозначен;
- linear-meter operations используют существующий volume без новых полей;
- оставшиеся manual_required действительно требуют будущих бизнес-норм;
- Scheduler всё ещё не реализован.

## Отчёт Codex
Указать:
- migration id;
- где добавлен cutting_method;
- какие resource links добавлены/подтверждены;
- какие links не созданы и почему;
- состояние live volume data;
- какие Demand statuses стали ready;
- что осталось manual_required;
- tests/checks;
- frontend не менялся;
- commit/push не выполнялись.
