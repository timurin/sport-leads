# ADR-027 — Unified internal messaging (lead ↔ Stage 19)

**Status:** принято (`2026-08-05`)  
**Date:** `2026-08-05`  
**Roadmap:** `20.3.1` (contract); feeds `20.3.2`–`20.3.3`, `20.4.4`  
**Amends:** ADR-026 (extends thread anchor; does not reopen Stage 19 MVP scope)  
**Depends on:** ADR-026, ADR-023, ADR-001, Stage `1.4.3` / `LeadMessage` external  
**Evidence:** task `docs/tasks/v1.00-stage-20.3-unified-messaging.md`

## Контекст

На карточке лида уже есть `LeadCommunicationPanel` с каналами CRM (phone / email / telegram / …) и пунктом **`internal`**, который пишет в **`LeadMessage`**.

На заказе / ТК — **`OrderCollaborationPanel`** на домене Stage 19 (`CollaborationThread` / messages / mentions / microtasks), ADR-026.

Stage `20.3` требует единого UX внутренней staff-переписки и явных границ vs внешний CRM. Нельзя:

- смешать внешние каналы клиента в collaboration SoT;
- писать order/lead staff chat обратно в `LeadTask` / timeline notes;
- молча «переехать» историю `LeadMessage` в order thread при convert без контракта.

## Решение

### 1. Два контура (жёсткая граница)

| Контур | SoT | UI host (после `20.3.2`) |
|--------|-----|--------------------------|
| **Внешние CRM-каналы** с клиентом / источниками | `LeadMessage` (+ adapters `1.4.3` / `NormalizedMessage`) | `LeadCommunicationPanel` — **без** staff-internal как primary write path |
| **Внутренняя staff-переписка** | `InternalCollaboration` (ADR-026 + это ADR) | Shared collaboration shell на лиде и на заказе / ТК |

`LeadMessage.channel = internal` после `20.3.2`: **не** использовать для новых staff-сообщений. Существующие строки — read-only legacy (timeline/history if already mapped); миграция bulk **не** обязательна в `20.3.2`.

### 2. Shared UI shell vs shared thread SoT

| Вопрос | Решение MVP (`20.3`) |
|--------|----------------------|
| Shared **UI shell**? | **Да.** Вынести/переиспользовать chrome `OrderCollaborationPanel` (лента, composer, @mention, микрозадачи) как общий компонент; hosts: lead card, order «Коммуникация», TC panel. |
| Shared **thread SoT**? | **Да, один домен.** Не второй чат на `LeadMessage`. Расширить `CollaborationThread`: якорь **XOR** — ровно одно из `sales_order_id` \| `lead_id` \| `order_group_id` (`28.5.4`). |
| Один thread на convert lead→order? | **Нет auto-merge в MVP.** Thread лида остаётся на `lead_id`; thread заказа — отдельный на `sales_order_id`. Deep-link / «история на лиде» — UI only. Merge/copy — отдельный later microtask if owner asks. |
| Заказ без лида (`0.4`) | Только order-anchored thread (как сегодня). |

### 3. Модель (дельты к ADR-026)

- `CollaborationThread.sales_order_id` → **nullable**; добавить `lead_id` nullable FK → `leads`.
- CHECK: ровно одно из (`sales_order_id`, `lead_id`) NOT NULL.
- UNIQUE(`lead_id`) where not null; UNIQUE(`sales_order_id`) where not null (как сейчас).
- `CollaborationMicrotask`: для lead-thread — `lead_id` required / `sales_order_id` null (зеркало XOR); `technical_card_id` только на order-side threads.
- API: зеркало order routes → `/leads/{lead_id}/collaboration/...` (list/create messages, microtasks; reuse mention candidates / templates where safe).
- Access MVP: authenticated staff с доступом к карточке лида / заказа (как Stage 19 + lead read).

### 4. Lead UI composition (`20.3.2`)

```text
Lead page right column
├── CRM channels panel (LeadMessage: external only)
└── Internal collaboration panel (Collaboration* via lead_id)
```

Не обязателен полный visual redesign в `20.3.2` — паритет chrome с заказом; owner visual gate остаётся на `20.4.4` / `20.4.5` для order parity.

### 5. Out of scope (`20.3`)

- Real-time websocket
- Client portal chat
- Auto-merge lead↔order threads on convert
- Dropping `LeadMessage` table / external channels
- Replacing CRM notes / `LeadTask`

### 6. Consequences

- `20.3.2` implements model/API + shared shell wire on lead; order/TC keep existing endpoints.
- `20.3.3` amends `order-card-field-links.md` + cross-ref ADR-026/027; regression.
- `20.4.4` only restyles/syncs order panel to the shared shell — no second domain.

## Связанные документы

- ADR-026 (base order/TC chat)
- `docs/tasks/v1.00-stage-20.3-unified-messaging.md`
- `docs/architecture/order-card-field-links.md` (amend in `20.3.3`)
- Stage `1.4.3` / `docs/architecture/communication-connectors.md`
