# PC-04.4S — Rebuild 30-TK Stress Dataset + Calendar Check

## Исполнитель
Codex

## Цель
Удалить старый stress dataset `VIS-STRESS-001…030`, создать новый набор из 30 техкарт с разными моделями/маршрутами/вариантами и проверить реальную работу Production Calendar.

Если возникает ошибка — не маскировать её, а остановить соответствующий сценарий и вывести короткий отчёт с root cause.

## Важно
Пользователь явно разрешил удалить старые 30 `VIS-STRESS-*`.

Не удалять другие ТК.
Не трогать реальные/не stress данные.

## 1. Cleanup
Удалить только:
- `VIS-STRESS-001…030`
- связанные snapshot stages/edges;
- variant selections;
- CalendarAssignment/CalendarAllocation;
- связанные тестовые operation lines/данные, созданные старым stress seed.

Перед удалением:
- вывести список ID/номеров;
- проверить, что их ровно 30;
- если набор не совпадает — STOP и report, без broad delete.

После удаления:
- подтвердить `VIS-STRESS-* = 0`.

## 2. Новый dataset
Создать новые 30 standalone TechnicalCard с новым префиксом:

`CAL-STRESS-001…030`

Использовать только существующие активные реальные справочники:
- Model;
- Routing;
- TechOperation;
- ONE OF groups;
- WorkCenter/Capacity.

Не создавать fake norms/resources только ради прохождения теста.

## 3. Вариативность
Набор должен быть неоднородным.

Использовать минимум:
- 5 разных моделей, если реально доступны и готовы;
- 2+ разных маршрута;
- разные quantity;
- разные priority;
- разные planning_start_date;
- разные shipping_date;
- ONE OF варианты раскроя:
  - ручной;
  - настил;
  - лазер;
  где маршрут это поддерживает;
- разные предварительные/confirmed selections, если это допустимо без факта.

Если доступных готовых моделей/маршрутов меньше — использовать максимум реальных и явно указать ограничение.

## 4. Распределение 30 ТК
Сделать примерно:
- 8 малых заказов;
- 10 средних;
- 8 крупных;
- 4 заказа с напряжённым/рисковым сроком.

Quantity выбирать реалистично и различно.

Не делать 30 одинаковых ТК.

## 5. Preflight до Scheduler
До массового планирования проверить каждую ТК:
- snapshot создан;
- route effective;
- ONE OF selected;
- Demand resolvable;
- diagnostics;
- blocking reason.

Сводка:
- ready;
- blocked;
- warning.

Если ready < 25:
не запускать mass schedule вслепую.
Сначала вывести таблицу blockers и root cause.

## 6. Mass Scheduler
Если dataset готов:
- выполнить mass schedule;
- измерить время;
- проверить planned/blocked/risk;
- проверить allocations;
- проверить shared resources;
- проверить WorkCenter selection;
- проверить ONE OF: планируется только selected member;
- проверить sequential/parallel/join semantics, где присутствуют.

## 7. Calendar validation
Проверить данные, которые увидит `/production/calendar`:
- все 30 ТК присутствуют;
- assignments не дублируются;
- отсутствуют assignments невыбранных ONE OF alternatives;
- dates последовательны по DAG;
- manual/locked unrelated records не затронуты;
- deadline risk определяется корректно;
- нагрузка распределена по ресурсам/оборудованию.

## 8. Ошибки
При любой ошибке записать:
- TechnicalCard number/id;
- Model;
- Routing;
- operation;
- diagnostic code;
- field;
- message;
- точный слой: data / Demand / Capacity / Scheduler / Calendar;
- root cause, если определён.

Не исправлять бизнес-данные автоматически, если причина — отсутствующая норма/ресурс/оборудование.
Только report.

## 9. Отчёт
Коротко:
1. cleanup old VIS-STRESS;
2. состав нового CAL-STRESS;
3. ready/blocked;
4. mass schedule result;
5. calendar result;
6. найденные ошибки;
7. performance;
8. что требует ручной настройки.

Сохранить отчёт:
`docs/tasks/pc-04-4s-rebuild-30-tk-stress-dataset-and-calendar-check-codex.md`

## 10. Проверки
- targeted dataset tests/script;
- DB integrity;
- project check;
- git diff --check.

Не commit/push.

## Acceptance
Готово, если:
- старые VIS-STRESS удалены безопасно;
- созданы 30 новых CAL-STRESS;
- dataset реально разнообразный;
- preflight выполнен;
- календарь проверен на готовых ТК;
- все blockers перечислены конкретно;
- никаких fake fixes ради зелёного результата.

Финальная строка:
`PC-04.4S CALENDAR STRESS DATASET REBUILT AND VERIFIED`

## Результат итерации — 2026-10-10

**Набор пересобран и проверен; сценарий Scheduler заблокирован реальными данными. PC-04.4S остаётся открытой для проверки планирования готовых ТК.** Исполнена выбранная владельцем задача, без перехода к следующему пункту roadmap.

1. **Cleanup:** проверен точный набор `VIS-STRESS-001…030`, ID 26–55. Удалены только эти 30 standalone ТК и их каскадные дочерние записи: 1977 поштучных строк, 130 операций, 130 этапов и 102 snapshot edges. Старых assignments/allocations не было. После удаления `VIS-STRESS-* = 0`; остатки удалённых ID дочерних записей — 0. Связанные JSON selections удалены вместе с ТК. Старые пустые order-group envelopes сохранены: родительские группы и чужие бизнес-записи не удалялись. Полная копия удалённого набора — `logs/pc-04-4s/cleanup-backup.json`.
2. **Новый набор:** `CAL-STRESS-001…030`, ID 86–115; 5 активных реальных моделей × 6 ТК; 2 разрешённых моделью маршрута × 15 ТК. Использованы существующие сборки, операции и ресурсы. Новых моделей, маршрутов, норм, ресурсов и оборудования нет. Название номенклатуры ТК — снимок имени выбранной реальной модели; новые строки каталога номенклатуры не создавались.
3. **Вариативность:** 8 малых, 10 средних, 8 крупных и 4 заказа с напряжённым сроком; 30 различных quantity от 8 до 600, разные priorities, 5 planning-start dates и разные shipping dates. В маршруте 2 — 5 выборов лазера, 5 настила, 5 ручного раскроя; 9 preliminary / 6 confirmed selections, без факта и без replan. В маршруте 1 ONE OF отсутствует — варианты не изобретались.
4. **Preflight:** snapshot каждого маршрута создан; effective route разрешён; все активные ONE OF выбраны; исключённые альтернативы отсутствуют в Demand. **Ready 0 / blocked 30 / warning cards 0.** Ни одной полностью готовой модели среди выбранных пяти: в существующих сборках есть нулевые применимые нормы. Карточки оставлены с честной диагностикой.
5. **Scheduler:** mass schedule **не запускался**, поскольку ready < 25. Выполнены только read-only preflight существующего движка. Нет результатов planned/deadline risk, проверки распределения нагрузки, выбранного оборудования или последовательности дат исполнения — эти проверки блокированы. Четыре напряжённых срока являются входными сценариями, а не подтверждённым Scheduler риском. Шаблоны дают последовательность и ONE OF; реальных параллельных fork/join в выбранных маршрутах нет.
6. **Calendar:** все 30 видны через `/production-calendar/board`, `/sources` и `/production/calendar` за недели 5–11 и 12–18 октября. Штатный `enqueue` создал ровно 30 меток «Подготовка к запуску», `routing_stage_line_id=NULL`, без дубликатов; **operation assignments 0 / allocations 0**. Это постановка в очередь, а не успешное планирование операций. Проверены 1440×1000 и 390×1000; на мобильном сохранена горизонтальная прокрутка таблицы. Постороннее назначение `1310/1310-1` осталось на прежнем месте. Визуальных правок нет; существующий календарный шаблон сохранён.
7. **Сохранность:** пересборка — одна внешняя транзакция; commit внутри действующих сервисов ограничен SAVEPOINT. Пробный запуск с полным rollback подтвердил сохранение исходных 30 ТК и отсутствие новых. Контрольные суммы посторонних ТК, зависимых бизнес-строк, assignments/allocations и справочников до/после совпали. Все FK public-schema валидированы. Для UI использована временная истекающая локальная сессия существующего пользователя; после проверки она отозвана, пароли и права не менялись.
8. **Performance:** атомарная пересборка 8,274 с; preflight/проверка календарных данных 3,149 с. Время mass schedule не измерялось — команда не запускалась.

### Конкретные blockers и root cause

В следующей таблице A–D — нормализованные ошибки. Таблица ТК ниже задаёт для каждой ошибки конкретные number/id, model, routing и выбранный вариант; общие metadata/message приведены один раз. Полные 95 диагностик с контекстом каждой ТК сохранены в `logs/pc-04-4s/blockers.json`.

| Ref | Operation / resource | Code | Field / fix_scope | Exact backend message |
|---|---|---|---|---|
| A | 1 / epson01_9300 | `missing_linear_meters` | `volume` / `technical_card` | Операция «Сублимационная печать», ресурс «Печать  EPSON 9300»: требуется исправление для поля «Объём операции». |
| B | 2 / work_center_2 | `missing_linear_meters` | `volume` / `technical_card` | Операция «Термоперенос», ресурс «Каландр SUPERTEX»: требуется исправление для поля «Объём операции». |
| C | 3 / sewers | `missing_sewing_norm` | `assembly_variant_id` / `technical_card` | Операция «Пошив», ресурс «Пошив»: требуется исправление для поля «Сборка изделия / нормы пошива». |
| D | 7 / work_center_9 | `route_snapshot_mismatch` | `production_stage_id` / `tech_operation` | Операция «Раскрой лазером», ресурс «LaserCut»: требуется исправление для поля «Цех операции». |

- **A/B — data → Demand:** созданные строки печати имеют `volume=0` в `linear_meters`. Из количества изделий нельзя вывести метраж без подтверждённых данных. Метры автоматически не подставлялись.
- **C — data → Demand:** `assembly_operation_lines.duration_seconds=0` в применимых сборках. Конкретные нулевые строки: assembly 1 — IDs 2, 3, 4; assembly 7 — ID 33; assembly 3 — ID 16; assembly 5 — ID 24; assembly 6 — ID 29. Нулевая норма не превращается в нулевую потребность.
- **D — Capacity/data → Demand:** операция 7 «Раскрой лазером» и её строки ТК имеют `volume_unit=pieces`, но связанный ресурс `work_center_9` / LaserCut настроен `capacity_unit=linear_meter`, `calculation_mode=rate`. `_linear_meters` отклоняет строку в штуках как `route_snapshot_mismatch`. Цех операции, snapshot и оборудования совпадает (=2): это **несовместимость единиц**, а не фактический перенос между цехами. Общая диагностика отображает `field=production_stage_id`; это неточная локализация причины, требующая отдельной задачи, без изменения диагностик в этой итерации.


Models: 1: Футболка спортивная; 5: Волейбольная ф-ка, О-обр; 45: Футболка; 49: Футболка; 103: Бафф

Routings: 1: Дизайн + Сублим + Пошив; 2: Без дизайна + Сублим + Пошив (копия)

### Состав и результат каждой ТК

| Number / ID | Model / assembly | Routing | ONE OF / status | Qty | Priority | Start | Ship | Blockers |
|---|---|---|---|---:|---:|---|---|---|
| CAL-STRESS-001 / 86 | 1 / 1 | 1 | none | 8 | 11 | 2026-10-10 | 2026-10-21 | A,B,C |
| CAL-STRESS-002 / 87 | 5 / 7 | 1 | none | 12 | 12 | 2026-10-11 | 2026-10-22 | A,B,C |
| CAL-STRESS-003 / 88 | 45 / 3 | 1 | none | 16 | 13 | 2026-10-12 | 2026-10-23 | A,B,C |
| CAL-STRESS-004 / 89 | 49 / 5 | 1 | none | 20 | 14 | 2026-10-13 | 2026-10-24 | A,B,C |
| CAL-STRESS-005 / 90 | 103 / 6 | 1 | none | 24 | 15 | 2026-10-14 | 2026-10-25 | A,B,C |
| CAL-STRESS-006 / 91 | 1 / 1 | 2 | 7/preliminary | 28 | 16 | 2026-10-10 | 2026-10-26 | A,B,D,C |
| CAL-STRESS-007 / 92 | 5 / 7 | 2 | 7/confirmed | 32 | 17 | 2026-10-11 | 2026-10-27 | A,B,D,C |
| CAL-STRESS-008 / 93 | 45 / 3 | 2 | 7/preliminary | 36 | 18 | 2026-10-12 | 2026-10-28 | A,B,D,C |
| CAL-STRESS-009 / 94 | 49 / 5 | 2 | 7/confirmed | 48 | 19 | 2026-10-13 | 2026-10-29 | A,B,D,C |
| CAL-STRESS-010 / 95 | 103 / 6 | 2 | 7/preliminary | 55 | 20 | 2026-10-14 | 2026-10-30 | A,B,D,C |
| CAL-STRESS-011 / 96 | 1 / 1 | 1 | none | 64 | 21 | 2026-10-10 | 2026-10-31 | A,B,C |
| CAL-STRESS-012 / 97 | 5 / 7 | 1 | none | 72 | 22 | 2026-10-11 | 2026-11-01 | A,B,C |
| CAL-STRESS-013 / 98 | 45 / 3 | 1 | none | 80 | 23 | 2026-10-12 | 2026-11-02 | A,B,C |
| CAL-STRESS-014 / 99 | 49 / 5 | 1 | none | 90 | 24 | 2026-10-13 | 2026-11-03 | A,B,C |
| CAL-STRESS-015 / 100 | 103 / 6 | 1 | none | 100 | 25 | 2026-10-14 | 2026-11-04 | A,B,C |
| CAL-STRESS-016 / 101 | 1 / 1 | 2 | 9/preliminary | 110 | 26 | 2026-10-10 | 2026-11-05 | A,B,C |
| CAL-STRESS-017 / 102 | 5 / 7 | 2 | 9/confirmed | 120 | 27 | 2026-10-11 | 2026-11-06 | A,B,C |
| CAL-STRESS-018 / 103 | 45 / 3 | 2 | 9/preliminary | 140 | 28 | 2026-10-12 | 2026-11-07 | A,B,C |
| CAL-STRESS-019 / 104 | 49 / 5 | 2 | 9/confirmed | 180 | 29 | 2026-10-13 | 2026-11-08 | A,B,C |
| CAL-STRESS-020 / 105 | 103 / 6 | 2 | 9/preliminary | 220 | 30 | 2026-10-14 | 2026-11-09 | A,B,C |
| CAL-STRESS-021 / 106 | 1 / 1 | 1 | none | 260 | 31 | 2026-10-10 | 2026-11-10 | A,B,C |
| CAL-STRESS-022 / 107 | 5 / 7 | 1 | none | 300 | 32 | 2026-10-11 | 2026-11-11 | A,B,C |
| CAL-STRESS-023 / 108 | 45 / 3 | 1 | none | 360 | 33 | 2026-10-12 | 2026-11-12 | A,B,C |
| CAL-STRESS-024 / 109 | 49 / 5 | 1 | none | 420 | 34 | 2026-10-13 | 2026-11-13 | A,B,C |
| CAL-STRESS-025 / 110 | 103 / 6 | 1 | none | 480 | 35 | 2026-10-14 | 2026-11-14 | A,B,C |
| CAL-STRESS-026 / 111 | 1 / 1 | 2 | 8/preliminary | 600 | 36 | 2026-10-10 | 2026-11-15 | A,B,C |
| CAL-STRESS-027 / 112 | 5 / 7 | 2 | 8/confirmed | 65 | 1 | 2026-10-10 | 2026-10-11 | A,B,C |
| CAL-STRESS-028 / 113 | 45 / 3 | 2 | 8/preliminary | 125 | 2 | 2026-10-10 | 2026-10-12 | A,B,C |
| CAL-STRESS-029 / 114 | 49 / 5 | 2 | 8/confirmed | 240 | 3 | 2026-10-10 | 2026-10-13 | A,B,C |
| CAL-STRESS-030 / 115 | 103 / 6 | 2 | 8/preliminary | 400 | 4 | 2026-10-10 | 2026-10-11 | A,B,C |

### Проверки, файлы и оставшаяся работа

- 8 targeted tests: точный разрешённый набор, STOP для missing/extra/duplicate/foreign/привязанной к продажам ТК, распределение и различие входных сценариев.
- Trial transaction/rollback, scoped cleanup, fingerprints, snapshot/ONE OF/Demand, DB integrity и HTTP/UI calendar checks — PASS.
- `python scripts/check_project.py` — **10/10**, **739 backend / 381 frontend tests**; OpenAPI, Alembic, lint, tsc, build и Compose — PASS. Существующие предупреждения lint/pytest сохранены; ошибки не скрывались.
- `git diff --check` — PASS. Модели, API-контракты, миграции и приложение не менялись.
- Файлы этой итерации: `backend/scripts/rebuild_calendar_stress_pc_04_4s.py`, `backend/tests/test_calendar_stress_rebuild_pc_04_4s.py`, данный отчёт, canonical roadmap/project-structure/ERP-check и HTML twins, записи S в v1.1/production-calendar roadmap и поддержка этого кода в генераторе. Предыдущий WIP сохранён; commit/push не выполнялись.
- Severity: P0 не обнаружены; существующие блокирующие data/Capacity несоответствия остановили Scheduler. Неправильное поле для unit mismatch — отдельный diagnostic UX debt; никаких runtime-исправлений ради зелёного stress не внесено.
- **HTML twin synced:** S `[ ]` ↔ `done:false`; стадия и функциональная готовность календаря не закрыты. Данные пересобраны, но Scheduler stress acceptance остаётся заблокирован.
- **Ручная настройка:** подтвердить метры для операций 1/2 на каждой ТК, заполнить реальные времена применимых строк сборок, согласовать единицы операции 7 и реальной мощности LaserCut. Затем повторить `--validate` на сохранённых CAL-STRESS без пересборки/удаления и выполнить отдельный защищённый mass/calendar прогон при ready ≥25. Следующая микрозадача автоматически не начата.

Evidence: `logs/pc-04-4s/manifest.json`, `preflight.json`, `blockers.json`, `calendar-api.json`, `calendar-integrity.json`, `unrelated-{before,after}.json`, `project-check.log`, `calendar-2026-10-12-{1440,390}.png`. Скрипт `--rebuild` повторно STOP, если CAL-STRESS уже существует; `--validate` только читает.

PC-04.4S CALENDAR STRESS DATASET REBUILT AND VERIFIED
