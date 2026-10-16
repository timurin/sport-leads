# PC-06.1A v2 — Simple Ready to Ship / Shipped with Warehouse Hook Deferred

## Исполнитель
Codex

## Архитектурное решение владельца
На текущем этапе складской учет на платформе не внедряется.

Нужно завершить только бизнес-состояния:
- `Готовы к отгрузке`
- `Отгружены`

При этом оставить возможность позже подключить складской контур без переписывания production flow.

Существующие ADR-019/030 не удалять и не ломать. Складской/QR/WIP процесс считать будущим расширением.

## Цель
После полного завершения производственного маршрута:

`Production completed`
→ `Ready to ship`
→ `Shipped`

Без:
- складских остатков;
- проводок;
- QR/WIP;
- частичной отгрузки;
- документов склада;
- списания номенклатуры.

## 1. Разделить production и fulfillment
Production:
- snapshot route;
- stage results;
- Kanban;
- Queue;
- Calendar;
- production completed.

Fulfillment:
- `ready_to_ship`
- `shipped`

Не добавлять shipping states как новые производственные операции snapshot route.

Если текущие страницы `/production/stages/ready_to_ship` и `/production/stages/shipped` исторически были привязаны к route nodes, адаптировать их как projection/read model текущего fulfillment state без удаления compatibility layer для будущего склада.

## 2. Canonical fulfillment state
Добавить минимальное persisted состояние, если его ещё нет.

Предпочтительно отдельное поле/модель:
- `fulfillment_status = ready_to_ship | shipped`
- `ready_to_ship_at`
- `shipped_at`

Не смешивать со `TechnicalCard.status`, если это ломает production lifecycle.

Если уже есть подходящие поля — использовать их.

Migration допустима только минимальная и обратимая.

## 3. Auto transition after production complete
Когда все required production snapshot nodes завершены:
- production lifecycle остаётся `completed`;
- fulfillment автоматически становится `ready_to_ship`;
- `ready_to_ship_at` фиксируется;
- ТК появляется в `/production/stages/ready_to_ship`.

Не создавать stock balance.
Не создавать warehouse movement.
Не изменять route snapshot.

## 4. Explicit ship action
На `/production/stages/ready_to_ship` добавить/использовать действие `Отгрузить`.

После успешного действия:
- fulfillment_status = `shipped`;
- `shipped_at` фиксируется;
- ТК исчезает из `ready_to_ship`;
- появляется в `/production/stages/shipped`.

Повторный ship защищён.

## 5. Warehouse-ready extension point
Оставить чистую точку расширения для будущего склада.

Например service boundary/event:
- `on_ready_to_ship(technical_card)`
- `on_shipped(technical_card)`

Сейчас implementation = no-op / fulfillment state only.

В будущем:

### ready_to_ship
- приход произведённой номенклатуры на склад;
- quantity = TechnicalCard.quantity;
- SKU/product reference;
- batch/TK reference.

### shipped
- расход/списание со склада;
- partial shipment;
- QR/WIP;
- warehouse documents.

Важно: не реализовывать это сейчас.

## 6. Quantity semantics
Fulfillment показывает canonical:
`TechnicalCard.quantity`

Не использовать:
- personalization sum как замену;
- Calendar quantity;
- warehouse quantity, которого пока нет.

## 7. UI/read models

### `/production/stages/ready_to_ship`
Минимум:
- № ТК;
- заказ;
- модель;
- quantity;
- production completed date;
- shipping/delivery date;
- action `Отгрузить`.

### `/production/stages/shipped`
Минимум:
- № ТК;
- заказ;
- модель;
- quantity;
- production completed date;
- shipped_at.

Shipped read-only.

Не делать warehouse UI.

## 8. Compatibility with ADR-019/030
Не удалять ADR и не переписывать их историю.

Документировать:
- warehouse/QR/WIP deferred;
- fulfillment state является временным упрощённым contract;
- будущий warehouse module подключается через extension point и не меняет production completion semantics.

Если существующий route node `ready_to_ship/shipped` используется в старом коде:
- сохранить backward compatibility, где безопасно;
- не создавать двойные competing sources of truth;
- явно пометить deprecated legacy route usage, если нужно.

## 9. Tests
Минимум:
1. incomplete production -> no ready_to_ship;
2. final required operation complete -> production completed + fulfillment ready_to_ship;
3. ready_to_ship page содержит карту;
4. active Kanban/Queue карту не содержит;
5. `Отгрузить` -> shipped;
6. shipped page содержит карту;
7. повторная отгрузка запрещена/idempotent;
8. quantity unchanged;
9. personalization unchanged;
10. Calendar history unchanged;
11. material facts unchanged;
12. no warehouse rows/documents created;
13. no orphan/FK issues.

Использовать safe completed test card, предпочтительно `STAB-P1-001-1` id 159, только если изменение fulfillment state безопасно.

## 10. Docs
Обновить targeted:
- Project Memory;
- Data Flow;
- ERP-check / roadmap only if fulfillment contract becomes canonical;
- note warehouse integration deferred.

HTML twin sync where required.

## Не делать
- stock balance;
- warehouse ledger;
- receipt/write-off movements;
- QR;
- WIP warehouse flow;
- partial shipment;
- shipment documents;
- logistics;
- payment;
- Scheduler/Kanban/Calendar refactor;
- commit/push.

## Acceptance

### Implementation and evidence — 2026-10-15

- Selected item: PC-06.1A v2, explicitly chosen by the owner to resolve the earlier PC-06.1A legacy warehouse decision. No automatic roadmap-stage advancement.
- Persistence: three nullable TechnicalCard fields (`fulfillment_status`, `ready_to_ship_at`, `shipped_at`) with a DB consistency constraint. Reversible migration `i5j6k7l8m912`; isolated PostgreSQL upgrade/downgrade regression. Conservative backfill requires completed selected required production facts, does not infer shipment, skips unresolved/missing-fact/posted-legacy-issue histories and aligns only lifecycle/pointer caches where necessary. On the current local DB, three already-completed cards (1,159,160) received readiness; all pre-existing columns across26 tables remained identical.
- Completion invokes `sync_ready` transactionally, sets ready/time and existing AuditEvent; explicit permission-checked scheduler/card-locked `mark-shipped` sets shipped/time + actor audit. Duplicate/incomplete shipment rejects409; shipped stage/start/reopen/QR writes reject. Guarded pre-shipment rollback clears readiness. `on_ready_to_ship`/`on_shipped` are documented no-op warehouse extension points; production progression/DAG/ONE OF gates and Scheduler remain the existing implementation.
- Legacy compatibility: existing catalog-identified workshop-only FG rows remain stored unchanged and are excluded at the production projection boundary. No automatic FG append to new snapshots. Explicit historical stock adapter remains available separately; the new lists/action never call it. ADR-019/030 history retained with current-boundary notes. No warehouse documents, ledger, balances, unit WIP, partial shipment or logistics added.
- API/read model: authenticated GET `/technical-cards/fulfillment/{ready_to_ship|shipped}` uses one slim joined SELECT, canonical TechnicalCard.quantity and no nested fact arrays. POST `/technical-cards/{id}/mark-shipped` reuses the existing shop-transition permission and canonical audit. `production_fulfillment_mismatch` diagnoses contradictory/uncertain legacy state without read repair.
- Frontend: existing two stage routes now read fulfillment, forward the session and retain PT-02 table/mobile-card primitives. Ready shows card/order/model/quantity/completion/planned shipping dates and Отгрузить; shipped is read-only with shipped_at. Successful action revalidates both lists/detail. Manager-card links avoid legacy warehouse controls. Shell unchanged; browser screenshots/responsive breakpoint verification not performed, no visual acceptance claimed.
- Tests: eight new backend cases cover incomplete/completion/shipment, duplicate/reopen protection, preservation of quantity/personalization/material/snapshot/Calendar/stock history, legacy marker exclusion, single-query read, authenticated API, hook rollback, mismatch diagnostic and reversible PostgreSQL migration. Two frontend API tests cover independent read, cookie forwarding and duplicate errors. Historical FG tests now distinguish the deferred adapter from current production progression; terminal-readiness fixture uses the canonical ready transition.
- Real local E2E: actual API/RBAC/services and PostgreSQL at localhost:5432, with only auth/session dependencies supplied by the existing local harness. Card `STAB-P1-001-1`159: ready list -> explicit ship200 -> absent ready/present shipped -> duplicate409. Changed only fulfillment_status/shipped_at/updated_at, plus one canonical actor audit.24 source/business tables unchanged; all other cards and previous audit rows unchanged.7 historical Calendar assignments preserved;248 foreign keys checked,0 orphan references. Active shop lists and queue APIs exclude159 across its5 distinct workshops; subsequent reads leave all26 table hashes unchanged. Evidence: ignored `logs/pc-06-1a-v2/live-proof.json`, scripts and migration baseline. No production apply, commit or push.

Готово, если:
1. production completed автоматически даёт `ready_to_ship`;
2. `/production/stages/ready_to_ship` показывает эту ТК;
3. явное `Отгрузить` переводит её в `shipped`;
4. `/production/stages/shipped` показывает её;
5. складская логика не создаётся;
6. оставлена documented extension point для будущего склада;
7. production core не менялся;
8. новых P0/P1 нет.

Финальная строка:

`PC-06.1A SIMPLE FULFILLMENT READY_TO_SHIP / SHIPPED READY`

### Final validation

Required project check10/10 PASS: 997 backend, 436 frontend; lint/tsc/build/OpenAPI/Alembic/Compose passed. The first full run exposed one obsolete terminal-readiness fixture; its setup now calls the canonical ready transition, and the repeated full check passes. Targeted18 backend regressions also pass. Scoped git diff --check passes; global diff --check retains the pre-existing unrelated EOF blank line at frontend/components/settings/shop-routing-detail-workspace.tsx:237 (P3). New P0/P1: none found in checked scope. Roadmap/ERP/project-structure matching PC-06.1A records updated atomically with HTML twins (done:true); original PC-06.1B visual gate remains open. Data-flow updated: DF-KANBAN-FACT, DF-DIAGNOSTICS; memory and UI contract updated. HTML twin synced. Remaining: owner visual review of the two PT-02 pages on approved breakpoints; future warehouse/QR/partial integration stays deferred. No commit/push.
