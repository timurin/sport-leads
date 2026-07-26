# ADR-017 — Shop routing domain (Stage 8)

**Status:** принято (`2026-07-26`)  
**Date:** `2026-07-26`  
**Roadmap:** Stage 8 § `8.1.1`–`8.2.3`  
**Depends on:** ADR-014, ADR-016 (Spec↔ТК amend), ADR-004  
**Evidence:** `docs/tasks/v0.9.0-stage-8.1.1-routing-adr-017.md`

## Контекст

Нужен цеховой **шаблон маршрута** (пресет этапов), чтобы техническая карта знала порядок участков. Нельзя смешивать с:

- `AssemblyVariant` / `SewingOperation` (Stage 6 — стоимость);
- Spec Stage 7 (исходящий план из заполненной ТК — **не** hard dep Stage 8);
- фактом партии (Stage 11).

## Решение

### 1. Сущности

| Сущность | Роль |
|----------|------|
| **TechOperation** | Плоский каталог цеховых операций: `name`, `code`, `volume_unit` (`linear_meters` \| `pieces`), `is_active`, `sort_order` |
| **WorkCenter** | Плоский справочник участков/оборудования: `name`, `code`, `is_active` (MVP) |
| **ShopRoutingTemplate** | Именованный пресет маршрута: `name`, `code?`, `is_active`, `notes` |
| **ShopRoutingStageLine** | Упорядоченный этап: `stage_order` (≥1, unique per template), `stage_label`, optional `tech_operation_id`, optional `work_center_id`, `is_quality_checkpoint` |

### 2. Правила последовательности

- Этапы строго упорядочены по `stage_order` (1…N, без дыр при replace API).
- `is_quality_checkpoint` — флаг на этапе; отдельной QC state machine в Stage 8 нет.
- Stage line **может** ссылаться на TechOperation (для prefill объёмов на ТК); не обязана.
- ≠ `AssemblyOperationLine` (cost contour).

### 3. Связи

| Связь | Правило |
|-------|---------|
| `ProductModel.default_routing_template_id` | Nullable FK; default для generate ТК |
| TC `routing_template_id` + name | Snapshot на generate; master edits не live-merge |
| TC `stage_results` | Skeleton из stage lines на generate; gates в `9.2.2` |
| TC op-volume lines | Prefill из TechOperation на stage lines с FK |
| Spec Stage 7 | Soft only; не требуется для CRUD маршрутов |

### 4. UI placement

Settings group **«Производство»**:

- Тех операции → `/settings/catalogs/tech-operations`
- Маршруты → `/settings/catalogs/routings`

**Не** CRUD внутри `/settings/catalogs/tech-cards` (`9.6`).

### 5. Seed TechOperation (MVP)

| Name | volume_unit |
|------|-------------|
| Сублимационная печать | linear_meters |
| Термоперенос | linear_meters |
| Пошив | pieces |
| ВТО | pieces |
| Упаковка | pieces |

## Последствия

- Closing `8.2.1` unblocks `9.2.2`.
- Generate may snapshot default model routing when present.
- Stage 7 remains later outbound wave.

## Ограничения

- Auth/roles later (`17.1`)
- Full work-center capacity / calendars out of MVP
- Spec CRUD out of Stage 8
