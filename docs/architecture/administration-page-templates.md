# Administration page template mapping (Stage 18.1.4)

**Code:** `SL-ADMIN-PT-MAP-v1`  
**Date:** `2026-08-02`  
**Roadmap:** `18.1.4`  
**Depends on:** `18.1.3` placement, design-system `PT-02` / `PT-05`, `DS-PAGE-02`

## Purpose

Зафиксировать, **какой page template** использовать для маршрутов оболочки Администрирования — без изобретения layout.

## Mapping

| Route | Role | Template | Chrome notes |
|-------|------|----------|--------------|
| `/settings/system` | Singleton platform parameters | **Settings form** (not list PT) | `PageToolbar` (`DS-PAGE-02`) + `SectionCard` stack; brand actions in toolbar |
| `/settings/platform-directories` | Registry hub | **Index / PT-02-lite** | `PageToolbar` optional search; cards/links to registered directories |
| `/settings/platform-directories/{code}` (list) | Directory list | **`DS-PT-02-CATALOG`** | Same chrome as product-models / size-grids lists |
| `/settings/platform-directories/{code}/[id]` | Directory card | **`DS-PT-05`** | `SimpleEntityCard` + `EntityHeader`; no version bar unless later ADR |
| `/settings/print-forms` (later `18.3`) | Print registry list | **`DS-PT-02-CATALOG`** | Card may stay PT-05 until versioning needs `PT-08` |
| `/settings` hub | Settings landing | Existing hub cards | Group «Платформа» mirrors nav |

## Explicit non-mapping

| Surface | Why not Administration PT map |
|---------|-------------------------------|
| `/settings/catalogs/tech-cards` | Domain `9.6` — stays settings-form pattern in domain group |
| `/settings/catalogs/product-models` | Catalog etalon `DS-PT-02-CATALOG` / `DS-PT-08-CATALOG` — Stage `6` |
| `/settings/users` | Access contour `17.1.2` — PT-02 list already |

## Shell contracts

- `DS-SHELL-01` / `DS-SHELL-02` unchanged except brand source from `18.1.2`.
- Page titles live in `PageToolbar` start / `EntityHeader` — not Platform Topbar.

## Evidence

- Task: `docs/tasks/v0.9.0-stage-18.1.4-administration-pt-mapping.md`
- Placement: `docs/architecture/administration-placement.md`
