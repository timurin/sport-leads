# PC-04.4O — Explicit Demand Rule for TechOperation

## Исполнитель
Codex

## Проблема
Для операций с режимом `По заданной норме времени` readiness показывает ошибку `Как рассчитывается потребность`, потому что Capacity настроен, а Demand rule отсутствует.

Менеджер ТК не должен вводить чел.-ч вручную. Норма настраивается администратором в TechOperation.

## Цель
Добавить явную настройку Demand rule для `explicit_hours`.

Поддержать минимум два admin-режима:
- `fixed_per_order` — фиксированное время на одну ТК/заказ;
- `per_item` — время на одно изделие × количество ТК.

Хранить значение нормы в минутах или секундах по текущему стандарту проекта, без float drift.

## Runtime
Demand:
- fixed_per_order → configured duration;
- per_item → duration × TechnicalCard.quantity;
- если rule/value отсутствует → `missing_operator_norm`.

Capacity остаётся отдельной логикой и не меняется.

## Diagnostics
Использовать общий diagnostics contract PC-04.4M:
- entity = конкретная TechOperation;
- field = конкретное отсутствующее поле, например `Норма времени`;
- message одинаковый для TechOperation / Routing / TechnicalCard.

После заполнения нормы diagnostic исчезает на всех уровнях.

## API
Расширить TechOperation read/write contract минимальными полями Demand rule.
Не ломать существующие операции и API.

## Migration
Reversible Alembic migration только если нужна.

## Tests
- fixed_per_order;
- per_item;
- missing rule/value;
- Demand/Scheduler используют rule;
- diagnostics исчезает после заполнения;
- regression existing modes;
- migration cycle;
- backend tests;
- project check;
- git diff --check.

## Не делать
- manager manual input;
- frontend;
- новые Scheduler semantics;
- Capacity/WorkCenter changes;
- VIS-STRESS changes;
- commit/push.

Финальная строка:
`PC-04.4O EXPLICIT DEMAND RULE READY FOR UI`

## Результат — 2026-10-09

**PC-04.4O backend CLOSED.** Следующая выбранная владельцем итерация после PC-04.4M:
закрыт отсутствующий источник времени для `explicit_hours`, без перехода roadmap stage.

TechOperation read/create/update получили два nullable поля:

- `demand_rule`: `fixed_per_order` / `per_item`;
- `demand_duration_seconds`: положительное целое число секунд, максимум 2147483647.

Секунды соответствуют существующему стандарту assembly/sewing norms. API отвергает
ноль, отрицательные значения, float/bool, переполнение и неизвестный rule. Частичные
настройки допускаются: отсутствующее поле остаётся blocking diagnostic. Read/list
возвращают поля без дополнительных запросов; прежний бюджет каталога — 3 запроса.

| Правило | Demand в часовом unit связанного ресурса |
|---|---|
| `fixed_per_order` | `Decimal(seconds) / 3600`, независимо от quantity |
| `per_item` | `Decimal(seconds) × TechnicalCard.quantity / 3600` |

`fixed_per_order` означает одно исполнение операции на одной ТК/route-step, а не
дедупликацию всех ТК SalesOrder или группы. Поле нормативов существует только в
TechOperation; manager manual input и rule/value на ТК не добавлены.

Норма читается в существующий frozen Demand input вместе с текущими настройками
операции. Identity/membership/edges/facts card snapshot не меняются. Норма применяется
только к `explicit_hours`; `rate`, `sewing_norm`, `cutting_methods`, `team_rate`,
milestone и excluded resources сохраняют свои адаптеры. Hourly units ресурса
(`labor_hour`, `machine_hour`, `team_hour`) сохраняются, без вычисления времени
из Capacity и без умножения Demand на staff count/hours per day.

Provenance использует существующие `fixed_per_card` / `technical_card_quantity`;
details содержат operation id, norm table, rule, seconds, quantity и formula id.
Scheduler получает обычный ready Demand и использует прежние placement/quantum/
manual/fact/locked gates. Изменение нормы не пересохраняет планы автоматически;
применяется существующая явная команда перепланирования. Norm PATCH использует
существующий scheduler transaction lock, чтобы не менять источник в середине расчёта.

**Diagnostics PC-04.4M:** отсутствие rule/value — `missing_operator_norm`, entity и
fix_scope = `tech_operation`, конкретный id/name. Отсутствующий rule указывает
`demand_rule` / «Правило расчёта потребности»; отсутствующая длительность —
`demand_duration_seconds` / «Норма времени». Например:
`Операция «Подготовка макетов к печати»: не заполнено поле «Норма времени».`
Все diagnostic fields совпадают между операцией, routing и effective ТК; после
заполнения исчезают на всех применимых уровнях. Невыбранный ONE OF member не требует
нормы для runtime ТК. Для explicit machine/team hours missing norm также теперь
`missing_operator_norm`; прежнее различие `missing_fixed_norm` этого адаптера снято
по задаче. Два существующих L/M regression assertions обновлены под этот контракт.

**Models / migration:** TechOperation — два nullable columns и CHECK rule/duration.
Миграция `c9d0e1f2a345`, parent `b8c9d0e1f234`, upgrade/downgrade без backfill норм.
Write probe migration directory — PASS; local Docker PostgreSQL `:5432` upgrade
применён, `alembic check` — `No new upgrade operations detected`.
Изолированный upgrade → configured value/invalid-value constraints → downgrade →
upgrade прошёл; прежние id/name rows сохранены. Public downgrade/production apply
не выполнялись. Реальным операциям значения не назначались.

**Файлы:** новый migration и `backend/tests/test_explicit_demand_rule_pc_04_4o.py`;
изменены `models/tech_operation.py`, `schemas/tech_operation.py`,
`services/tech_operations.py`, `production_demand.py`, `production_demand_snapshot.py`,
`route_readiness.py`, `production_diagnostics.py`; указанные L/M assertions;
контракт `docs/architecture/production-demand-pc-04-2.md`, этот task и canonical
roadmap/project-structure/ERP-check с HTML twins. Generator изменён только для
регистрации PC-04.4O и проверки generated calendar HTML.

**Проверки:** 23 новых tests; **115 targeted passed**; **729 backend passed**,
**373 frontend passed**; project check **10/10**, включая OpenAPI, Alembic,
TypeScript, lint, tests, build и Compose. `git diff --check` и generated roadmap
`--check` — PASS. Логи: [targeted](../../logs/pc-04-4o-targeted-final.log),
[project check](../../logs/pc-04-4o-project-check-final.log).
Проверены обе формулы, дробная quantity без float drift, hourly units, одна секунда
без потери allocation, реальные persisted plans, отсутствующие/invalid rule/value,
API create/read/list/partial PATCH, исчезновение diagnostics, selected ONE OF,
независимость Capacity, сохранение остальных modes и migration cycle.

Точное сравнение local source rows до/после — PASS:
10 operations (старые поля сохранены, новые нормы NULL), 11 resources, 9 WorkCenters;
VIS-STRESS **30 cards / 130 stages / 130 operation rows**, assignments/allocations
0/0 как в baseline. [Evidence](../../logs/pc-04-4o-data-verification.json).
Existing WIP сохранён; baseline 157 files в ignored `logs/pc-04-4o-baseline/`;
frontend byte-identical. [Diff этой итерации](../../logs/pc-04-4o-incremental.diff).

**HTML twin synced:** только отдельная PC-04.4O `[x]` ↔ `done:true`;
ERP-check backend-only, остальные checkbox/stage boundaries не изменены.
Обязательный canonical `git diff --`:
[canonical diff](../../logs/pc-04-4o-canonical-git.diff).
Новых P0/P1 нет; existing lint/deprecation warnings — P2 вне задачи;
новых P3/visual findings нет. Capacity/WorkCenter/Scheduler semantics, frontend,
production и реальные нормы не менялись; commit/push/merge не выполнялись.

Осталось / рекомендуемая следующая итерация: отдельный UI настройки rule/seconds
в TechOperation и явное администрирование реальных значений. Legacy операции без
настройки остаются blocked; production readiness не объявляется автоматически.
Следующая задача не начата.

`PC-04.4O EXPLICIT DEMAND RULE READY FOR UI`
