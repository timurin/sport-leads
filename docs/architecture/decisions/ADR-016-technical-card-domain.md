# ADR-016 — Technical card domain boundary

**Status:** принято (`2026-07-26`); amend numbering + TechOperation / op-volume lines (`2026-07-26`); amend Spec↔ТК dependency (`2026-07-26`); amend Spec = план+факт report (`2026-07-26`); amend screen mockups on TC max 3 + sewing snapshot lines (`2026-07-27`); **amend composition plan/fact + hard material gate cutting/print (`2026-07-27`)**; **amend aggregate personalization import + history block + TechOperation material prefill (`2026-07-28`)**; **amend shop-module platform contract (`11.3.1`, `2026-07-28`)**; **amend Раскрой shop domain (`11.5.1`, `2026-07-28`)**; **amend Печать shop domain (`11.6.1`, `2026-07-28`)**; **amend Пошив shop domain (`11.7.1`, `2026-07-28`)**; **amend Упаковка shop domain (`11.10.1`, `2026-07-29`)**; **amend DesignProject SoT ADR-021 (`2026-08-01`)**; **amend Stage 19 internal collaboration context (`2026-08-04`, ADR-026)**; **amend sewing work ledger pointer Stage 24 / ADR-029 (`2026-08-24`)**; **amend unit-line location + split WIP Stage 25 / ADR-030 (`2026-08-24`)**; **amend Spec version FK Stage 7 / ADR-031 (`2026-08-25`)**; **amend dual contour A/B + display `{orderNo}-{seq}/{N}` Stage 28 (`2026-08-27`)**

**Date:** `2026-07-26`  
**Roadmap:** Stage 9 § `9.1.1` (+ Stage `8.1.3` TechOperation catalog; Stage `9.3.3` volume lines; Stage `9.3.4` plan/fact materials; Stage `9.3.5` required materials prefill; document layout `9.4.2.7` / history `9.4.2.8`; shop Упаковка `11.10`)  
**Depends on:** ADR-004, ADR-003, ADR-012, ADR-014 (ADR-017 for shop routing)  
**UI chrome:** `docs/tasks/v0.9.0-stage-9.0.3-tech-cards-ui-contract.md` (`SL-TECH-CARDS-UI-v1`)  
**Order link plan:** `docs/architecture/order-card-field-links.md` § Gap `#4`  
**Spec↔ТК fix:** `docs/tasks/v0.9.0-stage-8-spec-tc-dependency-fix.md`  
**Spec document role:** `docs/tasks/v0.9.0-spec-document-and-documents-registry.md`  
**Document layout amend:** `docs/tasks/v0.9.0-stage-9.4.2-tech-card-document-layout.md`
**Plan/fact materials:** roadmap `9.3.4`; task `docs/tasks/v0.9.0-stage-9.3.4-composition-plan-fact.md`

## Контекст

Нужна граница между:

- коммерческой позицией заказа (`SalesOrderItem`);
- **технической картой (ТК)** — производственным документом исполнения по позиции заказа (**SoT состава** на order-line);
- цеховым маршрутом-шаблоном и каталогом **тех операций** (Stage 8) — пресет этапов для ТК;
- **спецификацией** (Stage 7) — **документ-отчёт** (план + факт в одной форме) для 1С по затратам партии; читает ТК + факт исполнения; **не** SoT состава и **не** hard dep generate;
- сырым фактом партии / выпуска (Stage 11) и журналом операций (`18.4`) — источники факта для блоков Spec;
- печатным макетом 2×A4 (`18.3`) — не SoT домена;
- реестром **Документы** — индекс ссылок на документы в родителях (не отдельный контур на тип; ADR-004).

Нельзя: плодить отдельный документ на каждую физическую штуку; переписывать открытые ТК live-правками справочников; смешивать ТК с менеджерским `AssemblyVariant` или с коммерческим `NomenclatureVariant`; смешивать цеховые **TechOperation** (объёмы) с коммерческими **SewingOperation** (стоимость).

## Решение

### 1. Термин и кардинальность (`9.1.1.1`)

| Понятие | Правило |
|---------|---------|
| **TechnicalCard** | Один производственный документ на **одну производимую** строку `SalesOrderItem` |
| **Не** | Один документ на каждую физическую единицу (`qty`) |
| **Не** | Один документ на весь заказ |

**Изделие (eligible line) — MVP:** строка заказа, у которой связанная номенклатура имеет `nomenclature_type == PRODUCT` (Продукция).  
`SERVICE` / `GOODS` / `MATERIAL` — **не** порождают ТК.

Отдельного enum «Полуфабрикат» в `NomenclatureType` пока нет; при появлении типа или флага полуфабриката eligible set расширяется через настройки Stage `9.6` **без** смены правила «1 ТК = 1 строка».

Ручные позиции без `nomenclature_id` вне eligible (как вне контура модели в ADR-014).

**Нумерация (default):** `{orderNo}-{cardSeq}`

- `orderNo` — номер заказа покупателя (контур A) или ручной номер группы (контур B, Stage 28);
- `cardSeq` — порядковый номер ТК **внутри заказа / группы** (1…N среди сформированных карт), стабильный после создания;
- разделитель **дефис** (`-`), согласован с печатным шаблоном Excel «НомерЗаказа-НомерТехкарты»;
- шаблон строки может уточняться в настройках `9.6`, default остаётся hyphen.

UNIQUE: не более одной ТК на один `sales_order_item_id` (когда карта создана; в контуре B поле null).

### 1.1 Dual contours + display number (Stage 28 / `SL-STANDALONE-TC-v1`)

| Contour | Entry | Order FKs |
|---------|--------|-----------|
| **A** | `SalesOrder` → `SalesOrderItem` → PRODUCT → generate (ADR-016 §1 unchanged; ≤1 TC per eligible item) | `sales_order_id` + `sales_order_item_id` both set |
| **B** | Manual create without required SalesOrder (scrap, gifts, internal ops) | both SalesOrder FKs **null**; `order_group_id` → `technical_card_order_groups` |

Contour B group: free-text `order_number` unique among groups (may coincide with a real `SalesOrder.number` — no FK); `tech_cards_planned_count` ≥ 1; `desired_date` snapshot. Create B: nomenclature + order number + planned count + ship date + qty ≥ 1 → **qty unit lines**. **No** auto-spawn of N cards.

**Link B→A (`28.5.1`):** optional convert of a contour-B card onto a **free** eligible `SalesOrderItem` (no existing TC on that item; ≤1 TC per item). Sets both SalesOrder FKs and **clears** `order_group_id` (XOR unchanged). Stored `number` is not rewritten. `card_seq` becomes next seq on the target SalesOrder. Item nomenclature must match the card when both ids are set. Unit lines stay. One-way (no unlink in this slice). After link, display `/{N}` uses the SalesOrder planned count.

**Planned TC count (soft):** manager field on `SalesOrder` (A) or the order group (B). Meaning: how many tech cards are expected. Create/generate is **not** blocked when actual ≠ planned.

**Stored vs display:**

| Layer | Format |
|-------|--------|
| Stored `TechnicalCard.number` | `{orderNo}-{card_seq}` |
| UI / print / list | `{orderNo}-{card_seq}/{N}` |

`N` = **live** planned count. Changing planned count does not rewrite stored `number`. When planned is unset, display = stored number.

Parked: none remaining in Stage 28. `28.5.2` closed: `ProductionOrder.sales_order_id` nullable via standalone group XOR. `28.5.3` closed: Spec header `sales_order_id` nullable copy from PO. `28.5.4` closed: collab on TC without order (ADR-026 order-group XOR).

### 2. Unit lines — поштучная матрица (`9.1.1.2`)

Внутри одной ТК хранится таблица **unit lines**:

- число строк **N = quantity** позиции заказа на момент синхронизации (`9.2.1.2`);
- каждая строка = одна физическая единица с полями характеристик: `size_type` (`male` / `female`), размер, персонализация (фамилия и т.п.), номер печати / игровой номер, примечание, прочие поля из настроек `9.6`;
- defaults при генерации: из snapshot позиции заказа (`size_range`, `personalization`, …) с возможностью per-row правки; `color` больше не является активным UI/import полем в этом контуре и остаётся только legacy nullable storage до cleanup;
- **не** создаём N отдельных `TechnicalCard` при qty = N.

**Amend `2026-08-24` (Stage `25` / ADR-030):** unit line получает **локацию** `production_stage_id` (WIP по штуке). Одна ТК; child TC запрещены. Вычисляемый статус карты (возврат > готова / частично готова / в работе) не дублирует `TechnicalCard.status`. QR — ADR-030, не этот файл.

Импорт персонализации может приходить **агрегированными** строками по колонкам (`size_type`, `size`, `surname`, `print_number`, `quantity`, `notes`), но сервис обязан валидировать `Σ quantity = qty` строки заказа и **разворачивать** агрегат в N unit lines. Агрегат — transport/presentation DTO, не новый SoT.

Печатная матрица размеров (агрегат по size type / size) — presentation в `18.3`, не отдельный SoT вместо unit lines.

### 3. Snapshot vs live link (`9.1.1.3`)

Политика как у коммерческих snapshot на заказе (ADR-003 / ADR-014): сформированная ТК **не** переписывается правками master-справочников.

| Связь | На ТК | Политика |
|-------|-------|----------|
| `SalesOrder` / `SalesOrderItem` | live FK | Идентичность документа; qty sync по правилам сервиса |
| Номенклатура | id + snapshot name/type | Snapshot при generate; live id для навигации |
| ProductModel | id + snapshot article/name/`size_type` | Копия из order-item snapshot (или catalog на generate); master не ретроактивен |
| AssemblyVariant + sewing operation lines | id + name/total + operation snapshots | Из order-item assembly snapshots (cost contour Stage 6) |
| Материалы / лекала / нормы | planned **composition** rows on card | SoT состава на order-line; MATERIAL lines bind to `production_stage_id`; **`planned_qty`** = hint from model operation norms × order qty (`6.1.17`) and, when TechOperation carries required materials, `required_material_qty × norm_qty_per_item × order qty` (`9.3.5`); **`fact_qty`** written by цех on stage complete (`11.5`/`11.6`); not a second складской каталог (ADR-012) |
| Спецификация (Stage 7) | `specification_version_id` FK → `specification_versions` + label (ADR-031 / `7.1.2.1`) | **Не** источник generate. Spec = сводный отчёт (план из ТК + факт исполнения) для **партии** / 1С. Stamp на карте — обратная связь после approve, не hard gate |
| Shop routing template (Stage 8) | template id + ordered stage plan snapshot | Снимок маршрута на generate from order-item snapshot / model whitelist (`3.2.7` / `6.1.17`); исполнение пишет **stage results** на карте |
| TechOperation volume lines | operation id + name/unit snapshot + volume Decimal + stage binding | Prefill from routing/`8.1.3` on generate (`9.3.3`); manager may edit volumes; catalog edits do not live-merge |
| Design mockup (Stage 10) | optional asset / file link | Не блокирует generate; экран и Side 1 печати показывают когда есть. **Amend `2026-07-27`:** экранная галерея на ТК до 3 фото (`TechnicalCardMedia`) раньше полного модуля Stage 10; печать 2×A4 остаётся `18.3`. **Amend `2026-08-01`:** версионный SoT = `DesignProject` / `DesignVersion` (**ADR-021**); TC media ≠ DesignVersion |

**Live** допускаются только: статус/участок исполнения, unit-line edits, composition edits (до правил `9.2.2`), op-volume edits, stage results, **fact material qty via shop modules**, ссылки навигации.  
**Не** live-merge: цены справочника пошива, шаги routing template / TechOperation master после generate; утверждённая Spec version не переписывает открытую ТК без явного действия.

**Hard material gate (`9.3.4`, amend `2026-07-27`):** нельзя `complete` этапов **Раскрой** (`cutting`) и **Печать** (`print`), пока у всех MATERIAL lines с этим `production_stage_id` не заполнен `fact_qty`. Остальные цеха — без material hard-gate в MVP.

Stage 7 **не** блокирует generate / Stage 8 / `9.2.2`. До готовности Stage 8 карта может существовать с пустым маршрутом / op-volume (UI contract) — без demo-данных.

### 4. Статусы и готовность заказа (`9.1.1.4`)

Детальная state machine — `9.2.2`. Для домена:

- у ТК есть жизненный цикл до **terminal** (завершена / отменена — точные enum в `9.2.2`);
- **order manufacturing completeness:** заказ считается производственно полным по ТК, когда:
  1. для **каждой** eligible строки существует ТК; **и**
  2. **все** ТК заказа в terminal-состоянии «завершена» (отменённые карты и не-eligible строки не блокируют, если бизнес-правило `9.2.2` так зафиксирует; MVP: отсутствующая карта на eligible line = **не** complete).

Коммерческий `SalesOrder.status` и stage rail заказа **не** заменяются статусом ТК. Интеграция с production-complete gates — `9.5.1` (READY/SHIPPED/COMPLETED требуют manufacturing completeness; helper для будущих reserve/ship docs `3.4.2`).

Stage gates: этапы идут в жёсткой последовательности snapshot-маршрута; нельзя начать следующий участок, пока предыдущий не complete (`9.2.2.2`). Строки объёмов операций **отображают** плановый объём на этапе, но **не** обходят gate.

### 5. Settings contract (`9.6.1`)

Settings under `/settings/catalogs/tech-cards` configure only the **document defaults and domain switches** of technical cards. MVP contract:

- **Eligible nomenclature types** for generate: default only `PRODUCT`; future extension (for example semi-finished items) must not break the rule `1 technical card = 1 sales order line`.
- **Numbering template**: default `{orderNo}-{cardSeq}`; settings may later offer a template variant, but order number + stable in-order sequence stay the base semantics.
- **Default unit-line fields**: choose which per-unit fields are active in the document/import contract (`size_type`, `size`, `personalization`, `print_number`, `notes`, later optional extensions).
- **Stage label binding policy**: runtime execution gates use snapshot `production_stage_id`; display `stage_label` is derived presentation/snapshot text, not a free-text settings source of truth.

Explicitly out of scope for `9.6` settings:

- TechOperation CRUD or required-material editing — owned by Stage `8.1.3` / `8.1.4`
- Shop routing CRUD — owned by Stage `8.2`
- Production-stage catalog CRUD — owned by Stage `8.3`
- Stage-action auth/roles — Stage `17.1`

### 6. Границы с соседними stage

| Контур | Роль относительно ТК |
|--------|----------------------|
| Stage 3 order item | Источник eligibility, snapshots, qty |
| Stage 6 SewingOperation | Коммерческий cost-каталог пошива; **не** цеховые объёмы |
| Stage 7 Specification | Документ-отчёт план+факт (из ТК + исполнения) → 1С; **не** hard dep generate; живёт у родителя, в «Документы» — только ссылка |
| Stage 8 Shop routing | Шаблон участков → snapshot plan; факт шагов на ТК |
| Stage 8 TechOperation (`8.1.3`) | Цеховой каталог операций с `volume_unit` (`linear_meters` \| `pieces`); seed: сублимация, термоперенос, пошив, ВТО, упаковка |
| Stage 9.3.3 op-volume lines | Snapshot строк объёмов на ТК |
| Stage 10 Design | Версии макетов: **ADR-021** `DesignProject`/`DesignVersion`; TC media ≤3 — interim gallery; approval gate = `3.4.1` + Stage `19` |
| Stage 11 Production batch | **ADR-018:** `ProductionOrder` → `ProductionBatch` группирует ТК; **не** меняет правило 1:1 line↔card; shop fact остаётся на ТК |
| Stage 11.1.2 WorkCenter planning | Planned equipment on `TechnicalCardStageResult.work_center_id` (snapshot from routing + editable); shop fact reuses same field; **not** a field on ProductionOrder/Batch |
| Stage 11.3 shop modules | Shared queue + stage-scoped execution UI open the **existing** TC and write fact on it; no second TC document |
| Stage 18.4 journal | Запись при реальном использовании модели в ТК/производстве |
| Stage 18.3 print forms | Печать ТК 2×A4 (Excel visual SoT): Side 1 шапка+макет+размерная матрица; Side 2 номенклатура+материалы+операции/объёмы; не SoT домена |

### 6.1 Stage 11.3 shop-module contract (`2026-07-28`)

- Shared shop modules work with a **queue of technical cards** filtered by `current` `ProductionStage`; the queue is derived from TC + routing snapshot and must not invent demo rows.
- Opening a shop module opens the **existing technical card document with stage context**; the module is an execution surface, not a second document parallel to the TC.
- Stage 10 client design remains separate: shop modules may show TC media/mockup context, but do not own client approval or replace the TC print/document screen.
- Shop execution must not bypass `9.2.2` stage order. A module may only act on the current routing step of the TC.
- For **Раскрой** and **Печать**, shop modules write `fact_qty` on TC composition `MATERIAL` lines bound to the current `production_stage_id`; stage complete remains fail-closed while any such line lacks `fact_qty` (`9.3.4` hard gate).
- TechOperation volumes and MATERIAL `fact_qty` stay distinct: op-volume rows describe planned/entered execution volume, while MATERIAL `fact_qty` is the stage consumption fact.
- Shop stage fact fields on `TechnicalCardStageResult` (`11.4+`): `performer_name`, `work_done`, `duration_seconds` written via `PATCH …/stages/{order}/fact` only for the **current** routing step; optional `shop_stage_code` binds the write to a specific цех (e.g. Дизайн).

### 6.2 Stage 11.5 Раскрой domain (`2026-07-28`)

Field inventory for цех **Раскрой** (`cutting`) — no new tables; reuses TC stage result + composition MATERIAL lines:

| Fact | Where | Notes |
|------|--------|--------|
| Performer | `TechnicalCardStageResult.performer_name` | Same stage-fact surface as `11.4` |
| Work done | `TechnicalCardStageResult.work_done` | Free text |
| Duration | `TechnicalCardStageResult.duration_seconds` | Integer seconds ≥ 0 |
| Material fact qty | Composition `MATERIAL.fact_qty` | Only lines with `production_stage_id` = Раскрой; written by shop path |
| Planned qty | Composition `MATERIAL.planned_qty` | Hint only (sizes/yield may change consumption) |

Rules:

- Shop module opens existing TC with `?stage=cutting`; does not create a parallel document.
- Stage fact and MATERIAL `fact_qty` writes may carry `shop_stage_code=cutting` and are accepted only when the card’s **current** routing step is Раскрой.
- Complete Раскрой is fail-closed while any Раскрой-bound MATERIAL lacks `fact_qty` (`9.3.4.3` / `MATERIAL_FACT_GATE_STAGE_CODES`).
- Печать (`11.6`) shares the material-gate pattern; Раскрой MVP does not add TechOperation/WorkCenter fields (those belong to Печать).

### 6.3 Stage 11.6 Печать domain (`2026-07-28`)

Extends Раскрой pattern with TechOperation volumes and optional equipment:

| Fact | Where | Notes |
|------|--------|--------|
| Performer | `TechnicalCardStageResult.performer_name` | Same as `11.4` / `11.5` |
| Work done | `TechnicalCardStageResult.work_done` | Free text |
| Duration | `TechnicalCardStageResult.duration_seconds` | Integer seconds ≥ 0 |
| Equipment | `TechnicalCardStageResult.work_center_id` | Optional FK → `WorkCenter` (миграция `v3w4x5y6z789`) |
| Op volumes | `TechnicalCardOperationLine.volume` | Routing ops bound to Печать; distinct from MATERIAL `fact_qty` |
| Material fact qty | Composition `MATERIAL.fact_qty` | Hard complete-gate like Раскрой |

Rules:

- Shop module opens TC with `?stage=print`.
- Stage fact / op volume / MATERIAL writes carry `shop_stage_code=print` and bind to current Печать step.
- Complete Печать is fail-closed while any Печать-bound MATERIAL lacks `fact_qty`.

### 6.4 Stage 11.7 Пошив domain (`2026-07-28`)

Field inventory for цех **Пошив** (`sewing`) — no new tables/columns; reuses TC stage result fact surface from `11.4`:

| Fact | Where | Notes |
|------|--------|--------|
| Performer | `TechnicalCardStageResult.performer_name` | Same stage-fact surface as Дизайн |
| Work done | `TechnicalCardStageResult.work_done` | Free text (что сделано на участке) |
| Duration | `TechnicalCardStageResult.duration_seconds` | Integer seconds ≥ 0 |

Rules:

- Shop module opens existing TC with `?stage=sewing`; does not create a parallel document.
- Stage fact writes may carry `shop_stage_code=sewing` and are accepted only when the card’s **current** routing step is Пошив (`11.7.4` bind; evidence `test_shop_sewing_11_7.py`).
- UI opens TC with `?stage=sewing` and disables fact/actions unless `current_stage` maps to Пошив.
- **No** MATERIAL hard complete-gate for Пошив in MVP (gate remains Раскрой/Печать only — `9.3.4`).
- **No** required WorkCenter / TechOperation volume fields for Пошив MVP (those stay Печать `11.6`).
- AssemblyVariant sewing-operation snapshot lines on the TC remain the **cost/plan contour** (Stage 6 / generate); they are not the shop-floor fact write surface for `11.7`.
- **Amend `2026-08-24` (Stage `24` / ADR-029):** multi-sewer **work ledger** (take/reserve/complete, piece vs sewing-op qty, price snapshot) is a **separate** SoT from this stage-fact table. Do not store assignments in `performer_name`. Shop module `11.7` stays.

### 6.5 Stage 11.10 Упаковка domain (`2026-07-29`)

Field inventory for цех **Упаковка** (`packaging`) — no new tables/columns; reuses TC stage result fact surface from `11.4` (same as Пошив / ВТО):

| Fact | Where | Notes |
|------|--------|--------|
| Performer | `TechnicalCardStageResult.performer_name` | Same stage-fact surface as Дизайн |
| Work done | `TechnicalCardStageResult.work_done` | Free text (что упаковано / комплект) |
| Duration | `TechnicalCardStageResult.duration_seconds` | Integer seconds ≥ 0 |

Rules:

- Shop module opens existing TC with `?stage=packaging`; does not create a parallel document.
- Stage fact writes may carry `shop_stage_code=packaging` and are accepted only when the card’s **current** routing step is Упаковка (`11.10.4` bind).
- UI opens TC with `?stage=packaging` and disables fact/actions unless `current_stage` maps to Упаковка.
- **No** MATERIAL hard complete-gate for Упаковка in MVP (gate remains Раскрой/Печать only — `9.3.4`).
- **No** required WorkCenter / TechOperation volume / QC scrap fields for Упаковка MVP (WorkCenter stays Печать `11.6`; scrap/rework stay ОТК `11.9`).

### 6.x Stage 11.1.2 WorkCenter planning (`2026-07-30`)

| Concern | Rule |
|---------|------|
| Master | `WorkCenter` (ADR-017) — оборудование / место; optional `production_stage_id`; **≠** цех |
| Planned on TC | `TechnicalCardStageResult.work_center_id` — snapshot from `ShopRoutingStageLine.work_center_id` on apply/generate; editable on TC |
| Fact | Same field via `PATCH …/stages/{order}/fact` (Печать UI already); no second WC column |
| ProductionOrder / Batch | **No** WorkCenter FK in MVP (ADR-018) |
| Settings | Dedicated WorkCenter catalog under Производство (`11.1.2.3`); routing step still may pick default WC |

### 6.y Stage 11.2.2 FG warehouse stages (`2026-07-30`)

| Concern | Rule |
|---------|------|
| Stages | `ready_to_ship` («Готовы к отгрузке»), `shipped` («Отгружены») after Упаковка — ADR-019 |
| Stock SoT | Warehouse ledger / StockDocument — **not** on TC header |
| Receipt qty | MVP: `TC.quantity − Σ scrap_qty` (QC). **Amend `2026-08-24` (Stage `25` / ADR-030):** post qty = unit lines arriving at the FG stage, not the whole card; multiple FG docs per TC allowed |
| Complete | `ready_to_ship` posts FG receipt; `shipped` posts FG issue (wire in `11.2.2.4` / `12.3`) |

### 7. Сущности (логический контур → `9.1.2` / `9.3.3`)

Без фиксации имён таблиц (миграция в `9.1.2`):

1. **TechnicalCard** — header (order, order item, number `{orderNo}-{cardSeq}`, status, current stage, timestamps)  
2. **Composition / planned lines** — material/pattern/note rows (**SoT** на ТК; MATERIAL: `production_stage_id`, `planned_qty`, `fact_qty`; later питают Spec)  
3. **TechnicalCardUnitLine** — N строк характеристик  
4. **TechnicalCardOperationLine** — строки тех операций: snapshot name/unit, `volume` Decimal/Numeric, stage order/binding  
5. **TechnicalCardStageResult** — факт прохождения участков (`performer_name`, `work_done`, `duration_seconds`, scrap/rework, timestamps)  

Derived/read-model only:

- **Aggregate personalization import row** — `size_type`, `size`, `personalization`, `print_number`, `quantity`, `notes`; validated then expanded into `TechnicalCardUnitLine`
- **Technical card history view** — derived timeline from card lifecycle timestamps and stage results; no separate Stage 18 journal entity introduced by this ADR

API не отдаёт ORM; деньги/нормы/объёмы — `Decimal`/`Numeric`; даты — timezone-aware.

## Последствия

- Generate (`9.2.1`) создаёт ровно одну карту на eligible line; numbering `{orderNo}-{cardSeq}`; **не** требует Spec.
- Frontend list/document следует `SL-TECH-CARDS-UI-v1` (блок «Операции / объёмы»); order host — gap `#4` / `9.4.1`; block «История» активный и сворачиваемый по умолчанию.
- Settings `9.6` настраивают eligible set / unit-line fields / numbering template / stage-label binding policy; **не** дублируют редактор TechOperation / routing / production stages (каталоги — Stage 8).
- Stage `11.3` shared shop platform opens existing TCs by current `ProductionStage`; fact entry writes onto TC stage results / MATERIAL rows, not into a second shop document.
- Stage `11.5` Раскрой: stage fact (`performer` / `work_done` / `duration`) + MATERIAL `fact_qty` for cutting-bound lines; hard complete-gate unchanged from `9.3.4`.
- Stage `11.6` Печать: adds `work_center_id` on stage result + op-volume fact on routing lines bound to Печать; MATERIAL hard-gate unchanged.
- Stage `11.1.2` WorkCenter planning: planned equipment is the same `TechnicalCardStageResult.work_center_id` field (routing snapshot + editable); not stored on ProductionOrder/Batch; Settings catalog CRUD for `WorkCenter` master.
- Stage `11.7` Пошив: stage fact only (`performer` / `work_done` / `duration`); no material gate; sewing-op snapshots stay cost contour, not shop fact.
- Stage `11.10` Упаковка: stage fact only (`performer` / `work_done` / `duration`); no material gate; no WorkCenter/QC scrap fields in MVP.
- **Stage 25 / ADR-030:** split WIP lives on unit-line location; FG auto-post qty follows arriving units (`12.3.2` amend).
- ADR-004: «технология» = заполненная ТК + snapshot маршрута; Spec — сводный отчёт план+факт по партии, опирается на ТК и факт, не предшествует create ТК.
- **Stage 19 / ADR-026:** document UI may show the order’s internal staff collaboration thread filtered by optional `technical_card_id`. ТК is **context**, not a second chat store; messages live on the order thread. Contour B: same domain, thread on `order_group_id` (`28.5.4`).
- **Stage 28:** second entry path B + live display `/{N}` + soft planned count. Shop / QR / FG stay on the TechnicalCard (null-order-safe in `28.4`).

## Ограничения / вне scope ADR

- Реализация таблиц/API/UI  
- Полный enum переходов и scrap/rework (`9.2.2`)  
- Партии Stage 11, обмен 1С  
- Auth/roles для stage actions (`17.1`)  
- Реализация печатного шаблона 2×A4 (`18.3.8`)  
- Internal staff chat persistence (Stage `19` / ADR-026)

## Evidence

- Roadmap: `9.1.1.1`–`9.1.1.5`; amend Excel/print align; Spec↔ТК fix; `8.1.3`; `9.3.3`; `18.3.8`
- Task: `docs/tasks/v0.9.0-stage-9.1.1-tech-card-adr-016.md`
- Amend task: `docs/tasks/v0.9.0-tech-card-excel-roadmap-align.md`
- Spec↔ТК fix: `docs/tasks/v0.9.0-stage-8-spec-tc-dependency-fix.md`
- DB core `9.1.2`: `backend/app/models/technical_card.py`, migration `k2l3m4n5o678`, schemas + `tests/test_technical_cards_9_1_2.py`; task `docs/tasks/v0.9.0-stage-9.1.2-tech-card-db-core.md`
