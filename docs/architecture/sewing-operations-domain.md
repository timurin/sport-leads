# Sewing Operations — Domain Contract

**Code:** `SL-SEWING-OPERATIONS-DOMAIN-v1`  
**Date:** `2026-07-22`  
**Roadmap:** `6.3.1` (amended `6.3.10`, `6.3.11`, `6.3.12`)  
**Boundary ADR:** `ADR-014` (amended)  
**UI template:** `DS-PT-02-CATALOG` + folder-tree UX (`4.9.5` / `4.10.3` pattern)  
**Task:** `docs/tasks/v0.9.0-stage-6.3.11-sewing-op-sort-and-templates.md`

## 1. Source of truth

`SewingOperation` — листовая операция пошива (стоимость / qty / время / оборудование) в группе «База лекал».

`SewingOperationFolder` — навигационная **папка** (parent/child) для упорядочивания каталога. Папки **не** копируются в варианты сборки и **не** являются целями pick/apply.

`SewingOperationTemplate` — именованная **заготовка** (библиотека): упорядоченный набор ссылок на листовые `SewingOperation`. На линиях шаблона **нет** snapshot cost/qty/duration — только `sewing_operation_id` + `sequence`. Snapshot создаётся при apply к варианту сборки (`6.3.13`).

**Заменяет** ранее планируемый `PatternSet` / маршрут «Лекала» (`/settings/catalogs/patterns`). Комплекты файлов лекал, версии и 1:1 связь модель→лекала **не входят** в Stage 6.

## 2. Fields

### 2.1 `SewingOperation` (leaf)

| Field | Type | Rules |
|---|---|---|
| `id` | PK | Surrogate key |
| `name` | string | Required; trim; non-empty; **globally unique** |
| `cost` | `Numeric(14,2)` | Required; `≥ 0`; money-safe `Decimal`; unit price per one operation |
| `quantity_per_item` | `Integer` | Required; `≥ 1`; line sum = `cost × quantity_per_item` |
| `duration_seconds` | `Integer` | Required; `≥ 0` |
| `folder_id` | FK → folder, nullable | `NULL` = root of catalog (`6.3.11`) |
| `sort_order` | `Integer` | `≥ 0`; sibling order among ops in the same folder (or root) |
| `work_center_ids` | M:N → `WorkCenter` | Optional; only `ProductionStage.code = sewing`; `6.3.10` |
| `created_at` / `updated_at` | timestamptz | Timezone-aware |

No soft status, versions, or files on the leaf. Equipment links are catalog metadata only (not copied to assembly/order/TC snapshots).

### 2.2 `SewingOperationFolder` (`6.3.11`)

| Field | Type | Rules |
|---|---|---|
| `id` | PK | Surrogate key |
| `name` | string | Required; trim; non-empty; **unique among siblings** (same `parent_id`, case-insensitive) |
| `parent_id` | FK → self, nullable | `NULL` = root folder; cycle-safe moves |
| `sort_order` | `Integer` | `≥ 0`; sibling order among folders under the same parent |
| `created_at` / `updated_at` | timestamptz | Timezone-aware |

Delete folder only when it has **no child folders** and **no operations** (RESTRICT).

### 2.3 `SewingOperationTemplate` + line (`6.3.12`)

| Field | Type | Rules |
|---|---|---|
| Template `id` | PK | Surrogate key |
| Template `name` | string | Required; trim; non-empty; **globally unique** (case-insensitive) |
| Template timestamps | timestamptz | Timezone-aware |
| Line `id` | PK | Surrogate key |
| Line `template_id` | FK → template | CASCADE delete |
| Line `sewing_operation_id` | FK → leaf op | RESTRICT; must exist; leaf only (not a folder) |
| Line `sequence` | `Integer` | `≥ 1`; unique per template; order of pack |

Replace-lines API: full ordered list of `sewing_operation_id` (duplicates rejected). Empty template allowed.

## 3. Tree order (`6.3.11`)

Within one parent (including catalog root):

1. Folders by `sort_order ASC`, then `lower(name)`, then `id`
2. Then leaf operations by `sort_order ASC`, then `lower(name)`, then `id`

Sibling ↑/↓ swaps `sort_order` among the same kind (folder↔folder or op↔op) under the same parent. Moving an op sets `folder_id` (nullable root) and appends at end of that folder’s ops unless `sort_order` is provided. UI: folder select on create drawer **and** on inline edit of an existing leaf (`2026-08-02` owner ask).

## 4. Boundaries

| Concept | Relation |
|---|---|
| `AssemblyOperationLine` | Copy-on-pick from **leaf** catalog only: snapshot `operation_name` + `cost` + `quantity_per_item` + `duration_seconds`; optional `sewing_operation_id`. Folders are never snapshot targets. |
| `ProductModel` | No `pattern_set_id`; sewing ops are **not** children of a model |
| `WorkCenter` | Compatible sewing-shop equipment via M:N (`6.3.10`) |
| Stage 8 shop routing / TC | Separate execution contour |
| Nomenclature categories | UX reference only — separate tables/API |
| Templates (`6.3.12`) | Named packs of leaf op refs; no commercial snapshot until `6.3.13` apply |
| `AssemblyVariant` | Per-model recipe; distinct from global templates |
| Stage 8 `TechOperation` | Shop volume/units — not this contour |

## 5. UI / API

- Route: `/settings/catalogs/sewing_operations` — collapsible folder tree + create/edit leaf drawers; **templates library** opens as fullscreen modal from this catalog (`6.3.12`, owner UX `2026-08-02`)
- Composition picker in templates uses the same folder tree (leaf ops only)
- Legacy path `/settings/catalogs/sewing_operation_templates` redirects to sewing operations
- API: `/sewing-operations` (ops) + `/sewing-operation-folders` (folders) + `/sewing-operation-templates` (templates)
- Equipment multi-select on create/edit leaf (`6.3.10.4`)
- Shell: nav only via `navigation.ts`; `DS-SHELL-01` / `DS-SHELL-02` preserved (no separate nav item for templates)

## Amendment (`6.3.10`, `2026-07-31`)

M:N equipment binding for sewing-ops catalog; filter WorkCenter by production stage Пошив. Task: `docs/tasks/v0.9.0-stage-6.3.10-sewing-op-equipment.md`.

**Shipped:** Alembic `d1e2f3a4b567`; API `work_center_ids` + sewing-stage gate; UI multi-select; regressions `6.3.10.5`. Not copied into assembly/order/TC snapshots.

## Amendment (`6.3.11`, `2026-08-02`)

Folder hierarchy for catalog navigation (not flat `sort_order`-only). Task: `docs/tasks/v0.9.0-stage-6.3.11-sewing-op-sort-and-templates.md`.

**Contract:** `SewingOperationFolder` + `SewingOperation.folder_id` / sibling `sort_order`; leaf-only pickers; cycle-safe parents; empty-folder delete.

## Amendment (`6.3.12`, `2026-08-02`)

Named sewing-operation template library (заготовки). Task: `docs/tasks/v0.9.0-stage-6.3.11-sewing-op-sort-and-templates.md`.

**Contract:** `SewingOperationTemplate` + ordered lines → live leaf ops; no cost snapshot on template; apply to assembly = `6.3.13`. UI: fullscreen modal on `/settings/catalogs/sewing_operations` (not a separate nav route); composition picker = folder tree.

## Amendment (`6.3.13`, `2026-08-02`)

Apply template → assembly variant copy-on-pick snapshots. Task: `docs/tasks/v0.9.0-stage-6.3.11-sewing-op-sort-and-templates.md`.

**Contract:** `POST /product-models/{id}/assembly-variants/{vid}/apply-sewing-template` (`append`|`replace`); drawer «Новый вариант сборки» — блок «Из шаблона» (prefill selection) + folder-tree ops list. Equipment not copied.
