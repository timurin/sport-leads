# ADR-020 — Hybrid import / export contours

**Status:** принято (`2026-07-30`); **amend outbound 1C** (`2026-08-26`, Stage **27**)  
**Date:** `2026-07-30`  
**Roadmap:** `4.5` (catalog I/O), domain `9.3.2` / SizeGrid, Stage `16.2`–`16.3`, Stage **`27`** (1C:UNF export)  
**Depends on:** ADR-012 (nomenclature SoT), ADR-016 (TC unit-line import), project-structure §12  
**Evidence:** `docs/architecture/import-export-contours.md`; task `docs/tasks/v0.9.0-stage-4.5-import-export-adr-020.md`

## Контекст

В roadmap «импорт/экспорт» встречается в разных местах: каталог номенклатуры (`4.5`), поштучный импорт на ТК (`9.3.2`), collectors лидов (`1.4`), обмен с 1С (`16.2.1` inbound parked; **outbound Stage 27**), checklist «Universal import and export». Нужно решить, строить ли:

1. отдельный платформенный модуль с выбором раздела; или  
2. кнопки Import/Export только внутри каждого раздела.

Чистый вариант 1 отдаляет UX от рабочих мест и смешивает domain-import с каталогами. Чистый вариант 2 дублирует парсеры и не закрывает Universal/1С.

## Решение — гибрид (слои)

### 1. Contours (SoT boundaries)

| Contour | Ownership | UI | Shared tech |
|---------|-----------|----|-------------|
| **A — Catalog file I/O** | Section services (nomenclature first: `4.5`) | Toolbar на workspace раздела (`/warehouse/stock` и т.п.) | Thin shared lib: parse CSV/XLSX, row-error DTO, dry-run |
| **B — Domain inline** | Domain service (TC, SizeGrid, …) | Только внутри документа/карточки | Может переиспользовать parse helpers; **не** job hub |
| **C — Lead ingest** | Collectors + CRM adapters (`1.4`; contract `SL-EXTERNAL-ADAPTERS-v1` / `1.4.3.1`) | CRM pipelines | Отдельно от A/B; messaging SoT = `LeadMessage` ≠ Stage 19 |
| **D — Exchange + universal jobs** | Stage `16.2` / `16.3` / **`27`** | Позже: Administration job shell (раздел + журнал); 1C **outbound** UI in Stage 27 | Те же section **adapters**, что и A; 1С outbound — Stage **27**; inbound `16.2.1` parked |

### 2. Near-term (`4.5`)

- Реализовать **вариант 2** для номенклатуры: import/export actions на каталоге, API рядом с nomenclature services.
- Второй catalog adapter: **модели изделий** (`4.5.3`) на `/settings/catalogs/product-models`.
- Третий catalog adapter: **операции пошива** (`4.5.4`) на `/settings/catalogs/sewing_operations`.
- Вынести **тонкую shared-библиотеку** (не полноценный модуль-навигацию).
- Не создавать отдельный пункт меню «Импорт/Экспорт» до `16.3`.

### 3. Domain inline (`9.3.2`, SizeGrid)

- Остаётся **только** в своём разделе (вариант 2 жёстко).
- Aggregate personalization import разворачивается в N `TechnicalCardUnitLine` (ADR-016); SoT не меняется.
- Запрещено переносить в Universal hub как «раздел = Техкарты» без document context.

### 4. Later (`16.3` + Stage `27`; `16.2.1` parked)

- **Вариант 1** как orchestration shell: upload → map → validate → dry-run → commit; журнал заданий; выбор раздела.
- Shell вызывает зарегистрированные adapters (включая nomenclature из `4.5`).
- **Amend `2026-08-26`:** канонический обмен 1C:UNF **outbound** (пакеты Заказ покупателя / approved Spec / ТН-УПД; сопоставление справочников **в УНФ**) = Stage **`27`**. Не Excel-кнопка в каталоге и не print-form (`18.3`).
- `16.2.1` — опциональный later **inbound** Excel заказов УНФ→платформа; **не** первый срез и **не** MVP.

### 5. Classification criteria

- Пакетный файл ↔ **мастер-справочник** → A (сейчас) / D hub (позже).
- Строки **документа** + domain validation → B only.
- Синхронизация с внешней ERP → D (Stage **`27`** outbound; `16.2.1` inbound parked).

## Последствия

- `4.5.1` / `4.5.2` дробятся на microtasks под section UX + shared lib.
- Project-structure «Universal import and export contour» мапится на Stage `16.3`, не на `4.5`.
- Печать Stage `18.3` остаётся вне этого ADR.

## Evidence

- Inventory: `docs/architecture/import-export-contours.md`
- Roadmap: `4.5.*`, `16.3.*`, Stage **`27`**
- Related: ADR-012, ADR-016, Stage `18.3` (print ≠ export), `docs/tasks/v1.00-stage-27-1c-unf-export.md`
