# PC-05.0A — SL-DATA-FLOW-v1 Canonical Map + HTML Twin

## Исполнитель
Codex

## Цель
Создать канонический документ связей данных проекта:

- `docs/architecture/SL-DATA-FLOW-v1.md`
- HTML twin для визуальной проверки владельцем:
  `docs/erp/status/SL-DATA-FLOW-v1.html`

Документ должен помогать агентам быстро понимать, откуда берутся данные, куда сохраняются и кто их использует.

## Важно
Не писать общий пересказ проекта.
Строить карту по реальному коду/моделям/сервисам/API.

## Структура

### 1. Индекс цепочек
В начале короткий индекс с ID:

- `DF-MODEL-ROUTE`
- `DF-MODEL-ASSEMBLY`
- `DF-ROUTE-SNAPSHOT`
- `DF-TK-OPERATION-VOLUME`
- `DF-ONE-OF`
- `DF-SEWING-DEMAND`
- `DF-PRINT-DEMAND`
- `DF-CUTTING-DEMAND`
- `DF-DEMAND-CAPACITY`
- `DF-WORKCENTER`
- `DF-SCHEDULER-CALENDAR`
- `DF-KANBAN-FACT`
- `DF-DIAGNOSTICS`

Добавить другие только если реально нужны.

Для каждой строки:
`ID | Source | Persisted data | Consumers | Invariant | Section`

### 2. Для каждой цепочки
Коротко и структурно:
- Purpose
- Source entity/field
- Persisted/copy/snapshot field
- Derived values
- Consumers
- Update/reapply semantics
- Invariants
- Failure modes
- Diagnostic codes
- Files/modules involved

### 3. Invariants
Особенно зафиксировать реальные формулы и правила, например:
- route norm × quantity -> TechnicalCard operation volume
- assembly duration × multiplicity × quantity -> sewing demand
- snapshot immutable после создания ТК
- ONE OF -> только selected member участвует в Demand/Scheduler
- WorkCenter = source of truth physical equipment
- CalendarAssignment = plan, Kanban = fact/current Workshop

### 4. HTML
HTML должен быть удобен владельцу:
- index/navigation;
- раскрываемые разделы;
- цветные flow blocks;
- таблицы invariants;
- поиск по ID/сущности;
- визуальные схемы связей;
- без внешних зависимостей/CDN.

HTML строится из той же информации, без расхождений с MD.

## Проверка
Сверить минимум по коду:
- Model/Assembly;
- Routing;
- TechnicalCard snapshot;
- TechnicalCardOperationLine;
- Demand;
- CapacityResource/WorkCenter;
- Scheduler;
- Calendar;
- Kanban;
- Diagnostics.

## Не делать
- runtime changes;
- migrations;
- frontend product changes;
- новые бизнес-правила;
- commit/push.

## Acceptance
Готово, если:
1. есть MD + HTML twin;
2. индекс позволяет найти нужную цепочку без чтения всего документа;
3. каждая цепочка содержит source -> persistence -> consumer -> invariant;
4. данные подтверждены кодом;
5. HTML пригоден для ручной проверки владельцем.

Финальная строка:
`PC-05.0A SL-DATA-FLOW-v1 READY FOR OWNER REVIEW`

## Отчёт выполнения — 2026-10-10

Выполнена только выбранная владельцем документационная микрозадача PC-05.0A. Переход к реализации PC-05 не выполнялся; незакрытая PC-04.4S сохранена. Исходный WIP не перезаписан.

Созданы канонический `docs/architecture/SL-DATA-FLOW-v1.md` и визуальный twin `docs/erp/status/SL-DATA-FLOW-v1.html`. Все13 ID имеют index row и отдельный раздел с Purpose, Flow, Source fields, Persisted fields, Derived values, Consumers, Update/reapply semantics, Invariants, Failure modes/Diagnostic codes и ссылками на реальные модули. Дополнительные цепочки не понадобились. Данные сверены с model/assembly, order snapshots, route copy/read/write, TK volume/quantity/manual producer, ONE OF selection/effective graph, Demand adapters, WorkCenter/capacity, scheduler/queue/calendar, stage facts/current workshop и diagnostic resolver.

Особенно зафиксированы реальные границы:

- Routing topology и operation input coefficient копируются в ТК; explicit reapply принимает новые значения, quantity использует сохранённый basis, manual override сохраняет total.
- Standalone sewing Demand читает текущие assembly times; order contour читает order-item time snapshots. На строке ТК нет frozen duration_seconds сборки.
- Live TechOperation rules/resource links/capacity не объявлены immutable snapshot. `fixed_per_order` adapter фактически once per card, не дедупликация заказа.
- Piece variant coefficient сохраняется как input/display, но текущий item Demand остаётся whole-card quantity. Meter Demand берёт один stored total; sewing формула не умножает displayed volume повторно.
- Calendar план и allocation отделены от stage/shop факта; ONE OF фильтрует альтернативы, Kanban имеет один current workshop.
- Shared diagnostics, Scheduler reason codes и validation/conflict exceptions различены; вымышленные коды не добавлялись.

`scripts/generate_data_flow.py` генерирует HTML только из Markdown, записывает source SHA-256, проверяет13 section IDs и наличие всех локальных source links; `--check` сравнивает twin целиком. HTML без внешних зависимостей/CDN; index/nav, case-insensitive entity/ID search, expand/collapse, anchor navigation, colored flow blocks, invariant tables. Chromium file:// проверка при1440×1000 и390×1000 прошла:13 sections, ID/entity search, no-results search, collapse/expand, anchor opening, отсутствие JS ошибок и горизонтального overflow. Evidence: ignored `logs/pc-05-0a/html-verification.json`, `data-flow-1440.png`, `data-flow-390.png`. Это визуальная проверка документа, не изменение product template/Protected Shell. Owner visual review остаётся pending.

Проверки: `python scripts/check_project.py` **10/10 PASS**, **761 backend / 384 frontend tests**; `python scripts/generate_data_flow.py --check` **PASS**; calendar roadmap generator `--check` **PASS**; `git diff --check` **PASS**. Полный check log: ignored `logs/pc-05-0a/project-check.log`. Неуспешных проверок кода нет; существующие backend warnings остаются в логе. HTML anchor self-check сначала выполнял assertion до обработки hashchange; ожидание события в проверке исправлено, повторная проверка обоих размеров PASS; изменение HTML для этого не требовалось.

Изменённые файлы этой итерации: MD/HTML карта, generator, этот task report; canonical roadmap.md/roadmap-v1.1.md/production-calendar-v0.1.md + соответствующие HTML, project-structure.md + HTML, erp-check.md; calendar-roadmap generator расширен только для регистрации PC-05.0A. **HTML twin synced**; done=true относится к созданию документа, не owner acceptance и не завершению стадии. P0/P1 новых дефектов не найдено; данных/норм/моделей/API/product frontend/runtime/migrations не меняли, commit/push не выполняли.

Следующий шаг — ручная проверка владельцем HTML карты; новую реализационную микрозадачу автоматически не начинать.

PC-05.0A SL-DATA-FLOW-v1 READY FOR OWNER REVIEW
