# Sport-Lead — Каноническая структура проекта

**Код:** `SL-PROJECT-STRUCTURE-v1`  
**Физический источник истины:** `docs/architecture/project-structure.md`  
**Связанные документы:** [roadmap](../roadmap/roadmap.md), [erp-check](erp-check.md)

## Архитектурный принцип

Система разделена на API, schemas, services, repositories (по мере появления), database models, frontend data layer и UI components. ORM-объекты не возвращаются напрямую из API; бизнес-правила находятся в services; денежные значения используют `Decimal/Numeric`; миграции обратимы.

## Модули

```text
backend/app/
├── api/             HTTP routes и response contracts
├── schemas/         Pydantic input/output contracts
├── services/        бизнес-правила и транзакционные workflows
├── models/          SQLAlchemy entities
├── collectors/      источники ingestion
├── parsers/         нормализация входных данных
└── communications/  connector contract и mock core
backend/alembic/     обратимые миграции
backend/tests/       API, service и regression tests
frontend/app/        Next.js routes и server actions
frontend/components/ переиспользуемый UI
frontend/lib/        frontend data layer, mapping и tests
docs/                канонические документы, ADR, процессы и статусы
```

## ERP-домены

### CRM и продажи

`Lead` → `LeadContact`/`Client` → `Organization` → `SalesOrder` → `SalesOrderItem`.

`SalesOrderItem` — коммерческая позиция: snapshot-наименование, размеры, персонализация, цвет, единица, количество, исходная цена, nullable процент скидки, вычисляемая сумма скидки и итоговая сумма строки. `Material` не является номенклатурой заказа. В текущем контуре `size_range`, `personalization`, `color` и `discount_percent` сохраняются как nullable snapshot-поля; `discount_amount` и `line_amount` рассчитываются service-слоем через Decimal/Numeric.

### Номенклатура и продукция

Будущий контур: `Nomenclature` → `Model/Article` → sizes/characteristics → patterns → variants. Номенклатура описывает готовое изделие, которое продаётся клиенту.

### Технологическая подготовка

Будущий контур: operation units → operations → model norms → batch specification preparation. Модель описывает конструкцию и нормативную технологию изделия.

### Материалы и ресурсы

`Material` — производственный ресурс для спецификаций, печати, раскроя, пошива и планового/фактического списания. Каталог материалов не подменяет каталог номенклатуры.

### Производство

Будущий контур: production batches → approved batch specifications → printing → cutting → sewing → QC → actual consumption/output.

Одна партия может объединять несколько позиций, а одна позиция может быть разделена между партиями.

### Склад, закупки и финансы

Склад отвечает за движения, остатки, резервы и списание; закупки — за дефицит и поставщиков; финансы — за оплаты, себестоимость, маржу и задолженность. Эти контуры ещё не образуют рабочий end-to-end процесс.

### Интеграции

Обмен с 1С должен передавать номенклатуры, заказы, утверждённые спецификации, списание материалов, операции, выпуск и связанные документы.

## Источники статуса

Статусы модулей подтверждаются кодом, API, миграциями и тестами. Наличие frontend-страницы или пункта навигации без persistence отмечается как `[~]`, а не `[x]`. Канонический фактический checklist находится в [erp-check.md](erp-check.md).
