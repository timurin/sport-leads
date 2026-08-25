# ADR-003 — SalesOrderItem является коммерческой позицией

**Статус:** принято  
**Контекст:** материал является производственным ресурсом и не должен подменять продаваемую клиенту номенклатуру.

## Решение

`SalesOrderItem` хранит snapshot-наименование, размеры, персонализацию, цвет, единицу, количество и исходную цену. Nullable процент скидки допускается от 0 до 100; сумма скидки и итог строки вычисляются service-слоем через Decimal/Numeric. `Material` не является номенклатурой заказа. Nullable-ссылка на `Nomenclature` допускается для выбора persistent-карточки, но snapshot не синхронизируется автоматически: при явном выборе в UI имя и base price копируются в позицию, после чего их можно редактировать вручную.

## Последствия

Заказ сохраняет коммерческий снимок и не зависит от изменений ресурсного каталога. CRUD и пересчёт `SalesOrder.amount` остаются в service/API-контуре.

## Ограничения

Реализована процентная скидка строки (`SalesOrderItem.discount_percent`) и **скидка заказа** (`SalesOrder.discount_percent`, roadmap `3.3.1`): сначала считаются `line_amount`, затем `discount_amount` заказа = % от суммы строк, `amount` = subtotal − order discount. `discount_amount` на строке и на заказе не являются полями ручного ввода. НДС / валюта / счета — `3.3.2` / `3.3.3`. Связь с `Nomenclature` nullable и сохраняет независимый snapshot.

**Связанные модули:** `backend/app/models/sales.py`, `backend/app/services/sales_order_items.py`, `frontend/components/sales/sales-order-items.tsx`, migrations `d9e0f1a2b345`, `e0f1a2b3c456`, `f1a2b3c4d567`, `a2b3c4d5e678`, `c0d1e2f3a456` (`3.3.1`).

## Amendment (`3.3.1`, `2026-07-31`)

Order-level percent discount added on `SalesOrder`. Interaction: line discounts first; order percent applies to `sum(line_amount)` only.

**Shipped** `3.3.1.1`–`3.3.1.5`: Alembic `c0d1e2f3a456`; `PATCH /orders/{id}/discount`; order card metrics UI; regressions + project-structure / erp-check sync.

## Cross-ref (`3.3.2`)

VAT amount persistence/recalc sits on top of this commercial stack (tax-inclusive bases). See ADR-005 amend `3.3.2` and task `docs/tasks/v0.9.0-stage-3.3.2-tax-vat-model.md`.

## Amendment (`3.4.1`, `2026-07-31`)

Sales-side **design approval status** on `SalesOrder` (`design_approval_status`): `not_required` (default) / `pending` / `in_review` / `approved` / `rejected`.

Gate: transition to `production` only when status is `not_required` or `approved`. Design **assets** remain Stage **10.1** (**ADR-021** `DesignProject`/`DesignVersion`); operational approval UX = this order status field + Stage **19** chat/microtasks (`10.2` client-review portal **cancelled** `2026-08-01`). Shop Дизайн remains `11.4`. Task `docs/tasks/v0.9.0-stage-3.4.1-design-approval-order-flow.md`.

## Amendment (`3.4.2`, `2026-07-31`)

Sales-side **execution markers** on `SalesOrder`:

- `payment_status` (`unpaid` / `partial` / `paid`) + `paid_amount`
- `material_reserve_status` (`not_required` / `pending` / `reserved`) — flag only, no warehouse movements

Gate: transition to `completed` requires `payment_status == paid` (in addition to manufacturing completeness from `9.5`). Warehouse reserves → Stage `12.5`; payment ledger / shipping docs → Stage `14`. Task `docs/tasks/v0.9.0-stage-3.4.2-order-execution-workflow.md`.

## Amendment (`2.3.3`, `2026-08-24`)

Client-card **settlements MVP** is a **read-only projection** of `SalesOrder` payment markers (`payment_status` / `paid_amount` / `amount`) for `client_id`, excluding `cancelled`. It is **not** a ledger and must not add `Client` balance columns. Ledger SoT remains Stage **`14.2`**. Contract `SL-CLIENT-SETTLEMENTS-v1` (`docs/tasks/v1.00-stage-2.3.3-client-settlements.md`).
