# IC-G01 — Protect Production Fact on Route Reapply

## Исполнитель
Codex

## Источник
PC-05.2 `SL-INVARIANT-COVERAGE-v1`

## Priority
P0

## Проблема
Повторное применение маршрута может удалить или пересоздать snapshot-узлы так, что уже записанный производственный факт начатой/завершённой операции теряется.

Это недопустимо.

## Цель
Защитить производственный факт при `route reapply`.

## Targeted data-flow
Использовать только релевантные цепочки:
- `DF-ROUTE-SNAPSHOT`
- `DF-SCHEDULER-CALENDAR`
- `DF-DIAGNOSTICS`

Не читать весь `SL-DATA-FLOW-v1`.

## Инвариант
Если snapshot node имеет факт:
- `in_progress`
- `completed`
или другой подтверждённый production fact,

то reapply маршрута не может:
- удалить этот node;
- заменить его новым node без сохранения идентичности/факта;
- потерять связь с CalendarAssignment/audit;
- сбросить статус;
- изменить уже записанный факт молча.

## Поведение

### 1. Preflight перед reapply
Сравнить current snapshot с новым route graph.

Если reapply затрагивает node с production fact:
- операция должна быть заблокирована;
- вернуть HTTP 409;
- diagnostic code:
  `route_reapply_conflicts_with_production_fact`
- category:
  `INTEGRITY`

### 2. Разрешённый случай
Если изменения маршрута не затрагивают fact-bearing nodes, reapply разрешён.

Существующий факт и связанные идентификаторы должны сохраниться.

### 3. ONE OF
Если selected member уже `in_progress/completed`:
- нельзя сменить выбор через route reapply;
- вернуть тот же класс integrity conflict.

### 4. Calendar
Если fact-bearing node имеет CalendarAssignment/audit:
- связи сохраняются;
- reapply не создаёт orphan assignment/allocation.

### 5. Diagnostics
Debug Center должен показать:
- какой snapshot node защищён;
- operation;
- fact status;
- что именно новый маршрут пытается изменить/удалить;
- recommended action.

Не предлагать auto-fix.

## Tests
Минимум:
- reapply identical route with started node -> safe/no fact loss;
- reapply removes started node -> 409;
- reapply changes started ONE OF member -> 409;
- reapply changes only future untouched nodes -> allowed;
- completed node preserved;
- CalendarAssignment preserved;
- lifecycle audit preserved;
- no orphan refs;
- legacy snapshot path covered.

## Data-flow update
Если semantics reapply изменены:
обновить:
- `DF-ROUTE-SNAPSHOT`
- `DF-SCHEDULER-CALENDAR`
- `DF-DIAGNOSTICS`

Синхронизировать HTML twin.

## Проверки
- targeted tests;
- backend full tests;
- project check;
- DB integrity;
- migration check if needed;
- git diff --check.

## Не делать
- broad route refactor;
- auto migration of existing facts;
- mass rewrite TechnicalCards;
- frontend changes unless DTO contract minimally requires it;
- commit/push.

## Отчёт
Коротко:
1. root cause;
2. guard location;
3. conflict semantics;
4. before/after example;
5. tests;
6. remaining P1 gaps.

Финальная строка:
`IC-G01 PRODUCTION FACT PROTECTED ON ROUTE REAPPLY`

## Отчёт выполнения — 2026-10-11

Выбрана IC-G01: первый P0 из PC-05.2, прямо назначенный владельцем. Следующие задачи не запускались.

Root cause: explicit reapply удалял StageResult и routing operation lines целиком. Начатый этап без completed stages проходил прежнюю проверку, поэтому терял started_at/performer/work_done/duration; lifecycle detach сохранял историю отвязки, но не сам факт.

Guard расположен в `backend/app/services/route_reapply.py`, подключён до удаления строк в общем `_apply_routing_template`. Public reapply использует scheduler/card locks; запись графа/шаблона сериализована с этой проверкой, запись material fact использует тот же card lock. Preflight сравнивает защищённую identity/shape, unit применённого объёма, выбранную ONE OF ветку и effective predecessors. Защищаются started/completed/skipped, записанные поля факта (включая нулевые значения), material fact, подтверждённый WIP/FG/scrap, sewing/stock ledger. Workshop-bound evidence защищает узлы этого цеха; неизвестная принадлежность защищает все узлы. Это консервативный reject, без восстановления отсутствующей identity.

Destructive изменение возвращает HTTP409, строковый detail, `X-Diagnostic-Code: route_reapply_conflicts_with_production_fact`, `X-Diagnostic-Category: INTEGRITY`, thin `X-Diagnostic-Details` первых десяти конфликтов. Отклонённый preflight не пишет business rows/audit. Identical и допустимый future-only reapply сохраняют protected node/operation-line IDs, status, все поля факта, ручные объёмы, confirmation/actor/time выбора, назначения, allocations и исторический аудит. Удаляемые future nodes получают существующий lifecycle detach с reason `future_snapshot_reapplied`; фиктивного rebinding/replan нет. Completed card разрешает только identical proven snapshot; bare legacy fact не получает выдуманную operation identity.

Пример до/после: начатый snapshot node 1 со временем, исполнителем и duration60 раньше заменялся pending node. Теперь identical reapply оставляет node 1 и его CalendarAssignment/audit неизменными. Смена его operation возвращает409 до SQL mutation. Изменение label будущего pending узла после completed prefix разрешено, prefix остаётся тем же.

Debug Center использует общий `card_diagnostics`/`read_health`: показывает node, operation/name, fact status, attempted changes и рекомендованное действие без auto-fix. Чтение текущего live template обнаруживает текущий конфликт reapply; отклонённые запросы к другим шаблонам не сохраняются как исторические diagnostic records. Локальный read-only scan:67 diagnostics, из них9 новых reapply conflicts, zero SQL writes. STRESS_TEST-1/card121/node867 остаётся reason unknown, без ремонта.

Изменены backend service `route_reapply.py`, интеграции `technical_cards.py`, `routing_graph_write.py`, `shop_routings.py`, `production_diagnostics.py`, API `technical_cards.py`; добавлены22 сценария в `test_route_reapply_ic_g01.py`, старый gap-proof IC-RS-03 превращён в preserve regression. Обновлены ADR-017, invariant matrix и data-flow с HTML twins, root roadmap/project structure/ERP-check и matching HTML checkpoints. Frontend продукта не изменялся. DB models без изменений; миграция не требуется. HTTP detail совместим, diagnostic headers добавлены, существующий DTO используется без нового persistence.

Проверки:131 targeted passed; полный backend828 passed; frontend388 passed; `check_project.py`10/10 (OpenAPI/Alembic/lint/tsc/build включены); Alembic не обнаружил новых upgrade operations. Local localhost:5432 integrity:247 FK, orphan refs0, SQL writes0. Генераторы data-flow/invariant/production-calendar `--check` и `git diff --check` прошли. Предупреждения pytest относятся к существующим dependencies/cache и не являются падением проверок. Evidence: ignored `logs/ic-g01/project-check.log`, `targeted.log`, `db-integrity.json`, `local-health.json`, `canonical-docs.diff`.

P0 IC-RS-03 устранён в route reapply scope. Семь P1 строк матрицы остаются открыты: manual started-plan delete/detach, date/unit allocation drift, stale quantity/live inputs, frozen snapshot completeness, destructive operation deletion. Destructive model/assembly binding не входит в закрываемый path и требует отдельного review. P2/P3 не исправлялись попутно. Рекомендуемая следующая итерация — IC-G02; не запускалась. Общие PC-05/PC-04.4S и переход stage не закрывались.

Data-flow updated: DF-ROUTE-SNAPSHOT, DF-TK-OPERATION-VOLUME, DF-ONE-OF, DF-SCHEDULER-CALENDAR, DF-DIAGNOSTICS. HTML twin synced. Roadmap/Project structure/ERP-check: IC-G01 выполнен, owner review pending. Commit/push не выполнялись; существующий WIP сохранён.

IC-G01 PRODUCTION FACT PROTECTED ON ROUTE REAPPLY
