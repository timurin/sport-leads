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
- `[x]` `SalesOrderItem` CRUD, snapshot-наименование, размеры (`size_range`), персонализация (`personalization`), цвет (`color`), процентная скидка (`discount_percent`), вычисляемая сумма скидки (`discount_amount`) и пересчёт `line_amount`/суммы заказа через `Decimal/Numeric`; полный pytest, frontend tests, TypeScript, lint, production build, project check 9/9 и Alembic проходят;
- `[!]` прежняя связь `SalesOrderItem → Material` была архитектурной ошибкой и удалена отдельным patch; `Material` не является номенклатурой заказа.

`Этап 2 закрыт в объёме MVP владельцем проекта.` За пределами этапа остаются НДС и налоговая модель, общая скидка заказа, платежи, финансовые документы, номенклатура и производство. НДС относится к будущему финансовому/налоговому контуру и требует связи с организациями, типами цен и интеграцией с 1С.

**Evidence:** `backend/app/models/sales.py`, `backend/app/api/leads.py`, `backend/app/api/orders.py`, `backend/app/api/organizations.py`, `backend/app/services/lead_conversion.py`, `backend/app/services/sales_order_items.py`, `backend/app/schemas/sales.py`, `backend/alembic/versions/e0f1a2b3c456_add_order_item_dimensions_and_personalization.py`, `backend/alembic/versions/f1a2b3c4d567_add_order_item_color.py`, `backend/tests/test_lead_conversion.py`, `frontend/components/sales/sales-order-items.tsx`, `frontend/app/(workspace)/sales/orders/[orderId]/order-item-actions.ts`, `frontend/lib/sales/order-details.ts`, `frontend/lib/sales/order-details.test.mjs`.

**v0.7.6 evidence:** `backend/alembic/versions/a2b3c4d5e678_add_order_item_discount_percent.py`, `backend/tests/test_lead_conversion.py`, `frontend/lib/sales/order-details.ts`, `frontend/lib/sales/order-details.test.mjs`.

**v0.8.1 evidence:** `backend/app/models/nomenclature.py`, `backend/app/schemas/nomenclature.py`, `backend/app/services/nomenclature.py`, `backend/app/api/nomenclature.py`, `backend/app/services/sales_order_items.py`, `backend/alembic/versions/c3d4e5f6a789_add_nomenclature_core.py`, `backend/tests/test_lead_conversion.py`, `frontend/lib/nomenclature.ts`, `frontend/lib/sales/order-details.ts`, `frontend/lib/sales/nomenclature.test.mjs`, `frontend/components/settings/nomenclature-workspace.tsx`, `frontend/components/sales/sales-order-items.tsx`, `frontend/app/(workspace)/settings/catalogs/nomenclature/page.tsx`, `frontend/app/(workspace)/sales/orders/[orderId]/order-item-actions.ts`.

## Номенклатура и продукция

- `[x]` `v0.8.1-nomenclature-core`: persistent-справочник готовых изделий, CRUD/API, поиск, уникальный article, Decimal/Numeric base_price, active-фильтрация и nullable-ссылка из `SalesOrderItem`; searchable combobox в создании/редактировании позиции явно копирует snapshot name/base price, ручные позиции поддерживаются; миграция и regression-проверки пройдены. Модели, лекала, материалы, спецификации и производство не входят;
- `[x]` `v0.8.2-nomenclature-types-and-category-hierarchy`: системные типы номенклатуры, persistent-иерархия категорий с `parent_id`, запретом циклов и проверкой совместимости, nullable `Nomenclature.category_id` и перенос legacy-категорий миграцией; API, frontend catalog workspace, regression tests и project check подтверждены;
- `[x]` `v0.8.3-units-of-measure`: persistent-справочник `UnitOfMeasure` с системными категориями, precision, active-фильтрацией и CRUD/API; `Nomenclature.storage_unit_id` сохраняет базовую единицу хранения, legacy `unit` мигрируется без потери данных; frontend, regression tests, Alembic и project check подтверждены. Альтернативные коэффициенты и складские роли не входят;
- `[x]` `v0.8.4-category-custom-fields`: `CustomFieldDefinition`, persistent options, `CategoryField` с required/default/inherit/override и typed `NomenclatureFieldValue`; effective schema учитывает всю иерархию, backend проверяет типы, варианты и обязательность; API, миграция, frontend catalog, редактор значений карточки и regression-проверки подтверждены. Characteristics/variants не входят;
- `[x]` `v0.8.5-nomenclature-workspace-and-editable-card`: рабочее место с деревом категорий, поиском/фильтрами, отдельными командами создания и отдельная карточка с view/edit и интеграцией custom fields v0.8.4; frontend persistence и regression-проверки подтверждены. Полный аудит, массовые действия, пользовательские колонки и глобальные права не входят;
- `[ ]` `v0.8.6-characteristics-and-variants`: planned; характеристики, допустимые значения и отдельные варианты номенклатуры, только после v0.8.5;
- `[ ]` `v0.8.7-nomenclature-media`: planned; persistent media, главное изображение и безопасный file lifecycle, с зависимостью от карточки v0.8.5;
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
