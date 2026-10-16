# ADR-017 — Shop routing domain (Stage 8)

**Status:** принято (`2026-07-26`); **amended** `2026-07-26` (`8.3` ProductionStage); **amended** `2026-07-27` (model routing whitelist + operation norms `6.1.17`); **amended** `2026-07-28` (TechOperation required materials for TC prefill `8.1.4` / `9.3.5`); **amended** `2026-07-30` (`11.1.2` WorkCenter planning: TC stage snapshot + Settings catalog); **amended** `2026-07-30` (FG stages `ready_to_ship` / `shipped` — ADR-019 / `11.2.2.1`); **amended** `2026-07-31` (`6.3.10` SewingOperation ↔ sewing-shop WorkCenter catalog link — ≠ routing/TC assignment)  
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

**Amend `2026-07-31` (`6.3.10`):** каталог `SewingOperation` может хранить M:N совместимое оборудование цеха Пошив (`WorkCenter` + `production_stage.code=sewing`). Это **не** SoT планового/факт оборудования на шаге маршрута или ТК — остаётся `11.1.2`.

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

**Amend PC-04.4U, 2026-10-10 — persistence/cache audit:** `ProductModelOperationNorm.norm_qty_per_item` + `unit` — каноническая норма варианта. `TechnicalCardOperationLine.volume_qty_per_item` — frozen source norm per item. Норма копируется для м.п. и шт.; implicit 1 для шт. применяется только без подходящей настроенной нормы. Live edit не меняет ТК; explicit reapply принимает текущую норму; quantity использует сохранённый коэффициент, ручной volume без коэффициента сохраняется. `CACHE NOT ROOT CAUSE`: 29 CAL-STRESS ТК сохраняли старые zero/null строки; явное восстановление через существующую привязку той же модели/сборки сохранило route snapshot и ONE OF. Новая временная ТК проверена после commit через PostgreSQL/API/UI и удалена. Demand/Scheduler/Capacity contracts не изменены. Отчёт: `docs/tasks/pc-04-4u-route-norms-to-techcard-persistence-cache-audit-codex.md`.

**Amend PC-04.4T, 2026-10-10 — задача владельца:** выбранные model/routing norms теперь заполняют пустые входные объёмы операций ТК при привязке модели/сборки/маршрута. Норма м.п. должна однозначно совпадать с операцией/цехом и единицей; шт. используют quantity, строки сборки — multiplicity × quantity. Принятый коэффициент хранится на существующей строке операции (`volume_qty_per_item`), чтобы последующий импорт quantity не перечитывал живые нормы и не перезаписывал ручной цеховой объём. Это плановый вход, не факт исполнения; Demand читает сохранённый volume, а норму времени пошива — из прежнего подтверждённого источника. Состав/edges/ONE OF snapshot не заменяются при изменении quantity. [Точный контракт](../production-demand-pc-04-2.md); задача `docs/tasks/pc-04-4t-restore-route-and-assembly-operation-demand-codex.md`.

- Closing `8.2.1` unblocked `9.2.2`.
- `8.3` stabilizes цех ids for Stage 11 shop modules.
- Generate snapshots `production_stage_id` on stage results.
- Stage 7 remains later outbound wave.
- Stage 10 (client design approval) ≠ цех Дизайн (`11.4`).

## Ограничения

**Amend PC-03.7A, 2026-10-06 — решение владельца:** TechOperation — источник технологической принадлежности; CapacityResource — единственный источник мощности. M:N junction `tech_operation_capacity_resources` позволяет операциям совместно использовать одну доступность/оборудование, без копирования ресурса или его исключений. `print_operator` разделяется `sublimation` и `heat_transfer`; связь не меняет маршрут, snapshot ТК или факт исполнения. Старое `production_capacity_settings` переименовано в `capacity_resources`, calendar capacity API сохранён поверх того же хранилища. [Точный контракт и миграция](../production-calendar-shared-capacity-pc-03-7a.md). Scheduler/ProductionJob отсутствуют; frontend-интеграция — отдельная PC-03.7B.

- Auth/roles later (`17.1`)
- Full work-center capacity / calendars out of MVP
- Spec CRUD out of Stage 8
- Per-цех execution UIs out of Stage 8 → `11.3`–`11.10`

**Amend IC-G01, 2026-10-11 - production fact on route reapply:** explicit reapply accepts current norms only for untouched future routing rows. Fact-bearing StageResult identity/status/recorded fields and all operation lines on protected orders remain unchanged, including manual volume and sewing-ledger references. Preflight compares protected shape, selected ONE OF and effective predecessors before mutation; destructive change returns HTTP409 `route_reapply_conflicts_with_production_fact` / INTEGRITY. Identical route and future-only changes preserve calendar/audit associations. No automatic migration/recovery of legacy facts; missing or ambiguous protected identity is rejected. This amendment protects route reapply only; model/assembly binding, live norm drift and other plan writers remain separately scoped work. See `docs/tasks/ic-g01-protect-production-fact-on-route-reapply-codex.md`.

**Amend IC-G02, 2026-10-11 - saved plan linkage:** source-line removal/replacement cannot detach a confirmed fact plan. Untouched future plans retire atomically with allocations and canonical lifecycle audit; no order-based remap. Live-template edits do not invalidate the frozen applied operation solely because the master changed. Legacy corruption remains report-only. See `docs/tasks/ic-g02-protect-saved-plan-linkage-codex.md`.

**Amend IC-G03, 2026-10-11 - allocation consistency:** allocated resource unit/physical identity and used operation/resource links cannot be changed or detached silently. Daily allocation dates are inside inclusive assignment bounds; totals match current selected Demand rounded once upward to0.0001. A valid WorkCenter alternative is resolved by the existing Scheduler eligibility, preserving nonphysical M:N sharing. Future replan replaces allocations atomically; no automatic unit conversion, migration or repair. Quantity/norm input revision policy remains IC-G04. See docs/tasks/ic-g03-allocation-date-unit-consistency-codex.md.

**Amend IC-G04, 2026-10-11 - input freshness:** accepted frozen route volumes remain frozen until explicit reapply; consumed live operation/sewing/resource inputs remain live. Saved plans carry an effective input stamp in canonical lifecycle audit. Future input drift makes the old plan non-executable and requires explicit replan; started/completed saved facts reject consumed-input ORM changes transactionally. Manual/past anchors with stale inputs block Scheduler reuse. Reapply/ONE OF retirement requires a fresh generation, with no position-based historical remap. Missing legacy evidence is unverifiable, not guessed. Existing Demand formulas, allocation rounding and accepted source ownership remain unchanged. See [IC-G04](../../tasks/ic-g04-invalidate-stale-plan-on-demand-change-codex.md).

**IC-RS01 owner policy, 2026-10-12:** retained route without frozen completeness evidence cannot support new planning/start. Complete canonical apply records an immutable manifest in existing AuditEvent; missing/changed retained structure is not reconstructed from live template. Explicit route refresh may establish new evidence only without protected production fact. Unverified fact-bearing refresh rejects; existing IC-G01 verified reapply remains compatible. No backfill or automatic repair. Manager UI uses plain route-review wording; detailed reason/IDs are Debug-only.

**IC-RS05,2026-10-12 — retained operation identity:** supported hard delete rejects any retained TechnicalCardStageResult or operation-line integer reference before repository mutation, independently of live route FK and card status. Reuse scheduler transaction lock for delete and snapshot copy/append producers. Unused identities remain deletable; display names never prove a link. Legacy missing references are read-only diagnostics. No automatic archive/deactivation/remap, schema migration or fact repair.
