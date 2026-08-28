# ADR-018 — ProductionOrder + ProductionBatch domain

**Status:** принято (`2026-07-30`); **amended** `2026-07-30` (`11.2.1.1` aggregate fact roll-up contract); **amended** `2026-07-30` (`11.2.2.1` / ADR-019 FG warehouse stages); **amended** `2026-08-25` (Spec parent 1:1 batch / ADR-031); **amended** `2026-08-27` (`28.5.2` nullable `sales_order_id` / standalone group XOR)

**Date:** `2026-07-30`  
**Roadmap:** Stage 11 § `11.1.1.1` (orders/batches); feeds `11.1.1.2`–`11.1.1.5`, `11.2`, Spec Stage 7  
**Depends on:** ADR-004, ADR-016, ADR-017, ADR-019  
**Evidence:** `docs/tasks/v0.9.0-stage-11.1.1.1-production-order-batch-adr.md`; amend `docs/tasks/v0.9.0-stage-11.2.1.1-aggregate-fact-contract.md`; FG amend `docs/tasks/v0.9.0-stage-11.2.2.1-warehouse-fg-contract.md`

## Контекст

Нужна граница между:

- коммерческим **заказом покупателя** (`SalesOrder` / `SalesOrderItem`);
- **технической картой** (SoT состава и цехового факта на order-line — ADR-016);
- **цеховыми модулями** `11.3`–`11.10` (пишут факт на ТК);
- планировочными документами Производства: **производственный заказ** и **партия**;
- **спецификацией партии** (Stage 7 / ADR-031 — отчёт план+факт для 1С, шапка 1:1 с batch; не gate запуска).

Нельзя: подменять `SalesOrder` «производственным заказом»; плодить второй SoT факта на партии вместо ТК; ломать правило 1 ТК = 1 eligible order-line; смешивать назначение WorkCenter (`11.1.2`) с CRUD заказов/партий.

## Решение

### 1. Сущности

| Сущность | Роль |
|----------|------|
| **ProductionOrder** | Планировочный документ Производства. Живёт в контуре `/production/orders`. Контур A: привязан к одному `SalesOrder`. Контур B (`28.5.2`): `sales_order_id` null, `order_group_id` → `technical_card_order_groups`. Не заменяет коммерческий заказ. |
| **ProductionBatch** | Партия выпуска внутри производственного заказа. Группирует существующие `TechnicalCard` для планирования / roll-up / будущего родителя Spec. |
| **ProductionBatchCardLink** | Связь партия ↔ ТК (`UNIQUE(technical_card_id)` в MVP: карта не более чем в одной активной партии). |

### 2. Кардинальность (MVP)

```
SalesOrder 1 ─── N ProductionOrder     (contour A; optional)
TechnicalCardOrderGroup 1 ─── N ProductionOrder  (contour B, 28.5.2)
ProductionOrder 1 ─── N ProductionBatch
ProductionBatch N ─── M TechnicalCard   (через link; MVP: TC ∈ ≤1 batch)
TechnicalCard 1 ─── 0..1 SalesOrderItem    (ADR-016; contour B: no item)
```

Допускается:

- несколько производственных заказов на один `SalesOrder` (частичный запуск);
- несколько партий внутри одного `ProductionOrder`;
- несколько ТК в одной партии (одинаковая или разная технология — MVP без hard-фильтра по routing);
- **не** допускается дробление одной ТК между партиями (связь 1:1 card↔batch link).

Генерация ТК остаётся на стороне Stage 9 (`9.2.1`); партия **не** создаёт ТК.

### 3. Статусы (MVP)

**ProductionOrder**

| Status | Meaning |
|--------|---------|
| `draft` | Создан; партии можно набирать |
| `in_progress` | Хотя бы одна партия `released` / `in_progress` |
| `completed` | Все партии terminal (`completed` / `cancelled`) и есть ≥1 `completed` |
| `cancelled` | Отменён (запрет новых партий) |

**ProductionBatch**

| Status | Meaning |
|--------|---------|
| `draft` | Набор ТК; правки состава партий |
| `released` | Передана в исполнение (цеха работают по ТК как раньше) |
| `in_progress` | Хотя бы одна связанная ТК не terminal |
| `completed` | Все связанные ТК `completed` (или batch пустой — запретить complete) |
| `cancelled` | Снята; links можно detach только до `released` (после — soft cancel) |

Детальная state machine и авто-переходы — в `11.1.1.2` / `11.1.1.3`; ADR фиксирует enum-набор и смысл.

### 4. Нумерация (default)

| Document | Pattern | Notes |
|----------|---------|-------|
| ProductionOrder | `PO-{salesOrderNumber}-{seq}` / contour B: `PO-{groupOrderNumber}-{seq}` | `seq` = 1…N внутри `SalesOrder` **или** standalone group; стабилен после create |
| ProductionBatch | `{productionOrderNumber}-B{seq}` | `seq` = 1…N внутри `ProductionOrder` |

Разделитель дефис; шаблоны могут уточняться позже в настройках — default фиксируем здесь.

### 5. Связи с соседними контурами

| Контур | Правило |
|--------|---------|
| `SalesOrder` | Live FK `ProductionOrder.sales_order_id` **nullable** (`28.5.2`); XOR with `order_group_id`. Коммерческие статусы заказа **не** зеркалятся автоматически |
| `TechnicalCard` | Soft/link via `ProductionBatchCardLink`; snapshot номера/модели опциональны на UI; master TC не переписывается партией |
| Shop modules `11.3`–`11.10` | SoT факта остаётся на ТК / stage results / MATERIAL `fact_qty`; партия **не** принимает shop fact writes |
| Aggregate fact `11.2` | Roll-up **читает** ТК, сгруппированные партией; не дублирует SoT — see §8 |
| Spec Stage 7 | Родитель отчёта = **партия** (предпочтительно) или заказ/ТК-контекст per ADR-004; Spec **не** prerequisite create партии |
| WorkCenter `11.1.2` | Planned equipment on TC `stage_results.work_center_id` (routing snapshot + editable); shop fact reuses field; **not** required on ProductionOrder/Batch |
| Warehouse Stage 12 / ADR-019 | Партия ≠ складская lot; FG receipt/issue tied to TC stages `ready_to_ship` / `shipped`; Batch.`released` ≠ «Отгружены» |

### 6. UI placement

- Список / карточка: `/production/orders` (nav уже есть).
- Создание: из Производства (и опционально deep-link с заказа покупателя — `11.1.1.4`).
- **Не** CRUD внутри settings tech-cards / shop modules.

### 7. Вне scope ADR

- Реализация таблиц / API / UI (`11.1.1.2`–`11.1.1.4`)
- WorkCenter planning (`11.1.2`) — shipped separately
- Aggregate performers/scrap roll-up API/UI (`11.2.1.2`–`11.2.1.4`) — contract in §8
- Spec document CRUD (Stage 7)
- Auth/roles (`17.1`)
- Складские lots / резервы / ledger documents (Stage 12 / ADR-019) — Batch не владеет остатком

### 8. Aggregate fact roll-up (`11.2.1`, amend `2026-07-30`)

| Rule | Detail |
|------|--------|
| Parent | Prefer `ProductionBatch`; order-level roll-up = union of batches (or all linked TCs of the `ProductionOrder`) |
| SoT | Remains on `TechnicalCard` — stage_results, composition MATERIAL `fact_qty`, operation_line volumes. Roll-up is **read model only** |
| Forbidden | Writing shop fact / scrap / material fact onto ProductionOrder or ProductionBatch tables |
| Performers | Distinct `performer_name` values from linked TC `stage_results` (optionally per `production_stage_id`) |
| Time | Sum of `duration_seconds` where set (null ignored); not invent zeros |
| Scrap / rework | Sum of `scrap_qty` / `rework_qty` on stage_results (typically ОТК) |
| Output | Count / qty of linked TCs by status (`completed` vs in progress); card `quantity` sum for linked cards |
| Materials | Sum MATERIAL `fact_qty` (and planned if needed) across linked TCs; group by nomenclature snapshot identity |
| Op volumes | Sum `TechnicalCardOperationLine.volume` by operation snapshot / stage |
| Empty batch | Roll-up returns empty aggregates (zeros / empty lists); does not invent demo rows |
| Spec Stage 7 | Consumes the same sources; roll-up UI is operational summary, not Spec document |

### 9. Последствия

- Цепочка ADR-004 уточняется: … → ТК → **ProductionOrder → ProductionBatch** → исполнение (shop на ТК) → Spec(партия) → 1С.
- Цеховые очереди и kanban продолжают работать от `TechnicalCard.current_stage_*` без обязательной партии.
- Партия — группировка для планирования и будущего Spec/roll-up, не второй документ исполнения.

## Evidence

- Roadmap: `11.1.1.1`; amend `11.2.1.1`
- Task: `docs/tasks/v0.9.0-stage-11.1.1.1-production-order-batch-adr.md`
- Aggregate amend: `docs/tasks/v0.9.0-stage-11.2.1.1-aggregate-fact-contract.md`
- API: `docs/tasks/v0.9.0-stage-11.2.1.2-aggregate-fact-api.md`
- Related: ADR-004, ADR-016 §6 (Stage 11 Production batch), ADR-017
