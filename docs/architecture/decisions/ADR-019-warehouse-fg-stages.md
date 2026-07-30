# ADR-019 — Warehouse domain + finished-goods production stages

**Status:** принято (`2026-07-30`)  
**Date:** `2026-07-30`  
**Roadmap:** Stage `12.0` / bridge `11.2.2.1`; feeds `12.1`–`12.3`, `11.2.2.2`–`11.2.2.5`; owns ledger formerly sketched as `4.6.5.*`  
**Depends on:** ADR-012, ADR-004, ADR-016, ADR-017, ADR-018  
**Evidence:** `docs/tasks/v0.9.0-stage-11.2.2.1-warehouse-fg-contract.md`

## Контекст

Нужна граница между:

- цеховым исполнением на ТК (`11.3`–`11.10`, заканчивается Упаковкой);
- **готовой продукцией на складе** (изделия заказа приняты на склад, ещё не отгружены);
- **отгрузкой** (списание со склада);
- будущими документами доставки Stage 14;
- правилом ADR-012: остатки **не** на карточке `Nomenclature`.

Нельзя: путать `ProductionBatch.status=released` (передача партии в цеха) с «Отгружены»; дублировать остаток на ТК/партии; проводить склад без регистра.

## Решение

### 1. Post-packaging ProductionStages

После цеха **Упаковка** в справочник `ProductionStage` добавляются:

| code | name | sort_order (seed) | Смысл |
|------|------|-------------------|--------|
| `ready_to_ship` | Готовы к отгрузке | 80 | ТК / номенклатура заказа на складе, не отгружена |
| `shipped` | Отгружены | 90 | Списано со склада |

Это **не** цеха с shop-fact scrap/MATERIAL gate. Это operational stages маршрута ТК с жёсткой связью со складскими документами.

```
… → ОТК → Упаковка → Готовы к отгрузке → Отгружены
```

### 2. Складские сущности (MVP)

| Сущность | Роль |
|----------|------|
| **Warehouse** | Справочник складов; seed default «Основной» |
| **StockDocument** | Шапка движения: типы `receipt` / `issue` (позже transfer, inventory); status `draft` / `posted` / `cancelled` |
| **StockLedgerLine** | Проводка регистра: `warehouse_id`, `nomenclature_id`, signed `qty`, `posted_at`, FK/soft на document; soft refs `technical_card_id`, `sales_order_id` |
| **Balance projection** | Read-model: Σ ledger по `(warehouse_id, nomenclature_id)` — наполняет `GET /stock/balances` (`12.1.2` contract; fill in `12.2`) |

Bins / lots — **вне MVP** (stub under `12.1.2`; no fields on balance DTO).

### 3. Finished-goods document types

| Event | Document | Ledger effect |
|-------|----------|---------------|
| Complete stage `ready_to_ship` | StockDocument **Приход ГП** (`fg_receipt`) | `+qty` PRODUCT (или nomenclature ТК) на default/selected warehouse |
| Complete stage `shipped` | StockDocument **Списание** (`fg_issue`) | `−qty` с того же склада |

SoT остатка = **только** posted ledger. ТК хранит `current_stage_*` / stage_results; **не** хранит balance.

### 4. Qty rule (MVP)

```
receipt_qty = max(0, TC.quantity − sum(scrap_qty on QC stage_results))
```

- `rework_qty` **не** уменьшает приход в MVP (изделие остаётся в потоке).
- Issue qty = ранее оприходованный `receipt_qty` по этой ТК (нельзя списать больше, чем принято).
- Nomenclature: `TechnicalCard.nomenclature_id` (PRODUCT); если null — complete `ready_to_ship` fail-closed.

### 5. Routing / generate policy

- Seed stages always in catalog (`11.2.2.2`).
- **Default append:** при apply/generate routing, если шаблон заканчивается на `packaging` и не содержит FG stages — append `ready_to_ship` → `shipped` (policy в `11.2.2.2`).
- Существующие шаблоны: soft migrate on next edit/apply, не silent rewrite всех live TC.
- Kanban (`11.3.6`): колонки включают оба FG stage (9+ колонок вместе с цехами); DnD adjacent only per `9.2.2`.

### 6. Границы соседних контуров

| Контур | Правило |
|--------|---------|
| ОТК `11.9` | Scrap/rework SoT на stage_results; не создаёт складской приход |
| Упаковка `11.10` | Последний цех до FG; complete → можно стартовать `ready_to_ship` |
| ProductionBatch `released` | Планирование → цеха; **≠** `shipped` |
| Aggregate fact `11.2.1` | Может читать FG stage labels/duration; **не** пишет ledger |
| Stage 14 Shipping | ТТН / delivery поверх уже `shipped`; не дублирует списание |
| `4.6.5` MVP register | Ownership переходит к Stage `12.2` (те же таблицы/API) |

### 7. UI placement

- Production: `/production/stages/ready-to-ship`, `/production/stages/shipped` (+ kanban).
- Warehouse: `/warehouse/movements` (документы), `/warehouse/stock` (остатки), settings warehouses.
- Complete FG stage на TC document с `?stage=…` — как остальные shop modules.

### 8. Вне scope ADR

- Реализация таблиц/API (кроме seed stages в `11.2.2.2`)
- Procurement receipts, returns, reserves
- Multi-bin / lots
- 1С exchange of stock docs

## Последствия

- Цепочка ADR-004: … → Упаковка → **складской приход ГП** → **отгрузка/списание** → Spec/1С.
- Остатки на списке номенклатуры становятся живыми после `12.2`.
- `11.2.2.4` (wire complete→post) зависит от ledger `12.2`.

## Evidence

- Roadmap: `11.2.2.1`, `12.0`
- Task: `docs/tasks/v0.9.0-stage-11.2.2.1-warehouse-fg-contract.md`
- Related: ADR-012, ADR-016, ADR-017, ADR-018, ADR-004
