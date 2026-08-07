# ADR-028 — Unified Work Tasks module

**Status:** принято (`2026-08-06`)  
**Date:** `2026-08-06`  
**Roadmap:** Stage `23` (`23.0.1` contract)  
**Amends:** ADR-026 / ADR-027 — **microtasks** replaced by WorkTask; **CollaborationMessage** object chat unchanged in MVP  
**Supersedes (UI/SoT for assignment):** Stage `1.2.4` `LeadTask` as primary task surface  
**Depends on:** ADR-023 (`PlatformUser`), Stage 8.3 `ProductionStage`, Stage `0.4` (order without lead)  
**Evidence:** `docs/superpowers/specs/2026-08-06-unified-tasks-module-design.md`; task `docs/tasks/v1.00-stage-23-unified-tasks.md`

## Контекст

Нужен единый модуль **Задачи**: постановка в **цех** (`ProductionStage`), ответственный и исполнитель (`PlatformUser`), якорь на лид / заказ покупателя / производственный заказ, список в Продаже → Задачи, интерфейс чата (текст + изображения).

Сейчас пересекаются:

- `LeadTask` — CRM-чеклист только на лиде;
- `CollaborationMicrotask` — лёгкие open/done из staff-чата;
- `/sales/tasks` — demo Kanban.

Owner (`2026-08-06`): **replace** — один модуль; migrate/leave UI для LeadTask и CollaborationMicrotask.

## Решение

### 1. Новый домен `WorkTask` (не раздувать CollaborationThread)

Один thread collaboration на объект ≠ много задач с чатом. Новые таблицы:

- `work_tasks`
- `work_task_messages`
- `work_task_attachments`

### 2. Якорь XOR

Ровно одно из: `lead_id` | `sales_order_id` | `production_order_id`.

### 3. Цех и люди

- Цех: `production_stage_id` → `ProductionStage`
- Responsible / executor: `platform_users`
- Status: `open` | `in_progress` | `done` | `cancelled`

### 4. Чат и файлы

- Сообщения на задаче; вложения в `storage/task-media/`
- API download; allowlist image MIME (как media)

### 5. API prefix `/work-tasks` + embed lists на lead / order / production-order

### 6. Миграция и deprecate

- Data migrate LeadTask + CollaborationMicrotask → WorkTask
- UI LeadTask / microtasks → WorkTask
- Tables LeadTask / CollaborationMicrotask: no drop in MVP
- **CollaborationMessage** остаётся (object staff chat)

### 7. Границы

| Не писать сюда | Остаётся отдельно |
|----------------|-------------------|
| External CRM (`LeadMessage`) | 1.4.3 |
| Object staff chat | Collaboration* messages |
| Demo `/sales/tasks` | Заменяется live list |

## Последствия

- Stage 23 owns WorkTask end-to-end
- ADR-026 microtask entity becomes legacy after migrate
- Shell contracts preserved; nav href `/sales/tasks` kept

## Alternatives rejected

- Inflate CollaborationThread into multi-task chat (breaks 1:1 thread-per-object)
- Big-bang drop without data migrate (owner chose replace with migrate)
