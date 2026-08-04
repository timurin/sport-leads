# ADR-025 — Universal audit event contract

**Status:** принято (`2026-08-01`)  
**Date:** `2026-08-01`  
**Roadmap:** Stage `17.1.3.1` (contract); feeds `17.1.3.2`–`17.1.3.3`  
**Depends on:** ADR-023 (`platform_user_id` actor), ADR-024 (permission-gated writes as first emitters)  
**Evidence:** `docs/tasks/v0.9.0-stage-17.1.3-universal-audit.md`

## Контекст

Нужен **единый** журнал критичных мутаций платформы (кто / что / когда / по какой сущности), отдельно от:

| Существующее | Почему не SoT для `17.1.3` |
|--------------|----------------------------|
| `nomenclature_history` (`4.3.3`) | Domain card feed; FIFO cap; free-text `actor` |
| Domain stage performer / scrap fields | Execution facts on TC stages, not a platform audit log |
| Global ops journal `18.4` (→ v1.00) | Business «модель участвовала в продаже/производстве»; guards for draft/size-grid — **≠** security/admin audit |

ADR-023 §7 уже фиксирует: actor key для audit = session `platform_user_id`.

## Решение

### 1. Сущность `AuditEvent` (логический контракт)

| Field | Type / notes |
|-------|----------------|
| `id` | PK |
| `occurred_at` | timezone-aware UTC |
| `actor_platform_user_id` | FK nullable — null only for system/bootstrap jobs without session |
| `actor_login` | denormalized snapshot at write (login may change later) |
| `action` | stable code string, e.g. `size_grid.update`, `role.assign`, `shop.stage.complete` |
| `entity_type` | stable type key, e.g. `size_grid`, `platform_user`, `technical_card_stage` |
| `entity_id` | string or int-as-string — polymorphic id of the primary entity |
| `request_id` | optional correlation (header / middleware later) |
| `payload` | JSON object — **non-secret** before/after or delta; never passwords, session tokens, cookie values |
| `source` | `api` \| `system` \| `migration` (MVP: mostly `api`) |

Append-only: **no update/delete API** in MVP. Retention/purge is ops later (`17.2`), not part of `17.1.3.1`.

### 2. Action catalog (MVP emitters)

First writers after persist (`17.1.3.2`) / surface (`17.1.3.3`):

| Action | Entity | Trigger |
|--------|--------|---------|
| `size_grid.create` / `update` / `delete` | `size_grid` | `size_grids.write` mutations (`17.1.2.4`) |
| `size_grid.row.create` / `update` / `delete` | `size_grid_row` | same |
| `role.assign` / `role.revoke` | `platform_user` | `admin.roles.assign` |
| `shop.stage.complete` / `shop.stage.rollback_kanban` | `technical_card` (+ stage in payload) | `shop.kanban.transition` |
| `stage_executors.put` | `production_stage` | directory PUT (`17.1.2.8`) |

Catalog is seed-extensible; new modules add codes in the implementer of `17.1.3.2`, not free-text from clients.

### 3. Write path rules

- Emit **in the same DB transaction** as the successful mutation (service layer), not from the frontend.
- Failure to append audit after a successful business write is **P1** — do not swallow; prefer transaction rollback over silent skip.
- Actor: `get_current_platform_user` id + login snapshot; unauthenticated public routes do not emit platform audit (they stay out of MVP emitters).
- Payload size: keep small (ids, changed field names, coarse before/after); no full entity dumps.

### 4. Query surface (`17.1.3.2`)

MVP read API (authenticated; admin-oriented — exact permission code chosen in implement, e.g. reuse `admin.roles.assign` or add `audit.read`):

| Method | Path | Behavior |
|--------|------|----------|
| `GET` | `/audit-events` | filter by `entity_type`, `entity_id`, `actor_platform_user_id`, `action`, time range; newest first; limit/offset |
| `GET` | `/audit-events/{id}` | single event |

No public anonymous access.

### 5. UI surface (`17.1.3.3`)

- Minimal: show recent events on critical mutation screens (at least size-grid card edits when write UI is used).
- Full Administration «Журнал» list UI is **not** required to close `17.1.3` if query API + at least one consumer panel ship; Stage `18.4` remains the business ops journal.

### 6. Out of scope (this ADR / MVP)

- Replacing `nomenclature_history` or merging into it
- Implementing `18.4` OperationJournal
- Immutable WORM storage / legal e-sign
- Streaming / SIEM export
- Client-authored audit rows

## Последствия

- `17.1.3.2` creates `audit_events` (name may match migration) + service append/query + wires first emitters from §2.
- `17.1.3.3` surfaces size-grid (and optionally role-assign) mutations to the operator.
- Domain histories and `18.4` stay separate SoTs with explicit boundaries above.

## Evidence

- Roadmap: `17.1.3.1`
- Task: `docs/tasks/v0.9.0-stage-17.1.3-universal-audit.md`
- Related: ADR-023 §7; ADR-024 protected writes; `4.3.3` nomenclature history; `18.4` ops journal (v1.00)
