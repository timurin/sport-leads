# Sport-Lead — Канонический ERP-check

**Код:** `SL-ERP-CHECK-v1`  
**Физический источник истины:** `docs/architecture/erp-check.md`  
**Структура:** [project-structure.md](project-structure.md)  
**Roadmap:** [roadmap.md](../roadmap/roadmap.md)

## Легенда

- `[x]` готово и подтверждено соответствующим слоем;
- `[~]` частично, local/demo или неполный backend-контур;
- `[ ]` не начато;
- `[!]` блокер или технический долг;
- `[?]` требует ручной проверки.

## CRM и продажи

- `[x]` `Lead`, `LeadContact`, `Client`, `LeadEvent`, `SalesUser` и их миграции;
- `[x]` создание лида, contact CRUD, стадии, частичное редактирование, конвертация, отказ и история;
- `[~]` список/Kanban, задачи, заметки, timeline и коммуникации частично local/demo;
- `[~]` `Deal`, архивирование, полные активности, авторизация и права не завершены;
- `[x]` `Organization` и связь `SalesOrder.organization_id`;
- `[x]` `SalesOrder` list/detail, status workflow и history;
- `[x]` `SalesOrderItem` CRUD, snapshot-наименование, размеры (`size_range`), персонализация (`personalization`) и пересчёт суммы заказа через `Decimal/Numeric`; focused tests, TypeScript, lint, offline production build и Alembic проходят;
- `[!]` прежняя связь `SalesOrderItem → Material` была архитектурной ошибкой и удалена отдельным patch; `Material` не является номенклатурой заказа.

**Evidence:** `backend/app/models/sales.py`, `backend/app/api/leads.py`, `backend/app/api/orders.py`, `backend/app/api/organizations.py`, `backend/app/services/lead_conversion.py`, `backend/app/services/sales_order_items.py`, `backend/app/schemas/sales.py`, `backend/alembic/versions/e0f1a2b3c456_add_order_item_dimensions_and_personalization.py`, `backend/tests/test_lead_conversion.py`, `frontend/components/sales/sales-order-items.tsx`, `frontend/app/(workspace)/sales/orders/[orderId]/order-item-actions.ts`, `frontend/lib/sales/order-details.ts`, `frontend/lib/sales/order-details.test.mjs`.

## Номенклатура и продукция

- `[ ]` единая номенклатура готовых изделий, услуг, полуфабрикатов и комплектов;
- `[ ]` модели и артикулы;
- `[ ]` размеры, характеристики, варианты и изображения;
- `[ ]` лекала и версии;
- `[~]` отдельный `Material` catalog/API существует, но frontend catalog остаётся demo-only и не является номенклатурой.

## Технологическая подготовка

- `[ ]` операционные узлы;
- `[ ]` технологические операции;
- `[ ]` нормативы модели и времени;
- `[ ]` подготовка и версионирование спецификации;
- `[ ]` запрет запуска без утверждённой версии.

## Производство

- `[ ]` production batches;
- `[ ]` batch specification formation and version approval;
- `[ ]` printing, cutting, sewing and QC;
- `[ ]` actual consumption, operations, output, scrap, performers and deviations.

Цепочка: партия → утверждённая спецификация → печать → раскрой → пошив → ОТК → фактический расход → выпуск. Спецификация — плановый состав, производственный факт — отдельный контур.

## Ресурсы, склад, закупки и финансы

- `[~]` `Material` хранит остаток и минимальный остаток, но нет регистра движений;
- `[ ]` единицы измерения как единый справочник, склады, зоны, резервы, партии и инвентаризация;
- `[ ]` фактическое списание и выпуск;
- `[ ]` закупки, поставщики и заказы поставщикам;
- `[ ]` оплаты, себестоимость, маржа, задолженность и финансовые документы.

## Интеграции

- `[x]` collectors/parsers и mock communication connector core;
- `[~]` реальные внешние CRM/communication adapters;
- `[ ]` обмен с 1С: номенклатуры, заказы, утверждённые спецификации, списание материалов, операции, выпуск и связанные документы.

## Правило подтверждения

`[x]` ставится только при наличии реализации на соответствующем слое и успешных применимых проверок. HTML-файлы в `docs/erp/status/` не являются источником истины.
