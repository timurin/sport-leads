# PC-05.0B — AGENTS.md Data-Flow Lookup & Update Rules

## Исполнитель
Codex

## Зависимость
После PC-05.0A.

## Цель
Добавить в `AGENTS.md` правила работы с `SL-DATA-FLOW-v1`, чтобы:
- агент не читал весь документ без необходимости;
- при изменении связей данных обновлял соответствующие цепочки;
- не тратил лишний контекст/лимит.

## Добавить правила

### Targeted data-flow lookup
Для задач, затрагивающих Model, Routing, Snapshot, TechnicalCard, Assembly, Demand, Capacity, WorkCenter, Scheduler, Calendar, Kanban или Diagnostics:

1. определить затронутые сущности/поля;
2. открыть только индекс `SL-DATA-FLOW-v1`;
3. выбрать релевантные `DF-*` цепочки;
4. читать только эти разделы;
5. расширять scope только при найденной зависимости.

Полный документ читать только для:
- архитектурного аудита;
- cross-module refactor;
- изменения общей модели данных.

### Mandatory data-flow update
Если задача меняет:
- source field;
- persistence/snapshot semantics;
- derived formula;
- consumer;
- dependency;
- invariant;
- diagnostic source;

то перед завершением:
1. обновить релевантный `DF-*` раздел;
2. обновить индекс, если изменился scope;
3. синхронизировать MD/HTML twin;
4. указать в отчёте: `Data-flow updated: DF-...`.

Если data-flow не изменился:
`Data-flow: no changes required`.

### No broad reread
Не перечитывать несвязанные цепочки и не делать общий аудит без явной необходимости.

## Дополнительно
В AGENTS.md добавить путь:
- `docs/architecture/SL-DATA-FLOW-v1.md`
- `docs/erp/status/SL-DATA-FLOW-v1.html`

## Проверки
- AGENTS.md короткий и без дублирования содержимого DATA-FLOW;
- правило targeted lookup понятно;
- правило mandatory update однозначно;
- diff check.

## Не делать
- runtime/backend/frontend changes;
- commit/push.

Финальная строка:
`PC-05.0B AGENTS DATA-FLOW RULES ACTIVE`

## Отчёт выполнения — 2026-10-10

Выбрана PC-05.0B по прямому запросу владельца после создания карты в PC-05.0A. В `AGENTS.md` добавлен один компактный раздел `Data-flow lookup and updates (SL-DATA-FLOW-v1)`: пути к MD/HTML, targeted lookup для перечисленных производственных сущностей, расширение чтения только по найденной зависимости, три разрешённых повода читать всю карту и запрет несвязанного broad reread.

Mandatory update охватывает все семь триггеров задачи: source field, persistence/snapshot semantics, derived formula, consumer, dependency, invariant, diagnostic source. Перед завершением требуется обновить релевантные DF-разделы, индекс при изменении scope, регенерировать HTML и проверить `--check`; закреплены точные строки отчёта `Data-flow updated: DF-...` / `Data-flow: no changes required`. Содержимое цепочек и бизнес-формулы в AGENTS не дублировались.

Изменены только `AGENTS.md` и этот отчёт. Runtime/backend/frontend/модели/DTO/миграции/данные не менялись; исходный WIP сохранён. Новых P0–P3 проблем не обнаружено. Commit/push не выполнялись; новая микрозадача и переход стадии автоматически не начинались.

Checks: data-flow generator --check PASS (13 flows/local links/exact twin); git diff --check PASS; python scripts/check_project.py 10/10 PASS (761 backend / 384 frontend tests). Evidence: ignored logs/pc-05-0b/project-check.log.

Data-flow: no changes required. Roadmap: changes not required. Project structure checklist: changes not required. ERP-check: changes not required. Карта данных и canonical HTML twins в этой итерации не менялись; существующий data-flow HTML twin synced подтверждён проверкой генератора. Следующий шаг — применение этих правил в последующих выбранных владельцем задачах.

PC-05.0B AGENTS DATA-FLOW RULES ACTIVE
