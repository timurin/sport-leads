# ADR-022 — DesignVersion assets and module comments

**Status:** принято (`2026-08-01`)  
**Date:** `2026-08-01`  
**Roadmap:** Stage 10 § `10.1.2.1` (domain); feeds `10.1.2.2`–`10.1.2.5`  
**Depends on:** ADR-021 (`DesignProject` / `DesignVersion`), ADR-011 (local media storage pattern), ADR-016 (TC media interim)  
**Evidence:** `docs/tasks/v0.9.0-stage-10.1.2-design-assets-comments.md`

## Контекст

После `10.1.1` есть контейнер версий, но нет файлов макетов / логотипов и локальных комментариев дизайн-модуля. Нужна граница между:

- **файловыми активами версии** (layout / logo / other);
- **комментариями дизайн-модуля** на `DesignVersion` (заметки по макету);
- **чатом сотрудников** Stage `19` на заказе / ТК (операционное согласование);
- **interim** `TechnicalCardMedia` (≤3 фото на ТК) — не версионный SoT;
- **коммерческим** `design_approval_status` (`3.4.1`).

Нельзя: подменять Stage 19 чатом DesignComment; писать файлы в `nomenclature-media` / TC media без явного bridge; хранить произвольные пути вне opaque storage key.

## Решение

### 1. Сущности

| Сущность | Роль |
|----------|------|
| **DesignVersionAsset** | Файл, привязанный к `DesignVersion`. Metadata в PostgreSQL; binary в локальном ignored storage (паттерн ADR-011), отдельный root `storage/design-version-media`. |
| **DesignVersionComment** | Текстовый комментарий дизайн-модуля на `DesignVersion` (не чат Stage 19). |

### 2. Кардинальность

```
DesignVersion 1 ─── N DesignVersionAsset
DesignVersion 1 ─── N DesignVersionComment
```

Правила:

- `design_version_id` **обязателен** (CASCADE с версией).
- Asset `kind`: `layout` | `logo` | `other` (MVP enum).
- ≤1 `is_primary` asset на версию (primary layout для превью / будущего soft-link в TC / print).
- Comments — append-only MVP (create + soft-delete optional later); author — optional free-text / future user FK (`17.1`).
- Удаление `DesignVersion` каскадирует assets metadata + files и comments.

### 3. Storage (MVP)

| Rule | Value |
|------|--------|
| Root | `storage/design-version-media` (ignored; не смешивать с `storage/nomenclature-media`) |
| Key | opaque UUID filename; API не принимает произвольный path |
| Types | JPEG, PNG, WebP, SVG, PDF (layouts); max **20 MB** |
| Delete | metadata + file; path must resolve under root |

CDN / object storage — later (как ADR-011).

### 4. Границы с соседними контурами

| Контур | Правило |
|--------|---------|
| Stage `19` chat | Операционный диалог manager↔designer. **Не** DesignVersionComment. Deep-link «открыть чат заказа» — optional UI later. |
| `TechnicalCardMedia` | Interim gallery. MVP **не** авто-копирует assets в TC. Soft-link / promote primary layout → TC — отдельный follow-up (`10.1.2` UI optional или print `18.3`). |
| `design_approval_status` | Не пишется из upload/comment. |
| Shop «Дизайн» `11.4` | Fact на ТК; не CRUD assets. |
| Nomenclature media (ADR-011) | Другой root / API. Shared helper допустим позже; MVP — отдельный service module. |

### 5. UI placement (intent)

- На карточке `/design/projects/[id]`: блок активов выбранной / current версии + блок комментариев.
- Не settings catalogs; не отдельный chat UI.

### 6. Вне scope ADR (implementation follows microtasks)

- Таблицы — `10.1.2.2` (shipped: `design_version_assets` / `design_version_comments`, Alembic `q4r5s6t7u890`)
- API — `10.1.2.3` (shipped; evidence `test_design_assets_10_1_2_3.py`)
- UI — `10.1.2.4` (shipped on `/design/projects/[id]`)
- Owner visual — `10.1.2.5` STOP
- Auth/roles (`17.1`) — author string optional
- Auto-sync to `TechnicalCardMedia` / print Side 1
- Client portal (`10.2` cancelled)
- Object storage / CDN

## Последствия

- Версия становится носителем файлов и design-module notes без смешения с Stage 19.
- `10.1.2.2+` реализует persistence/API/UI без смены кардинальности ADR-021.

## Связанные документы

- ADR-021 — DesignProject / DesignVersion
- ADR-011 — nomenclature media storage pattern
- ADR-016 — TC media interim
- Roadmap Stage 10 / `10.1.2`
