# ADR-033 — Procurement suppliers and supplier prices

**Status:** принято  
**Date:** `2026-08-29`  
**Roadmap:** Stage `13.1.1` (`13.1.1.1`–`13.1.1.6`)  
**Contract:** `SL-SUPPLIER-v1` — `docs/tasks/v1.00-stage-13.1.1-suppliers.md`

## Контекст

Хаб `/purchases` (Stage `22.6`) уже Soft UI, но без API: пустые панели «Поставщики» / «Заказы поставщикам». CRM `Client` — контур продаж; складские остатки живут в ledger (ADR-019), не на карточке номенклатуры (ADR-012). Нужен отдельный master-справочник поставщиков и их закупочных цен для Stage 13.

## Решение

1. **`Supplier`** — отдельная сущность закупок. Не `Client`, не `Organization`, не stub `contractors` из platform-directories.
2. **`SupplierPrice`** — закупочная цена поставщика на позицию **`Nomenclature`** (`unit_price` Decimal/Numeric, валюта MVP = `RUB`). Уникальность `(supplier_id, nomenclature_id)`.
3. Host UI: `/purchases/suppliers` (list + card). Хаб `/purchases` показывает живые счётчики/ссылки после API, без demo-строк.
4. List DTO slim (`SL-LIST-PAGE-RULES-v1`); реквизиты и цены — на detail / вложенном списке цен.
5. Заказы поставщикам (`13.1.2`), поступления/возвраты (`13.2.1`), дефицит/min stock (`13.2.2`) — **не** этот ADR.

## Границы MVP `13.1.1`

| In | Out |
|----|-----|
| CRUD `Supplier` (name, optional code/INN/KPP/contacts/address/notes, `is_active`) | Bank accounts (later if needed) |
| CRUD `SupplierPrice` per nomenclature | Sales / Client prices (ADR-005) |
| FE list + card Soft UI | Purchase orders / receipts |
| | Supplier rating, 1C matching, batches |

## Последствия

- Platform-directories `contractors` остаётся `planned` stub — не дублировать SoT.
- Приходы склада (`13.2.1`) смогут ссылаться на `supplier_id` позже; ledger `receipt` уже существует без обязательного поставщика.
- `13.1.2` будет ссылаться на `Supplier` как шапку ЗП.

**Связанные:** ADR-012, ADR-005, ADR-019; Design `22.6`.  
**Evidence:** task `v1.00-stage-13.1.1-suppliers.md`.
