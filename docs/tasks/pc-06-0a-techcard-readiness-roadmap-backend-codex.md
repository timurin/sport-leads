# PC-06.0A — TechnicalCard Readiness Roadmap Backend

## Исполнитель
Codex

## Цель
Добавить единый backend readiness contract для техкарты, который станет источником данных для будущего manager-facing roadmap/checker.

Это НЕ новый production workflow и НЕ refactor production core.

Production core после PC-05.14 считать baseline:
- Calendar = plan;
- Queue = waiting order;
- Kanban = fact;
- snapshot progression/material gate/quantity не менять.

## Контекст
Использовать только:
- `SL-PROJECT-MEMORY-v1`
- `DF-KANBAN-FACT`
- `DF-TK-OPERATION-VOLUME`
- `DF-SCHEDULER-CALENDAR`
- relevant diagnostics/invariants
- targeted TechnicalCard/readiness/diagnostics symbols

Без repo-wide scan.

---

## 1. Readiness endpoint / read model

Добавить canonical read model для одной TechnicalCard:

`TechnicalCardReadiness`

Минимум:

- `technical_card_id`
- `overall_status`
- `can_launch`
- `progress_completed`
- `progress_total`
- `steps[]`

### `overall_status`
Одно из:
- `ready`
- `warning`
- `blocked`
- `incomplete`

### `steps[]`
Каждый шаг:
- `code`
- `title`
- `status`
- `summary`
- `issues[]`
- `fix_action`
- `fix_url` (если безопасно и уже есть canonical route)
- `blocking`

### `status`
- `completed`
- `warning`
- `blocked`
- `pending`

---

## 2. Канонические шаги

Порядок:

1. `basic`
   - основные данные ТК;
   - quantity > 0;
   - order/TK number;
   - delivery/shipping date, если обязательна текущим contract.

2. `model`
   - product model;
   - assembly variant, если требуется.

3. `route`
   - verified route snapshot;
   - выбранный route/template;
   - ONE OF selection, если требуется;
   - no invalid/unverified legacy route.

4. `personalization`
   - использовать canonical quantity;
   - mismatch personalization sum vs quantity = warning, если текущий invariant не блокирует launch;
   - не менять quantity.

5. `norms`
   - только реально required inputs для Demand/Scheduler;
   - missing operation norms;
   - missing linear meters/labor/demand inputs;
   - readiness должен переиспользовать существующие diagnostics, не создавать вторую систему норм.

6. `planning`
   - planning start/shipping date;
   - valid saved plan;
   - no stale/replan-required state;
   - ETA/plan availability.

7. `launch`
   - итоговая готовность к `Запустить ТК`;
   - блокирующие diagnostics отсутствуют;
   - launch не должен создавать production fact.

---

## 3. Источник ошибок

Переиспользовать существующие:
- diagnostics engine;
- readiness checks;
- invariant guards;
- scheduler validation.

Не дублировать rules вручную, если они уже существуют.

Нужен mapping:
`diagnostic/invariant -> readiness step -> manager message -> fix action`

Если одного backend diagnostic недостаточно, допускается маленький adapter layer, но не новый независимый validator.

---

## 4. Manager-facing wording

Readiness API должен отдавать понятные сообщения без внутренних кодов как основной текст.

Примеры:

### Route missing
`Маршрут производства не выбран.`

Fix:
`Выберите маршрут производства.`

### Personalization mismatch
`Персонализация заполнена на 3 из 4 изделий.`

Fix:
`Добавьте ещё 1 изделие или скорректируйте персонализацию.`

### Missing norm
`Для операции «Сублимационная печать» не заполнена норма.`

Fix:
`Заполните норму модели.`

### Plan missing
`Производственный план ещё не рассчитан.`

Fix:
`Рассчитайте производственный план.`

Technical diagnostic codes/details остаются доступны Debug Mode, но не должны быть единственным текстом readiness.

---

## 5. Launch guard alignment

`can_launch` должен совпадать с реальной backend-возможностью запуска ТК.

Недопустимо:
- roadmap говорит `ready`, а launch endpoint блокирует;
- roadmap говорит `blocked`, а launch проходит.

Если существующий launch guard использует другую логику:
- привести его к тому же canonical readiness source либо переиспользовать общий service;
- не менять смысл launch: launch = ready/waiting, не `in_progress`.

---

## 6. P2 не чинить

Не исправлять здесь:
- forecast после reload;
- поиск модели;
- duplicate date UX;
- delayed Kanban refresh;
- Calendar operation status display;
- WIP badge completed card;
- empty `ВТО и Упаковка`;
- hydration warning.

Readiness может только показать существующее состояние.

---

## 7. Tests

Минимум:

- empty/new TK -> pending/blocked steps;
- quantity 4 + personalization 1 -> warning, quantity unchanged;
- no model -> model blocked;
- no route -> route blocked;
- missing operation norm -> norms blocked;
- saved valid plan -> planning completed;
- stale plan -> planning blocked/warning according to existing invariant;
- ready card -> `can_launch=true`;
- blocked card -> `can_launch=false`;
- launched waiting card remains production-ready semantics;
- completed card -> readiness reflects completed lifecycle without suggesting launch;
- launch guard and readiness `can_launch` agree.

Использовать existing allowed SKU fixtures where needed.

---

## 8. API contract

Добавить/расширить endpoint минимальным способом.

Предпочтительно:
`GET /technical-cards/{id}/readiness`

Не ломать существующие TechnicalCard schemas без необходимости.

---

## 9. Документация

Если contract/semantics реально меняются:
- update Project Memory targeted section;
- update relevant Data Flow/Invariant docs;
- HTML twin sync where canonical docs require it.

Иначе:
`Project memory: no changes required`.

---

## Проверки

- targeted backend tests;
- full backend tests once;
- project check;
- Alembic only if migration unexpectedly needed;
- git diff --check.

Migration не ожидается.

Commit/push не выполнять.

---

## Acceptance

Готово, если:
1. есть один backend readiness contract;
2. 7 шагов возвращаются в фиксированном порядке;
3. issues используют существующие diagnostics/invariants;
4. manager messages понятны;
5. `can_launch` совпадает с реальным launch guard;
6. production core не менялся;
7. новых P0/P1 нет.

Финальная строка:

`PC-06.0A TECHCARD READINESS BACKEND READY`


## Implementation notes — 2026-10-15

Selected PC-06.0A explicitly requested by owner after PC-05.14 baseline. Existing working-tree modifications/untracked files preserved; branch main, no stage transition/commit/push. Backend scope only.

Targeted dependency recorded: card_diagnostics also invokes prospective standalone Scheduler diagnostics. These do not all represent launch invariants in contour A, or on a locked valid saved plan. The adapter keeps only applicable evidence: A has no invented B dates/plan/Demand requirement; verified snapshot/header/model/integrity still apply. B uses canonical ProductionState complete valid fresh plan and real Demand/norm diagnostics. Prospective plan_locked/horizon warnings with an existing valid saved plan cannot prevent its launch. Raw diagnostics remain available in existing Debug API and issue.diagnostic.

Targeted discrepancy discovered in launch regression: legacy sales-order generation can leave route.manifest missing (and current-stage cache unset). Under the task's verified-route requirement readiness and launch now both block it. This task does not fix production generation or auto-certify legacy data. The stage-machine test explicitly uses existing apply-routing before launch; the deliberately manually built material-gate fixture records frozen fixture evidence and synchronizes its initial cache. Existing launch-only scheduler fixture now supplies the required model. Fact/material/quantity/snapshot production algorithms unchanged.

| Source diagnostic / existing field | Readiness step | Manager wording / fix |
|---|---|---|
| Required TK/order number, positive canonical quantity | basic | Укажите номер заказа/ТК и положительное количество |
| Missing model, broken model/assembly reference; missing sewing source without assembly in B | model | Выберите модель/нужную сборку; verify existing sources |
| missing_route/active_route/route snapshot verification, invalid or unresolved ONE OF | route | Маршрут не выбран/требует проверки; выбрать маршрут/вариант, explicit apply only |
| UnitLine count vs canonical quantity | personalization | Заполнено N из Q; add/correct personalization; warning, never quantity write |
| Actual applicable Demand/config/norm/retained operation diagnostics | norms | Заполните требуемые нормы/данные операции; original details in Debug |
| Existing B required dates, complete saved plan, linkage/amount/freshness, saved ETA | planning | Рассчитайте/пересчитайте план; no fake forecast or plan mutation |
| Upstream blockers, projection integrity, terminal/already running lifecycle | launch | Устраните blockers; no repeated launch action for completed/cancelled/in-progress |

Technical diagnostic codes and raw trace exist only as identifiers/Debug evidence; the primary message, summary and fix action are Russian manager wording. Fix URLs are only the existing canonical card route. Adapter-only codes identify missing required header/model/plan and personalization; norm formulas are never duplicated. Missing assembly is required only when the existing sewing diagnostic proves a missing required source; valid applied sales-order sources do not require an invented assembly FK.

Contract: new schemas/technical_card_readiness.py + services/technical_card_readiness.py; GET /technical-cards/{id}/readiness (same authenticated read scope as diagnostics, 404 for missing card). Existing DTOs unchanged. Release reuses this contract under existing scheduler/card locks and retains saved-plan assertion; missing-plan HTTP409 class/code is preserved. Completed/cancelled/in-progress return can_launch=false, launch blocked with a lifecycle-specific explanation and no relaunch fix action. Repeated waiting release remains allowed and writes no fact. No new persisted launched flag, lifecycle enum or migration.

Checks before full project run: 55 targeted tests PASS (10 task cases plus existing launch/verification/material/stage cases). SQL observer proves zero INSERT/UPDATE/DELETE for ready read + release + reread. Full backend is included in required scripts/check_project.py. First complete run: 974 passed / 1 legacy completeness-fixture launch failed; frontend 422 PASS with lint/tsc/build PASS. The remaining helper now explicitly applies its generated route before launch. Corrected task/API + completeness subset: 13 PASS, including actual HTTP readiness=true → launch200 and started_at unchanged. Final repeated full check is required because of that failure; result appended after completion.

Files: new backend/app/schemas/technical_card_readiness.py, backend/app/services/technical_card_readiness.py, backend/tests/test_technical_card_readiness_pc_06_0a.py; updated backend/app/api/technical_cards.py, backend/app/services/technical_card_stages.py (card release guard only), four existing launch fixture regressions. No frontend edits, no P2 issue fixes, no real DB data mutation or mass replan. Documentation: PM-DIAGNOSTICS; DF-DIAGNOSTICS/DF-KANBAN-FACT/DF-SCHEDULER-CALENDAR/DF-TK-OPERATION-VOLUME; IC-DI-01/IC-SC-01 evidence. HTML twins generated/checked.

Remaining limitation: readiness performs the existing detailed diagnostics/dry-run for one card; it is not a list/batch endpoint or an independent guarantee that every possible future scheduling issue was audited. Existing P2 UI items remain untouched. Generated/unverified A cards require explicit route apply; no new automatic recovery. Next iteration: owner review, then separately selected manager UI integration; not auto-started.


## Final validation

`python scripts/check_project.py`: PASS 10/10; 975 backend tests, 422 frontend tests, frontend lint/TypeScript/build, Alembic model drift check (no new operations) and Compose PASS. Full backend repeated only because the first run found the remaining legacy launch fixture. No separate redundant full pytest run. OpenAPI readiness enum/order/default schema PASS; authenticated GET401/200/404 and actual ready GET → POST launch200 tested. Zero-write ready read/release observer PASS.

Exact test changes: new `backend/tests/test_technical_card_readiness_pc_06_0a.py`; updated `test_calendar_plan_lifecycle_pc_05_1b.py` (model in launch-only fixture), `test_technical_cards_9_2_2.py` and `test_technical_cards_9_5_1.py` (explicit route apply before launch), `test_technical_cards_9_3_4_gate.py` (frozen manual fixture evidence/cache). Runtime baseline diff confirms only new schema/service/GET and replacement of the card-release ONE OF precheck by the canonical readiness guard; existing locked saved-plan assertion retained. No fact producer or Scheduler implementation edits.

Scoped iteration diff/whitespace PASS; global diff retains only pre-existing `frontend/components/settings/shop-routing-detail-workspace.tsx:237` EOF whitespace P3. New P0/P1: none. Existing P2 UI issues not addressed. Roadmap/Project structure/ERP-check PC-06.0A updated with evidence; HTML twin synced. Project memory updated PM-DIAGNOSTICS. Data-flow updated: DF-DIAGNOSTICS, DF-KANBAN-FACT, DF-SCHEDULER-CALENDAR, DF-TK-OPERATION-VOLUME; generated DF/invariant HTML twins checked. No frontend/UI contract changes, migration, live-data repair, production apply, commit/push or automatic next task. Recommended next action: owner review of the backend contract before separately selected UI work.

PC-06.0A TECHCARD READINESS BACKEND READY
