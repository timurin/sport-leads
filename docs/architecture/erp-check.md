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
- `[x]` **website-form ingest `1.4.3.2`** — `POST /leads/ingest/website-form` → `create_lead` + `lead_ingest_receipts` (secret header; contour C);
- `[x]` **SMTP email connector `1.4.3.3`** — real outbound email + inbound webhook → `LeadMessage` (mock fallback if SMTP unset);
- `[x]` **mailbox settings `1.4.3.4`** — persist SMTP/IMAP/CRM flags in `mailbox_settings`; admin UI `/settings/integrations`; secrets not returned; owner visual OK `2026-08-23`;
- `[x]` **external adapters checkpoint `1.4.3.5`** — contour **C** closed (`2026-08-23`): website-form ingest + SMTP `LeadMessage` + mailbox persist; collectors ≠ connectors; ≠ Stage 19;
- `[~]` список/Kanban, задачи, заметки, timeline и коммуникации частично local/demo; **лиды list/kanban** `1.1.3`/`1.1.4` closed (owner visual OK `2026-07-31`); **dashboard models** `1.1.5` closed (owner visual OK `2026-08-01`); **lead tasks/notes/communications** `1.2.4` closed (owner visual OK `2026-08-01`); lead **card demix** `1.2.5` closed (owner visual OK `2026-08-01`; production auth → `17.1.1`); **`1.3.3` closed** (owner visual OK `2026-08-01`): no Deal; deals→orders; lead archive cancelled; ACL → `17.1.1`; **`2.2.1`/`2.2.2` closed** (owner visual OK `2026-08-01`); **`2.2.3` closed** (owner visual OK `2026-08-23`); **`2.2.4` closed** (owner visual OK `2026-08-23`); **`2.3.1` shipped** (`2026-08-23`; INN/KPP/OGRN + `ClientBankAccount` on `/sales/clients/[id]`); **`2.3.2` closed** (owner visual OK `2026-08-24`; segment tags + duplicate warning); **`2.3.3` closed** (owner visual OK `2026-08-24`; read-only settlements projection of `3.4.2` markers; ledger SoT Stage `14.2`); **`2.4.1` closed** (owner visual OK `2026-08-24`; `/settings/organizations` list+card); **`2.4.2` closed** (owner visual OK `2026-08-24`; `/settings/organizations/employees`; auth linkage deferred); **Stage 2 closed**;
- `[x]` `Deal` как отдельная сущность **не вводится** (конверсия → `SalesOrder`); ACL CRM → `17.1.1`;
- `[x]` `Organization` и связь `SalesOrder.organization_id`;
- `[x]` `SalesOrder` list/detail, status workflow и history;
- `[x]` order card UX `3.5`: compact header + view filters + field-link map; owner visual OK `3.5.9` (`2026-07-31`); **Tasks panel → `WorkTask`** (Stage `23`; primary `LeadTask` UI removed `23.5.4`); filter «Коммуникация» = Stage `19` staff chat (`CollaborationMessage`; microtasks UI removed `23.5.4`, data migrate `23.6.1`); ≠ CRM `1.2.4`, ≠ external connectors;
- `[x]` **v1.00 Stage `20` closed** (`2026-08-05` owner visual `20.4.5`): lead need-cleanup `20.1`; lead card layout `20.2`; unified internal messaging ADR-027 / lead XOR collaboration thread `20.3`; order card parity (hide reserve/design, client-need sync, metrics MetricCard grid, shared collaboration shell) `20.4`;
- `[~]` **v1.00 Stage `23` Unified Work Tasks** — ADR-028; through `23.10.4` + `23.7` (API/FE/hosts + migrate + kanban + order context; owner visuals OK `2026-08-22`); old `LeadTask` / `CollaborationMicrotask` tables retained;
- `[x]` `SalesOrderItem` CRUD, snapshot-наименование, размеры (`size_range`), персонализация (`personalization`), цвет (`color`), процентная скидка строки (`discount_percent`), вычисляемая сумма скидки (`discount_amount`) и пересчёт `line_amount` через `Decimal/Numeric`; **скидка заказа** `3.3.1` shipped (`SalesOrder.discount_percent` / `discount_amount` / `items_subtotal`; UI на карточке); **НДС** `3.3.2` shipped (`price_includes_vat` per line, line/order `vat_amount`, API `amount_net` / `line_total`; UI toolbar `BadgePercent` apply-all; transfer rule для price-доков; Alembic `e2f3a4b5c678`); полный pytest, frontend tests, TypeScript, lint, production build, project check 9/9 и Alembic проходят;
- `[!]` прежняя связь `SalesOrderItem → Material` была архитектурной ошибкой и удалена отдельным patch; `Material` не является номенклатурой заказа.

`Этап 2 закрыт в объёме MVP владельцем проекта.` За пределами этапа остаются полный print Stage 18, платежи, финансовые документы и производство. Скидка заказа закрыта в `3.3.1`. НДС на позициях заказа закрыт в `3.3.2`. **`3.3.3` closed** (валюта, КП/счёт, owner visual OK `2026-07-31`); печать шаблонов — Stage 18. **`3.4.1` closed** (design approval + production gate, owner visual OK `2026-07-31`). **`3.4.2` closed** — sales payment/reserve markers + completed payment gate; owner visual OK `2026-07-31`; warehouse reserve / payment ledger remain Stage 12/14. **`3.4.3` closed** — orders list `loading.tsx`/`error.tsx` + network errors surfaced (no silent empty board).

**Evidence:** `backend/app/models/sales.py`, `backend/app/api/leads.py`, `backend/app/api/orders.py`, `backend/app/api/organizations.py`, `backend/app/services/lead_conversion.py`, `backend/app/services/sales_order_items.py`, `backend/app/schemas/sales.py`, `backend/alembic/versions/e0f1a2b3c456_add_order_item_dimensions_and_personalization.py`, `backend/alembic/versions/f1a2b3c4d567_add_order_item_color.py`, `backend/tests/test_lead_conversion.py`, `frontend/components/sales/sales-order-items.tsx`, `frontend/app/(workspace)/sales/orders/[orderId]/order-item-actions.ts`, `frontend/lib/sales/order-details.ts`, `frontend/lib/sales/order-details.test.mjs`.

**v0.7.6 evidence:** `backend/alembic/versions/a2b3c4d5e678_add_order_item_discount_percent.py`, `backend/tests/test_lead_conversion.py`, `frontend/lib/sales/order-details.ts`, `frontend/lib/sales/order-details.test.mjs`.

**v0.8.1 evidence:** `backend/app/models/nomenclature.py`, `backend/app/schemas/nomenclature.py`, `backend/app/services/nomenclature.py`, `backend/app/api/nomenclature.py`, `backend/app/services/sales_order_items.py`, `backend/alembic/versions/c3d4e5f6a789_add_nomenclature_core.py`, `backend/tests/test_lead_conversion.py`, `frontend/lib/nomenclature.ts`, `frontend/lib/sales/order-details.ts`, `frontend/lib/sales/nomenclature.test.mjs`, `frontend/components/settings/nomenclature-workspace.tsx`, `frontend/components/sales/sales-order-items.tsx`, `frontend/app/(workspace)/settings/catalogs/nomenclature/page.tsx`, `frontend/app/(workspace)/sales/orders/[orderId]/order-item-actions.ts`.

## Номенклатура и продукция

- `[x]` `v0.8.1-nomenclature-core`: persistent-справочник, CRUD/API, поиск по name/category, Decimal/Numeric base_price, active-фильтрация и nullable-ссылка из `SalesOrderItem`; `Nomenclature.article` снят (`4.7.11` / B3 — артикул модели на `ProductModel`); searchable combobox копирует snapshot name/base price; миграция и regression-проверки пройдены;
- `[x]` `v0.8.2-nomenclature-types-and-category-hierarchy`: системные типы номенклатуры, persistent-иерархия категорий с `parent_id`, запретом циклов; type↔category decouple (`4.9.1`); tree directory + CRUD (`4.9.2`/`4.9.3`); owner visual folders UX (`4.9.5`, `2026-07-26`); nullable `Nomenclature.category_id`; API, frontend catalog workspace, regression tests подтверждены;
- `[x]` `v0.8.3-units-of-measure`: persistent-справочник `UnitOfMeasure` с системными категориями, precision, active-фильтрацией и CRUD/API; `Nomenclature.storage_unit_id` сохраняет базовую единицу хранения, legacy `unit` мигрируется без потери данных; frontend, regression tests, Alembic и project check подтверждены. Альтернативные коэффициенты и складские роли не входят;
- `[x]` `v0.8.4-category-custom-fields`: historical — `CustomFieldDefinition` / `CategoryField` / `NomenclatureFieldValue` shipped in v0.8.4; **SoT superseded by ADR-015 / `4.8`** (`Characteristic*` + `NomenclatureCharacteristicValue`);
- `[x]` `v0.8.5-nomenclature-workspace-and-editable-card`: отдельная карточка и list workspace; historical note: дерево категорий later removed from list (`4.7.2`); list now PT-02 rows; full audit/bulk/columns/rights не входят;
- `[x]` `v0.8.6-characteristics-and-variants`: определения и значения характеристик, category inheritance, nomenclature assignments, persistent variants с проверкой комбинаций/артикулов и order-item snapshots подтверждены API, миграцией `g7b8c9d0e123`, frontend card/actions и regression-проверками. Изображения, модели, производство и live 1С не входят; цены/barcode/external_code вариантов закрыты в `4.4.6`;
- `[x]` `v0.8.7-nomenclature-media`: persistent media, главное изображение, сортировка, безопасное хранение/выдача/удаление изображений подтверждены моделью, API, миграцией `h8c9d0e1f234`, frontend card и regression-проверками. Базовый контур — изображения до 10 MB; non-image вложения расширены в `4.4.5`;
- `[x]` `4.4.5` non-image attachments: PDF/Office/ZIP/TXT/CSV на `nomenclature_media`, `is_primary` только для изображений, блок «Вложения» на карточке; evidence `test_nomenclature_attachments_4_4_5.py`;
- `[x]` `4.4.6` variant pricing / barcodes / external_code: nullable `price` (override `base_price`), unique `barcode`, opaque `external_code` (1С → `16.2.1`); Alembic `b9c0d1e2f345`; card «Варианты» + order suggests variant price; evidence `test_variant_pricing_4_4_6.py`;
- `[x]` `v0.8.8a-nomenclature-card-exact-reference`: карточка номенклатуры приведена к reference-структуре без изменения backend/API/БД: header, anchor-tabs, двухколоночная desktop-сетка, responsive mobile bar, основная информация, реквизиты, характеристики/варианты, media, карточка метаданных и история дат используют реальные persistent-данные и существующие Server Actions. Planned-заглушки v0.8.6/v0.8.7 удалены. Подтверждение: `frontend/components/settings/nomenclature-card.tsx`, маршрут карточки, `docs/design/nomenclature-card-reference-v1.html`, frontend tests, TypeScript, ESLint и build;
- `[x]` `v0.8.8b-card-layout-tabs-visual-fix`: верхний PageHeader удалён, карточка начинается с back-link/header, пять вкладок используют active state и скрывают невыбранные секции. Reference typography/layout/breakpoints сохранены, backend/API/БД и бизнес-логика не менялись. Подтверждение: frontend route/card, TypeScript, frontend tests, ESLint, production build и static responsive check;
- `[x]` `v0.8.8c-card-block-editing-and-async-save`: основная информация, typed-реквизиты, характеристики и media получили независимые edit/cancel/save flows с saving/saved/error states, dirty guard и блокировкой повторного запроса. Использованы существующие `updateNomenclature`, characteristics values/media Server Actions; backend/API/БД не изменялись. Подтверждение: frontend card, regression test, TypeScript, frontend tests, ESLint, build и project check;
- `[x]` `v0.8.8d-card-media-gallery-fix`: media actions приведены к каноническому `/nomenclatures/{id}/media` API prefix. Галерея поддерживает загрузку с preview и состояниями ошибки/загрузки, существующие thumbnails, primary, sort order, alt-text, delete, empty state и JPG/PNG/WEBP до 10 MB. Подтверждение: `frontend/app/(workspace)/settings/catalogs/nomenclature/characteristics-actions.ts`, `frontend/components/settings/nomenclature-media-gallery.tsx`, карточка и regression test; backend/API/БД не изменялись;
- `[x]` `v0.8.8e-restore-card-design-and-media-library`: reference-композиция восстановлена без изменения backend/API/БД: основной tab использует desktop 65/35, реквизиты, характеристики, media и история занимают полную полезную ширину, mobile/tablet переходят в одну колонку. Визуальный слой зафиксирован в `frontend/app/globals.css`. Media library использует headless `@uppy/core`, `@uppy/react`, `@uppy/thumbnail-generator`, поддерживает очередь нескольких изображений, thumbnail preview, MIME/size ограничения, удаление из очереди, существующий upload transport, primary, sort, alt и delete. Отдельные block edit/save/cancel flows, tabs и unsaved guard сохранены. Подтверждение: frontend card/gallery, package manifest/lock, regression tests, TypeScript, ESLint, build, backend pytest и project check;
- `[x]` `v0.8.8g-card-header-and-main-block`: header и main tab приведены к reference composition только на frontend: справа в header переиспользованы существующие menu/BlockActions, на «Основном» сохранены основной блок слева и карточка/timeline справа, на mobile верхние actions скрываются без изменения нижней панели. Остальные вкладки, API, Server Actions и backend не менялись. Подтверждение: `frontend/components/settings/nomenclature-card.tsx`, `frontend/app/globals.css`, TypeScript, ESLint, frontend tests и production build;
- `[x]` `v0.8.8h-nomenclature-free-custom-fields`: historical free-assignment contour on former `CustomField*`; **superseded by ADR-015 / `4.8`** (card values → `NomenclatureCharacteristicValue` / characteristics API);
- `[x]` `4.8` / ADR-015: unified `Characteristic*` catalog — migration `f7a8b9c0d123`, `/custom-fields` API unmounted, DELETE + usage guards + `18.4` journal stub, nav redirect (`4.8.1`–`4.8.3`, `4.8.5`); detail card **layout confirmed** (`4.8.4`); nomenclature card UI on characteristics names (`4.8.6`); orphan `custom_fields` modules removed + focused regression (`4.8.7`); open: appearance/content polish of characteristic card (follow-up);
- `[x]` отдельный `Material` catalog/API удалён после cutover (`4.6.4`); данные в `Nomenclature` type `MATERIAL` (`z6a7b8c9d012`); Materials nav removed (`4.6.3`);
- `[~]` единая номенклатура готовых изделий, услуг, полуфабрикатов и комплектов (типы `PRODUCT`/`GOODS`/`SERVICE`/`MATERIAL`; materials cutover `4.6.1`–`4.6.4` done; UNF primary warehouse list `4.10` shipped; stock register MVP `4.6.5.*` / Stage `12.2` shipped);
- `[x]` `4.10` — УНФ: Склад → «Номенклатура» (`/warehouse/stock`) primary PT-04; `4.10.1`–`4.10.7` closed (`v0.9.0`; owner visual OK `2026-07-26`); остаток column live from ledger (`12.2.2`–`12.2.3`);
- `[x]` `4.6.5.*` — MVP регистр shipped via Stage `12.2` (`12.2.1`–`12.2.5`; ADR-019); SoT = posted ledger, not `Nomenclature`; FG docs/bins/lots → `12.3`+;
- `[~]` **warehouse Stage 12** — ADR-019; `12.1`–`12.3` shipped in `v0.9.0`; inventory UI `12.4.1.5` closed `2026-08-25`; owner visual `12.4.1.6` next; transfers/reserves `12.5` open;
- `[~]` модели и артикулы — Stage 6 catalog v1 closed (`6.1.1`–`6.1.16`, `6.2.*`, `6.3.*` incl. `6.3.8` duration / `6.3.10` equipment, `6.4`); product types directory + model link shipped; order-item binding `3.2.5` + routing `3.2.7` + smoke `3.2.6` shipped; model routing whitelist + op norms `6.1.17` shipped;
- `[~]` размеры и изображения — SizeGrid Mosmade men+women + list/card visual OK; Stage-6 read-only; write/edit → `17.1.2.4`; model link `6.2.7` shipped;
- `[x]` операции пошива (каталог) + связка со строками варианта — `6.3.1`–`6.3.6` shipped; normative `duration_seconds` + assembly-line snapshot `6.3.8` shipped; equipment M:N (цех Пошив) `6.3.10` shipped; folder tree `6.3.11` + templates `6.3.12` + apply to assembly `6.3.13` shipped (owner visual OK `2026-08-02`);
- `[x]` типы изделия (`ProductType`) — directory + `ProductModel.product_type_id` + list filter/column (`6.1.14`–`6.1.16`);

## Технологическая подготовка

- `[ ]` операционные узлы;
- `[~]` технологические операции — Stage `8.1.3` **shipped** (`tech_operations` + seed 5; settings UI); строки объёмов на ТК — `9.3.3` (≠ SewingOperation Stage `6.3`); привязка ops → цех shipped in `8.3`;
- `[~]` нормативы модели и времени — **planned** `6.1.17` (operation material norms on model+routing as plan hint) + sewing duration already `6.3.8`; TC `planned_qty`/`fact_qty` + hard gate cutting/print → `9.3.4` / shop `11.5`–`11.6`;
- `[x]` подготовка и версионирование спецификации — Stage 7 **документ-отчёт план+факт** (ADR-004/016/031; owner visual `7.2.2.6` OK `2026-08-25`; не hard dep generate ТК; не отдельный модуль; не gate запуска партии);
- `[x]` запрет запуска партии без утверждённой версии Spec — **не применяется** (ADR-004/031): Spec = отчёт после исполнения, не prerequisite партии/ТК;

## Производство

- `[x]` технические карты: domain **ADR-016** (+ plan/fact materials amend `9.3.4`); DB `9.1.2`; generate `9.2.1`; composition/unit/op-volume; order UI `9.4.1` (owner visual OK); stage machine `9.2.2`; **list/document `9.4.2` shipped** (owner visual `9.4.2.7` OK `2026-07-28`); **settings `9.6` shipped** (singleton `TechnicalCardSettings`, settings page, generate/prefill wiring, focused regressions); print A4×2 `18.3.8` owner visual OK `2026-08-03`;
- `[~]` shop routings / work centers — ADR-017 (+ model whitelist amend `6.1.17`; TC wire `8.2.3.7`–`8.2.3.8` shipped; TechOp materials `8.1.4` shipped); migration `l3m4n5o6p789`; API + settings UI; owner visual `8.2.2.6` OK `2026-07-28`;
- `[~]` **ProductionStage (цех) catalog** — Stage `8.3` **shipped** (seed 7 цехов; migration `m4n5o6p7q890`); FG stages `ready_to_ship` / `shipped` seeded in `11.2.2.2` (`x5y6z7a8b901`); settings «Этапы»; routing step = цех; owner visual OK `2026-07-28`;
- `[x]` **WorkCenter planning (`11.1.2`)** — contract + routing snapshot + Settings catalog + TC planned assign UI shipped; owner visual `11.1.2.5` OK `2026-07-30`;
- `[~]` **shop-floor modules** — Stage `11.3` platform + **`11.4`–`11.10` per-цех UIs shipped** (owner visuals OK through `11.10.5`); FG stages `11.2.2` (ADR-019) after packaging; **Раскрой/Печать** write material `fact_qty` with hard complete-gate (`9.3.4`);
- `[x]` **кабинет швеи (`v1.00` Stage `24`)** — закрыт `2026-08-24` (owner visual `24.5.2`); ADR-029 + `SL-SEWING-CABINET-v1`; `PlatformUser`; журнал + ограниченная оболочка; ≠ `2.4.2` Employee;
- `[x]` **QR техкарты / скан (`v1.00` Stage `25`)** — закрыт `2026-08-25` (owner visual `25.5.2`); ADR-030; токен + печать QR + скан + `wip_status` + частичный FG;
- `[x]` **production batches** — ADR-018 + DB/API/UI `/production/orders` shipped (`11.1.1`); owner visual `11.1.1.5` OK `2026-07-30`;
- `[x]` batch specification formation (plan+fact report document from filled TC / ADR-004/031; owner visual `7.2.2.6` OK `2026-08-25`);
- `[x]` **aggregate fact (`11.2.1`)** — contract/API/UI/tests + owner visual OK `2026-07-30` (`11.2.1.1`–`11.2.1.4`);
- `[x]` **FG warehouse bridge (`11.2.2`)** — wire + auto-post + owner visual OK `2026-08-01`; movements UI `12.3.3` shipped;

Цепочка (ADR-004 amend): заказ → ТК (технология/состав) → партия → исполнение → спецификация как **сводный отчёт план+факт** → 1С. Spec — документ, не модуль; сырой факт остаётся в своих контурах. **Документы** = реестр ссылок на документы в родителях (не контур на каждый тип).

## Ресурсы, склад, закупки и финансы

- `[~]` складской регистр остатков / min stock — MVP register shipped (`4.6.5.*` / `12.2`); min stock + bins/lots later; не на карточке `Nomenclature`; legacy `Material` removed (`4.6.4`); primary list UI — `4.10` (UNF);
- `[~]` единицы измерения как единый справочник, склады, зоны, резервы, партии и инвентаризация — склады + регистр `12.1`/`12.2` shipped; инвентаризация UI `12.4.1.5` (`2026-08-25`); зоны/лоты/резервы later;
- `[ ]` фактическое списание и выпуск;
- `[ ]` закупки, поставщики и заказы поставщикам;
- `[ ]` оплаты, себестоимость, маржа, задолженность и финансовые документы.

## Платформа и доступ

- `[x]` **List-page data rules (`v1.00` `0.2.1`–`0.2.8`)** — `SL-LIST-PAGE-RULES-v1`; embed/batch for product-models cost, characteristic `option_count`, warehouse `list-extras`, slim tech-cards list; PO `batch-fact-rollups` (`0.2.6`); stock `nomenclature_name` (`0.2.7`); nomenclature card `options-batch` (`0.2.8`); evidence `test_list_performance_0_2.py`, `test_technical_cards_9_4_2.py`, `test_production_fact_rollup_11_2_1_2.py`, `test_stock_documents_12_2_2.py`;
- `[x]` **LAN local-stack access (`v1.00` `0.3.1`–`0.3.3`)** — `scripts/dev-servers.ps1 -Lan` binds `0.0.0.0:3001`/`8000`; `.env.example` + AGENTS CORS/`NEXT_PUBLIC_*` notes; owner smoke OK `2026-08-05` (`192.168.2.98:3001`); ≠ public internet / production Caddy;
- `[x]` **Create SalesOrder without Lead (`v1.00` `0.4.1`–`0.4.3`)** — nullable `lead_id`; `POST /orders` (number auto|freeform unique); FE create drawer; convert intact; org optional + client checkbox «Создать организацию?»; owner visual OK `2026-08-05`; evidence `test_order_without_lead_0_4.py`, `SL-ORDER-WITHOUT-LEAD-v1`;
- `[~]` **Canonical VPS workflow (`v1.00` `0.5`)** — ADR-032 + agent rule + compose `127.0.0.1:5432` + tunnel/storage scripts; git push + live host + owner smoke open (`0.5.3`/`0.5.4`/`0.5.6`–`0.5.8`/`0.5.11`–`0.5.12`);
- `[x]` **Authentication (`17.1.1`)** — ADR-023 + API + `/login` workspace gate; owner visual OK `2026-08-01`; evidence `test_auth_17_1_1_2.py`, `session.test.mjs`;
- `[x]` System users / roles / permissions (`17.1.2`) — ADR-024 + RBAC + size-grid/kanban/admin gates + stage executors; owner visuals OK `2026-08-01`; **Users cabinet list/profile/access** → Stage `21`; sewing cabinet codes/roles → `24.1.1`;
- `[x]` **Settings / Users cabinet (`v1.00` Stage `21` closed)** — nav «Пользователи» `/settings/users` (≠ org «Сотрудники» `2.4.2`); invite + list/filter + profile PATCH + access matrix; Alembic `m6n7o8p9q012`; owner visual OK `21.5.1` (`2026-08-05`); `SL-USERS-CABINET-v1`; extends `17.1.2` without new permission codes;
- `[x]` **Design v1.0 (`v1.00` Stage `22`)** — Soft UI HTML etalons → platform; process `SL-DESIGN-V1-PROCESS-v1`; closed `2026-08-23` (boards `22.3.4` + shell `22.9.4`); do not re-open Stage `20` data contracts;
- `[x]` Universal audit trail (`17.1.3`) — ADR-025 + `audit_events` + size-grid UI journal; owner visual OK `2026-08-01`;
- `[x]` Production ops (`17.2`) — `17.2.1`–`17.2.3` shipped (Compose/Caddy, deploy/health/logs, backup/DR runbooks); live apply + tunnel = `v1.00` `0.5` (do not reopen `17.2.*`).

## Интеграции

- `[x]` collectors/parsers и mock communication connector core;
- `[~]` реальные внешние CRM/communication adapters;
- `[ ]` **внутренние коммуникации сотрудников** (Stage `19`): чат по заказу и техкартам, `@mention`, микротаски из чата, in-app уведомления — не внешние каналы;
- `[ ]` обмен с 1С: номенклатуры, заказы, утверждённые спецификации, списание материалов, операции, выпуск и связанные документы (`16.2.1`, ADR-020 contour D);
- `[x]` каталожный file I/O номенклатуры (`4.5.1`/`4.5.2`) + модели изделий (`4.5.3`) + операции пошива (`4.5.4`, owner visual OK `4.5.4.4` `2026-08-24`) — section toolbar + shared parse lib (ADR-020); domain inline (`9.3.2`) отдельно;
- `[x]` audit/archive/bulk номенклатуры (`4.3.3`) — card history + soft archive + warehouse multi-select;
- `[ ]` универсальный job shell импорта/экспорта (`16.3`) — поверх adapters `4.5`, не print-forms `18.3`.

## Правило подтверждения

`[x]` ставится только при наличии реализации на соответствующем слое и успешных применимых проверок. HTML-файлы в `docs/erp/status/` не являются источником истины. При изменении checklist readiness синхронизируй HTML-twin в той же итерации (см. `AGENTS.md` § canonical sync и `.cursor/rules/canonical-docs-html-twins.mdc`).
Patch v0.8.8h confirmed: backend-generated unique codes, typed save/reload, scoped direct-assignment delete, inherited-assignment protection and required-clear validation are covered by regression tests; no migration is required.

`v0.8.8i-product-characteristics-directory` confirmed: the existing characteristic model/API now supports `kind`, color HEX values, generated codes, system Color/Size records and safe deactivation. Migration `i9j0k1l2m345` has upgrade/downgrade; the settings directory and regression checks are implemented. Nomenclature card layout and variant snapshot logic are unchanged.

Canonical sync `2026-07-28`: **`11.3`–`11.6` shipped** (owner visuals OK), **`11.7.1`–`11.7.4` Пошив**. Next: **owner visual `11.7.5`**.
