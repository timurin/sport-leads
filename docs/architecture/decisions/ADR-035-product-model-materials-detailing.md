# ADR-035 — Product-model materials BOM + Detailing catalog

**Status:** принято (contract only; implementation owner-pull `26.13.2+`)  
**Date:** `2026-08-29`  
**Roadmap:** Stage `26.13` (`26.13.1`–`26.13.6`)  
**Contracts:** `SL-MODEL-MATERIALS-v1`, `SL-DETAILING-v1` — `docs/tasks/v1.00-stage-26.13-model-materials.md`  
**Amends:** ADR-014 (product model), ADR-016 (TC composition prefill SoT)

## Контекст

На карточке модели (`/settings/catalogs/product-models/[id]`) нет группы «Материалы». Состав ТК (`TechnicalCardCompositionLine`) префиллится из `TechOperation.required_materials` × норм модели, а не из BOM модели. Владелец требует:

1. Справочник **Деталировка** (`id`, наименование, применимость).
2. На модели — группа **Материалы** с табами Печать / Ткань / Раскрой / Фурнитура / Упаковка.
3. На ТК — префилл из BOM модели + chrome Редактировать / Отмена / Сохранить; факт = существующий `fact_qty`.

## Решение

### 1. Справочник «Деталировка» (`SL-DETAILING-v1`)

| Поле | Правило |
|------|---------|
| `id` | PK |
| `name` | уникальное наименование (нормализованный match при выборе) |
| `applicability_product_type_ids` | M2M на **Виды изделия** (`product_types`); деталь может быть применима к нескольким видам; list DTO: `applicability_product_types[{id,name}]` |

- Settings UI + nav (точный path в `26.13.2`).
- На вкладке **Ткань**: multi-select значений; match по `name`; если нет — **создать** с `applicability` = `product_type` текущей модели.

### 2. BOM материалов на модели (`SL-MODEL-MATERIALS-v1`)

Сущность строк (рабочее имя `ProductModelMaterialLine`):

| Tab (`kind`) | Цех (`production_stage.code`) | Колонки |
|--------------|-------------------------------|---------|
| `print` | `print` | `nomenclature_id` (MATERIAL), `planned_qty` |
| `fabric` | **`print` или `cutting`** (поле на строке) | MATERIAL, `planned_qty`, M2M Деталировка |
| `cutting` | `cutting` | MATERIAL, `planned_qty` |
| `hardware` | `sewing` | MATERIAL, Тип (CharacteristicOption), Цвет (CharacteristicOption), `planned_qty` |
| `packaging` | `packaging` | MATERIAL, `planned_qty` |

**Ткань (решено):** одно поле «Цех» на строке = Печать **или** Раскрой. Если ткань нужна в обоих цехах — **две строки** с разным `planned_qty`.

**Материал:** только pick из номенклатуры `MATERIAL` (как на ТК). Без свободного ввода / автосоздания номенклатуры.

**Упаковка:** один таб → цех `packaging` (отдельного таба ВТО нет).

**Фурнитура Тип/Цвет:** Select из `CharacteristicOption` (не свободный текст). Конкретные `CharacteristicDefinition` (code/kind) фиксируются в реализации `26.13.3`.

### 3. Prefill → ТК (amend ADR-016 § materials)

| Событие | Поведение |
|---------|-----------|
| Привязка / смена `product_model_id` на ТК | **Префилл** composition material lines из BOM модели (по `kind` → `production_stage_id`, snapshot name, `planned_qty`; ткань → выбранный цех; фурнитура → char snapshots в `notes` или расширенных полях later) |
| Сохранение BOM на модели | **Не** перезаписывает уже созданные ТК |
| После префилла | Менеджер правит вручную |

Chrome вкладки «Материалы» на ТК: по умолчанию view; иконки **Редактировать / Отмена / Сохранить** (как order-data / personalization). Колонка **Фактическое количество** = существующий `fact_qty` (RO менеджеру; пишет цех через текущий PATCH fact-qty).

Prefill из BOM модели становится **SoT норм** для менеджерского состава вместо (или вместо primary) sync из TechOp required materials — точная миграция поведения в `26.13.5` (TechOp path не удалять без явного owner visual / regression).

## Границы MVP `26.13`

| In | Out |
|----|-----|
| Detailing catalog + fabric multi + create-on-miss | Отдельный ВТО-таб материалов |
| Model Materials 5 tabs | Авто-перезапись ТК при каждом save BOM |
| Prefill on model bind/change | Свободный ввод материала |
| TC Edit/Cancel/Save + fact column UX | Новое поле факта (дубль `fact_qty`) |
| Characteristic options for hardware type/color | Новые справочники вне characteristics |

## Последствия

- Nav settings: пункт «Деталировка».
- Карточка модели: блок Materials (табы).
- ADR-016: prefill SoT сдвигается к model BOM.
- Реализация кода — только по «делай 26.13.N» (`26.13.2+`; `26.13.1` = этот контракт).

**Связанные:** ADR-012, ADR-014, ADR-016, ADR-017; Stage `9.3.4` / `9.3.5`.  
**Evidence:** task `v1.00-stage-26.13-model-materials.md`; plan Stage 26 model materials (owner Q&A `2026-08-29`).
