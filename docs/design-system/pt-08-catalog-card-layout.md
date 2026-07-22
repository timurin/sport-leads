# Sport-Lead — PT-08 Catalog Card Layout (справочники)

**Code:** `SL-PT-08-CATALOG-CARD-LAYOUT-v1`  
**Contract:** `DS-PT-08-CATALOG`  
**Date:** `2026-07-22`  
**Parent:** `DS-PT-08` (`pt-08-versioned-workspace.md`)  
**Reference page:** `/settings/catalogs/product-models/[modelId]` (`ProductModelPersistentCard`)  
**Layout primitive:** `frontend/components/entity/catalog-versioned-card-layout.tsx`  
**Related:** `stage-6.0.3-pattern-base-pt-mapping.md`, `responsive-rules.md`, `DS-PAGE-01`…`04`/`06`, `DS-ACTION-01`

## Purpose

Эталон **карточки справочника** с версиями (База лекал и аналогичные settings-каталоги): одна сетка колонок, фиксированные breakpoints и слоты.  
Новые карточки справочников, разделов и категорий с версиями **не изобретают** свою разметку — берут этот контракт и `CatalogVersionedCardLayout`.

Канонический маршрут-эталон: `/settings/catalogs/product-models/[id]` (`6.0.3.5`).

Не заменяет PT-05 (простая карточка без версий) и PT-06 (CRM complex card). Список справочника — `DS-PT-02-CATALOG` (`pt-02-catalog-list.md`).

## When to use

| Use `DS-PT-08-CATALOG` | Use something else |
|---|---|
| Versioned catalog entity card (models, pattern sets, directories, …) | Simple settings card → **PT-05** |
| Needs media + versions + history beside main attrs | Catalog list → **`DS-PT-02-CATALOG`** |
| Settings route under `/settings/catalogs/…` | Lead/order card → **PT-06** / **PT-07** |
| Section / category card that needs the same catalog chrome | Flat CRM list → **PT-02** (`/sales/clients`) |

## Canonical composition

```
AppShell
  └── [data-app-shell-main]
        └── VersionedWorkspace (DS-PT-08)
              ├── EntityHeader (back · title · status)
              └── CatalogVersionedCardLayout (DS-PT-08-CATALOG)
                    ├── main      → реквизиты + рабочая область
                    ├── media     → фото / обложка (колонка 300px на wide)
                    └── versions  → версии + история изменений
```

## Column slots

| Slot | Content (etalon) | Notes |
|---|---|---|
| `main` | `SectionCard` «Основные реквизиты» + `SectionCard` «Рабочая область…» | Domain fields; workspace grows with Stage 6 features |
| `media` | `SectionCard` «Карточка» + media carousel | Fixed **300px** column width at `≥1900`; photo max **300px**, height proportional |
| `versions` | `SectionCard` «Версии модели» → version bar + change history | History: who / what / when; FIFO cap is domain rule (models: 10) |

Gap between columns/sections: **14px** (`gap-[14px]`).

## Responsive grid (canonical)

| Viewport | Grid | Behaviour |
|---|---|---|
| **&lt; 1300px** | `1` col | All slots full width, stacked: main → media → versions |
| **1300px – 1899px** | `75fr / 25fr` | `main` left (`row-span-2`); `media` + `versions` stacked in right column |
| **≥ 1900px** (full width) | `60fr / 300px / 20fr` | Three columns; **media column fixed 300px** |

Tailwind reference (must stay in sync with `CatalogVersionedCardLayout`):

```txt
grid-cols-1
min-[1300px]:grid-cols-[minmax(0,75fr)_minmax(0,25fr)]
min-[1900px]:grid-cols-[minmax(0,60fr)_300px_minmax(0,20fr)]

main:   min-[1300px]:row-span-2 min-[1900px]:row-span-1
media:  min-[1900px]:w-[300px]
```

Do **not** use the old 65/35 `lg:` split for new catalog cards.

## Media affordances (etalon)

Inside the media slot (product-models reference):

1. Single-photo carousel (prev/next + dots when &gt;1).
2. Hover / focus-within overlay icons (not a permanent button row):
   - Основное · Удалить · Заменить · Добавить · Распахнуть
3. Accept JPEG / PNG / WebP, ≤ 10 МБ — show rule text **only on violation**.
4. Lightbox for expand.
5. List thumbnail = primary media (`is_primary`).

## History vs meta

- Do **not** put created/updated/id/status prose in the media column.
- Change log lives in the **versions** slot (per-entity DB history when required).
- Catalog status stays in `EntityHeader` via `StatusBadge`.

## Agent / implementer checklist

When rebuilding or adding a catalog card:

1. Read this file + `pt-08-versioned-workspace.md`.
2. Wrap page in `VersionedWorkspace`.
3. Body = `CatalogVersionedCardLayout` with three slots (empty `SectionCard` placeholders OK until domain fills).
4. Match breakpoints above — do not invent parallel grids.
5. Keep Platform Shell contracts (`DS-SHELL-01` / `02`) untouched.
6. Report: template `DS-PT-08-CATALOG`, reference route, breakpoints checked.

## Reference consumers

| Route | Status |
|---|---|
| `/settings/catalogs/product-models/[id]` | **Etalon** (API) |
| `/settings/catalogs/product-models/demo-reference` | PT-08 demo shell (older composition; migrate toward this grid when touched) |
| `/settings/catalogs/patterns/[patternSetId]` | Adopt on `6.3.5` card fill |
| Future versioned settings cards | Same layout unless ADR says otherwise |

## Status

Approved as layout etalon from product-models card (`2026-07-22`). Visual owner sign-off for `6.1.8.5` may still be open; layout contract is the migration target regardless.
