# ADR-031 — Specification as batch plan+fact report

**Status:** принято (`2026-08-25`)  
**Date:** `2026-08-25`  
**Roadmap:** Stage 7 (`7.1.1` contract; `7.2` API+UI; stop at owner visual `7.2.2.6`)  
**Amends:** ADR-004 (version lifecycle); ADR-016 (soft `specification_version_id` becomes real FK in `7.1.2`); ADR-018 (Spec parent = `ProductionBatch`)  
**Depends on:** ADR-004, ADR-014, ADR-016, ADR-018, ADR-019, ADR-029  
**Evidence:** `docs/tasks/v1.00-stage-7-specifications.md` (`SL-SPEC-DOCUMENT-v1`)

## Контекст

ADR-004 уже зафиксировал роль: спецификация — **документ-отчёт план+факт** по выпуску партии для 1С, не модуль и не SoT состава. Stage 9/11/24/25 уже пишут план и факт на техкарте. Stage `7.1.1` должен зафиксировать сущности, lifecycle версий, scope строк и copy/read — без БД в этом срезе.

Нельзя: сделать Spec prerequisite generate ТК или запуска партии; live-редактировать мастер модели из формы Spec; плодить реестр «Документы» как контур на тип; второй SoT материалов/операций рядом с ТК.

## Решение

### 1. Сущности (`7.1.1.1`)

| Сущность | Роль |
|----------|------|
| **Specification** | Шапка документа. **1:1** с `ProductionBatch` (`UNIQUE production_batch_id`). Живёт у родителя-партии, не в отдельном модуле. |
| **SpecificationVersion** | Версия отчёта (`version_no` ≥ 1, unique внутри шапки). Строки принадлежат версии. |
| **SpecificationProductLine** | Блок «что продали»: snapshot PRODUCT/order-item / ТК в партии. |
| **SpecificationMaterialLine** | Блок материалов: план + факт расхода. |
| **SpecificationOperationLine** | Блок операций: план объёма + факт объёма / время / исполнитель. |

Кардинальность:

```
ProductionBatch 1 ─── 1 Specification
Specification 1 ─── N SpecificationVersion
SpecificationVersion 1 ─── N product / material / operation lines
```

Денормализация на шапке (read, не второй SoT): `sales_order_id`, `production_order_id`. Связанные ТК = links партии (`ProductionBatchCardLink`), не отдельная M:N на Spec.

Нумерация (default): `{productionBatchNumber}-SPEC`. Версия в UI как `v{n}`, не отдельный номер документа.

**Родитель только партия.** ТК вне партии в MVP не получает Spec: сначала link в batch. Не создавать авто-партию из Stage 7.

### 2. Lifecycle версий

| Status | Смысл |
|--------|--------|
| `draft` | Черновик. Можно refresh план и факт. Не более **одной** `draft` на шапку. |
| `approved` | Финальный отчёт. Строки **иммутабельны**. Это кандидат в 1С (Stage **`27`**). |
| `superseded` | Бывшая `approved`, когда утвердили более новую версию. |
| `cancelled` | Снятый черновик. Строки не правят. |

Создание: партия с ≥1 linked TC → шапка (если нет) + `v1` `draft`. Refresh на `draft`: переснять план с ТК партии и факт с исполнения.

**Approve:** все linked TC в terminal (`completed` / `cancelled`). Иначе 422. Cancelled TC входят в отчёт со статусом cancelled.

После approve: правки ТК / модели / каталога **не** переписывают версию. Новая версия = создать `draft` `v{n+1}` копией + refresh; прежняя `approved` → `superseded` в момент approve новой.

Поля формы **не** свободный ввод. Elevated rights (те же, что правка производственного заказа / admin / technologist) могут править черновик только через refresh + явные override-поля, если они появятся в `7.2` — не в контракте MVP. MVP = snapshot/read.

**Не gate запуска.** Партия и ТК **не** ждут утверждённой Spec. Пункт erp-check «запрет запуска без Spec» **не применяется** (устаревшая модель Spec-как-BOM).

### 3. Материалы / нормы / замены (`7.1.1.2`)

Источник плана и факта — **состав ТК** (`TechnicalCardCompositionLine`), не live `Nomenclature` / нормы модели `6.1.17`.

| Scope | Правило MVP |
|-------|-------------|
| Материалы | Только `line_kind = material`. Snapshot: `nomenclature_id`, имя, unit, `production_stage_id`, `planned_qty`, `fact_qty`. Агрегация по партии: сумма qty одноимённых строк (ключ: nomenclature + unit + цех). |
| Accessory | Отдельного типа номенклатуры нет (`MATERIAL` / `PRODUCT` / `GOODS` / `SERVICE`). Фурнитура = те же material-строки. |
| Норма | `planned_qty` на ТК уже норма/план. Spec не читает мастер модели. |
| Замены | На ТК нет сущности substitute. **Нет** таблицы замен в Spec MVP. Факт = `fact_qty` той же material-строки (цех Раскрой/Печать, gate `9.3.4`). |
| PATTERN / NOTE | Не в блоке материалов. |
| Складской регистр | Не второй SoT расхода в Spec. Списания регистра — Stage 12; в отчёт MVP не тянем. |

### 4. Copy / read (`7.1.1.3`)

Spec **копирует / читает**, не live-edit мастера.

| Блок | План | Факт |
|------|------|------|
| Что продали | Snapshot ТК / order-item: nomenclature PRODUCT, модель, вариант сборки, qty карты | — (коммерция не факт цеха) |
| Сборка | `assembly_variant_*` и sewing op lines с ТК (уже snapshot с order-item / ADR-014), **не** live `AssemblyVariant` | — |
| Операции routing | `TechnicalCardOperationLine` `source_kind=routing`: `volume` = план | Если цех stage result `completed` — fact volume = план; иначе 0. Время / исполнитель с `TechnicalCardStageResult` (`duration_seconds`, `performer_name`) |
| Операции пошива | `source_kind=sewing`: `volume` = план | Σ `qty` completed строк журнала Stage 24 по этой ТК + `sewing_operation_id`. Время/кто — агрегация completed ledger / stage result Пошив; **не** зарплата кабинета |
| Кто / время | — | Stage results по цехам linked TC; при нескольких картах — строки по ТК или сумма duration, имена через запятую (деталь `7.2`) |

`11.2.1` roll-up и склад ГП **не** заменяют блоки Spec; это соседние контуры. Spec может показать ссылки на заказ / ТК / партию.

После `approved`: тест `7.2.3.6` — правка ТК/модели не меняет frozen lines.

Soft stamp на ТК: `specification_version_id` — FK на `specification_versions.id` + label (`7.1.2.1`); проставлять при approve (обратная связь, не gate generate).

### 5. Документы (`7.1.1.4`)

Раздел **Документы** = поздний **индекс ссылок** на документы в родителях (ADR-004). Stage 7 **не** строит `/sales/documents` и **не** плодит контур на тип.

Хосты реализации (`7.2.2`):

| Surface | Роль |
|---------|------|
| Карточка партии `/production/orders/…` | Родительский хост Spec |
| Interim list `/production/specifications` | Список документов до индекса Документы; потом фильтр реестра, не второй SoT |

DS-SHELL-01/02 не менять.

### 6. Права и 1С

Новые permission codes в `7.1.1` **не** вводятся. Read Spec = read партии. Approve / refresh draft = write партии (уточнение кодов — `7.2.1`, без новой роли).

Выгрузка в 1С — Stage **`27`**, не этот срез. Контракт: в 1С уходит **последняя `approved`** версия. Inbound `16.2.1` припаркован.

## Последствия

- `7.1.2.1`–`7.1.2.2` добавляют таблицы + Alembic `e4f5a6b7c890`. Schemas/tests DTO — `7.1.2.3`.
- Generate ТК и release партии остаются независимы от Spec.
- Кабинет швеи и скан QR не пишут в Spec; Spec читает их SoT при refresh.

## Ограничения

Нет UI/API/DB в `7.1.1`. Нет substitute-строк. Нет Documents registry. Нет автосоздания партии. Нет cost/money блоков (это Stage 15).
