# PC-06.1A — Post-production handoff: Ready to Ship → Shipped

## Исполнитель
Codex

## Цель
Добавить явный post-production lifecycle после полного завершения производственного маршрута.

Существующие разделы:
- `/production/stages/ready_to_ship`
- `/production/stages/shipped`

Production core не переписывать.

## Требуемая бизнес-логика

### 1. Полный производственный цикл завершён
Когда все required snapshot operations TechnicalCard завершены:

- производственный маршрут считается completed;
- TechnicalCard больше не должна исчезать из рабочего контура без следующего состояния;
- карточка должна попадать в раздел:

`Готовы к отгрузке`
`/production/stages/ready_to_ship`

Это переход:
`Production completed → Ready to ship`

### 2. Ready to ship
В этом состоянии:
- ТК больше не показывается как активная в производственном Kanban;
- Queue производственных участков её не содержит;
- Calendar сохраняет историю производственного плана;
- факт производства не изменяется;
- карта доступна в `/production/stages/ready_to_ship`.

### 3. Shipped
Из `Готовы к отгрузке` пользователь выполняет явное действие:

`Отгрузить`

После успешного действия карточка переходит в:

`Отгружены`
`/production/stages/shipped`

Это переход:
`Ready to ship → Shipped`

Автоматически переводить в shipped нельзя.

## Source of truth
Нужно определить и использовать один canonical persisted post-production state.

Не использовать:
- CalendarAssignment;
- Kanban column;
- UI-only state.

Если существующий lifecycle/status уже поддерживает такие значения — использовать его.
Если нет — предложить минимальное расширение модели/enum без изменения production progression.

## Важное разделение
Production state и fulfillment state не смешивать.

Production completed означает:
- все required operations completed.

Shipping state означает:
- ready_to_ship;
- shipped.

Не возвращать shipped-карту обратно в production workflow без отдельного явного сценария.

## API / actions
Минимально нужны:

- read/query для `/production/stages/ready_to_ship`;
- read/query для `/production/stages/shipped`;
- action:
  `mark_shipped` / эквивалент existing style.

Если endpoints уже существуют — переиспользовать и исправить semantics.

## UI contract
Для `ready_to_ship`:
- номер ТК;
- заказ;
- модель;
- quantity;
- дата готовности;
- дата отгрузки;
- customer/order reference, если уже есть;
- кнопка `Отгрузить`.

Для `shipped`:
- read-only history;
- shipped_at;
- кто подтвердил отгрузку, если existing audit/user contract это поддерживает.

Не делать UI redesign в этой задаче; только backend/read-model contract и minimal frontend wiring при необходимости.

## E2E
Использовать завершённую тестовую карту:
`STAB-P1-001-1` (id 159)

Проверить:
1. она отсутствует в активном production Kanban;
2. она присутствует в `/production/stages/ready_to_ship`;
3. production facts/history сохранены;
4. выполнить `Отгрузить`;
5. карта исчезает из ready_to_ship;
6. появляется в `/production/stages/shipped`;
7. shipped transition не меняет route snapshot/stage results/Calendar assignments/material facts/quantity/personalization.

Если изменение существующей completed-карты рискованно — создать отдельную safe test card на разрешённом SKU и довести только post-production transition.

## Diagnostics / audit
При невозможном переходе вернуть manager-friendly reason.

Минимум:
- нельзя ship, если production не completed;
- нельзя повторно ship уже shipped card;
- integrity mismatch между completed production и shipping state должен диагностироваться.

## Tests
Минимум:
- all required operations completed -> ready_to_ship;
- incomplete production -> not ready_to_ship;
- ready_to_ship -> shipped;
- shipped idempotency/protection;
- shipped card not in production Kanban/Queue;
- completed production history unchanged;
- quantity/personalization unchanged;
- Calendar history unchanged.

## Docs
Обновить targeted:
- Project Memory;
- relevant Data Flow;
- invariant coverage;
- roadmap/ERP-check только если добавляется новый canonical lifecycle contract.

## Не делать
- Scheduler refactor;
- Kanban redesign;
- Calendar redesign;
- warehouse/inventory shipment documents;
- payment logic;
- logistics integration;
- commit/push.

## Architecture decision pending — 2026-10-15

Resolved by the owner's subsequent PC-06.1A v2 task: warehouse/QR/WIP/partial shipment is deferred; separate whole-card fulfillment and no-op warehouse hooks are explicitly authorized. The investigation below is historical. Implementation/evidence belongs to `pc-06-1a-v2-simple-ready-to-ship-shipped-with-warehouse-hook-codex.md`.

Targeted inspection found a compatibility dependency: ADR-019 §§1,3,5 and ADR-030 §6 define `ready_to_ship` / `shipped` as applied routing nodes with warehouse receipt/issue and partial per-unit posting. `technical_cards._append_finished_goods_stages` appends both required nodes after packaging. `production_state.resolve_fact_state` includes them in completion; `tech_card_wip` also completes/reopens production from unit locations. These are existing production/warehouse contracts.

The requested independent fulfillment state is clear. The unresolved boundary is how existing FG nodes and partial unit shipment remain executable when these same pages become whole-card fulfillment lists. Adding only fulfillment fields leaves packaging routes incomplete and outside the new ready list. Marking existing FG nodes completed would invent facts. Neither is an acceptable fallback.

Proposed persistence: nullable `TechnicalCard.fulfillment_status` (`ready_to_ship` / `shipped`), `ready_to_ship_at`, `shipped_at`, plus existing actor/audit events. Ready transition shares production completion's transaction. Explicit shipment locks the card, validates canonical completion, rejects duplicates and prevents production reopen after shipment. Reads never repair data; the new shipment action does not post stock.

Owner decision needed: retain legacy warehouse/unit FG execution through a separate explicit entry point, or supersede FG routing progression with an approved compatibility policy for existing snapshots and partial postings. Recommended: preserve historical nodes, unit flags and ledger unchanged; define the legacy execution entry point before replacing stage pages. This determines completion scope and migration/backfill rules; do not rewrite snapshots or infer history from live templates.

Read-only local check: `STAB-P1-001-1` (159) has seven completed operations (design, print×2, cutting, sewing, QC×2), no FG markers and no stock documents. It is suitable for fulfillment E2E after the compatibility decision. No database writes.

Iteration result: investigation/proposal only; acceptance remains open. No application code, migrations, roadmap/ERP checklist or HTML twins changed. Project memory and Data-flow: no changes required until the lifecycle contract is selected. Tests/full project check not run: no executable changes. Existing working-tree changes preserved; no commit/push or production actions.

## Acceptance
Готово, если:
1. completed production автоматически попадает в `ready_to_ship`;
2. `Отгрузить` явно переводит в `shipped`;
3. обе страницы показывают правильные наборы ТК;
4. production history сохраняется неизменной;
5. нет возврата shipped в production;
6. новых P0/P1 нет.

Финальная строка:

`PC-06.1A POST-PRODUCTION READY_TO_SHIP / SHIPPED FLOW READY`
