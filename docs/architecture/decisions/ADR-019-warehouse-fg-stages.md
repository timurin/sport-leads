# ADR-019 — Warehouse domain + finished-goods production stages

**Status:** принято (`2026-07-30`)
**Date:** `2026-07-30`
**Roadmap:** Stage `12.0` / bridge `11.2.2.1`; feeds `12.1`–`12.5`, `11.2.2.2`–`11.2.2.5`; owns ledger formerly sketched as `4.6.5.*`
**Amended:** `2026-08-24` (Stage `25` / ADR-030: partial FG qty from unit lines); `2026-08-25` (Stage `12.4` inventory document)

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
| **StockDocument** | Шапка движения: типы `receipt` / `issue` / `fg_receipt` / `fg_issue` / **`inventory`** (Stage `12.4`); позже `transfer`. Status `draft` / `posted` / `cancelled` |
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
- Warehouse **transfers** (`12.5.1`) — separate document type, not inventory

## Последствия

- Цепочка ADR-004: … → Упаковка → **складской приход ГП** → **отгрузка/списание** → Spec/1С.
- Остатки на списке номенклатуры становятся живыми после `12.2`.
- `11.2.2.4` (wire complete→post) зависит от ledger `12.2`.

## Amend `2026-08-24` — partial FG post (Stage `25`)

`12.3.2` сегодня постит `TC.quantity − QC scrap` одним документом на карту. После ADR-030 приход/списание ГП считаются по **unit lines, которые реально вошли** в `ready_to_ship` / `shipped`. Несколько FG-документов на одну ТК допустимы; повторный пост той же штуки запрещён. Подробности: ADR-030 §6.

## Amend `2026-08-25` — inventory recount (`12.4`)

`StockDocument.doc_type = inventory` is a warehouse **recount document**, not a second register and not a transfer.

| Правило | Решение |
|---------|---------|
| Header | Same `StockDocument` (one `warehouse_id`; status `draft` / `posted` / `cancelled`). No `technical_card_id` / `sales_order_id` required. Number stays in the `STK-*` sequence (no second numerator). |
| Recount lines | Own table `stock_inventory_lines` on the document: `nomenclature_id`, `book_qty` (snapshot of posted ledger at fill/refresh), `counted_qty` (≥ 0). Unique nomenclature per document. |
| Delta | `delta = counted_qty − book_qty`. Book is a snapshot, not a live remainder after the user starts counting. Draft may refresh book from current posted balance (overwrites book; counted stays). |
| Post | For each line with `delta ≠ 0`, insert `StockLedgerLine` with signed `quantity = delta` (surplus `+`, shortage `−`) on the same warehouse. Zero-delta lines do not write ledger (`quantity != 0` check). Post with all-zero deltas is allowed (audit document, no ledger rows). Posted document is immutable. |
| Balance SoT | Posted ledger only (ADR-012). Inventory does not store remainder on `Nomenclature`. |
| Negative remainder | Same as existing `issue`: MVP does **not** block posting a shortage below zero. |
| UI host | `/warehouse/movements` + document card (PT-02/PT-07). No Documents module. No bins/lots. |
| Out of this amend | `transfer` (`12.5.1`), reserves (`12.5.2`), 1C, serials. |

Task: `docs/tasks/v1.00-stage-12.4-inventory.md` (`SL-STOCK-INVENTORY-v1`).

## Evidence

- Roadmap: `11.2.2.1`, `12.0`, `12.4.1.*`
- Task: `docs/tasks/v0.9.0-stage-11.2.2.1-warehouse-fg-contract.md`; inventory `docs/tasks/v1.00-stage-12.4-inventory.md`
- Related: ADR-012, ADR-016, ADR-017, ADR-018, ADR-004, ADR-030
