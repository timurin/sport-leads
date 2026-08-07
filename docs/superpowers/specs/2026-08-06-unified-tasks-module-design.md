# Unified Tasks module (WorkTask) — Design

**Code:** `SL-WORK-TASKS-v1`  
**Date:** `2026-08-06`  
**Status:** approved (owner sections 1–4)  
**Roadmap:** Stage `23` (`docs/roadmap/roadmap-v1.00.md`)  
**ADR:** `ADR-028`  
**Swarm:** `swarm-1786016747037-4g9654`  
**Owner decision:** replace path — single Tasks module; migrate/leave UI for `LeadTask` + `CollaborationMicrotask`

## Problem

Sport-Lead has three overlapping “task” surfaces:

| Surface | Scope | Gap |
|---------|-------|-----|
| `LeadTask` (1.2.4) | CRM checklist on lead only | No workshop, no chat, not on order/production |
| `CollaborationMicrotask` (19/20) | open/done from staff chat | Not a first-class task list; no workshop; no images |
| `/sales/tasks` | Demo Kanban | Not API-backed |

Owner needs one module: assign work to a **цех** (`ProductionStage`) with **responsible** + **executor**, host on lead / sales order / production order, list under Sales → Задачи, Telegram-like chat with text + images, file storage + DB.

## Decision summary

| Topic | Choice |
|-------|--------|
| Approach | **A** — new `WorkTask` domain (not inflate collaboration thread) |
| Replace | `LeadTask` + `CollaborationMicrotask` UI → `WorkTask`; one-time data migrate |
| Workshop | `production_stage_id` → `ProductionStage` |
| Actors | `PlatformUser` (not `sales_users`) |
| Chat | Per-task messages + attachments (not object-level collaboration thread) |
| Legacy staff chat | `CollaborationMessage` **stays** for now (object thread ≠ task assignment) |
| Storage | `storage/task-media/{task_id}/…` |
| Nav | Live `/sales/tasks`; `/production/tasks` later same SoT |

## Domain model

### WorkTask

- `title` (required)
- `status`: `open` | `in_progress` | `done` | `cancelled`
- `production_stage_id` nullable FK → `production_stages` (цех)
- `responsible_platform_user_id` nullable FK → `platform_users`
- `executor_platform_user_id` nullable FK → `platform_users`
- Anchor **XOR** (exactly one):
  - `lead_id` → `leads`
  - `sales_order_id` → `sales_orders`
  - `production_order_id` → `production_orders`
- `due_at` optional (tz-aware)
- `created_at` / `updated_at` / `completed_at`

### WorkTaskMessage

- `work_task_id`, `author_platform_user_id`, `body` (text; may be empty if attachments only)
- `created_at`

### WorkTaskAttachment

- `message_id`, `storage_key`, `mime_type`, `size_bytes`, `original_filename`
- Images MVP: jpeg / png / webp / gif (align nomenclature media allowlist)

### File storage

- Root: `storage/task-media/` (repo-ignored like other storage)
- Path: `{task_id}/{uuid}-{safe_filename}`
- Serve via authenticated API download endpoint (not static public/)

## API

Prefix: `/work-tasks`

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/work-tasks` | Sales list (filters: status, stage, executor, responsible, anchor type) |
| POST | `/work-tasks` | Create |
| GET | `/work-tasks/{id}` | Detail + recent messages |
| PATCH | `/work-tasks/{id}` | Status / stage / people / title |
| GET | `/work-tasks/{id}/messages` | Chat history |
| POST | `/work-tasks/{id}/messages` | Text and/or multipart image |
| GET | `/work-tasks/{id}/attachments/{attachment_id}/file` | File bytes |

Embed lists:

- `GET /leads/{id}/work-tasks`
- `GET /orders/{id}/work-tasks`
- `GET /production-orders/{id}/work-tasks`

Errors: 404 missing; 400 XOR/title; 413/415 bad files.

Deprecate after migrate: lead-tasks write UI; collaboration microtasks UI. Old tables not dropped in MVP.

## UI

1. **`/sales/tasks`** — replace demo Kanban with live list (status, цех, responsible, executor, object link).
2. **`/sales/tasks/[id]`** — Telegram-like chat (header + message list + composer with image).
3. **Hosts** — lead / order / production order: Tasks tab → list + create + open chat.
4. **Shell** — do not change `DS-SHELL-01/02`. Soft UI consistent with Stage 22 where touched.

## Data migration

1. Create new tables.
2. Map `LeadTask` → `WorkTask` (lead anchor; assignee→executor; created_by→responsible; status map; stage null).
3. Map `CollaborationMicrotask` → `WorkTask` (lead|order; assignee→executor).
4. Do **not** migrate `CollaborationMessage` into tasks.
5. Keep old tables; drop later after owner OK.

## Boundaries (hard)

| In scope | Out of scope |
|----------|--------------|
| Work assignment + task chat | External CRM `LeadMessage` / adapters `1.4.3` |
| Replace LeadTask + microtask UI | Replacing object staff chat (`CollaborationMessage`) in MVP |
| ProductionStage as цех | Inventing a second workshop directory |
| PlatformUser actors | Reintroducing sales_users as SoT for tasks |

## Testing

- BE: CRUD, XOR, messages+upload, list filters, migration smoke
- FE: slim list DTO (list-page rules), mappers
- Regression: lead/order cards without old task panels

## Spec self-review

- [x] No TBD placeholders in core contracts
- [x] Consistent with owner options 1 + sections 1–4 OK
- [x] Does not reopen Stage 19 message SoT for object chat
- [x] Scope = one Stage 23 module (not multi-product)

## Related docs

- ADR-026, ADR-027 (collaboration — leave messages; replace microtasks)
- Stage 1.2.4 LeadTask (migrate away)
- `ProductionStage` / Stage 8.3
- List rules: `docs/architecture/list-page-data-rules.md`
