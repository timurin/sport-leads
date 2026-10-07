# PC-04.2D — Capacity UI Unit Alignment

## Статус
Формы мощности принимают единицы PC-04.2C. Оборудование может быть `linear_meter` или `item`. `packing_team` остаётся одной бригадой. Backend и база не менялись.

## Контекст
PC-04.2C завершена.

Backend и данные CapacityResource теперь используют натуральные единицы Demand:

- plotter_1…4 -> `linear_meter`
- calender -> `linear_meter`
- laser -> `item`
- cutters -> `item`
- packing_team -> `item`
- sewers / operators / designers -> `labor_hour`
- procurement -> milestone / unit null

Frontend пока отстаёт от backend:
- для оборудования всё ещё навязывает `machine_hour`;
- форма мощности допускает `packing_team.resource_count = 2`;
- backend для packing_team теперь принимает только одну бригаду (`resource_count = 1`);
- это может давать ошибку сохранения.

Scheduler пока НЕ реализовывать.

## Цель
Привести frontend редактирования CapacityResource к текущему backend-контракту PC-04.2C.

## Scope
Frontend only / Cursor.

### 1. Unit rules
Перестать автоматически навязывать `machine_hour` для resource_type `machine`.

Разрешить и корректно отображать:
- `linear_meter`
- `item`
- `labor_hour`
- `machine_hour`
- milestone / no unit

Точный список взять из backend enum/contract.

Не придумывать дополнительные units.

### 2. Machine resources
Оборудование может иметь натуральную throughput unit.

Примеры:
- plotter -> linear_meter
- calender -> linear_meter
- laser -> item

UI не должен считать это ошибкой или автоматически менять unit на machine_hour.

### 3. Packing team semantics
Для `packing_team`:

- capacity_unit = item
- base_rate = throughput всей бригады
- resource_count = 1

UI:
- не позволять задавать resource_count > 1;
- либо скрыть/заблокировать поле количества для team throughput;
- показать короткую подсказку:
  `Производительность указана для всей бригады`.

Не умножать throughput на число сотрудников.

### 4. Existing resources
Не менять автоматически существующие значения при открытии формы.

Если backend вернул:
- linear_meter
- item
- labor_hour

frontend должен сохранить их без silent normalization.

### 5. Capacity screen
Проверить оба места:

- `/settings/catalogs/tech-operations`
- `/production/calendar/capacity`

Они должны использовать одинаковые validation/formatting rules.

Не должно быть ситуации, когда один экран принимает unit, а второй его исправляет/отклоняет.

### 6. Summary formatting
Колонка/summary мощности должна корректно показывать:

- `15 м.п./ч`
- `60 м.п./ч`
- `100 шт./ч`
- `80 шт./ч`
- `68 чел.-ч/день`
- `Milestone`

Если у ресурса `resource_count` отсутствует или =1, не показывать бессмысленное `× 1`, если это ухудшает читаемость.

### 7. Validation
Frontend должен повторять backend-ограничения, но backend остаётся источником истины.

Минимум:
- packing team count > 1 блокируется;
- machine + linear_meter разрешено;
- machine + item разрешено;
- milestone не требует unit/rate;
- labor_hour остаётся валидным для операторов и швей.

### 8. Error handling
Если backend всё же возвращает validation error:
- не сбрасывать черновик;
- показать понятное сообщение;
- сохранить текущий modal UX.

### 9. Не делать
- не менять backend;
- не менять DB/migrations;
- не менять Demand adapters;
- не добавлять operator norms;
- не менять cutting mode;
- не реализовывать Scheduler;
- не менять weekly board;
- не делать commit/push/merge.

## Tests
Минимум:

- machine + linear_meter accepted;
- machine + item accepted;
- labor + labor_hour;
- packing_team count fixed to 1;
- milestone no unit;
- existing backend unit preserved after load/save;
- both TechOperation and Capacity screen use same rules;
- no silent normalization to machine_hour;
- save error preserves draft;
- existing shared resource behavior not broken.

## Проверки
- targeted frontend tests;
- full frontend tests;
- lint;
- tsc;
- production build;
- git diff --check;
- project check.

## Acceptance
После PC-04.2D:
- frontend полностью принимает натуральные CapacityResource units из PC-04.2C;
- оборудование больше не обязано быть `machine_hour`;
- packing_team не создаёт двойное умножение мощности;
- оба экрана Capacity работают одинаково;
- backend validation errors из-за устаревшего UI устранены.

## Отчёт Cursor
Кратко:
- какие файлы изменены;
- какие validation rules обновлены;
- как обработан packing_team;
- tests/checks;
- backend/DB не менялись;
- commit/push не выполнялись.
