# Import / Export contours (inventory)

**Code:** `SL-IMPORT-EXPORT-INVENTORY-v1`  
**Date:** `2026-07-30`  
**Decision:** [ADR-020](decisions/ADR-020-import-export-hybrid.md)  
**Roadmap:** `4.5`, `9.3.2`, `1.4`, `16.2` / `16.3`; project-structure §5 / §12

## Purpose

Канонический инвентарь пунктов roadmap/ERP, которые называют «импорт/экспорт», но относятся к **разным контурам**. Не смешивать с печатными формами Stage `18.3`.

## Contours

| Code | Contour | Roadmap / checklist | Status | Meaning |
|------|---------|---------------------|--------|---------|
| **A** | Catalog file I/O | `4.5.1` / `4.5.2`; project-structure §5 «import, and export» | open | Пакетный файл ↔ мастер-справочник (сначала номенклатура) |
| **B** | Domain / inline import | `9.3.2.*` (personalization); SizeGrid Mosmade row-by-row; unit-lines API `9.3.2.3` | partial | Импорт **внутрь** документа/сущности; SoT остаётся domain rows |
| **C** | Lead / source ingest | `1.4.1` done; `1.4.3` open | collectors | Нормализация внешних лидов — не Excel-каталог |
| **D** | System exchange + universal jobs | `16.2.1` 1C:UNF; `16.3.*` universal job shell; project-structure «Universal import and export» / «1C exchange» | open | Внешняя ERP + кросс-модульный job runner |

## Explicitly out of scope for A/D file I/O

- Stage `18.3` print-form registry (Excel = **print visual SoT**, не data migration).
- `4.3.3` bulk operations (массовые действия без файлового контура).
- Stock ledger post (`12.2`) — складские документы, не catalog import.

## Placement rules (see ADR-020)

1. Меняет **мастер-справочник** пакетом → contour **A** (toolbar раздела; shared parse lib).
2. Меняет **строки документа** с domain qty/SoT → contour **B** only (не Universal hub).
3. Синхронизация с внешней ERP → contour **D** (`16.2.1`), не `4.5`.
4. Платформенный job hub (раздел + журнал) → contour **D** `16.3` later, поверх тех же adapters.

## Related evidence

- Task: `docs/tasks/v0.9.0-stage-4.5-import-export-adr-020.md`
- ADR-016 § aggregate personalization import (contour B)
- Roadmap §`4.5`, §`16.3`
