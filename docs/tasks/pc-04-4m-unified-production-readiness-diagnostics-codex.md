# PC-04.4M — Unified Production Readiness Diagnostics

## Исполнитель
Codex

## Источник истины
Использовать существующие TechOperation readiness, Routing graph/readiness, TechnicalCard snapshot/Demand/Scheduler blockers и контракты PC-04.4G / PC-04.4I / PC-04.4L.

Не делать новый общий аудит.

## Проблема
Готовность расходится между:
- `/settings/catalogs/tech-operations`
- `/settings/catalogs/routings/{id}`
- `/production/tech-cards/{id}`

После исправления ошибки на одном уровне она может появляться на другом.

## Цель
Сделать один shared diagnostic/readiness source. Одна и та же производственная ошибка должна иметь одинаковые:
- `code`
- `severity`
- `entity_type`
- `entity_id`
- `entity_name`
- `field`
- `message`
- `fix_scope`

на всех трёх уровнях.

## Сделать
1. Выделить общий backend diagnostic/readiness resolver.
2. Проверки должны опираться на тот же runtime contract, что Demand/Scheduler.
3. Diagnostic обязан указывать конкретное место исправления: операция, ресурс, оборудование, поле/параметр, ONE OF вариант при необходимости.
4. Пример:
   - code: `missing_operator_norm`
   - entity_name: `Подготовка макетов к печати`
   - field: точное пользовательское поле
   - message: `Операция «Подготовка макетов к печати»: не заполнено поле «...».`
   - fix_scope: `tech_operation`
5. TechOperation API получает те же diagnostics для операции.
6. Routing агрегирует diagnostics активных/default nodes без изменения `code/field/message`.
7. TechnicalCard агрегирует diagnostics effective snapshot/selected ONE OF nodes без изменения `code/field/message`.
8. Не создавать разные тексты одной ошибки на каждом endpoint.
9. После исправления первопричины diagnostic должен исчезнуть одновременно на всех применимых уровнях.
10. ONE OF: невыбранные alternatives не блокируют runtime ТК; template может показывать их собственный warning отдельно.
11. Snapshot immutability не нарушать.

## API
Переиспользовать/добавить единый DTO `diagnostics` без breaking changes, если возможно.

## Tests
Обязательный regression:
- одна ошибка TechOperation -> Routing -> TechnicalCard имеет одинаковые `code/field/message`;
- после исправления источника исчезает везде;
- no false green;
- ONE OF selected/default semantics;
- Scheduler blocker совпадает с blocking diagnostic;
- backend tests;
- project check;
- git diff --check.

## Не делать
- frontend;
- новые нормы;
- ручной ввод менеджером;
- Scheduler semantics changes;
- VIS-STRESS changes;
- commit/push.

## Краткий отчёт
Только root cause, shared resolver/DTO, 2–3 примера diagnostics, tests, remaining gap.

Финальная строка:
`PC-04.4M UNIFIED READINESS DIAGNOSTICS READY FOR UI`

## Результат — 2026-10-09

**PC-04.4M backend CLOSED.** Выбрана явным запросом владельца после существующих
PC-04.4G/I/L; следующая задача и переход этапа не запускались.

**Root cause:** PC-04.4L передавала только первый Demand reason и общий текст.
TechOperation API не использовал этот readiness result; готовый рабочий график
не означал наличия Demand rule. ТК дополнительно проверяет реальные объёмы,
выбранный вариант, оборудование и сохранённый план.

**Shared resolver/DTO:** `backend/app/services/production_diagnostics.py` и
`backend/app/schemas/production_diagnostics.py`. Frozen diagnostic содержит
единые code/severity/entity_type/entity_id/entity_name/field/message/fix_scope;
field_label, operation_id и resource_key уточняют пользовательское поле и контекст.
Причины берутся из существующего Demand resolver, а capacity проверяется той же
функцией `_capacity`; diagnostics ТК также включают реальный dry-run blocker
`schedule_card_in_transaction(persist=False)`, без записи/commit/перестановки плана.

- TechOperation list/detail/create/update возвращают additive `diagnostics`.
- Routing graph возвращает общий `diagnostics` только для active/default nodes;
  каждый node имеет собственные diagnostics и прежний `affects_route` для alternatives.
- ТК: `GET /technical-cards/{id}/production-diagnostics`, а также diagnostics в
  существующем route-graph. Используются реальные snapshot inputs и selected ONE OF;
  нет fallback на default при отсутствующем выборе ТК. Snapshot не изменяется.
- Прежние DTO fields и legacy PC-04.4L messages сохранены для совместимости;
  канонический подробный текст читается из `diagnostics`. Недостающая capacity теперь
  также блокирует legacy node status. Не выбранные alternatives не блокируют ТК.

Примеры:

| code | Место исправления | field / fix_scope |
|---|---|---|
| `missing_operator_norm` | операция «Подготовка макетов к печати», ресурс «Оператор печати» | `calculation_mode` / `capacity_resource`; поле «Как рассчитывается потребность» |
| `resource_capacity_not_configured` | конкретный ресурс операции | `hours_per_day` / `capacity_resource`; поле «Рабочих часов в день» |
| `missing_linear_meters` | конкретная ТК и операция её снимка | `volume` / `technical_card`; поле «Объём операции» |

Для первого примера одинаковы **все** поля diagnostic на operation → routing → card;
после исправления источника ошибка исчезает на всех применимых уровнях. Card-only
inputs не объявляются ошибкой шаблона. Неисправное оборудование не создаёт ложный
blocker, когда Scheduler может выбрать другой совместимый кандидат: неполная
capacity альтернативного оборудования — warning. Выбор совместимого оборудования
вынесен в общий helper с тем же выражением; Scheduler semantics не изменились.

**Проверки:** 10 новых regression tests; целевой набор **74 passed**;
полный backend **706 passed**, frontend **369 passed**;
`scripts/check_project.py` **10/10** (OpenAPI, Alembic, TypeScript, lint, tests,
build, Compose), `git diff --check` и generated roadmap `--check` — PASS.
Покрыты одинаковые diagnostics/исчезновение после исправления, no false green,
ONE OF default/selected, неизменность snapshot, совпадение Scheduler blocker,
объёмы ТК, оборудование, пустой рабочий график и read-only поведение.

Первая полная проверка обнаружила увеличение запросов каталога с 3 до 8 — code
regression, исправлена. Existing batch test снова проверяет **ровно 3 запроса**;
новый тест проверяет 42 операции без per-row fetch. Repository eager-load использует
существующие FK resource→stage/work_center; новые ORM relationships не меняют схему.
Миграция и новые нормы не требуются. Финальные логи:
[project-check](../../logs/pc-04-4m-project-check-final.log),
[targeted](../../logs/pc-04-4m-targeted-final.log).

**Remaining gap:** `explicit_hours` по-прежнему не имеет утверждённого operator/fixed
Demand rule. Diagnostic точно указывает операцию, ресурс и существующее поле
настройки; не выдумывает поле ручных часов или новую норму. Frontend adoption единого
DTO — отдельная задача; готовность diagnostics не закрывает production readiness.

WIP сохранён: baseline 144 files в ignored `logs/pc-04-4m-baseline/`, frontend
byte-identical, VIS-STRESS не менялся. Новых P0/P1 нет; existing lint/deprecation
warnings — P2 вне задачи. **HTML twin synced**: отдельная PC-04.4M `[x]` ↔ `done:true`
в roadmap/project-structure и их HTML, ERP-check backend-only; generated calendar
HTML проверен. Остальные checkbox/stage boundaries не изменены. Обязательный
canonical `git diff --` и diff этой итерации:
[canonical diff](../../logs/pc-04-4m-canonical-git.diff),
[incremental diff](../../logs/pc-04-4m-incremental.diff).
Commit/push/merge, frontend и production apply не выполнялись.

`PC-04.4M UNIFIED READINESS DIAGNOSTICS READY FOR UI`
