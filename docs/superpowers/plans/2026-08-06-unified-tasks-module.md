# Unified Work Tasks Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a unified `WorkTask` module (цех + responsible/executor + Telegram-like chat with images) replacing LeadTask/CollaborationMicrotask UI, with live `/sales/tasks`.

**Architecture:** New SQLAlchemy models + `/work-tasks` API; files under `storage/task-media/`; FE list + chat card; host tabs on lead/order/PO; one-time Alembic data migrate; leave CollaborationMessage alone.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, Next.js (App Router), PlatformUser auth patterns from Stage 19/21.

## Global Constraints

- ADR-028 / `SL-WORK-TASKS-v1` are SoT
- Anchor XOR: lead | sales_order | production_order
- Workshop = `ProductionStage`; actors = `PlatformUser`
- DS-SHELL-01/02 unchanged
- List pages: `docs/architecture/list-page-data-rules.md`
- MD↔HTML roadmap twins atomic
- One roadmap microtask per iteration; no commit unless owner asks

---

## File map

| Area | Files (create/modify) |
|------|------------------------|
| Models | `backend/app/models/work_tasks.py` (new), `__init__.py` |
| Schemas | `backend/app/schemas/work_tasks.py` |
| Services | `backend/app/services/work_tasks.py`, `work_task_media.py` |
| API | `backend/app/api/work_tasks.py` + router include in `main` |
| Migration | `backend/alembic/versions/*_work_tasks.py` (+ later data migrate) |
| Tests | `backend/tests/test_work_tasks_23_*.py` |
| FE lib | `frontend/lib/work-tasks.ts` |
| FE pages | `frontend/app/(workspace)/sales/tasks/page.tsx`, `[id]/page.tsx` |
| FE UI | `frontend/components/tasks/*` |
| Hosts | lead-page / sales-order-page / production order Tasks tab |
| Docs | ADR-028, task file, roadmap Stage 23 (done in 23.0.1) |

---

### Task 1: 23.1 — DB models + Alembic + storage helper

**Replaces:** roadmap `23.1.1`–`23.1.2`

- [ ] Write failing test: create WorkTask with lead XOR, reject dual anchors
- [ ] Add models `WorkTask`, `WorkTaskMessage`, `WorkTaskAttachment`
- [ ] Alembic upgrade/downgrade
- [ ] `storage/task-media` path helper + `.gitkeep` / ignore already covered
- [ ] Run pytest focused; stop

### Task 2: 23.2 — API CRUD + messages + upload

**Replaces:** roadmap `23.2.*`

- [ ] Failing tests for list/create/patch/messages/upload
- [ ] Implement services + routes `/work-tasks`
- [ ] Embed routes on lead/order/production-order
- [ ] Pytest green; stop

### Task 3: 23.3 — FE `/sales/tasks` live list

- [ ] Replace demo Kanban page with RSC list from API
- [ ] Slim list DTO; filters
- [ ] Basic empty/error states; stop

### Task 4: 23.4 — FE task chat card + images

- [ ] `/sales/tasks/[id]` chat UI
- [ ] Composer text + image upload
- [ ] Stop

### Task 5: 23.5 — Host tabs + deprecate old UI

- [ ] Wire lead/order/PO Tasks to WorkTask
- [ ] Remove primary LeadTask panel + collaboration microtasks UI
- [ ] Stop

### Task 6: 23.6 — Data migrate + regression + owner visual

- [ ] Alembic data migrate LeadTask + CollaborationMicrotask
- [ ] Regression suite + docs checkpoint
- [ ] Owner visual gate

---

## Execution note

Start at Task 1 after owner confirms the design spec file. Do not skip TDD for BE XOR and upload paths.
