# ADR-001 — Lead → SalesOrder

**Статус:** принято  
**Контекст:** конвертация лида должна создавать коммерческий документ без повторного ввода данных и без повторной конвертации.

## Решение

Использовать существующие `Lead`, `Client`, `LeadEvent` и `SalesOrder` в одной транзакции. Результат конвертации фиксируется событием, а повторная или конфликтующая конвертация отклоняется.

## Последствия

Источник коммерческого заказа сохраняется, история доступна через события, а дальнейшие изменения заказа не требуют копирования CRM-модели.

## Ограничения

Сделки, оплаты, документы и полный production workflow ещё не реализованы.

**Связанные модули:** `backend/app/services/lead_conversion.py`, `backend/app/api/leads.py`, `backend/app/models/sales.py`.

## Amendment (`v1.00` / `0.4`, `2026-08-05`)

**SalesOrder without Lead** is a second create path (`SL-ORDER-WITHOUT-LEAD-v1`):

- `SalesOrder.lead_id` becomes **nullable**; `uq_sales_orders_lead_id` remains (at most one order per non-null lead; many orders with `lead_id IS NULL`).
- **Convert-from-lead** (`convert_lead`) stays the CRM completion path and always sets `lead_id`.
- **Direct create** (`POST /orders`): `lead_id` always `NULL`; required `client_id`, `responsible_id`, `title`; **`organization_id` optional** (owner UX amend `0.4.2` — new client may skip org via unchecked «Создать организацию?»); number = auto `SO-YYYY-######` **or** owner freeform unique (≤50).
- Technical cards are **not** created on order insert — use existing generate after a PRODUCT line (ADR-016).
- Order card «source lead» is optional when `lead_id` is null.

Shipped `0.4.2`/`0.4.3` `2026-08-05` (owner visual OK).
