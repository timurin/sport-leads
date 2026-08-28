# ADR-034 — Purchase orders (заказы поставщикам)

**Status:** принято  
**Date:** `2026-08-29`  
**Roadmap:** Stage `13.1.2` (`13.1.2.1`–`13.1.2.6`)  
**Contract:** `SL-PURCHASE-ORDER-v1` — `docs/tasks/v1.00-stage-13.1.2-purchase-orders.md`

## Контекст

Stage `13.1.1` закрыл справочник `Supplier` + `SupplierPrice` (ADR-033). Хаб `/purchases` и nav `/purchases/orders` уже Soft UI (`22.6`), но без API ЗП. Поступления склада (`13.2.1`) должны позже ссылаться на заказ; ledger `receipt` уже есть без обязательного поставщика/ЗП.

## Решение

1. **`PurchaseOrder`** — документ закупок «Заказ поставщику». Отдельная сущность, не складской `StockDocument`, не CRM `SalesOrder`.
2. **Отдельной «Заявки на закупку» нет в MVP:** черновик ЗП (`draft`) = внутренняя заявка; после подтверждения (`ordered`) — заказ поставщику. Отдельная сущность заявки — later / owner-pull.
3. Шапка: обязательный `supplier_id` (FK RESTRICT на `suppliers`), автономер `PO-*`, статусы `draft` | `ordered` | `cancelled`, опционально `expected_date`, `warehouse_id` (ожидаемый склад прихода, для `13.2.1`), `notes`, валюта MVP `RUB`.
4. **`PurchaseOrderLine`:** `nomenclature_id` + `quantity` (> 0) + `unit_price` (> 0) + optional `comment`. Уникальность `(purchase_order_id, nomenclature_id)`. Цена по умолчанию из `SupplierPrice`, иначе явный ввод.
5. Подтверждение (`draft` → `ordered`) и отмена (`→ cancelled`) **не** пишут ledger. Приход/частичное получение — `13.2.1` (статусы «частично» / «закрыт» позже).
6. Host UI: list `/purchases/orders`, card `/purchases/orders/[id]`. List DTO slim (без строк). Хаб без demo-строк.

## Границы MVP `13.1.2`

| In | Out |
|----|-----|
| CRUD draft PO + lines | Separate procurement-request entity |
| Confirm / cancel | Stock receipt / return (`13.2.1`) |
| Default price from `SupplierPrice` | VAT, payments, 1C packages (Stage 27) |
| Optional expected warehouse | Partial/closed status from receipts |
| FE list + card Soft UI | Demand / min-stock (`13.2.2`) |

## Последствия

- Platform-directories / Soft UI «Заказы поставщикам» переходят на live API.
- `13.2.1` сможет ссылаться на `purchase_order_id` (+ `supplier_id`) при приходе.
- Stage **27** не стартует из этого ADR.

**Связанные:** ADR-033, ADR-019, ADR-012; Design `22.6`.  
**Evidence:** task `v1.00-stage-13.1.2-purchase-orders.md`.
