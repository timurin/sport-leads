# PC-05.0C — Platform Diagnostics & Data Lineage Foundation

## Исполнитель
Codex

## Зависимости
После PC-05.0A и PC-05.0B.

Использовать только релевантные `DF-*` цепочки из `SL-DATA-FLOW-v1`.

## Цель
Создать единый backend слой диагностики платформы, чтобы ошибки показывали:
- что сломано;
- откуда ожидались данные;
- что реально найдено;
- где разорвалась цепочка;
- что исправить.

Не заменять существующую бизнес-логику.

## Единый diagnostic contract
Минимум:
- code
- severity
- category: CONFIGURATION | DATA_FLOW | RUNTIME | INTEGRITY
- module
- entity_type/id/name
- field
- expected_source
- source_value
- actual_value
- formula/trace
- reason
- fix_action
- fix_scope
- fix_url/target metadata
- debug_details safe for UI

## Scope первой версии
Подключить основные производственные цепочки:
- Routing/Snapshot
- Operation volume
- Assembly/Sewing
- ONE OF
- Demand
- Capacity/WorkCenter
- Scheduler
- Calendar

Переиспользовать существующие diagnostics, не создавать параллельную систему.

## Data lineage trace
Для diagnostic уметь показать цепочку, например:
`Model Route Norm -> Snapshot -> OperationLine -> Demand -> Scheduler`

И определить точку разрыва.

## Platform health API
Добавить read-only API для Debug Center:
- summary counts;
- diagnostics list;
- filters by category/module/severity/entity;
- optional entity-specific trace;
- no mutations.

## Contract tests
Минимум:
- configuration missing;
- source exists but snapshot missing -> DATA_FLOW;
- snapshot exists but derived value wrong -> DATA_FLOW;
- valid data but scheduler cannot place -> RUNTIME;
- broken reference -> INTEGRITY;
- one diagnostic identical across entity-level and platform-level views.

## Не делать
- UI;
- auto-fixes;
- business-data mutation;
- broad platform rewrite;
- commit/push.

## Обязательное
Если меняются data-flow semantics:
обновить релевантные `DF-*` sections + HTML twin согласно AGENTS.md.

## Acceptance
Готово, если:
1. есть единый diagnostic DTO/resolver;
2. platform-wide read-only health API;
3. diagnostics показывают provenance/trace;
4. категории ошибок различают config/data-flow/runtime/integrity;
5. существующие diagnostics не расходятся с новым слоем;
6. contract tests зелёные.

Финальная строка:
`PC-05.0C PLATFORM DIAGNOSTICS FOUNDATION READY FOR UI`

## Отчёт выполнения — 2026-10-10

Выполнена PC-05.0C после A/B по прямому запросу владельца. Перед изменениями использованы релевантные DF-DIAGNOSTICS и зависимые routing/volume/assembly/ONE OF/capacity/scheduler цепочки. Общий аудит несвязанных модулей не выполнялся. Исходный WIP сохранён; последующая UI задача не начиналась.

Расширен существующий `ProductionDiagnostic`, а не введён параллельный DTO готовности. Старые поля сохранены, добавлены category/module, expected_source/source_value/actual_value, formula/trace, reason/fix_action/fix_url/fix_target и safe debug_details. Общий `production_diagnostics.resolve_details` используется existing entity surfaces и platform aggregation; дедупликация обновлена для JSON metadata. Graph diagnostics также нормализуются этим resolver. Card diagnostics включают read-only lineage, поэтому entity и platform не расходятся.

Добавлены `production_lineage.py` и `platform_health.py`: существующий источник без route snapshot; подходящая source norm без copied input; mismatch frozen basis × quantity; broken soft operation/model/assembly/route references; malformed ONE OF groups; sewing source table/IDs/time/multiplicity trace; active equipment без capacity adapter; calendar allocation target/unit/span consistency. Scheduler использует прежний dry-run persist=False. Empty configured working_days классифицируется CONFIGURATION в resource context; реальное исчерпание horizon при валидных данных — RUNTIME. ONE OF альтернативы исключены из volume checks; положительные manual NULL-basis totals не проверяются как derived. Snapshot, нормы, quantity, даты и план не исправляются автоматически.

API зарегистрирован в app.main:

- `GET /platform-health`: filtered total/counts + limit1..200/offset diagnostics; category/module/severity/entity_type/entity_id filters.
- `GET /platform-health/technical-cards/{id}/trace`: тот же результат resolver, что existing card diagnostic view; missing card404.

Доступ — authentication + существующее `audit.read`. Методы только GET, business writes/commit отсутствуют. Debug details содержат выбранные поля и IDs; нет ORM/config/credentials dumps и raw validation exceptions. Scope=`production`; summary counts относятся к полному отфильтрованному результату до pagination. Pagination ограничивает payload, не стоимость scan; per-card dry-run и per-template projections выполняются явно. Фоновый collector/cache и исчерпывающий аудит всех ERP references не заявлены. NULL basis не различает legacy и manual ввод: zero input с существующей нормой показывает место проверки, но не доказывает историю потери данных и не разрешает auto-fix.

8 новых contract cases: configuration missing + identical entity/platform issue; source exists/snapshot missing; missing norm copy + wrong derived total; valid workload/horizon exhaustion; broken soft ref; API filters/counts/trace404/422 и SQL no-writes; malformed groups без утечки validation payload; calendar unit integrity. **40 final focused passed** вместе с M/T regression suites. Первоначальный API test использовал thread-local SQLite fixture; исправлен на существующий StaticPool scheduler fixture (test config), все проверки прошли.

Полная проверка `python scripts/check_project.py`: **10/10 PASS**, **769 backend / 384 frontend tests**; OpenAPI/Alembic/frontend/Compose проверены штатным скриптом. Final focused suite выполнена также после уточнения runtime metadata. `git diff --check`, оба generator `--check` PASS. Local PostgreSQL read-only scan:48 diagnostics (27 CONFIGURATION /21 DATA_FLOW), SQL observer подтвердил **ноль INSERT/UPDATE/DELETE**; evidence ignored `logs/pc-05-0c/local-health.json`, `project-check.log`. Это наблюдение текущих сохранённых данных, не их исправление.

Изменены schema/resolver/routing_graph normalization/main registration, новые API/services/tests, контракт `docs/architecture/platform-diagnostics-pc-05-0c.md`, эта задача. Runtime Demand/Capacity/WorkCenter/Scheduler бизнес-формулы не менялись; моделей/миграций/frontend UI/production apply нет. Новых P0/P1 обнаруженных проблем нет; существующие warnings и data/config blockers не маскировались.

Data-flow updated: DF-DIAGNOSTICS. Markdown и `SL-DATA-FLOW-v1.html` синхронизированы генератором; canonical roadmap/project-structure/ERP-check и matching HTML отмечают завершение только C. **HTML twin synced**; PC-04.4S и общий PC-05 остаются открытыми. Следующая рекомендуемая итерация — отдельно выбранный владельцем Debug Center UI на этом read-only контракте. Commit/push не выполнялись.

PC-05.0C PLATFORM DIAGNOSTICS FOUNDATION READY FOR UI
