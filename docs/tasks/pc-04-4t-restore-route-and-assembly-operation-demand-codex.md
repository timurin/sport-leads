# PC-04.4T — Restore Route + Assembly Operation Demand

## Исполнитель
Codex

## Симптом
После последних изменений Production Calendar/Readiness у новых `CAL-STRESS-*` техкарт перестали считаться операции по выбранному маршруту и сборке изделия.

Наблюдение:
- в ТК операции маршрута присутствуют;
- `Операции / объёмы` показывают `0.000`;
- diagnostics:
  - `Объём операции`;
  - `Сборка изделия / нормы пошива`;
- ранее эти значения рассчитывались.

## Цель
Найти regression и восстановить расчёт объёмов операций из:
1. выбранного Routing snapshot;
2. Model / Assembly Variant / sewing norms;
3. данных ТК (quantity и другие существующие inputs).

Не подменять проблему ручным вводом.

## Проверить полный flow
Для одной реальной `CAL-STRESS` ТК проследить:

`TechnicalCard`
→ model
→ assembly variant
→ route snapshot
→ TechnicalCardOperationLine
→ Demand resolver
→ Scheduler preflight

Проверить отдельно:

### Route operations
- какие операции snapshot созданы;
- почему `volume = 0`;
- где раньше формировался volume;
- не потерялся ли mapping после PC-04.4G/I/M/Q.

### Sewing
- выбран ли assembly variant;
- загружаются ли sewing operation norms;
- рассчитывается ли трудоёмкость из `duration_seconds × multiplicity × quantity`;
- почему diagnostic `Сборка изделия / нормы пошива` появляется при существующей сборке.

## Root cause
Найти один фактический regression:
- mapping;
- snapshot binding;
- operation-line population;
- quantity propagation;
- assembly variant lookup;
- Demand adapter;
- seed/new TK creation flow.

Не маскировать diagnostics.

## Исправление
Восстановить canonical flow так, чтобы новая ТК после выбора Model + Routing автоматически имела корректные operation inputs.

Важно:
- м.п. операции получают существующий реальный источник объёма;
- шт. операции используют quantity там, где это уже предусмотрено contract;
- sewing demand использует нормы сборки модели;
- ONE OF учитывает только selected member.

Не создавать fake values.

## Обязательный E2E
На одной новой/существующей `CAL-STRESS` ТК:

1. выбрать/проверить Model;
2. проверить Assembly Variant;
3. применить Routing;
4. проверить snapshot;
5. проверить `Операции / объёмы`;
6. проверить Demand;
7. выполнить Scheduler preflight.

Ожидается:
- operation volumes не `0.000`, если источник данных существует;
- sewing demand рассчитан;
- ложные diagnostics исчезли;
- реальные missing-data diagnostics остаются.

## Regression checks
Проверить минимум:
- маршрут с сублимационной печатью;
- ONE OF раскрой;
- пошив с assembly norms;
- маршрут без пошива;
- старую ТК со snapshot;
- новую ТК после применения маршрута.

## Не делать
- manager manual input;
- новые нормы ради теста;
- Capacity/WorkCenter changes;
- readiness text hacks;
- удаление нового CAL-STRESS dataset;
- commit/push.

## Проверки
- targeted tests;
- backend full tests;
- project check;
- DB integrity;
- git diff --check.

## Отчёт
Коротко:
1. root cause;
2. какой flow сломался;
3. какие файлы исправлены;
4. до/после на одной CAL-STRESS ТК;
5. remaining real blockers;
6. tests.

Финальная строка:
`PC-04.4T ROUTE AND ASSEMBLY OPERATION DEMAND RESTORED`

## Результат — 2026-10-10

### Root cause и граница исправления

Фактический разрыв — **operation-line population**: `_apply_routing_template` создавал routing rows с `volume=0`, `_sync_sewing_operation_lines` — sewing rows также с `volume=0`. Выбор модели/сборки не соединял существующие model/routing norms с входным volume. Для `CAL-STRESS-001` реальный источник метров уже существовал: model 1, route 1, active link 2, norm IDs 3/4 = 0,700 м.п./изделие. Quantity=8 давал проверяемые 5,600 м.п., но в строках сохранялись нули.

Git HEAD также содержит эти нулевые инициализаторы: **атрибуция новой регрессии именно PC-04.4G/I/M/Q не подтверждена**. Это существовавший разрыв producer → stored input, проявившийся в новых CAL-STRESS. Mapping выбранного snapshot и загрузка AssemblyVariant не потеряны.

Нулевой volume сборочных строк и отсутствующая норма времени — разные причины. В assembly 1 находятся реальные zero-time IDs 2/3/4; прежний и текущий Demand корректно отвергают их. Положительные времена остальных строк (10/15/90 секунд) не разрешают игнорировать обязательные строки с нулём. Изменения не превращают неполную сборку в ready.

### Исправленный canonical flow

- При явной привязке модели/сборки/маршрута пустые routing inputs заполняются: pieces ← quantity; linear_meters ← одна положительная норма выбранного active model/routing link × quantity, с проверкой операции, цеха, единицы и неоднозначности. Приоритет имеет norm конкретной операции; допустим только однозначный default цеха, если конкретной нормы нет. Неверная конкретная норма не скрывается default.
- Sewing operation volumes ← quantity × multiplicity из прежнего order-item snapshot / выбранной model assembly. Demand использует прежние source durations/multiplicity и quantity; projected volume не становится вторым множителем трудоёмкости.
- Принятый коэффициент сохраняется как nullable `TechnicalCardOperationLine.volume_qty_per_item`. Это необходимо для реального create-quantity=1 → personalization import workflow. Import/replace/sync quantity пересчитывают только marked inputs; изменение живой нормы каталога не меняет уже принятый коэффициент. Явная запись объёма из цеха снимает marker. Положительные legacy/manual значения не подменяются. Выход за Numeric(14,3) выявляется как явная validation error.
- ONE OF продолжает исключать невыбранные альтернативы в существующем resolver. Ни нового Demand/readiness механизма, ни изменений Capacity/WorkCenter/Scheduler semantics нет.

### E2E: CAL-STRESS-001 / ID 86

Model 1 «Футболка спортивная», assembly 1 «Базовая сборка», route 1 «Дизайн + Сублим + Пошив», quantity=8.

| Проверка | До | После |
|---|---|---|
| Сублимационная печать / операция 1 | volume=0,000 | volume=5,600 м.п., basis=0,700 |
| Термоперенос / операция 2 | volume=0,000 | volume=5,600 м.п., basis=0,700 |
| Остальные 5 routing rows | volume=0,000 | volume=8,000 шт., basis=1 |
| 6 sewing rows | volume=0,000 | volume=8,000 шт., multiplicity=1 |
| Print Demand | missing_linear_meters | ready, amount=5,6 linear_meter на соответствующий ресурс/шаг |
| Diagnostics | 2 missing_linear_meters + missing_sewing_norm | только реальный missing_sewing_norm |
| Scheduler preflight | blocked на первом print input | blocked на пошиве (source line ID 2, duration=0) |

Проверены фактические DB rows, API GET, Demand, diagnostics, preflight и UI reload `/production/tech-cards/86`, вкладка «Операции» (1440×1000). После первоначального заполнения выполнено штатное `POST /technical-cards/86/apply-routing`: оно явно пересоздаёт snapshot по прежнему правилу и фиксирует volume basis. Snapshot graph/порядок/источник маршрута тот же; замена snapshot IDs при этой явной команде штатная. Количество/даты/приоритет ТК, entry assignment и allocations не изменялись. Новых постоянных ТК нет, CAL-STRESS по-прежнему ровно 30.

Новая transient ТК создана на реальных model/assembly/route с quantity=1, затем обычный импорт quantity=8 получил 5,600 м.п./8 шт. без ручного volume input; snapshot IDs при импорте сохранились. Создание и отдельный routing-reapply trial полностью откатились внешней транзакцией/SAVEPOINT. В постоянной БД восстановлена только ТК 86. Остальные 29 CAL-STRESS, прочие ТК, calendar assignments/allocations и справочники совпали с исходными контрольными суммами; сравнение legacy columns исключает единственную добавленную nullable-колонку. Нормы, ресурсы и оборудование не создавались и не редактировались. Временные локальные UI-сессии отозваны.

### Пошив и оставшиеся реальные blockers

Расчёт с полным допустимым источником подтверждён изолированными тестами: `720 sec × multiplicity 2 × quantity 8 / 3600 = 3,2 labor_hour`; после quantity import до 10 — 4 labor_hour, без удвоения через sewing volume=20. Fixture-нормы существуют только в изолированной pytest БД; в локальные реальные справочники никакие времена «ради теста» не добавлены.

На ТК 86 sewing demand **не ready** из-за реальных zero-time норм assembly 1. У других CAL-STRESS сохраняются исходные неполные сборки/непринятые meter inputs и лазерный pieces-versus-linear_meter конфликт PC-04.4S. Их данные не маскировались; массового backfill остальных ТК и mass scheduling не было. PC-04.4S остаётся открытой.

### Файлы и миграция

- `backend/app/services/technical_cards.py` — input producer, frozen basis refresh при quantity, снятие basis при shop override.
- `backend/app/services/tech_card_model_assembly.py` — явная смена модели сбрасывает только автоматически полученные routing inputs предыдущей модели; новый отсутствующий источник не скрывается старым коэффициентом.
- `backend/app/models/technical_card.py` — nullable Numeric(14,3) `volume_qty_per_item` и positive CHECK.
- `backend/alembic/versions/d0e1f2a3b456_operation_volume_basis.py` — upgrade/downgrade; родитель c9d0e1f2a345; **без backfill legacy/manual rows**.
- `backend/tests/test_operation_input_population_pc_04_4t.py` — 17 regression cases: сублимация, модель после маршрута, полный/нулевой sewing source, no-sewing route, ONE OF, чужая/нулевая/unit-incompatible/inactive norm, default priority, immutable legacy input, quantity import, shop override и precision guard.
- Demand contract, ADR-017, этот отчёт, canonical checklist entries и MD/HTML twins, поддержка T в генераторе production-calendar roadmap.

Локальный PostgreSQL :5432 upgraded до `d0e1f2a3b456`; production/tunnel не использовались. `alembic check` — PASS. Изолированный UUID-owned schema прошёл upgrade → downgrade → upgrade, сохранил прежний volume=7,250, проверил NULL для legacy basis и positive CHECK; удалён только owned test schema. API DTO/OpenAPI поля не расширялись: basis — внутренняя provenance существующей строки, клиент не задаёт её напрямую.

### Проверки и статус

- 17 новых targeted cases; 48 targeted + совместимость Demand/ONE OF/model-assembly — PASS.
- DB/API/runtime/UI E2E, quantity import, rollback, DB integrity, неизменность справочников и остальных данных — PASS.
- Full project check after the final change: **10/10**, **756 backend / 381 frontend tests**, OpenAPI, Alembic, lint, tsc, build and Compose PASS. Existing dependency/lint warnings retained; `git diff --check` PASS.
- Новых P0/P1 в реализации не обнаружено; существующая data readiness остаётся blocked. Новые UI layouts и shell не изменялись; layout техкарты прежний. Backend/schema/data changes приведены выше, предыдущий WIP сохранён.
- Рекомендуемый следующий шаг: отдельно заполнить подтверждённые времена применимых сборочных строк и согласовать реальную мощность LaserCut; затем продолжить PC-04.4S. Не вводить произвольные нормы и не запускать следующую микрозадачу автоматически.

Evidence: `logs/pc-04-4t/{before,after,accepted-sources,new-card-trial,reapply-routing-trial,card-api-after,demand-api-after,unrelated-before,unrelated-after}.json`, `e2e.py`, `migration-cycle.py`, `operation-volumes-after.png`, `project-check-final.log`, `iteration-only-service.diff`.

**HTML twin synced:** T MD `[x]` matches HTML `done:true` in canonical roadmap/project structure and v1.1/detailed calendar; S remains `[ ]` / `done:false`. No commit/push.

PC-04.4T ROUTE AND ASSEMBLY OPERATION DEMAND RESTORED
