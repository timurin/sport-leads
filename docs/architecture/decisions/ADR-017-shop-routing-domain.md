# ADR-017 — Shop routing domain (Stage 8)

**Status:** принято (`2026-07-26`); **amended** `2026-07-26` (`8.3` ProductionStage); **amended** `2026-07-27` (model routing whitelist + operation norms `6.1.17`); **amended** `2026-07-28` (TechOperation required materials for TC prefill `8.1.4` / `9.3.5`); **amended** `2026-07-30` (`11.1.2` WorkCenter planning: TC stage snapshot + Settings catalog); **amended** `2026-07-30` (FG stages `ready_to_ship` / `shipped` — ADR-019 / `11.2.2.1`)  
**Date:** `2026-07-26`  
**Roadmap:** Stage 8 § `8.1.1`–`8.2.3`, amend `8.1.4` / `8.3`; Stage `6.1.17`; Stage `9.3.5`; shop modules `11.3`–`11.10`; planning `11.1.2`; FG bridge `11.2.2`  
**Depends on:** ADR-014, ADR-016 (Spec↔ТК amend), ADR-004, ADR-019 (FG warehouse stages)  
**Evidence:** `docs/tasks/v0.9.0-stage-8.1.1-routing-adr-017.md`; amend task `docs/tasks/v0.9.0-stage-8.3-production-stages.md`; whitelist/norms task `docs/tasks/v0.9.0-stage-6.1.17-model-routing-norms.md`; FG amend `docs/tasks/v0.9.0-stage-11.2.2.1-warehouse-fg-contract.md`

## Контекст

Нужен цеховой **шаблон маршрута** (пресет цехов), чтобы техническая карта знала порядок прохождения. Нельзя смешивать с:

- `AssemblyVariant` / `SewingOperation` (Stage 6 — стоимость);
- Spec Stage 7 (исходящий план из заполненной ТК — **не** hard dep Stage 8);
- фактом партии / цеховыми UI-модулями (Stage 11).

Amend `8.3`: free-text `stage_label` как SoT шага маршрута путал **цех**, **техпроцесс** и **оборудование**. Цех = стабильный справочник + будущий модуль исполнения на ТК.

## Решение

### 1. Сущности

| Сущность | Роль |
|----------|------|
| **ProductionStage** | Справочник **цехов / post-production этапов**: `name`, `code`, `is_active`, `sort_order`. Seed: Дизайн, Раскрой, Печать, Пошив, ВТО, ОТК, Упаковка, **Готовы к отгрузке** (`ready_to_ship`), **Отгружены** (`shipped`) — ADR-019 |
| **TechOperation** | Цеховая операция с `volume_unit`; **обязана** принадлежать цеху (`production_stage_id`). Может опционально иметь child BOM `required_materials` (MATERIAL nomenclature + qty per one operation `volume_unit`) для префилла состава ТК. Сублимация / DTF / термоперенос → Печать |
| **WorkCenter** | **Оборудование / место** внутри цеха (`production_stage_id` optional MVP); не путать с цехом |
| **ShopRoutingTemplate** | Именованный пресет маршрута: `name`, `code?`, `is_active`, `notes` |
| **ShopRoutingStageLine** | Упорядоченный шаг: `stage_order`, **`production_stage_id`** (SoT), denormalized `stage_label` (= имя цеха на момент save), optional `tech_operation_id` (из ops этого цеха), optional `work_center_id`, `is_quality_checkpoint` |

### 2. Правила последовательности

- Шаги строго упорядочены по `stage_order` (1…N).
- Маршрут = **последовательность цехов**; `stage_label` не является SoT (копия имени для снимка/UI).
- `is_quality_checkpoint` — флаг на шаге (обычно цех ОТК).
- TechOperation на шаге должен относиться к тому же `production_stage_id`, что и шаг.
- ≠ `AssemblyOperationLine` (cost contour).

### 3. Связи

| Связь | Правило |
|-------|---------|
| `ProductModel.default_routing_template_id` | Nullable FK; default для generate ТК; **must ∈ model routing whitelist** when whitelist non-empty (`6.1.17`) |
| `ProductModelRoutingLink` | Whitelist model ↔ `ShopRoutingTemplate` (ordered; `is_active`; `UNIQUE(model, template)`); master remains global `/shop-routings` — **no** duplicate routing CRUD / stage-line clone on model |
| `ProductModelOperationNorm` | Plan hint on a whitelist link: `norm_qty_per_item` (`Decimal` ≥0) + `unit`; bind `production_stage_id` and/or `tech_operation_id` (at least one); feeds TC `planned_qty` hint (`9.3.4`) and TechOperation required-material plan (`9.3.5`); **not** fact consumption |

Field-level domain for links/norms: `docs/architecture/product-model-domain.md` §7 (`6.1.17.1`).
| TC `routing_template_id` + name | Snapshot на generate (prefer order-item snapshot `3.2.7`); master edits не live-merge; apply-routing rejects foreign-to-model |
| TC `stage_results` | Skeleton из stage lines; snapshot `production_stage_id` + `stage_label`; gates `9.2.2` |
| TC op-volume lines | Prefill из TechOperation; snapshot stage id/label |
| TC composition MATERIAL | Bind to цех; `planned_qty` hint / `fact_qty` from shop (`9.3.4`); when route op has `required_materials`, prefill as `required_material_qty × norm_qty_per_item × order qty` (`9.3.5`); hard complete-gate cutting/print |
| Shop modules Stage `11.3`–`11.10` | Один модуль на цех; пишут факт на ТК по текущему `production_stage_id` (incl. material `fact_qty` for `11.5`/`11.6`) |
| Spec Stage 7 | Soft only |

### 4. UI placement

Settings group **«Производство»**:

- **Этапы (цеха)** → `/settings/catalogs/production-stages`
- Тех операции → `/settings/catalogs/tech-operations` (поле цех)
- **Оборудование (WorkCenter)** → `/settings/catalogs/work-centers` (`11.1.2.3`)
- Маршруты → `/settings/catalogs/routings` (шаг = выбор цеха; optional default WorkCenter on stage line)

**Не** CRUD внутри `/settings/catalogs/tech-cards` (`9.6`).

Плановое назначение на исполнении (`11.1.2`): `ShopRoutingStageLine.work_center_id` копируется в `TechnicalCardStageResult.work_center_id` при apply/generate; дальше правится на ТК / shop fact. Capacity calendars — вне MVP.

### 5. Seed ProductionStage (MVP)

| Name | code | sort_order |
|------|------|------------|
| Дизайн | design | 10 |
| Раскрой | cutting | 20 |
| Печать | print | 30 |
| Пошив | sewing | 40 |
| ВТО | wto | 50 |
| ОТК | qc | 60 |
| Упаковка | packaging | 70 |

### 6. Seed TechOperation → цех

| Operation | volume_unit | production_stage |
|-----------|-------------|------------------|
| Сублимационная печать | linear_meters | Печать |
| Термоперенос | linear_meters | Печать |
| Пошив | pieces | Пошив |
| ВТО | pieces | ВТО |
| Упаковка | pieces | Упаковка |

### 7. TechOperation required materials (`8.1.4`)

- Child rows belong to one `TechOperation`
- Each row references MATERIAL nomenclature and stores quantity per one operation `volume_unit`
- Example for `Сублимационная печать`: paper `1 m` + ink `10 g` per `1 linear_meter`
- On TC generate/refresh, required-material rows may prefill MATERIAL lines only when a matching `ProductModelOperationNorm` exists for the operation/stage; otherwise the system must not silently fabricate a planned quantity

## Последствия

- Closing `8.2.1` unblocked `9.2.2`.
- `8.3` stabilizes цех ids for Stage 11 shop modules.
- Generate snapshots `production_stage_id` on stage results.
- Stage 7 remains later outbound wave.
- Stage 10 (client design approval) ≠ цех Дизайн (`11.4`).

## Ограничения

- Auth/roles later (`17.1`)
- Full work-center capacity / calendars out of MVP
- Spec CRUD out of Stage 8
- Per-цех execution UIs out of Stage 8 → `11.3`–`11.10`
