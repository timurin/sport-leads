# Work Tasks: chat bubbles + list/kanban board stages

**Date:** 2026-08-08  
**Status:** Approved (owner)  
**Related:** ADR-028, Stage 23

## Goals

1. **Chat** `/sales/tasks/[id]`: mine right (primary tint), others left (neutral); clear author label; highlight current session.
2. **List views** `/sales/tasks`: toggle **Список | Канбан**.
3. **Board stages** separate from `WorkTask.status`: CRUD columns; task `board_stage_id`.

## Non-goals

- Replace/remove `status` enum
- Reorder cards within a column
- New RBAC codes (reuse session auth like `/work-tasks`)
- Close Stage `23.6.3` owner visual (separate)

## Chat

- FE only: `viewerUserId` from `getMe()`.
- `isMine = message.authorPlatformUserId === viewerUserId`
- Mine: `justify-end`, primary-soft bubble; others: `justify-start`, muted surface.
- Author line: «Вы» vs display name / login.

## Board stages

### Schema

`work_task_board_stages`: `id`, `name` (unique trim), `sort_order`, `is_active`, timestamps.

`work_tasks.board_stage_id` → FK `ON DELETE SET NULL`, indexed.

Seed: Бэклог, В работе, На проверке, Готово (`sort_order` 10/20/30/40).

### API

- `GET/POST /work-task-board-stages`
- `PATCH/DELETE /work-task-board-stages/{id}`
- Delete: refuse if last active stage; else SET NULL on tasks
- List/detail WorkTask include `board_stage_id` (+ optional name)
- `PATCH /work-tasks/{id}` accepts `board_stage_id`

### FE

- `?view=list|kanban` (default list)
- Kanban columns by `sort_order`; drag or menu move between stages
- Column menu: rename, delete; toolbar «+ стадия»
- List view unchanged (existing cards/table)

## Tests

- Migration + stage CRUD + task move
- FE: `formatLoginHandle`-style helpers for view query + bubble side
