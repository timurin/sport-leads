# ADR-026 — Internal collaboration (order / technical-card chat)

**Status:** принято (`2026-08-03`); **amended** `2026-08-05` by ADR-027 (lead XOR anchor / Stage `20.3`)  
**Date:** `2026-08-03`  
**Roadmap:** Stage `19.0.1` (contract); feeds `19.0.2`–`19.5`  
**Depends on:** ADR-023 (session `platform_user_id` author), ADR-024 (authenticated staff), ADR-016 (optional `technical_card_id` context), ADR-001 / order card surface `3.5.7`  
**Evidence:** `docs/roadmap/roadmap.md` Stage 19; task `docs/tasks/v0.9.0-stage-19.0.1-internal-collaboration-adr.md`  
**Later:** lead host + XOR `lead_id` — **ADR-027** / `docs/tasks/v1.00-stage-20.3-unified-messaging.md` (does not reopen Stage 19 sign-off)

## Контекст

На **заказе покупателя** нужна **внутренняя переписка сотрудников** по заказу и его техническим картам: сообщения, **@mention**, микрозадачи из чата (например «Правка по макету», «Не хватает материала»).

Нельзя смешивать этот контур с уже существующими:

| Существующее | Почему не SoT для Stage 19 |
|--------------|----------------------------|
| CRM lead notes / tasks / communications (`1.2.4`, `LeadTask`, lead timeline) | Lead/pre-order CRM; ≠ order execution chat |
| External connectors (`NormalizedMessage`, Telegram/VK/email — `1.4` / `16.1`) | Внешние каналы с клиентом/источниками |
| Design-module asset comments (`10.1.2`, ADR-022) | Комментарии к версии дизайна; могут deep-link позже, не заменяют order thread |
| Shop-floor fact entry (`11.*`) | Цеховой факт этапов, не переписка |
| Universal audit (`17.1.3`, ADR-025) | Security/admin append-only log, не чат |
| Ops journal `18.4` (→ v1.00) | Business «модель участвовала…», не staff chat |

Поверхность UI уже намечена: фильтр **«Коммуникация»** на карточке заказа (`3.5.7`) — **surface**, не домен. Документ ТК (`9.4.2`) — второй surface того же домена.

## Решение

### 1. Один домен: `InternalCollaboration` (OrderChat)

Канонические сущности (логические имена; физические таблицы — `19.1`):

| Entity | Cardinality / keys |
|--------|--------------------|
| **CollaborationThread** | Один primary thread на `sales_order_id` (required). Сообщения могут нести optional `technical_card_id` (контекст ТК). Отдельный thread на каждую ТК **не** обязателен в MVP — фильтр по `technical_card_id` на сообщениях. |
| **CollaborationMessage** | `thread_id`, `author_platform_user_id`, `body`, `created_at` (tz-aware), optional `technical_card_id` |
| **CollaborationMention** | `message_id`, `mentioned_platform_user_id` (+ optional display snapshot) |
| **CollaborationMicrotask** | `title`, `status` (`open` \| `done`), `assignee_platform_user_id`, `sales_order_id`, optional `technical_card_id`, optional `source_message_id`, `created_by_platform_user_id` |

Правила:

- Автор и assignee = **`platform_user_id`** (ADR-023). Справочник сотрудников `2.4.2` (→ v1.00) — **мягкая** зависимость: mention picker MVP = platform users с доступом к заказу; связка user↔employee — когда directory появится.
- Сообщения и микрозадачи **append/update status only** — удаление истории не в MVP (soft-delete later if needed).
- Закрытие микрозадачи **не** удаляет сообщения.
- Нет demo/local fallback UI при отсутствии API.

### 2. Границы ответственности

| Stage / surface | Роль |
|-----------------|------|
| `3.5.7` «Коммуникация» | UI filter / chrome на order card → live thread (`19.3.1`) |
| `9.4.2` TC document | Panel / deep-link в тот же order thread с TC context (`19.3.4`) |
| `1.2.4` | CRM lead only — **не** писать order chat в `LeadTask` |
| `10.1.2` | Design comments remain design-scoped; optional later attach/link |
| Notifications | Soft dep: mention / microtask events (`19.4`); baseline notifications в project-structure |

### 3. Access (MVP)

- Только authenticated staff (ADR-023 session).
- Anonymous → 401.
- Read/write scope MVP: пользователь, который может открыть заказ (и ТК, если сообщение с `technical_card_id`). Точные permission codes — в `19.1.4` (reuse order/TC read where possible; не invent parallel ACL).

### 4. Out of scope (this ADR / Stage 19 MVP)

- Клиентский портал / внешний chat с покупателем
- Замена shop fact UI
- Real-time websocket (polling/refresh OK for MVP)
- Rich attachments beyond text (later)
- Merging into audit trail or ops journal

### 5. Consequences

- Stage 19 owns one collaboration model; Stages 3 and 9 only host UI surfaces.
- `19.0.2` amends `order-card-field-links.md` + ADR-016 cross-ref; `19.0.3` documents dedupe vs CRM/design.
- Implement sequence: domain/API `19.1` → microtasks `19.2` → UI `19.3` → notifications `19.4`.

## Связанные документы

- Roadmap Stage 19
- `docs/architecture/order-card-field-links.md` (amend in `19.0.2`)
- ADR-016 technical card domain
- ADR-023 authentication session
- ADR-022 design version assets/comments (boundary only)
- **ADR-027** — lead XOR anchor + shared UI shell (`20.3`)
