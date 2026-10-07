# PC-03.5A — Automatic queue entry contract

**Fixed before implementation, 2026-10-05.** Backend-only task [PC-03.5A](../tasks/pc-03-5a-auto-entry-stage-codex.md), frontend handoff [PC-03.5B](../tasks/pc-03-5b-simplify-queue-ux-cursor.md). This explicit owner task supersedes the earlier PC-03.1 arbitrary-stage create semantics, without changing dispatcher PUT.

## Create

`POST /production-calendar/assignments`; existing session + `technical_cards.create` permission.

```json
{"technical_card_id":42,"planned_date":"2026-10-12","note":"Материал ожидается"}
```

Only technical_card_id (existing positive ID), planned_date (valid ISO date), note (optional/null, max 2000) are accepted. No second reference identifier, no manual stage/position/quantity. Legacy create fields production_stage_id, stage, section, position, quantity (even null) →422 rather than accepting a future production stage. Invalid/completed/cancelled/non-standalone TC →422; unauthenticated →401; missing write permission →403. The current frontend create needs PC-03.5B alignment; Codex does not modify frontend.

Backend chooses the existing ProductionStage entity seeded with stable code **`launch_preparation`**, canonical name **«Подготовка к запуску»**, active=true, sort_order=0. Existing stage IDs/order/routes/TC workflow are not rewritten. Quantity stays live from TC. CalendarAssignment schema and pair UNIQUE(TC,stage) remain unchanged.

Response is the **existing AssignmentRead DTO** with actual stage/position, not the requested fields:

```json
{
  "id":101,"technical_card_id":42,"technical_card_number":"TC-42",
  "order_number":"ORDER-42","nomenclature_name":"Форма","quantity":"100.000",
  "production_stage_id":9,"production_stage_name":"Подготовка к запуску",
  "planned_date":"2026-10-12","position":0,"note":"Материал ожидается",
  "created_at":"2026-10-05T15:00:00Z","updated_at":"2026-10-05T15:00:00Z"
}
```

IDs/timestamps are illustrative; frontend must use actual returned ID/name. Read DTO explicitly retains stage/position after the Create DTO becomes minimal. Board keeps slim summaries and the existing 2-query batch contract.

## Ordering / repeats

First entry in an empty date/preparation cell → position=0. Next → `max(position)+1` among that date/stage only, regardless of gaps and legacy manual reorder. Existing rows are never resequenced. Postgres locks the preparation-stage row for the create transaction so concurrent creates see a stable tail. Existing board `(position,id)` tie-break remains deterministic.

Identical repeated POST for the same TC/preparation stage, date and note returns the same assignment and preserves its current position. Incompatible repeat →409; it does not silently move or reset an assignment. Pair uniqueness remains the existing PC-03.1 invariant, not a new global one-assignment-per-TC constraint. Once the dispatcher moves an entry to another stage, a new POST can create a separate preparation assignment under the same pre-existing pair semantics; no full lifecycle/idempotency engine is introduced.

Missing/inactive entry stage →503 with an explicit configuration error, never fall back to printing/sewing and never create a stage from a read/create request. Apply the local migration before exercising create.

## Dispatcher compatibility

`PUT /production-calendar/assignments/{id}` stays `{production_stage_id,planned_date,position,note}`. Existing assignments retain IDs, dates, positions, stage, note, references and quantity; no backfill. Manual moves/reorder are preserved, including a deliberate move to printing/cutting/sewing/packing. This task enforces **initial entry only**, not design/material launch gates or a dependency engine. DELETE and source search remain unchanged.

## Preparation and procurement

The existing capacity resource key `procurement` binds to stage_code **`launch_preparation`** (registration change only). It remains kind/unit/source **milestone**, no settings/editable hourly fields/capacity/rates. Load-state remains unknown/milestone, no hours or percentage, no automatic material readiness from BOM or purchase orders. Other capacity calculations/keys unchanged. No WorkCenter, employee or new stage directory.

## Migration / boundaries

A data-only additive stage migration is required. Upgrade refuses a conflicting pre-existing code/name instead of overwriting/adopting unknown data. Downgrade refuses a modified or referenced stage; it does not delete assignments or null user links via cascade. Local upgrade/downgrade/upgrade is checked with unused seed; production/tunnel out of scope.

No frontend changes, workflow transitions, MES/APS, automatic scheduling, new queue model, quantity field or new endpoint. PC-03.5B owns removing create stage/position and simplifying the UI. UI-E uses the unchanged PUT.


**Verified 2026-10-05:** implementation complete; data-only migration w2x3y4z5a678 (parent v1w2x3y4z567), local upgrade/check/downgrade/upgrade/check and referenced-stage downgrade refusal verified. 61 targeted, 529 full backend tests, project check10/10; eight concurrent real API/Postgres creates yield unique ordered tail positions; dispatcher move/reload preserves quantity. Frontend PC-03.5B not changed/closed by Codex.
