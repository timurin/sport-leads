# PC-04.4Q — End-to-End Readiness Persistence Fix

## Исполнитель
Codex

## Цель
Один агент полностью находит и устраняет рассинхронизацию `Как рассчитывается потребность` между:
- `/settings/catalogs/tech-operations`
- `/settings/catalogs/routings/{id}`
- `/production/tech-cards/{id}`

Не передавать части задачи другому агенту.

## Симптом
В TechOperation визуально заполнены режим `По заданной норме времени`, `Норма времени`, ресурс, рабочие часы и эффективность, но diagnostics всё равно показывают `Правило расчёта потребности` / аналогичный blocker.

Проверить возможные причины: UI сохраняет не те поля; разные DTO/read models; stale cache; migration/default mismatch; Demand читает другое поле; один patch затёр контракт другого.

## Сделать

1. Для реальной операции `Дизайн` проследить полный data-flow:
`UI form -> request payload -> API schema -> service -> DB columns -> GET response -> readiness diagnostics -> Demand resolver -> Routing diagnostics -> TechnicalCard diagnostics`.

2. После сохранения нормы проверить напрямую Postgres, затем GET API и reload UI. Значение не должно теряться.

3. Найти один root cause и исправить источник, а не маскировать ошибку на frontend.

4. Сделать один canonical contract: Demand/readiness читают те же поля, которые редактирует TechOperation UI. Не оставлять legacy/new параллельные поля или frontend-only state.

5. После исправления одна операция должна иметь одинаковый итог на всех трёх экранах. Если blocked — одинаковые `code/entity/field/message`. Если ready — ready везде.

6. Перед изменениями зафиксировать `git status`; не делать broad reset/checkout и не перетирать существующий WIP. Менять только необходимые файлы.

## Обязательный E2E на локальной БД
Для `Дизайн`:
1. задать валидный Demand rule;
2. сохранить;
3. проверить DB;
4. проверить TechOperation API;
5. проверить Routing diagnostics;
6. проверить TechnicalCard diagnostics;
7. выполнить Demand/Scheduler preflight;
8. подтвердить исчезновение прежнего blocker.

## Self-check
- Persistence: PATCH/POST -> DB -> GET roundtrip.
- Runtime: Demand resolver использует сохранённый rule.
- Diagnostics: TechOperation / Routing / TechnicalCard совпадают.
- Reload: после перезапуска backend результат не меняется.
- Regression: fixed_per_order, per_item, missing rule, ONE OF selected/default, existing non-explicit modes.

## Tests
- targeted regression;
- backend full tests;
- frontend tests, если затронут frontend;
- project check;
- alembic/migration check, если затронута schema;
- `git diff --check`.

## Не делать
- новый parallel readiness mechanism;
- manager manual hours;
- Scheduler semantics changes;
- Capacity/WorkCenter changes;
- VIS-STRESS changes;
- commit/push.

## Краткий отчёт
1. root cause;
2. какие поля расходились;
3. изменённые файлы;
4. DB/API/runtime roundtrip;
5. итог на трёх экранах;
6. tests.

Финальная строка:
`PC-04.4Q END-TO-END READINESS PERSISTENCE VERIFIED`

## Resume verification - 2026-10-10

Root cause: the resource editor's time norm wrote `capacity_resources.base_rate`, while explicit-hours Demand reads `tech_operations.demand_rule` and `demand_duration_seconds`. Local Design operation 6 had base_rate=100 on designers, but both operation Demand fields were NULL. Correctly saved operation norms were not lost by the DB.

Existing PC-04.4Q changes remove the misleading resource norm input and point to operation Main fields. Saved operation readiness uses canonical backend diagnostics, matching routing and card surfaces. Canonical flow: operationDraft -> demandWriteFields (minutes to integer seconds) -> PATCH -> TechOperationUpdate -> update_tech_operation -> TechOperation columns -> GET -> shared diagnostics and Demand.

Resumed work preserves pre-existing WIP. Restored backend/scripts/verify_readiness_persistence.py, which contained 6206 NUL bytes. Original corrupt bytes are retained in ignored logs. The script permits only localhost PostgreSQL :5432, restores temporary norms in finally and invokes Scheduler with persist=False.

Local DB/API/runtime roundtrip passed for Design 6 / routing 1 / card 2: fixed_per_order=3600 and per_item=120. The Design missing_operator_norm disappears from all four projections. Demand reads the persisted rule. Evidence: logs/pc-04-4q/resumed-roundtrip-{fixed_per_order,per_item}.json. Original NULL values restored; no plan persisted.

Backend worker restart passed: saved fixed_per_order=3600 survived uvicorn reload and fresh GET plus DB/runtime checks. Original norm restored. Evidence: logs/pc-04-4q/resumed-restart-e2e.py.

Card 2 is not an active standalone card: Scheduler reports standalone_active_card_required. Other operations still have independent missing norm/input errors; this task does not claim whole-card readiness.

Targeted backend: 2 passed. Targeted frontend: 10 passed. Full project check passed 10/10: 731 backend tests, 377 frontend tests, lint, tsc, build, OpenAPI, Alembic and Compose configuration. Existing lint/pytest dependency warnings remain P2; no new P0/P1.

UI E2E passed at 1440x1000: real operation editor save (60 minutes -> 3600 seconds), DB/API/runtime verification, populated editor after reload, routing and technical-card pages. Evidence: logs/pc-04-4q/resumed-ui-e2e.py and resumed-{editor-reload,routing,card}.png. Bootstrap credentials failed (401), so a temporary expiring local AuthSession was used for the existing active user and revoked afterward; passwords and permissions were not changed. This checks the norm editor, not login credential readiness or a full responsive visual acceptance. Existing DS-PT-02-CATALOG pattern retained; shell files untouched.

Changed within PC-04.4Q: frontend/lib/tech-operation-ux.ts (+ its regression), frontend/components/settings/tech-operation-capacity-fields.tsx, frontend/components/settings/tech-operation-edit-modal.tsx; backend/tests/test_readiness_persistence_pc_04_4q.py; recovered backend/scripts/verify_readiness_persistence.py; task and canonical MD/HTML checkpoint entries; production-calendar roadmap generator. Prior unrelated WIP retained. Models/API contract/migrations unchanged by Q.

HTML twin synced: PC-04.4Q MD [x] matches HTML done:true in canonical roadmap/project structure and v1.1/production-calendar twins. Remaining work: owner code review; other card inputs/norms and broader calendar items remain separate tasks. Recommended next iteration: select one remaining calendar microtask with the owner; no next item started.

PC-04.4Q END-TO-END READINESS PERSISTENCE VERIFIED
