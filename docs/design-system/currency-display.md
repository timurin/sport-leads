# Sport-Lead — Currency display

**Code:** `DS-MONEY-01`  
**Canonical helper:** `frontend/lib/money.ts`  
**Date:** `2026-07-26`

## Rule

1. **Storage / API** keep ISO 4217 codes (`RUB`, `USD`, `EUR`, …).
2. **UI never shows the literal string `RUB`.** Display the ruble sign **`₽`**.
3. Use `currencySymbol(code)` or `formatAmountWithCurrency(amount, code)` for all readouts.
4. Selects keep `value={ISO}` and show `currencyOptionLabel(code)` (₽ / $ / €).
5. Prefer `Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" })` for full money formatting — it already emits `₽` in `ru-RU`.
6. Do not hardcode `"RUB"` next to amounts in JSX. Do not invent parallel formatters per module.

## Examples

```ts
import { currencySymbol, formatAmountWithCurrency } from "@/lib/money";

formatAmountWithCurrency(item.basePrice, item.currency); // "1500.00 ₽"
currencySymbol(item.currency); // "₽"
```

## Out of scope

Changing default stored currency code (still `RUB`), multi-currency FX, or backend schema.
