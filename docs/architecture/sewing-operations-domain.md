# Sewing Operations — Domain Contract

**Code:** `SL-SEWING-OPERATIONS-DOMAIN-v1` (amended `SL-SEWING-OPS-ECONOMICS-v1`)  
**Date:** `2026-07-22` (amended `2026-08-28` / `26.10.1`)  
**Roadmap:** `6.3.1` (amended `6.3.10`, `6.3.11`, `6.3.12`, catalog I/O `4.5.4`, **`26.10.1`**)  
**Boundary ADR:** `ADR-014` (amended); sewing-cabinet price: `ADR-029` (amended `26.10.1`)  
**UI template:** `DS-PT-02-CATALOG` + folder-tree UX (`4.9.5` / `4.10.3` pattern)  
**Task:** `docs/tasks/v1.00-stage-26-10-sewing-ops-economics.md` (`26.10.*`); prior `docs/tasks/v0.9.0-stage-6.3.11-sewing-op-sort-and-templates.md`

## 1. Source of truth

`SewingOperation` — листовая операция пошива (**имя + описание + папка + оборудование**) в группе «База лекал». Стоимость / кол-во / время **не** живут на каталоге — SoT = `AssemblyOperationLine` на варианте модели (`26.10`).

`SewingOperationFolder` — навигационная **папка** (parent/child) для упорядочивания каталога. Папки **не** копируются в варианты сборки и **не** являются целями pick/apply.

`SewingOperationTemplate` — именованная **заготовка** (библиотека): упорядоченный набор ссылок на листовые `SewingOperation`. На линиях шаблона **нет** snapshot cost/qty/duration — только `sewing_operation_id` + `sequence`. Snapshot создаётся при apply к варианту сборки (`6.3.13`).

**Заменяет** ранее планируемый `PatternSet` / маршрут «Лекала» (`/settings/catalogs/patterns`). Комплекты файлов лекал, версии и 1:1 связь модель→лекала **не входят** в Stage 6.

## 2. Fields

### 2.1 `SewingOperation` (leaf)

Slim catalog leaf (`26.10.1`; DB drop of economics columns = `26.10.2`).

| Field | Type | Rules |
|---|---|---|
| `id` | PK | Surrogate key |
| `name` | string | Required; trim; non-empty; **globally unique** |
| `description` | string, nullable | Optional; trim; **≤ 256** chars (`26.10.2`) |
| `folder_id` | FK → folder, nullable | `NULL` = root of catalog (`6.3.11`) |
| `sort_order` | `Integer` | `≥ 0`; sibling order among ops in the same folder (or root) |
| `work_center_ids` | M:N → `WorkCenter` | Optional; only `ProductionStage.code = sewing`; `6.3.10` |
| `created_at` / `updated_at` | timestamptz | Timezone-aware |

**Removed from the leaf (`26.10.2`):** `cost`, `quantity_per_item`, `duration_seconds` (+ CHECK constraints). Those fields remain on `AssemblyOperationLine` (and order-item / TC snapshots).

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
| `AssemblyOperationLine` | **SoT** for `cost` / `quantity_per_item` / `duration_seconds` on the product-model variant (`26.10`). Pick from **leaf** catalog only: snapshot `operation_name` + optional `sewing_operation_id`; economics defaults `cost=0`, `qty=1`, `duration=0` (`26.10.5`) — manager edits on the model (`26.10.6`). Existing rows **keep** stored economics (no mass backfill). Folders are never snapshot targets. |
| `ProductModel` | No `pattern_set_id`; sewing ops are **not** children of a model; economics live on the model's assembly lines |
| `WorkCenter` | Compatible sewing-shop equipment via M:N (`6.3.10`) |
| Stage 8 shop routing / TC | Separate execution contour |
| Nomenclature categories | UX reference only — separate tables/API |
| Templates (`6.3.12`) | Named packs of leaf op refs; no commercial snapshot on template lines; economics come from variant on apply |
| `AssemblyVariant` | Per-model recipe; distinct from global templates |
| Stage 8 `TechOperation` | Shop volume/units — not this contour |
| `SalesOrderItemAssemblyOperationSnapshot` | Shape unchanged; still copies from variant lines on item select |
| TC sewing sync | Unchanged; still copies names + `sewing_operation_id` |
| Sewing cabinet `operation` `unit_price` | Assembly snapshot / live variant line — **not** catalog (`26.10.7`; ADR-029) |

## 5. UI / API

- Route: `/settings/catalogs/sewing_operations` — collapsible folder tree + create/edit leaf drawers; **templates library** opens as fullscreen modal from this catalog (`6.3.12`, owner UX `2026-08-02`)
- Catalog columns after `26.10.4`: **Операция** | **Описание** | **Оборудование** | actions. No Стоимость / Кол-во / Сумма / Время.
- Model assembly (`/settings/catalogs/product-models/[id]`): inline **Кол-во / Цена / Время**; **Сумма** = `cost × quantity_per_item` read-only (`26.10.6`)
- Pick drawer: name + description only — no catalog totals (`26.10.5`)
- Composition picker in templates uses the same folder tree (leaf ops only)
- Legacy path `/settings/catalogs/sewing_operation_templates` redirects to sewing operations
- API: `/sewing-operations` (ops) + `/sewing-operation-folders` (folders) + `/sewing-operation-templates` (templates)
- Catalog file I/O (`4.5.4`): `GET/POST /sewing-operations/export|import-template|import` (CSV/XLSX; `folder_path`, `work_center_codes`). **`26.10.3`:** drop cost/qty/duration columns; add `description` (breaking; release notes with `26.10.3`)
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

## Amendment (`4.5.4`, `2026-08-24`)

Catalog CSV/XLSX import/export on `/settings/catalogs/sewing_operations` (ADR-020 contour A). Task: `docs/tasks/v0.9.0-stage-4.5.4-sewing-operation-import-export.md`.

**Contract:** same columns for template/export/import; upsert by `id` then unique `name`; `folder_path` (` / `, create missing folders on commit); `work_center_codes` (`|`, sewing-stage only); templates library not in the file. Owner visual OK `4.5.4.4` (`2026-08-24`).

**Amend `26.10.3`:** I/O columns drop catalog economics; add `description`. Shipped `2026-08-28` (breaking for old cost/qty/time CSV).

## Amendment (`26.10.1`, `2026-08-28`)

Catalog leaf slim + assembly economics SoT. Contract: `SL-SEWING-OPS-ECONOMICS-v1`. Task: `docs/tasks/v1.00-stage-26-10-sewing-ops-economics.md`.

**Contract:** `SewingOperation` = name + description (≤256) + folder + equipment. `AssemblyOperationLine` = SoT for cost / qty / duration (editable on the model). Pick defaults `0` / `1` / `0`. Sewing cabinet `operation` `unit_price` from assembly snapshot / variant line, not catalog. Existing assembly rows keep stored economics. Schema/API/UI shipped `26.10.2`–`26.10.7`; checkpoint `26.10.8` shipped. Pointers: ADR-014 §6; ADR-029 §3.
