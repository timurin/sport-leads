# ADR-016 — Technical card domain boundary

**Status:** принято (`2026-07-26`); amend numbering + TechOperation / op-volume lines (`2026-07-26`); amend Spec↔ТК dependency (`2026-07-26`); amend Spec = план+факт report (`2026-07-26`)  
**Date:** `2026-07-26`  
**Roadmap:** Stage 9 § `9.1.1` (+ Stage `8.1.3` TechOperation catalog; Stage `9.3.3` volume lines)  
**Depends on:** ADR-004, ADR-003, ADR-012, ADR-014 (ADR-017 for shop routing)  
**UI chrome:** `docs/tasks/v0.9.0-stage-9.0.3-tech-cards-ui-contract.md` (`SL-TECH-CARDS-UI-v1`)  
**Order link plan:** `docs/architecture/order-card-field-links.md` § Gap `#4`  
**Spec↔ТК fix:** `docs/tasks/v0.9.0-stage-8-spec-tc-dependency-fix.md`  
**Spec document role:** `docs/tasks/v0.9.0-spec-document-and-documents-registry.md`

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

- `orderNo` — номер заказа покупателя;
- `cardSeq` — порядковый номер ТК **внутри заказа** (1…N среди сформированных карт этого заказа), стабильный после создания;
- разделитель **дефис** (`-`), согласован с печатным шаблоном Excel «НомерЗаказа-НомерТехкарты»;
- шаблон строки может уточняться в настройках `9.6`, default остаётся hyphen.

UNIQUE: не более одной ТК на один `sales_order_item_id` (когда карта создана).

### 2. Unit lines — поштучная матрица (`9.1.1.2`)

Внутри одной ТК хранится таблица **unit lines**:

- число строк **N = quantity** позиции заказа на момент синхронизации (`9.2.1.2`);
- каждая строка = одна физическая единица с полями характеристик (MVP-набор): размер, персонализация (фамилия и т.п.), номер печати / игровой номер, прочие поля из настроек `9.6`;
- defaults при генерации: из snapshot позиции заказа (`size_range`, `personalization`, `color`, …) с возможностью per-row правки;
- **не** создаём N отдельных `TechnicalCard` при qty = N.

Изменение qty на заказе синхронизирует число unit lines (добавление/удаление незакрытых строк) — сервис `9.2.1.2`, не ручное размножение документов.

Печатная матрица размеров (агрегат по size type / size) — presentation в `18.3`, не отдельный SoT вместо unit lines.

### 3. Snapshot vs live link (`9.1.1.3`)

Политика как у коммерческих snapshot на заказе (ADR-003 / ADR-014): сформированная ТК **не** переписывается правками master-справочников.

| Связь | На ТК | Политика |
|-------|-------|----------|
| `SalesOrder` / `SalesOrderItem` | live FK | Идентичность документа; qty sync по правилам сервиса |
| Номенклатура | id + snapshot name/type | Snapshot при generate; live id для навигации |
| ProductModel | id + snapshot article/name/`size_type` | Копия из order-item snapshot (или catalog на generate); master не ретроактивен |
| AssemblyVariant + sewing operation lines | id + name/total + operation snapshots | Из order-item assembly snapshots (cost contour Stage 6) |
| Материалы / лекала / нормы | planned **composition** rows on card | SoT состава на order-line; редактируются на ТК; не второй складской каталог (ADR-012) |
| Спецификация (Stage 7) | optional soft `specification_version_id` + label | **Не** источник generate. Spec = сводный отчёт (план из ТК + факт исполнения) для партии / 1С. Soft-ref на карте — обратная связь после Stage 7, не hard gate |
| Shop routing template (Stage 8) | template id + ordered stage plan snapshot | Снимок маршрута на generate; исполнение пишет **stage results** на карте |
| TechOperation volume lines | operation id + name/unit snapshot + volume Decimal + stage binding | Prefill from routing/`8.1.3` on generate (`9.3.3`); manager may edit volumes; catalog edits do not live-merge |
| Design mockup (Stage 10) | optional asset / file link | Не блокирует generate; экран и Side 1 печати показывают когда есть |

**Live** допускаются только: статус/участок исполнения, unit-line edits, composition edits (до правил `9.2.2`), op-volume edits, stage results, ссылки навигации.  
**Не** live-merge: цены справочника пошива, шаги routing template / TechOperation master после generate; утверждённая Spec version не переписывает открытую ТК без явного действия.

Stage 7 **не** блокирует generate / Stage 8 / `9.2.2`. До готовности Stage 8 карта может существовать с пустым маршрутом / op-volume (UI contract) — без demo-данных.

### 4. Статусы и готовность заказа (`9.1.1.4`)

Детальная state machine — `9.2.2`. Для домена:

- у ТК есть жизненный цикл до **terminal** (завершена / отменена — точные enum в `9.2.2`);
- **order manufacturing completeness:** заказ считается производственно полным по ТК, когда:
  1. для **каждой** eligible строки существует ТК; **и**
  2. **все** ТК заказа в terminal-состоянии «завершена» (отменённые карты и не-eligible строки не блокируют, если бизнес-правило `9.2.2` так зафиксирует; MVP: отсутствующая карта на eligible line = **не** complete).

Коммерческий `SalesOrder.status` и stage rail заказа **не** заменяются статусом ТК. Интеграция с production-complete gates — `9.5.1` (READY/SHIPPED/COMPLETED требуют manufacturing completeness; helper для будущих reserve/ship docs `3.4.2`).

Stage gates: этапы идут в жёсткой последовательности snapshot-маршрута; нельзя начать следующий участок, пока предыдущий не complete (`9.2.2.2`). Строки объёмов операций **отображают** плановый объём на этапе, но **не** обходят gate.

### 5. Границы с соседними stage

| Контур | Роль относительно ТК |
|--------|----------------------|
| Stage 3 order item | Источник eligibility, snapshots, qty |
| Stage 6 SewingOperation | Коммерческий cost-каталог пошива; **не** цеховые объёмы |
| Stage 7 Specification | Документ-отчёт план+факт (из ТК + исполнения) → 1С; **не** hard dep generate; живёт у родителя, в «Документы» — только ссылка |
| Stage 8 Shop routing | Шаблон участков → snapshot plan; факт шагов на ТК |
| Stage 8 TechOperation (`8.1.3`) | Цеховой каталог операций с `volume_unit` (`linear_meters` \| `pieces`); seed: сублимация, термоперенос, пошив, ВТО, упаковка |
| Stage 9.3.3 op-volume lines | Snapshot строк объёмов на ТК |
| Stage 10 Design | Опциональный макет/визуал для карточки и Side 1 печати |
| Stage 11 Production batch | Может группировать/потреблять ТК; **не** меняет правило 1:1 line↔card |
| Stage 18.4 journal | Запись при реальном использовании модели в ТК/производстве |
| Stage 18.3 print forms | Печать ТК 2×A4 (Excel visual SoT): Side 1 шапка+макет+размерная матрица; Side 2 номенклатура+материалы+операции/объёмы; не SoT домена |

### 6. Сущности (логический контур → `9.1.2` / `9.3.3`)

Без фиксации имён таблиц (миграция в `9.1.2`):

1. **TechnicalCard** — header (order, order item, number `{orderNo}-{cardSeq}`, status, current stage, timestamps)  
2. **Composition / planned lines** — material/pattern/note rows (**SoT** на ТК; позже питают Spec)  
3. **TechnicalCardUnitLine** — N строк характеристик  
4. **TechnicalCardOperationLine** — строки тех операций: snapshot name/unit, `volume` Decimal/Numeric, stage order/binding  
5. **TechnicalCardStageResult** — факт прохождения участков  

API не отдаёт ORM; деньги/нормы/объёмы — `Decimal`/`Numeric`; даты — timezone-aware.

## Последствия

- Generate (`9.2.1`) создаёт ровно одну карту на eligible line; numbering `{orderNo}-{cardSeq}`; **не** требует Spec.
- Frontend list/document следует `SL-TECH-CARDS-UI-v1` (блок «Операции / объёмы»); order host — gap `#4` / `9.4.1`.
- Settings `9.6` настраивают eligible set / unit-line fields / numbering template; **не** дублируют редактор TechOperation / routing (каталоги — Stage 8).
- ADR-004: «технология» = заполненная ТК + snapshot маршрута; Spec — сводный отчёт план+факт по партии, опирается на ТК и факт, не предшествует create ТК.

## Ограничения / вне scope ADR

- Реализация таблиц/API/UI  
- Полный enum переходов и scrap/rework (`9.2.2`)  
- Партии Stage 11, обмен 1С  
- Auth/roles для stage actions (`17.1`)  
- Реализация печатного шаблона 2×A4 (`18.3.8`)

## Evidence

- Roadmap: `9.1.1.1`–`9.1.1.5`; amend Excel/print align; Spec↔ТК fix; `8.1.3`; `9.3.3`; `18.3.8`
- Task: `docs/tasks/v0.9.0-stage-9.1.1-tech-card-adr-016.md`
- Amend task: `docs/tasks/v0.9.0-tech-card-excel-roadmap-align.md`
- Spec↔ТК fix: `docs/tasks/v0.9.0-stage-8-spec-tc-dependency-fix.md`
- DB core `9.1.2`: `backend/app/models/technical_card.py`, migration `k2l3m4n5o678`, schemas + `tests/test_technical_cards_9_1_2.py`; task `docs/tasks/v0.9.0-stage-9.1.2-tech-card-db-core.md`
