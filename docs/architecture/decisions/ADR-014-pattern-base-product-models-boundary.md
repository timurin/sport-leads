# ADR-014 — Pattern-base boundary: product models, size grids, sewing operations, assembly variants

**Status:** принято (с поправкой `2026-07-22`: `PatternSet` / «Лекала» заменены на плоский справочник `SewingOperation`; **amended `2026-08-28` / `26.10.1`:** catalog slim, economics on `AssemblyOperationLine`)  
**Date:** `2026-07-22`  
**Roadmap:** Stage 6 § `6.0.1` / `6.3`  
**Depends on:** ADR-004, ADR-006, ADR-010, ADR-012

## Контекст

Нужна единая граница «Базы лекал» для лидов, заказа покупателя, спецификации и технической карты. Нельзя смешивать:

- коммерческий вариант номенклатуры (цвет / принт, ADR-010);
- конструкторскую модель изделия (артикул + тип размера);
- плоский справочник операций пошива (наименование + описание; без стоимости);
- менеджерский пакет сборки/отделки с стоимостью операций **на строках варианта**;
- цеховой маршрут исполнения (Stage 8).

Согласованная бизнес-модель: плоская карточка модели без вложенных контуров «М/Ж/Д» внутри одной записи; whitelist моделей на PRODUCT-номенклатуре; варианты сборки живут на модели и копируются в спецификацию.

**Поправка:** отдельный каталог комплектов лекал (`PatternSet`, файлы, версии, 1:1 model→pattern) **снят** с Stage 6 как неактуальный. Вместо пункта меню «Лекала» — справочник **«Операции пошива»**.

## Решение

### 1. Термины и сущности

| Сущность | Роль | Master of truth |
|----------|------|-----------------|
| **ProductModel** | Справочник модели изделия: то, что выбирают в лиде / заказе / ТК / спецификации | Stage 6 (`6.1`) |
| **SizeGrid** | Размерная сетка модели (размеры внутри одного `size_type`) | Stage 6 (`6.2`) |
| **SewingOperation** | Листовая операция пошива: `name` + `description` (≤256) + папка + оборудование; **без** cost/qty/time | Stage 6 (`6.3`); slim `26.10` |
| **SewingOperationFolder** | Навигационные папки parent/child для каталога операций (`6.3.11`) | Stage 6 (`6.3.11`) |
| **AssemblyVariant** | Именованный пакет сборки/отделки модели («С отстрочкой», …) | Stage 6 (`6.1.12`) |
| **AssemblyOperationLine** | Упорядоченная строка варианта: операция + **SoT** cost / qty / duration | Stage 6 (`6.1.12`); economics `26.10` |
| **ProductModelRoutingLink** | Whitelist модели ↔ существующий `ShopRoutingTemplate` (ordered; no clone) | Stage 6 (`6.1.17`); тело маршрута = Stage 8 |
| **ProductModelOperationNorm** | Plan hint: `norm_qty_per_item` + unit на link+цех/op | Stage 6 (`6.1.17`); факт qty — ТК / Stage 11 |
| **NomenclatureVariant** | Коммерческий SKU (характеристики) | ADR-010 — **не** модель лекал |
| **ShopRouting / work center** | Цеховой маршрут исполнения (master шаблонов) | Stage 8 — **не** менеджерский пакет сборки |

**Плоское правило:** `1 ProductModel = 1 size_type (men \| women \| kids) = 1 article`.

«Футболка 213 женская» — **другая** `ProductModel` (другой артикул и/или другой `size_type`), а не ветка внутри мужской 213.

Связи:

- `ProductModel` → ровно одна `SizeGrid` (целевая после `6.2.7`, согласованная с `size_type`);
- `SewingOperation` — **глобальный** плоский каталог (не 1:1 с моделью);
- ~~`ProductModel` → `PatternSet`~~ — **отменено**.
- **Amend `2026-07-27`:** `ProductModel` → N `ShopRoutingTemplate` via whitelist links (`6.1.17`); `default_routing_template_id` ∈ whitelist when set. **Operation material norms** live on model+routing (+ stage/op) as plan hints — not a second routing master and not Stage 6 assembly cost lines.

`AssemblyVariant[]` принадлежит модели (1:N). Итог варианта = Σ `AssemblyOperationLine.cost` (`Decimal` / `Numeric`).

### 2. Что не является друг другом

| Понятие | Не путать с |
|---------|-------------|
| `ProductModel.article` | коммерческий артикул **модели лекал** (не поле номенклатуры; `Nomenclature.article` удалён `4.7.11`) |
| `AssemblyVariant` | `NomenclatureVariant` (ADR-010) |
| `AssemblyOperationLine` (менеджерский пакет) | Stage 8 shop routing / work centers / факт пошива |
| `SewingOperation` | Строка варианта (MVP inline) или цеховая операция Stage 8 |
| `ProductModelRoutingLink` / norms | Clone of `ShopRoutingTemplate` stage lines; hard BOM×qty; TC `fact_qty` |

Параллельных master-справочников для модели / вариантов сборки не создаём. `SewingOperation` — единственный shared catalog операций пошива в Stage 6. Маршруты — единственный master в Stage 8; модель только whitelist + plan hints.

### 3. PRODUCT «модели изделий» (whitelist)

На карточке номенклатуры с типом **`PRODUCT`** хранится whitelist моделей:

```
nomenclature_product_models
  nomenclature_id
  product_model_id
  sort_order
  UNIQUE(nomenclature_id, product_model_id)
```

Правила:

1. Связь допустима **только** при `nomenclature_type == PRODUCT`. Для `SERVICE` / `GOODS` / `MATERIAL` — запрет API.
2. Направление UI: список правится на карточке номенклатуры (не «модель выбирает номенклатуру»).
3. Одна `ProductModel` **может** входить в whitelist нескольких PRODUCT (M2M без глобальной уникальности модели).
4. Модель остаётся самостоятельным справочником «База лекал»; номенклатура только сужает выбор.
5. На PRODUCT задаётся nullable `product_type_id` (**Вид изделия**, справочник `ProductType`). Добавление модели в whitelist требует выбранного вида изделия; `ProductModel.product_type_id` должен совпадать. Без вида изделия — API отклоняет POST. Смена/очистка вида изделия или уход с PRODUCT очищает whitelist.

### 4. Цепочка выбора в позиции заказа

```
Nomenclature (PRODUCT)
  → ProductModel ∈ available-models whitelist
      → autofill: size_type, model article
      → AssemblyVariant ∈ variants of that model
      → ShopRoutingTemplate ∈ model routing whitelist (`6.1.17` / `3.2.7`)
```

Дальше (другие stages):

- **Stage 7:** при формировании спецификации **копируются** строки операций/стоимостей из snapshot выбранного `AssemblyVariant` позиции (не live-edit master модели).
- **Stage 8:** цеховые маршруты, участки, нормы времени исполнения — отдельный контур; не место заново изобретать менеджерские пакеты сборки. Master маршрутов глобальный; **допустимые пресеты модели** — whitelist `6.1.17`.
- **Stage 9:** техническая карта — **ADR-016** (принято `2026-07-26`); amend plan/fact materials `9.3.4` (`2026-07-27`). ADR-015 = unified characteristics.

`SalesOrderItem` хранит nullable связи + denormalized snapshot (как у номенклатуры/вариантов): model id/article/`size_type`; variant id/name/total; **routing id/name (`3.2.7`)**; при необходимости — снимок строк операций сборки. Правки справочника не переписывают старые заказы и уже сформированные спецификации.

`NomenclatureVariant` (цвет и т.п.) остаётся **отдельным** шагом выбора и не заменяет модель лекал.

### 5. Политика пустого whitelist (MVP)

| Состояние списка «доступные модели» у PRODUCT | Правило для `SalesOrderItem` |
|-----------------------------------------------|------------------------------|
| **Пуст** | `product_model_id` / `assembly_variant_id` **опциональны** (nullable). Заказ можно оформить до настройки базы лекал. |
| **Не пуст** | `product_model_id` **обязателен** и ∈ whitelist. `assembly_variant_id` обязателен, если у выбранной модели есть ≥1 активный вариант; иначе опционален до настройки вариантов. |
| Любое | Модель вне whitelist и вариант чужой модели **отклоняются API** (не только UI). |

**Amend `2026-07-27` (`3.2.7.1`):** политика whitelist маршрутов модели зеркалит варианты сборки — при ≥1 активном `ProductModelRoutingLink` поле `routing_template_id` **обязательно** и ∈ whitelist; чужой routing отклоняется. Детали снимка: `docs/architecture/order-item-model-assembly.md` §4.5 / §5.

Ручные позиции без номенклатуры остаются вне этого контура (как сейчас).

### 6. Строки операций варианта vs справочник операций пошива

**Справочник (`6.3` + `26.10`):** `SewingOperation` — листовой каталог (`name` unique, optional `description` ≤256, folder, equipment). **Не** хранит cost / qty / duration. UI: `/settings/catalogs/sewing_operations` — колонки Операция | Описание | Оборудование.

**Amend `2026-07-31` (`6.3.10`):** optional M:N link to sewing-shop `WorkCenter` (цех Пошив / `code=sewing`) for catalog compatibility. Does **not** replace Stage 8 routing / TC planned equipment (`11.1.2`). Domain: `sewing-operations-domain.md`.

**Amend `2026-08-02` (`6.3.11`):** `SewingOperationFolder` parent/child tree for catalog navigation; ops have nullable `folder_id` + sibling `sort_order`. Folders are **not** assembly snapshot targets; pick/apply remain leaf-only. Domain: `sewing-operations-domain.md` §2.2 / §3.

**Amend `2026-08-02` (`6.3.12`):** `SewingOperationTemplate` library — ordered refs to leaf sewing ops (no cost snapshot on template lines). Apply to assembly variant is `6.3.13`. Not Stage 8 `TechOperation`. Domain: `sewing-operations-domain.md` §2.3.

**Вариант сборки (`6.1.12` + `6.3.6` + `26.10`):** группа выбранных операций пошива. `AssemblyOperationLine` — **SoT** economics (`cost`, `quantity_per_item`, `duration_seconds`); editable on the model card (`PATCH …/operation-lines/{id}`). Create/add — copy-on-pick: snapshot `operation_name` + nullable `sewing_operation_id`; economics defaults `0` / `1` / `0` (`26.10.5`). Existing lines keep stored values (no mass backfill). Итог варианта = Σ (`cost × quantity_per_item`). Правки каталога не переписывают уже сохранённые варианты / заказы.

**Amend `2026-08-28` (`26.10.1`):** catalog vs assembly economics boundary locked (`SL-SEWING-OPS-ECONOMICS-v1`). Schema/UI shipped `26.10.2`–`26.10.7`; checkpoint `26.10.8`. Sewing cabinet price: ADR-029. Domain: `sewing-operations-domain.md` §2.1 / §4.

Стоимость варианта всегда считается как сумма строк в money-safe типах (`Decimal` / `Numeric`).

## Границы реализации

Реализация — пункты roadmap `6.0.2+`, `6.1.*`, `6.2.*`, `6.3.*`, `6.4.*`, затем Stage 7/8/9.

Вне Stage 6: склад, закупки, НДС, 1С, факт производства, файлы комплектов лекал.

## Последствия

- Settings: модели / размерные сетки / **операции пошива** (`6.0.2`, поправка nav `2026-07-22`).
- Карточка PRODUCT получает блок «Доступные модели лекал» (`6.1.11`).
- Карточка модели получает блок вариантов сборки (`6.1.12`).
- **Amend `2026-07-27`:** карточка модели получает блок whitelist маршрутов + нормы операций (`6.1.17`); заказ выбирает routing (`3.2.7`).
- Stage 8 не дублирует менеджерские assembly packages.
- Планируемый ADR технических карт — **ADR-016** (принято `2026-07-26`; ADR-015 = unified characteristics catalog).

**Связанные решения:** ADR-004, ADR-006, ADR-010, ADR-012.  
**Evidence:** `docs/architecture/sewing-operations-domain.md` (`6.3.1`, amend `26.10.1`); `docs/architecture/product-model-domain.md` §7 (`6.1.17.1`); `docs/roadmap/roadmap-v1.00.md` § `26.10` / `6.3` / `6.1.17`.
