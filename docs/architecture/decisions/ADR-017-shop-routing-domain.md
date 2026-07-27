# ADR-017 — Shop routing domain (Stage 8)

**Status:** принято (`2026-07-26`); **amended** `2026-07-26` (`8.3` ProductionStage)  
**Date:** `2026-07-26`  
**Roadmap:** Stage 8 § `8.1.1`–`8.2.3`, amend `8.3`; shop modules `11.3`–`11.10`  
**Depends on:** ADR-014, ADR-016 (Spec↔ТК amend), ADR-004  
**Evidence:** `docs/tasks/v0.9.0-stage-8.1.1-routing-adr-017.md`; amend task `docs/tasks/v0.9.0-stage-8.3-production-stages.md`

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
| **ProductionStage** | Справочник **цехов** (этапов производства): `name`, `code`, `is_active`, `sort_order`. Seed: Дизайн, Раскрой, Печать, Пошив, ВТО, ОТК, Упаковка |
| **TechOperation** | Цеховая операция с `volume_unit`; **обязана** принадлежать цеху (`production_stage_id`). Сублимация / DTF / термоперенос → Печать |
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
| `ProductModel.default_routing_template_id` | Nullable FK; default для generate ТК |
| TC `routing_template_id` + name | Snapshot на generate; master edits не live-merge |
| TC `stage_results` | Skeleton из stage lines; snapshot `production_stage_id` + `stage_label`; gates `9.2.2` |
| TC op-volume lines | Prefill из TechOperation; snapshot stage id/label |
| Shop modules Stage `11.3`–`11.10` | Один модуль на цех; пишут факт на ТК по текущему `production_stage_id` |
| Spec Stage 7 | Soft only |

### 4. UI placement

Settings group **«Производство»**:

- **Этапы (цеха)** → `/settings/catalogs/production-stages`
- Тех операции → `/settings/catalogs/tech-operations` (поле цех)
- Маршруты → `/settings/catalogs/routings` (шаг = выбор цеха; WorkCenter label = «Оборудование»)

**Не** CRUD внутри `/settings/catalogs/tech-cards` (`9.6`).

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
