# WorkTask status ↔ board stage sync (2026-08-10)

## Goal

Keep `work_tasks.status` and `work_tasks.board_stage_id` aligned so kanban column «Готово» matches closed tasks. Controls live in the task chat card (not list/kanban chrome).

## Rules (server source of truth)

On `PATCH /work-tasks/{id}`:

1. `status = done` → set `board_stage_id` to active stage named **«Готово»**, set `completed_at` if empty.
2. `board_stage_id` → stage named **«Готово»** → set `status = done` (+ `completed_at`).
3. Leave «Готово» (other stage) while `status` was `done` → set `status = open`, clear `completed_at`.
4. `status` away from `done` while on «Готово» → clear `completed_at`; leave stage unless client also sends a new `board_stage_id`.
5. `cancelled` does not force «Готово» (only `done` does).

Kanban DnD uses the same PATCH path, so drag onto «Готово» closes the task.

## Data repair

One-shot: all rows with `status = done` and board stage ≠ «Готово» move to «Готово».

## UI (task chat)

- Select **Стадия** (active board stages).
- Select **Статус** + quick **Закрыть** / **Открыть снова**.
- Local task state updates from PATCH response; hosts/list refresh via callback when provided.

## Out of scope

- Renaming «Готово» terminal detection by flag.
- Auto-move on `cancelled`.
