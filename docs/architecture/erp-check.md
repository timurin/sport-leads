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

- `[x]` `v0.8.1-nomenclature-core`: persistent-справочник, CRUD/API, поиск по name/category, Decimal/Numeric base_price, active-фильтрация и nullable-ссылка из `SalesOrderItem`; `Nomenclature.article` снят (`4.7.11` / B3 — артикул модели на `ProductModel`); searchable combobox копирует snapshot name/base price; миграция и regression-проверки пройдены;
- `[x]` `v0.8.2-nomenclature-types-and-category-hierarchy`: системные типы номенклатуры, persistent-иерархия категорий с `parent_id`, запретом циклов; type↔category decouple (`4.9.1`); tree directory + CRUD (`4.9.2`/`4.9.3`); nullable `Nomenclature.category_id`; API, frontend catalog workspace, regression tests подтверждены;
- `[x]` `v0.8.3-units-of-measure`: persistent-справочник `UnitOfMeasure` с системными категориями, precision, active-фильтрацией и CRUD/API; `Nomenclature.storage_unit_id` сохраняет базовую единицу хранения, legacy `unit` мигрируется без потери данных; frontend, regression tests, Alembic и project check подтверждены. Альтернативные коэффициенты и складские роли не входят;
- `[x]` `v0.8.4-category-custom-fields`: historical — `CustomFieldDefinition` / `CategoryField` / `NomenclatureFieldValue` shipped in v0.8.4; **SoT superseded by ADR-015 / `4.8`** (`Characteristic*` + `NomenclatureCharacteristicValue`);
- `[x]` `v0.8.5-nomenclature-workspace-and-editable-card`: отдельная карточка и list workspace; historical note: дерево категорий later removed from list (`4.7.2`); list now PT-02 rows; full audit/bulk/columns/rights не входят;
- `[x]` `v0.8.6-characteristics-and-variants`: определения и значения характеристик, category inheritance, nomenclature assignments, persistent variants с проверкой комбинаций/артикулов и order-item snapshots подтверждены API, миграцией `g7b8c9d0e123`, frontend card/actions и regression-проверками. Изображения, модели, производство, цены вариантов и 1С не входят;
- `[x]` `v0.8.7-nomenclature-media`: persistent media, главное изображение, сортировка, безопасное хранение/выдача/удаление изображений подтверждены моделью, API, миграцией `h8c9d0e1f234`, frontend card и regression-проверками. Файлы ограничены изображениями до 10 MB;
- `[x]` `v0.8.8a-nomenclature-card-exact-reference`: карточка номенклатуры приведена к reference-структуре без изменения backend/API/БД: header, anchor-tabs, двухколоночная desktop-сетка, responsive mobile bar, основная информация, реквизиты, характеристики/варианты, media, карточка метаданных и история дат используют реальные persistent-данные и существующие Server Actions. Planned-заглушки v0.8.6/v0.8.7 удалены. Подтверждение: `frontend/components/settings/nomenclature-card.tsx`, маршрут карточки, `docs/design/nomenclature-card-reference-v1.html`, frontend tests, TypeScript, ESLint и build;
- `[x]` `v0.8.8b-card-layout-tabs-visual-fix`: верхний PageHeader удалён, карточка начинается с back-link/header, пять вкладок используют active state и скрывают невыбранные секции. Reference typography/layout/breakpoints сохранены, backend/API/БД и бизнес-логика не менялись. Подтверждение: frontend route/card, TypeScript, frontend tests, ESLint, production build и static responsive check;
- `[x]` `v0.8.8c-card-block-editing-and-async-save`: основная информация, typed-реквизиты, характеристики и media получили независимые edit/cancel/save flows с saving/saved/error states, dirty guard и блокировкой повторного запроса. Использованы существующие `updateNomenclature`, characteristics values/media Server Actions; backend/API/БД не изменялись. Подтверждение: frontend card, regression test, TypeScript, frontend tests, ESLint, build и project check;
- `[x]` `v0.8.8d-card-media-gallery-fix`: media actions приведены к каноническому `/nomenclatures/{id}/media` API prefix. Галерея поддерживает загрузку с preview и состояниями ошибки/загрузки, существующие thumbnails, primary, sort order, alt-text, delete, empty state и JPG/PNG/WEBP до 10 MB. Подтверждение: `frontend/app/(workspace)/settings/catalogs/nomenclature/characteristics-actions.ts`, `frontend/components/settings/nomenclature-media-gallery.tsx`, карточка и regression test; backend/API/БД не изменялись;
- `[x]` `v0.8.8e-restore-card-design-and-media-library`: reference-композиция восстановлена без изменения backend/API/БД: основной tab использует desktop 65/35, реквизиты, характеристики, media и история занимают полную полезную ширину, mobile/tablet переходят в одну колонку. Визуальный слой зафиксирован в `frontend/app/globals.css`. Media library использует headless `@uppy/core`, `@uppy/react`, `@uppy/thumbnail-generator`, поддерживает очередь нескольких изображений, thumbnail preview, MIME/size ограничения, удаление из очереди, существующий upload transport, primary, sort, alt и delete. Отдельные block edit/save/cancel flows, tabs и unsaved guard сохранены. Подтверждение: frontend card/gallery, package manifest/lock, regression tests, TypeScript, ESLint, build, backend pytest и project check;
- `[x]` `v0.8.8g-card-header-and-main-block`: header и main tab приведены к reference composition только на frontend: справа в header переиспользованы существующие menu/BlockActions, на «Основном» сохранены основной блок слева и карточка/timeline справа, на mobile верхние actions скрываются без изменения нижней панели. Остальные вкладки, API, Server Actions и backend не менялись. Подтверждение: `frontend/components/settings/nomenclature-card.tsx`, `frontend/app/globals.css`, TypeScript, ESLint, frontend tests и production build;
- `[x]` `v0.8.8h-nomenclature-free-custom-fields`: historical free-assignment contour on former `CustomField*`; **superseded by ADR-015 / `4.8`** (card values → `NomenclatureCharacteristicValue` / characteristics API);
- `[x]` `4.8` / ADR-015: unified `Characteristic*` catalog — migration `f7a8b9c0d123`, `/custom-fields` API unmounted, DELETE + usage guards + `18.4` journal stub, nav redirect (`4.8.1`–`4.8.3`, `4.8.5`); detail card **layout confirmed** (`4.8.4`); nomenclature card UI on characteristics names (`4.8.6`); orphan `custom_fields` modules removed + focused regression (`4.8.7`); open: appearance/content polish of characteristic card (follow-up);
- `[x]` отдельный `Material` catalog/API удалён после cutover (`4.6.4`); данные в `Nomenclature` type `MATERIAL` (`z6a7b8c9d012`); Materials nav removed (`4.6.3`);
- `[~]` единая номенклатура готовых изделий, услуг, полуфабрикатов и комплектов (типы `PRODUCT`/`GOODS`/`SERVICE`/`MATERIAL`; materials cutover `4.6.1`–`4.6.4` done; warehouse balances → `4.6.5`);
- `[~]` модели и артикулы — Stage 6 catalog v1 closed (`6.1.1`–`6.1.16`, `6.2.*`, `6.3.*` incl. `6.3.8` duration, `6.4`); product types directory + model link shipped; order-item binding moved to Stage `3.2.5` / smoke `3.2.6` (open);
- `[~]` размеры и изображения — SizeGrid Mosmade men+women + list/card visual OK; Stage-6 read-only; write/edit → `17.1.2.4`; model link `6.2.7` shipped;
- `[x]` операции пошива (каталог) + связка со строками варианта — `6.3.1`–`6.3.6` shipped; normative `duration_seconds` + assembly-line snapshot `6.3.8` shipped; owner visual OK for catalog (`2026-07-22`);
- `[x]` типы изделия (`ProductType`) — directory + `ProductModel.product_type_id` + list filter/column (`6.1.14`–`6.1.16`);

## Технологическая подготовка

- `[ ]` операционные узлы;
- `[ ]` технологические операции;
- `[ ]` нормативы модели и времени;
- `[ ]` подготовка и версионирование спецификации;
- `[ ]` запрет запуска без утверждённой версии.

## Производство

- `[ ]` технические карты: один документ на производимую позицию заказа, строки поштучных характеристик, маршрут участков, готовность заказа по всем ТК; roadmap `9.*` (domain ADR reserved as **ADR-016**; ADR-015 = unified characteristics);
- `[ ]` production batches;
- `[ ]` batch specification formation and version approval;
- `[ ]` printing, cutting, sewing and QC;
- `[ ]` actual consumption, operations, output, scrap, performers and deviations.

Цепочка: партия → утверждённая спецификация → печать → раскрой → пошив → ОТК → фактический расход → выпуск. Спецификация — плановый состав, производственный факт — отдельный контур.

## Ресурсы, склад, закупки и финансы

- `[ ]` складской регистр остатков / min stock (`4.6.5`) — не на карточке `Nomenclature`; legacy `Material` entity removed (`4.6.4`);
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
Patch v0.8.8h confirmed: backend-generated unique codes, typed save/reload, scoped direct-assignment delete, inherited-assignment protection and required-clear validation are covered by regression tests; no migration is required.

`v0.8.8i-product-characteristics-directory` confirmed: the existing characteristic model/API now supports `kind`, color HEX values, generated codes, system Color/Size records and safe deactivation. Migration `i9j0k1l2m345` has upgrade/downgrade; the settings directory and regression checks are implemented. Nomenclature card layout and variant snapshot logic are unchanged.

Canonical sync `2026-07-24`: `4.8` closed through `4.8.7` (orphan cleanup + focused regression); appearance polish of characteristic card remains follow-up. Prior `2026-07-23` sync covered product types `6.1.14`–`6.1.16`, sewing `6.3.8`, ADR-016 tech-card reserve, and warehouse `4.6.5`.
