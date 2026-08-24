# Sport-Lead — Roadmap v1.00

**Code:** `SL-ROADMAP-v1.00`  
**Updated:** `2026-08-23` (Stage **1.4.3** closed: checkpoint `1.4.3.5`)  
**Project version:** `v1.00`  
**Status:** Confirmed carry-over from `v0.9.0` (Stages **1.4.3**, **2** group, **7**, **12.4**–**12.5**, **13**, **14**, **15**, **16**, **18.4**) + **new** Stages **0** (performance + LAN + order-without-lead), **20** (Lead / Order UX, closed), **21** (Settings / Users cabinet, closed), **22** (Design v1.0), **23** (Unified Work Tasks). Owner started early (`2026-08-05`).  
**Languages / Языки:** English + Russian (this MD). Interactive switch: `docs/erp/status/roadmap-v1.00.html`

**Canonical twin:**
- Markdown (master): `docs/roadmap/roadmap-v1.00.md`
- HTML report: `docs/erp/status/roadmap-v1.00.html`

**Related:**
- Active until close: `docs/roadmap/roadmap.md` (`SL-ROADMAP-v1`, `v0.9.0`)
- Structure: `docs/architecture/project-structure.md`
- ERP-check: `docs/architecture/erp-check.md`

---

## Language note / Примечание о языке

| EN | RU |
|---|---|
| This Markdown keeps bilingual titles and notes side by side. | В Markdown заголовки и заметки даны на двух языках. |
| Use the HTML twin for one-click **EN ↔ RU** switching. | Для переключения **EN ↔ RU** откройте HTML-близнец. |

---

## Rules / Правила

- `[x]` = done / выполнено; `[ ]` = open / не выполнено.
- Codes keep `v0.9.0` numbering for carried work (`1.4.3.*`, `2.2.3.*`, `2.2.4.*`, `2.3.*`, `2.4.*`, `7.*`, `12.4`–`12.5`, `13.*`, `14.*`, `15.*`, `16.*`, `18.4.*`). New Stages **0** (`0.1` / `0.2.*` / `0.3.*` / `0.4.*`), **20** (`20.1`–`20.4`), **21** (`21.1`–`21.5`), **22** (`22.0`–`22.9` Design v1.0; process `docs/design/design-v1-process.md`), **23** (`23.0`–`23.6` Unified Work Tasks; ADR-028).
- Do not execute `v1.00` while `v0.9.0` is still the active project version, unless the owner explicitly starts early.
- Не исполнять `v1.00`, пока активная версия проекта — `v0.9.0`, если владелец явно не начал раньше.
- **Owner early start:** `2026-08-05` — execution of `v1.00` begun (`0.1.1` closed).
- MD ↔ HTML twins must stay atomic on checkbox / title / note changes.

---

## Owner transfer / Перенос владельца

### Confirmed move from v0.9.0 → v1.00 / Подтверждённый перенос

| Stage | EN | RU |
|---|---|---|
| **1.4.3** | Real CRM source / communication adapters | Реальные адаптеры источников лидов / коммуникаций |
| **2** (group) | Client history, business data, organizations (`2.2.3` + `2.3` + `2.4`) | История клиента, бизнес-данные, организации |
| **7** | Specifications | Спецификации |
| **12.4**–**12.5** | Warehouse inventory / transfers / reserves | Склад: инвентаризация / перемещения / резервы |
| **13** | Procurement | Закупки |
| **14** | Shipping and Payments | Отгрузка и платежи |
| **15** | Costing and Analytics | Себестоимость и аналитика |
| **16** | Integrations | Интеграции |
| **18.4** | Global operations journal | Глобальный журнал операций |

### New for v1.00 / Новые задачи v1.00

| Stage | EN | RU |
|---|---|---|
| **0** | Platform performance / slow-data + LAN + order without Lead | Производительность / slow-data + LAN + заказ без лида |
| **20** | Lead / Order card UX + unified messaging | UX карточек лида / заказа + единая внутренняя переписка |
| **21** | Settings / Users cabinet (`/settings/users`) | Настройки / Пользователи (кабинет) |
| **22** | Design v1.0 (HTML etalons → Soft UI platform) | Design v1.0 (HTML-эталоны → Soft UI в платформе) |

> **EN:** Stage 0 is **new** in `v1.00`: slow-data (`0.1`/`0.2`), **LAN** (`0.3`), and **create SalesOrder without Lead** (`0.4`). Stages **20** / **21** closed. Stage **22** = Design v1.0 (do **not** re-open `20.*` data contracts). Do **not** re-open closed `3.5.*` / `19.*` / `17.1.2.*` in `v0.9.0`.  
> **RU:** Stage 0: slow-data + **LAN** (`0.3`) + **заказ без лида** (`0.4`). Stages **20** / **21** закрыты. Stage **22** = Design v1.0 (не переоткрывать контракты `20.*`). Не переоткрывать закрытые пункты v0.9.

### Remain in v0.9.0 / Остаются в v0.9.0

`1.4.1` / `1.4.2` (collectors + mock connector — already done); `2.2.1` / `2.2.2`; warehouse FG `12.3`; CRM residual visual `1.3.3.6`; auth `17`; admin shell `18.1`–`18.3`; Stage `19`; etc.

`1.4.1` / `1.4.2` уже закрыты в `v0.9.0`; `2.2.1` / `2.2.2`; FG `12.3`; visual `1.3.3.6`; auth `17`; admin `18.1`–`18.3`; Stage `19` — остаются в `v0.9.0`.

> **18.4 decision / Решение по 18.4:** full carry to `v1.00` (no minimum close in `v0.9.0`). Catalog guards already use stable stubs (`product_model_has_journal_operations` / characteristic journal hooks return `False`). Real journal does not block closing `v0.9.0`.  
> Полный перенос в `v1.00` без минимального закрытия в `v0.9.0`: stubs уже держат guards каталога.

> **1.4.3 decision / Решение по 1.4.3:** only open remainder of Stage 1.4. Core + mock (`1.4.1`/`1.4.2`) stay done in `v0.9.0`. Real adapters ≠ Stage `19`; channel transport shared with `16.1`, CRM lead ingest owned here.  
> Переносится только открытый остаток; ядро+mock закрыты в `v0.9.0`.

---

## Stage 0 — Platform performance, LAN access, and order-without-lead / Производительность, LAN и заказ без лида

**New in:** `v1.00` (relocated from `v0.9.0` stub `0.4`; LAN `2026-08-05`; order-without-lead `2026-08-05`)  
**Новое в:** `v1.00` (из stub `0.4`; LAN и заказ без лида `2026-08-05`)

> **EN:** (1) Kill slow catalog/list UX from RSC **per-row HTTP** (N+1). (2) **LAN** access to local FE/BE (`3001`/`8000`; ≠ production VPS). (3) Enable **SalesOrder create without Lead** — today `lead_id` is required and orders are created only via `convert_lead`. Convert-from-lead stays valid.  
> **RU:** (1) Slow-data / N+1. (2) Доступ из **LAN**. (3) **Создание заказа без лида** — сейчас `lead_id` обязателен, заказ только через convert. Convert-from-lead остаётся.

### 0.1 — Full slow-data audit (first) / Полный аудит медленных данных (первым)

- [x] 0.1.1 — Agent/owner audit: FE list/RSC N+1 and waterfall fetches; BE list endpoints with fat `selectinload` / oversized JSON; dependency/runtime cost where it affects local/dev list latency; write findings into Stage 0 roadmap microtasks (MD + HTML twin) before closing this item — `v1.00` `2026-08-05`; task `docs/tasks/v1.00-stage-0.1.1-slow-data-audit.md`; findings → `0.2.2` note + `0.2.3.1`–`0.2.3.3` + `0.2.6`–`0.2.8` / Аудит закрыт; находки внесены в Stage 0

### 0.2 — Known findings (seed `2026-08-02` + audit `0.1.1`) / Известные находки (seed + аудит)

- [x] 0.2.1 — Contract: list-page rules — no per-row RSC HTTP; batch/embed summary on list DTO; slim list vs detail; success = list TTFB without N round-trips — `v1.00` `2026-08-05`; `docs/architecture/list-page-data-rules.md` (`SL-LIST-PAGE-RULES-v1`); task `docs/tasks/v1.00-stage-0.2-list-performance.md` / Контракт list pages
- [x] 0.2.2 — P1 case `/settings/catalogs/product-models`: confirm cost column without SSR N+1 — batch `assembly_cost_min/max` via `assembly_cost_ranges_by_model_ids` on `GET /product-models`; FE list uses embed; tests `test_list_performance_0_2.py` + `test_assembly_variants.py` — `v1.00` `2026-08-05` / P1 product-models batch подтверждён
- [x] 0.2.3 — Sibling list fixes from seed + `0.1.1` (characteristics / warehouse / tech-cards) — `v1.00` `2026-08-05` / Соседние list-фиксы закрыты
  - [x] 0.2.3.1 — Product-characteristics list: embed `option_count` on definitions; remove N× `getCharacteristicOptions` — `v1.00`; evidence: `product-characteristics/page.tsx`, `option_counts_by_definition_ids` / embed `option_count`
  - [x] 0.2.3.2 — Warehouse stock catalog: kill 2N — batch `GET /nomenclatures/list-extras` (covers + values) — `v1.00`; evidence: `warehouse-nomenclature.ts`, `primary_cover_urls_by_nomenclature_ids` / убран 2N
  - [x] 0.2.3.3 — Tech-cards list: slim `TechnicalCardListRead` + `_list_card_load_options` (stage_results only; no fat `_card_load_options` / full read) — `v1.00`; evidence: `technical_cards.py`, `test_technical_cards_9_4_2.py` / slim DTO
- [x] 0.2.4 — Shared guardrails: AGENTS list-page checklist + `list-page-data-rules.md`; focused tests `test_list_performance_0_2.py` — `v1.00` `2026-08-05` / Guardrails + тесты
- [x] 0.2.5 — Docs checkpoint: erp-check / project-structure note + evidence (request-count patterns fixed; before = N/2N RSC HTTP, after = embed/batch) — `v1.00` `2026-08-05` / Checkpoint документации
- [x] 0.2.6 — Production order detail: N× `fetchProductionBatchFactRollup` — `v1.00` `2026-08-05`; `GET /production-orders/{id}/batch-fact-rollups` + FE single fetch; evidence `test_production_fact_rollup_11_2_1_2.py` / Деталь ПЗ: batch rollups в одном запросе
- [x] 0.2.7 — Warehouse movement document: N× `getNomenclatureById` for ledger line names — `v1.00` `2026-08-05`; embed `nomenclature_name` on `StockLedgerLineRead`; FE uses document DTO; evidence `test_stock_documents_12_2_2.py` / Документ движения: имя в DTO
- [x] 0.2.8 — Nomenclature card: N× `getCharacteristicOptions` for LIST/COLOR fields — `v1.00` `2026-08-05`; `GET /characteristics/options-batch` + FE `getCharacteristicOptionsBatch`; evidence `test_list_performance_0_2.py` / Карточка номенклатуры: batch options

### 0.3 — Local network (LAN) access / Доступ в локальной сети

> **EN:** Today stack defaults to `127.0.0.1` — not reachable from other LAN hosts without bind/CORS/env. LAN share ≠ public internet / production Caddy.  
> **RU:** Сейчас стек на `127.0.0.1` — с других машин LAN недоступен без bind/CORS/env. LAN ≠ публичный интернет / production Caddy.

- [x] 0.3.1 — Audit first: inventory bind hosts (uvicorn/Next `127.0.0.1` vs `0.0.0.0`), CORS, `SPORT_LEADS_API_URL` / `NEXT_PUBLIC_*`, firewall/Windows features, optional reverse proxy; produce **install vs remove** component list + threat note (LAN ≠ public); write follow-up Stage 0 microtasks if gaps remain — `v1.00` `2026-08-05`; task `docs/tasks/v1.00-stage-0.3-lan-access.md` / Аудит LAN закрыт
- [x] 0.3.2 — Implement LAN access for local stack: scripts/env/docs so FE+BE reachable from another LAN client on `3001`/`8000` (or documented alternate); keep `3000` out of scope — `v1.00`; `scripts/dev-servers.ps1 -Lan`, `.env.example` notes, AGENTS LAN note / Реализован `-Lan` bind `0.0.0.0`
- [x] 0.3.3 — Smoke from second LAN device + docs checkpoint (`.env.example`, `scripts/dev-servers.ps1` / AGENTS note, erp-check/project-structure as needed) — `v1.00` `2026-08-05`; owner smoke OK (`http://192.168.2.98:3001`); task `docs/tasks/v1.00-stage-0.3-lan-access.md` / Smoke LAN OK владельцем

### 0.4 — Create sales order without Lead / Создание заказа без лида

> **EN:** Evidence: `SalesOrder.lead_id` required + `uq_sales_orders_lead_id`; create path = `convert_lead` only (`lead_conversion.py`). Need nullable `lead_id` + create API + UI; convert-from-lead intact. **Numbering:** auto `SO-YYYY-######` **or** owner-entered freeform `number` (unique, ≤50). **TC path:** no orphan TechnicalCard — after create + PRODUCT line, use existing `…/technical-cards/generate` (ADR-016). Enables manual «TC with arbitrary order number» without breaking FG/Spec/shop. Prefetch for UNF order Excel (`16.2.1`).  
> **RU:** Сейчас заказ только через convert; `lead_id` обязателен. Нужен nullable `lead_id` + create API + UI. **Номер:** auto или **произвольный** (unique). **ТК:** без orphan — generate после заказа+позиции (ADR-016). Prefetch для импорта заказов УНФ (`16.2.1`).

- [x] 0.4.1 — Audit/contract: nullable `lead_id` (unique still for non-null); required Client/org/responsible; **number = auto OR freeform unique**; create API vs convert-only; UI entry (`/sales/orders` create); impact on lead convert, order field-links, Stage 20, TC generate (no orphan TC); amend ADR/domain note — `v1.00` `2026-08-05`; `SL-ORDER-WITHOUT-LEAD-v1`; task `docs/tasks/v1.00-stage-0.4-order-without-lead.md`; ADR-001 amend / Контракт закрыт
- [x] 0.4.2 — Implement: migration + schemas/services/API create order without lead (incl. freeform number validation); FE create flow; keep convert-from-lead intact — `v1.00` `2026-08-05`; Alembic `i2j3k4l5m678`/`j3k4l5m6n789`/`k4l5m6n7o890`; `POST /orders` + `POST /clients`; drawer `/sales/orders`; owner visual OK; org via checkbox «Создать организацию?» / Реализация закрыта
- [x] 0.4.3 — Regression (API: convert + without-lead create + freeform number unique) + docs checkpoint (order-card-field-links, erp-check/project-structure) — `v1.00` `2026-08-05`; `test_order_without_lead_0_4.py` 8 passed; field-links Source lead optional; ADR-001 org optional on create / Регрессия + docs закрыты

---

## Stage 1.4.3 — Real external lead-source and communication adapters / Реальные адаптеры источников лидов и коммуникаций

**Moved from:** `v0.9.0` `1.4.3` (split into microtasks)  
**Перенесено из:** `v0.9.0`, `1.4.3` (разбито на микротаски)

> **EN:** Stage closed `2026-08-23`. `1.4.1` collectors + `1.4.2` mock stay in `v0.9.0`. Lead card send uses SMTP when mailbox/env configured; mock fallback otherwise. Contour **C** (ADR-020). ≠ Stage `19`.  
> **RU:** Этап закрыт `2026-08-23`. `1.4.1` + `1.4.2` остаются в `v0.9.0`. Отправка с карточки лида — SMTP при конфиге, иначе mock. Контур **C**. ≠ Stage `19`.

- [x] 1.4.3.1 — Contract: adapter registry vs collectors (`1.4.1`); lead create/update mapping; ≠ Stage `19` staff chat; relation to `16.1` (shared channel transport, CRM ingest owned here) — `v1.00` `2026-08-05`; `SL-EXTERNAL-ADAPTERS-v1`; task `docs/tasks/v1.00-stage-1.4.3-external-adapters.md`; ADR-020 / contour C note / Контракт закрыт
- [x] 1.4.3.2 — First real lead-source adapter (e.g. website form / webhook ingest) wired through normalization core — `v1.00` `2026-08-23`; `webhook_form` + `POST /leads/ingest/website-form`; `test_lead_ingest_1_4_3_2.py` / Первый реальный lead-source адаптер (форма сайта / webhook) через normalization core
- [x] 1.4.3.3 — First real communication adapter for lead outbound/inbound (replace mock path used by `1.2.4.8` send) — `v1.00` `2026-08-23`; SMTP `smtp-email` + `POST /leads/messages/inbound/email`; mock fallback when SMTP unset; `test_lead_email_connector_1_4_3_3.py` / Первый реальный communication адаптер (входящие/исходящие лида; заменить mock path `1.2.4.8`)
- [x] 1.4.3.4 — Persist connector config + credentials (no secrets in repo); admin/settings surface as needed — `v1.00` `2026-08-23`; `mailbox_settings` + `/settings/integrations`; owner visual OK; `test_mailbox_settings_1_4_3_4.py` / Персистентность config/credentials (без секретов в репо); admin/settings при необходимости
- [x] 1.4.3.5 — Regression tests + docs checkpoint (erp-check / import-export contour C) — `v1.00` `2026-08-23`; 42 pytest (ingest/email/mailbox/messages/comms/collaboration + `test_external_adapters_1_4_3_5.py`); FE mailbox 5; contour C closed / Регрессия + checkpoint документации (erp-check / контур C)

---

## Stage 2 — Client history, business data, organizations / История клиента, бизнес-данные, организации

**Moved from:** `v0.9.0` items `2.2.3`, `2.3.*`, `2.4.*` (one group); **added** `2.2.4` folders (`2026-08-05`)  
**Перенесено из:** `v0.9.0`, пункты `2.2.3`, `2.3.*`, `2.4.*`; **добавлено** `2.2.4` папки (`2026-08-05`)

> **EN:** `2.2.1` / `2.2.2` closed in `v0.9.0` (list+card on `/sales/clients`). History `2.2.3` owner OK; **folders** `2.2.4` owner OK `2026-08-23`; legal requisites `2.3.1` shipped on card; **segments/duplicates** `2.3.2` shipped `2026-08-24` (stop at owner visual).
> **RU:** `2.2.1` / `2.2.2` закрыты в `v0.9.0`. История `2.2.3` owner OK; **папки** `2.2.4` owner OK `2026-08-23`; юр. реквизиты `2.3.1` на карточке; **сегменты/дубли** `2.3.2` shipped `2026-08-24` (стоп на visual владельца).

### 2.2.3 — Client lead and order history / История лидов и заказов клиента

- [x] 2.2.3.1 — Contract: sources (Lead / SalesOrder), filters, sort, empty states; embeddable on future client card (`2.2.2`) — `v1.00` `2026-08-23`; `SL-CLIENT-HISTORY-v1` `docs/tasks/v1.00-stage-2.2.3-client-history.md` / Контракт: источники (Lead / SalesOrder), фильтры, сортировка, empty states; встраивание на будущую карточку клиента (`2.2.2`)
- [x] 2.2.3.2 — Backend: `GET` client history aggregation (leads + orders) + schemas — `v1.00` `2026-08-23`; `GET /clients/{id}/history`; `client_history` schema/service / Backend: агрегация истории клиента (лиды + заказы) + schemas
- [x] 2.2.3.3 — Frontend: history panel/component wired to API (no demo substitution) — `v1.00` `2026-08-23`; `ClientHistoryPanel` on `/sales/clients/[id]` / Frontend: панель истории на API (без demo)
- [x] 2.2.3.4 — Regression tests (API + FE mapper/unit as applicable) — `v1.00` `2026-08-23`; `test_client_history_2_2_3.py` + `client-history.test.mjs` / Регрессионные тесты (API + FE)
- [x] 2.2.3.5 — Owner visual verification — `v1.00` `2026-08-23`; owner OK `/sales/clients/{id}` history tabs / Визуальная проверка владельцем

### 2.2.4 — Client folders (`/sales/clients`) / Папки клиентов

> **EN:** Organize clients in a folder tree on the list workspace (pattern like product-model / sewing-op folders). Unfiled bucket allowed.  
> **RU:** Организация клиентов по дереву папок на `/sales/clients` (как папки моделей / операций). Допускается «без папки».

- [x] 2.2.4.1 — Contract: folder tree (create/rename/move/reorder); client↔folder link; filter list by folder∪descendants; empty/unfiled bucket — `v1.00` `2026-08-23`; `SL-CLIENT-FOLDERS-v1` `docs/tasks/v1.00-stage-2.2.4-client-folders.md` / Контракт: дерево папок; связь client↔folder; фильтр list; unfiled
- [x] 2.2.4.2 — BE: `ClientFolder` model + migration + API CRUD/move + client `folder_id` — `v1.00` `2026-08-23`; Alembic `v6w7x8y9z012`; `/client-folders` + `PATCH /clients/{id}` / BE: модель папок + API + `folder_id` на Client
- [x] 2.2.4.3 — FE: folders UI on `/sales/clients` (tree + list filter; no demo) — `v1.00` `2026-08-23`; `ClientFolderTree` on list / FE: UI папок на списке клиентов
- [x] 2.2.4.4 — Regression + owner visual — `v1.00` `2026-08-23`; owner OK `/sales/clients` folders; `test_client_folders_2_2_4.py` / Регрессия + визуальная проверка владельцем

### 2.3 — Business data and quality / Бизнес-данные и качество

#### 2.3.1 — Legal details and banking data / Юр. реквизиты и банковские данные

> **EN:** Host `/sales/clients/[clientId]`. MVP fields: **INN**, **bank accounts** (1..n via child table `ClientBankAccount`), **legal address**, **actual (factual) address**. KPP/OGRN only if approved in `2.3.1.1`.  
> **RU:** Карточка `/sales/clients/[clientId]`. MVP: **ИНН**, **банковские счета** (1..n, таблица `ClientBankAccount`), **юридический адрес**, **фактический адрес**.

- [x] 2.3.1.1 — Domain contract: INN + multi bank accounts (`ClientBankAccount`) + legal/actual address (+ optional KPP/OGRN); validation rules — `v1.00` `2026-08-23`; `SL-CLIENT-REQUISITES-v1` `docs/tasks/v1.00-stage-2.3.1-client-requisites.md` / Контракт: ИНН + счета + юр./факт. адрес (+ опц. КПП/ОГРН); валидация
- [x] 2.3.1.2 — Migration + schemas + API read/write (Client fields + bank-account CRUD) — `v1.00` `2026-08-23`; Alembic `w7x8y9z0a123`; `ClientUpdate` + `/clients/{id}/bank-accounts` / Миграция + schemas + API
- [x] 2.3.1.3 — FE section on `/sales/clients/[clientId]` (edit requisites; no interim-only) — `v1.00` `2026-08-23`; `ClientLegalSection` on PT-05 card / FE-секция на карточке клиента
- [x] 2.3.1.4 — Regression + docs checkpoint — `v1.00` `2026-08-23`; `test_client_requisites_2_3_1.py` + `client-requisites.test.mjs` / Регрессия + checkpoint документации

#### 2.3.2 — Segmentation and duplicate detection / Сегментация и дедупликация

- [x] 2.3.2.1 — Contract: segment tags + duplicate match rules (name/phone/INN) — `v1.00` `2026-08-24`; `SL-CLIENT-SEGMENTS-v1` `docs/tasks/v1.00-stage-2.3.2-client-segments-duplicates.md` / Контракт: сегменты + правила дублей (name/phone/INN)
- [x] 2.3.2.2 — Persist segments + duplicate-check service/API — `v1.00` `2026-08-24`; Alembic `x8y9z0a1b234`; `PUT /clients/{id}/segments`; `GET /clients/duplicate-candidates` / Персистентность сегментов + service/API проверки дублей
- [x] 2.3.2.3 — FE: segment UI + duplicate warning on create/edit — `v1.00` `2026-08-24`; `ClientSegmentsSection` + `ClientCreateDrawer` + INN save warning / FE: UI сегментов + предупреждение о дублях
- [x] 2.3.2.4 — Regression tests — `v1.00` `2026-08-24`; `test_client_segments_2_3_2.py` + `client-segments.test.mjs`; stop at owner visual / Регрессионные тесты

#### 2.3.3 — Settlements and financial client state / Взаиморасчёты и фин. состояние клиента

- [ ] 2.3.3.1 — Contract: which balances are SoT (orders/payments Stage 14 vs summary flags); MVP scope / Контракт: SoT балансов (заказы/платежи Stage 14 vs summary); MVP scope
- [ ] 2.3.3.2 — Backend summary API (debt/advance/open orders) — no fake ledger / Backend summary API (долг/аванс/открытые заказы) — без fake ledger
- [ ] 2.3.3.3 — FE settlements summary block / FE-блок сводки взаиморасчётов
- [ ] 2.3.3.4 — Regression + docs; note link to Stage 14 when payments ship / Регрессия + docs; связь со Stage 14 при платежах

### 2.4 — Organizations workspace / Рабочее пространство организаций

#### 2.4.1 — Organizations list and card / Список и карточка организаций

> **EN:** Backend `Organization` + `/organizations` already exist; FE still uses demo `organizationRecords`.  
> **RU:** Backend `Organization` + `/organizations` уже есть; FE ещё на demo `organizationRecords`.

- [ ] 2.4.1.1 — Contract: list/card fields vs existing `OrganizationRead`; drop demo path / Контракт: поля list/card vs `OrganizationRead`; отказ от demo
- [ ] 2.4.1.2 — Extend API if gaps (CRUD/detail) + schemas / Расширить API при пробелах (CRUD/detail) + schemas
- [ ] 2.4.1.3 — Wire `/settings/organizations` list to API (remove `organizationRecords`) / Подключить список `/settings/organizations` к API (убрать `organizationRecords`)
- [ ] 2.4.1.4 — Persistent organization card route + edit / Persistent карточка организации + edit
- [ ] 2.4.1.5 — Regression + owner visual / Регрессия + визуальная проверка владельцем

#### 2.4.2 — Employees directory / Справочник сотрудников

> **EN:** `/settings/organizations/employees` uses demo `employeeRecords`; user linkage → Stage `17.1` / Stage **21** cabinet. Full Settings **Users** list+cabinet UX → **Stage 21** (`/settings/users`); do not duplicate SoT here.  
> **RU:** `/settings/organizations/employees` на demo; связка с users → `17.1` / Stage **21**. Кабинет **Пользователи** → **Stage 21** (`/settings/users`); без дубля SoT.

- [ ] 2.4.2.1 — Domain: Employee entity vs platform User; org/department links (MVP) / Домен: Employee vs platform User; связи org/department (MVP)
- [ ] 2.4.2.2 — DB + migration + schemas + API / БД + миграция + schemas + API
- [ ] 2.4.2.3 — Wire employees list/card UI to API (remove `employeeRecords`) / Подключить UI сотрудников к API (убрать `employeeRecords`)
- [ ] 2.4.2.4 — Regression + owner visual; auth linkage deferred to `17.1` / Stage 21 / Регрессия + visual; auth-связка → `17.1` / Stage 21

---

## Stage 7 — Specifications / Спецификации

**Moved from:** `v0.9.0` Stage 7  
**Перенесено из:** `v0.9.0`, этап 7

> **EN:** Spec = plan+fact **report document** from filled TC + execution (ADR-004/016). Not a prerequisite for TC generate. Documents registry = link index later.  
> **RU:** Спецификация = **документ-отчёт** план+факт из заполненной ТК + исполнения (ADR-004/016). Не prerequisite для generate ТК. Реестр Документы = индекс ссылок позже.

### 7.1 — Domain and persistence / Домен и персистентность

#### 7.1.1 — Specification architecture / Архитектура спецификации

- [ ] 7.1.1.1 — Define specification entities and version lifecycle (from TC / batch context; plan draft vs final plan+fact report) / Сущности спецификации и lifecycle версий (из ТК / batch; plan draft vs итоговый план+факт)
- [ ] 7.1.1.2 — Define material, accessory, norm, and substitute scope sourced from TC composition (+ fact consumption binding) / Scope материалов/норм/замен из состава ТК (+ привязка факта расхода)
- [ ] 7.1.1.3 — Define copy/read contract: assembly + op volumes from order-item / TC; performers / time from execution — not live model edit / Контракт copy/read: сборка + объёмы ops из order-item / ТК; исполнители / время из исполнения — не live-редактирование модели
- [ ] 7.1.1.4 — Documentation checkpoint (Documents registry = link index only; no per-type contour) / Checkpoint документации (реестр Документы = только индекс ссылок)

#### 7.1.2 — Specification database core / Ядро БД спецификаций

- [ ] 7.1.2.1 — Add SQLAlchemy entities / Добавить SQLAlchemy entities
- [ ] 7.1.2.2 — Add Alembic migration / Добавить Alembic migration
- [ ] 7.1.2.3 — Add schemas and backend regression tests / Schemas + backend regression tests

### 7.2 — Specification workflows / Workflows спецификаций

#### 7.2.1 — Specification CRUD API / CRUD API спецификаций

- [ ] 7.2.1.1 — Add repository and service CRUD / Repository + service CRUD
- [ ] 7.2.1.2 — Add endpoints / Endpoints
- [ ] 7.2.1.3 — Add backend regression tests / Backend regression tests

#### 7.2.2 — Specification workspace and card / Workspace и карточка спецификации

- [ ] 7.2.2.1 — Add frontend types and API client / Frontend types + API client
- [ ] 7.2.2.2 — Add workspace/list route (interim; later subsumed by Documents filter) / Workspace/list route (interim; позже Documents filter)
- [ ] 7.2.2.3 — Add detail card (plan+fact blocks; rights-gated edit) / Detail card (блоки план+факт; edit по правам)
- [ ] 7.2.2.4 — Add loading/error states / Loading/error states
- [ ] 7.2.2.5 — Add frontend regression tests / Frontend regression tests
- [ ] 7.2.2.6 — Visual verification / Визуальная проверка

#### 7.2.3 — Link specifications to technical card / order context / Связь спецификаций с ТК / контекстом заказа

- [ ] 7.2.3.1 — Add backend relation fields (technical_card / order item / model / variant / batch references as approved) / Backend relation fields (ТК / позиция заказа / модель / вариант / batch)
- [ ] 7.2.3.2 — Add migration and schemas for specification material + operation (+ fact) lines (snapshot/read from TC + execution) / Миграция + schemas строк материалов/операций (+ факт)
- [ ] 7.2.3.3 — Add service: create Spec version from TC composition + assembly snapshot (plan); refresh fact blocks from execution / Service: создать версию Spec из состава ТК + snapshot сборки (plan); обновить факт из исполнения
- [ ] 7.2.3.4 — Add service validation for active/approved versions where applicable / Валидация active/approved версий
- [ ] 7.2.3.5 — Add workspace/card integration showing plan+fact blocks sourced from TC / execution / Интеграция workspace/card с блоками план+факт из ТК / исполнения
- [ ] 7.2.3.6 — Add regression tests (immutability vs later TC/model edits after Spec approve) / Регрессия (иммутабельность vs правки ТК/модели после approve Spec)

---

## Stage 12 — Warehouse remainder / Остаток склада (12.4–12.5)

**Moved from:** `v0.9.0` `12.4`, `12.5`  
**Перенесено из:** `v0.9.0`, `12.4`, `12.5`

> **EN:** `12.1` structure + `12.2` ledger MVP already shipped in `v0.9.0`. FG docs `12.3` (+ wire `11.2.2.4`) **remain** in `v0.9.0`.  
> **RU:** `12.1` + `12.2` уже в `v0.9.0`. FG `12.3` (+ `11.2.2.4`) **остаются** в `v0.9.0`.

### 12.4 — Inventory / Инвентаризация

- [ ] 12.4.1 — Inventory documents and recount postings / Документы инвентаризации и пересчётные проводки

### 12.5 — Transfers and reserves / Перемещения и резервы

- [ ] 12.5.1 — Transfers between warehouses / Перемещения между складами
- [ ] 12.5.2 — Reserves (sales/production) — later / Резервы (продажи/производство) — later

---

## Stage 13 — Procurement / Закупки

**Moved from:** `v0.9.0` Stage 13  
**Перенесено из:** `v0.9.0`, этап 13

### 13.1 — Supplier contour / Контур поставщиков

- [ ] 13.1.1 — Suppliers and supplier prices / Поставщики и цены поставщиков
- [ ] 13.1.2 — Procurement requests and purchase orders / Заявки на закупку и заказы поставщикам

### 13.2 — Supply execution / Исполнение поставок

- [ ] 13.2.1 — Receipts and returns / Поступления и возвраты
- [ ] 13.2.2 — Demand planning and minimum stock linkage / Планирование потребности и связь с минимальным остатком

---

## Stage 14 — Shipping and Payments / Отгрузка и платежи

**Moved from:** `v0.9.0` Stage 14  
**Перенесено из:** `v0.9.0`, этап 14

### 14.1 — Shipping / Отгрузка

- [ ] 14.1.1 — Shipping orders, packaging, delivery, and documents — on top of already `shipped` warehouse issue (ADR-019); do not duplicate issue / Заказы на отгрузку, упаковка, доставка и документы — **поверх** уже `shipped` (складское списание ADR-019); не дублировать issue

### 14.2 — Payments / Платежи

- [ ] 14.2.1 — Invoices, payments, advances, and debt / Счета, оплаты, авансы и задолженность
- [ ] 14.2.2 — Settlements by order and client / Взаиморасчёты по заказу и клиенту

---

## Stage 15 — Costing and Analytics / Себестоимость и аналитика

**Moved from:** `v0.9.0` Stage 15  
**Перенесено из:** `v0.9.0`, этап 15

### 15.1 — Costing / Себестоимость

- [ ] 15.1.1 — Planned, normative, and actual costing / Плановая, нормативная и фактическая себестоимость
- [ ] 15.1.2 — Margin and plan-fact analysis / Маржа и план-факт анализ

### 15.2 — Analytics / Аналитика

- [x] 15.2.1 — CRM dashboard and base order analytics / CRM-дашборд и базовая аналитика заказов — already shipped in `v0.9.0` / уже закрыто в `v0.9.0`
- [ ] 15.2.2 — ERP analytics and management P&L / ERP-аналитика и управленческий P&L

---

## Stage 16 — Integrations / Интеграции

**Moved from:** `v0.9.0` Stage 16  
**Перенесено из:** `v0.9.0`, этап 16

### 16.1 — External channels / Внешние каналы

> **EN:** Platform channel connectors. Lead **ingest** adapters owned by `1.4.3.*` (shared transport OK, no duplicate CRM SoT).  
> **RU:** Канальные коннекторы платформы. Адаптеры **ingest лидов** — `1.4.3.*` (общий transport OK, без дубля CRM SoT).

- [ ] 16.1.1 — Website forms, email, VK, Telegram, and telephony / Формы сайта, email, VK, Telegram и телефония
- [ ] 16.1.2 — Google Sheets and webhooks / Google Sheets и webhooks

### 16.2 — Enterprise exchange / Корпоративный обмен

> **EN:** Contour **D** (ADR-020). **First slice of `16.2.1`:** import **SalesOrder** (+ lines) from **1C:UNF Excel export** via shared `file_io` + dry-run (not catalog toolbar). Depends on **`0.4`** (create without lead). Column map **deferred** until owner provides a sample UNF workbook. Resolve Client / Nomenclature (variant `external_code` as seed); idempotency via UNF document number → `SalesOrder.number` (or later `external_id`). Commercial import OK without model/routing; TC generate only after eligible PRODUCT lines are completed. Orchestration shell → `16.3`.  
> **RU:** Контур **D**. **Первый срез `16.2.1`:** импорт **заказов покупателя** из **Excel выгрузки 1С:УНФ** (`file_io` + dry-run). Зависит от **`0.4`**. Карта колонок — **позже** (нужен образец файла). Сопоставление клиент/номенклатура; идемпотентность по номеру УНФ. ТК — только после дозаполнения eligible lines. Оркестрация → `16.3`.

- [ ] 16.2.1 — 1C:UNF exchange — contour **D** (ADR-020); **MVP first:** SalesOrder Excel from UNF export (depends `0.4`; column map after sample file); neighbor to universal job shell (`16.3`), not catalog Excel buttons / Обмен с 1С:УНФ — контур **D**; **MVP:** Excel заказов из УНФ (после `0.4`; карта колонок после образца); рядом с `16.3`, не кнопки каталога
- [ ] 16.2.2 — Delivery and payment-system integrations / Интеграции доставки и платёжных систем
- [ ] 16.2.3 — External API for third-party systems / Внешний API для сторонних систем

### 16.3 — Universal import and export (orchestration) / Универсальный импорт и экспорт (оркестрация)

> **EN:** ADR-020: platform **job shell** (section picker + journal) over the same adapters used by section toolbars (`4.5`). Do not pull domain-inline `9.3.2` here.  
> **RU:** ADR-020: платформенная **оболочка заданий** (выбор раздела + журнал) поверх тех же адаптеров, что у тулбаров разделов (`4.5`). Не тянуть сюда доменный inline `9.3.2`.

- [ ] 16.3.1 — Contract: job runner + section adapter registry (upload → map → validate → dry-run → commit; audit hooks) / Контракт: runner заданий + реестр адаптеров разделов (upload → map → validate → dry-run → commit; audit hooks)
- [ ] 16.3.2 — Wire nomenclature adapter from `4.5` into the job shell / Подключить адаптер номенклатуры из `4.5` к оболочке заданий
- [ ] 16.3.3 — Administration UI: jobs list + section picker (no duplicate SoT) / UI администрирования: список заданий + выбор раздела (без дубля SoT)
- [ ] 16.3.4 — Regression tests + documentation checkpoint / Регрессионные тесты + checkpoint документации

---

## Stage 18.4 — Global operations journal / Глобальный журнал операций

**Moved from:** `v0.9.0` `18.4` (full block)  
**Перенесено из:** `v0.9.0`, блок `18.4` целиком

> **EN:** No minimum close in `v0.9.0`. Stubs remain: `product_model_has_journal_operations` / characteristic journal hooks return `False` until this ships. Admin shell `18.1`–`18.3` stay in `v0.9.0`.  
> **RU:** Без минимального закрытия в `v0.9.0`. Stubs остаются до реализации журнала. Оболочка admin `18.1`–`18.3` — в `v0.9.0`.

### 18.4 — Journal microtasks / Микрозадачи журнала

- [ ] 18.4.1 — Domain contract: OperationJournal entry fields, sources (sales / production), idempotency, retention / Контракт: поля записи, источники (sales / production), idempotency, retention
- [ ] 18.4.2 — Database model, migration, schemas for global operations journal / Модель БД, миграция, schemas
- [ ] 18.4.3 — Service API: append / query by entity (`product_model_id`, …); `has_operations(entity)` helper / Service API: append / query; helper `has_operations`
- [ ] 18.4.4 — Write path: sales order uses model → append journal row (no write if model not used) / Write path: продажа с моделью → строка журнала
- [ ] 18.4.5 — Write path: production / ТК uses model → append journal row / Write path: производство / ТК → строка журнала
- [ ] 18.4.6 — Wire product-model guards (`revert_to_draft`, size-grid change) to real `has_operations` (replace Stage-6 stub) / Подключить guards модели к реальному `has_operations` (заменить stub)
- [ ] 18.4.7 — Administration UI: journal list/filter (PT-02) under Администрирование → Журнал операций / UI администрирования: список/фильтр журнала
- [ ] 18.4.8 — Regression tests + documentation checkpoint / Регрессия + checkpoint документации

---

## Stage 20 — Lead / Order card UX + unified messaging / UX карточек лида / заказа + единая переписка

**New in:** `v1.00` (owner UX package `2026-08-05`)  
**Новое в:** `v1.00` (UX-пакет владельца `2026-08-05`)

> **EN:** Do not re-open closed `v0.9.0` `3.5.*` or Stage `19`. External CRM channels stay `1.4.3` / `LeadMessage`. Stage `19` (ADR-026) remains the staff collaboration platform on order/TC; Stage 20 unifies UX / optional shared shell with lead.  
> **RU:** Не переоткрывать закрытые `3.5.*` / Stage `19` в `v0.9.0`. Внешние CRM-каналы — `1.4.3` / `LeadMessage`. Stage `19` (ADR-026) — платформа staff chat на заказе/ТК; Stage 20 — паритет UX / общий shell с лидом.

### 20.1 — Lead: Client need field cleanup / Лид: очистка «Потребность клиента»

> **EN:** Remove from lead commercial block (`lead-commercial-details.tsx`): `productType`, `kitQuantity`, `estimatedAmount`, `sizeComment`, `desiredReadyDate`, `eventDate`.  
> **RU:** Убрать из блока: Тип продукции, Количество комплектов, Предполагаемая сумма, Размерный ряд/комментарии, Желаемая дата готовности, Дата мероприятия.

- [x] 20.1.1 — Contract: retain vs remove vs hide for each field; impact on convert-to-order / order sync (`20.4.2`) — `v1.00` `2026-08-05`; `SL-LEAD-NEED-CLEANUP-v1`; task `docs/tasks/v1.00-stage-20.1-lead-need-cleanup.md`; hide UI / retain DB; convert keeps `estimated_amount`+`desired_date` / Контракт закрыт
- [x] 20.1.2 — BE + FE: drop or hide fields from API/schema/UI (migration if columns retired) — `v1.00` `2026-08-05`; hide 6 fields in `lead-commercial-details.tsx`; PATCH omit via `toApiLeadCommercialPayloadOmittingNeedCleanup`; no DROP / UI hide + omit PATCH
- [x] 20.1.3 — Regression tests + docs checkpoint — `v1.00` `2026-08-05`; FE omit + convert mapper tests; BE convert amount/desired_date; task checklist closed / Регрессия OK

### 20.2 — Lead: Card template layout / Лид: шаблон карточки

> **EN:** Host `lead-page.tsx`: key metrics under stage/kanban rail; activity history full width at page bottom; tasks + notes **50/50**.  
> **RU:** Метрики вверх под стадии канбан; история на всю ширину внизу; задачи и заметки 50/50.

- [x] 20.2.1 — Layout wire: metrics up; history full-width bottom; tasks/notes 50/50 — `v1.00` `2026-08-05`; `lead-page.tsx` + `globals.css` `.lead-bottom-grid` / `.lead-history-card`; skeleton synced / Layout wired
- [x] 20.2.2 — Owner visual verification (desktop + mobile matrix) — `v1.00` `2026-08-05`; owner OK; commercial extra-params wrap fix / Visual OK

### 20.3 — Unified internal messaging (CRM lead ↔ Stage 19) / Единая внутренняя переписка

> **EN:** Analyze merge of lead CRM communications UI with order `OrderCollaborationPanel` / Stage `19`. Prefer shared platform UX; keep external channel SoT separate (`LeadMessage` / `1.4.3`).  
> **RU:** Анализ совмещения CRM-коммуникаций лида с панелью заказа / Stage `19`. Общий UX платформы; внешние каналы отдельно.

- [x] 20.3.1 — Contract / ADR note: shared UI shell vs shared thread SoT; boundaries vs `LeadMessage` external — `v1.00` `2026-08-05`; `ADR-027`; task `docs/tasks/v1.00-stage-20.3-unified-messaging.md`; shared UI + XOR lead/order thread; no convert merge; external stays `LeadMessage` / Контракт закрыт
- [x] 20.3.2 — Implement chosen unify (shared component and/or wire lead to collaboration platform) — `v1.00` `2026-08-05`; migration `l5m6n7o8p901`; `/leads/{id}/collaboration/*`; `OrderCollaborationPanel` leadId; CRM panel without `internal` / Unify wired
- [x] 20.3.3 — Regression + docs (`order-card-field-links.md` / ADR cross-ref) — `v1.00` `2026-08-05`; `test_collaboration_lead_20_3_2.py` + Stage 19; field-links + ADR-026↔027 / Docs OK

### 20.4 — Sales order card parity with lead / Паритет карточки заказа с лидом

> **EN:** Host `/sales/orders/[id]` (`sales-order-page.tsx`). Remove **Резерв** / **Дизайн** from «Основные сведения» (hide from block; do not blindly delete domain). Sync client-need with lead after `20.1`. Metrics visual parity with lead. Internal chat look + sync via `20.3`. **Create order without Lead** owned by Stage **`0.4`** (not this block).  
> **RU:** Убрать Резерв и Дизайн из «Основные сведения». Синхронизировать «Потребность клиента» с лидом. Метрики как у лида. Внутренняя переписка — вид как у лида + sync через `20.3`. **Создание заказа без лида** — Stage **`0.4`**.

- [x] 20.4.1 — Remove Reserve / Design from order «Основные сведения» (relocate only if process still requires) — `v1.00` `2026-08-05`; hidden from `sales-order-page.tsx` basics; domain fields/API retained / Убраны из UI
- [x] 20.4.2 — Client-need block: transfer + sync fields with lead (post-`20.1` set) — `v1.00` `2026-08-05`; `PATCH /orders/{id}/client-need` + `OrderClientNeedDetails`; sync sport/category/qty/desired_date/source/description → lead / Sync OK
- [x] 20.4.3 — Key metrics visual parity with lead «Ключевые метрики лида» — `v1.00` `2026-08-05`; MetricCard grid + editors below; metrics first in top grid / Parity wired
- [x] 20.4.4 — Internal collaboration panel: lead-like appearance + sync with `20.3` unify — `v1.00` `2026-08-05`; shared `OrderCollaborationPanel` (orderId); same shell as lead / Shared shell
- [x] 20.4.5 — Owner visual + docs checkpoint (erp-check / project-structure as applicable) — `v1.00` `2026-08-05`; owner OK; erp-check + project-structure Stage 20 notes / Stage 20 closed

---

## Stage 21 — Settings / Users cabinet (Пользователи) / Настройки / Пользователи (кабинет)

**New in:** `v1.00` (owner ask `2026-08-05`)  
**Новое в:** `v1.00` (запрос владельца `2026-08-05`)

> **EN:** Rename Settings «Сотрудники»→«Пользователи»; route `/settings/users`. Extend closed `17.1.2.5` role-assign UI into full user list + cabinet + flexible access (ADR-024). Org HR directory `/settings/organizations/employees` stays **`2.4.2`**. Bitrix-only extras (gratitude, Disk/Mail/Analytics tabs, mobile/desktop app install columns, 2FA UI) deferred in `21.1.2`.  
> **RU:** Переименовать «Сотрудники»→«Пользователи»; маршрут `/settings/users`. Расширить закрытый `17.1.2.5` до списка + кабинета + гибкого доступа. Org-справочник сотрудников — **`2.4.2`**. Bitrix extras — deferred в `21.1.2`.

### 21.1 — Placement, rename, domain contract / Размещение, rename, контракт

- [x] 21.1.1 — Nav/settings copy: «Сотрудники»→«Пользователи» for this cabinet; keep or redirect `/settings/organizations/employees` per contract (no duplicate SoT) — `v1.00` `2026-08-05`; already «Пользователи» `/settings/users`; org «Сотрудники» stays `2.4.2`; task `docs/tasks/v1.00-stage-21.1-users-cabinet.md` / Rename OK
- [x] 21.1.2 — Domain contract: `PlatformUser` profile fields vs Employee (`2.4.2`); invite/pending; access extension of ADR-024; MVP fields from screens vs deferred (2FA, app install, gratitude, Bitrix tabs) — `v1.00` `2026-08-05`; `SL-USERS-CABINET-v1` in task file / Контракт закрыт

### 21.2 — Users list (`/settings/users`) / Список пользователей

- [x] 21.2.1 — List UX: search, status filters (active / invited / pending), invite action, columns MVP (id, name+avatar, department, email, phone, last activity) — PT-02 — `v1.00` `2026-08-05`; filters all/active/inactive; columns + initials; invite CTA until `21.2.2`; profile cols placeholder / List UX
- [x] 21.2.2 — BE: list/filter/invite APIs as needed (extend platform-users; no demo substitution) — `v1.00` `2026-08-05`; migration `m6n7o8p9q012`; `GET /platform-users?q&status`; `POST /platform-users/invite`; FE list wired; `test_platform_users_invite_21_2_2.py` / BE: list/filter/invite API

### 21.3 — User cabinet / profile panel / Кабинет пользователя

- [x] 21.3.1 — Profile panel/drawer or card: contact block (name, email, department, manager, position, language), document/extra/about MVP; Security entry — `v1.00` `2026-08-05`; `PlatformUserProfilePanel` overlay; row click; Security scroll entry; stubs document/extra/about / Панель профиля: контакты + секции MVP; вход в Безопасность
- [x] 21.3.2 — Persist profile fields (model/migration/API) + FE wire — `v1.00` `2026-08-05`; `PATCH /platform-users/{id}`; editable cabinet; `test_platform_user_profile_21_3_2.py` (migration already `m6n7o8p9q012`) / Персистентность полей профиля + FE

### 21.4 — Flexible platform access / Гибкий доступ к платформе

- [x] 21.4.1 — Access UI beyond checkbox role grid: roles + readable permission/module access (`admin.roles.assign` / ADR-024 amend if needed) — `v1.00` `2026-08-05`; `PlatformAccessMatrix` + `buildAccessMatrix`; no new perm codes / UI доступа: роли + матрица прав/модулей
- [x] 21.4.2 — Wire security/access from cabinet; deny-by-default unchanged — `v1.00` `2026-08-05`; Security: role toggles + effective perms + open matrix; no per-user overrides / Wire безопасности из кабинета; deny-by-default без изменений

### 21.5 — Regression, visual, docs / Регрессия, visual, docs

- [x] 21.5.1 — Regression (API + FE) + owner visual (list + cabinet) — `v1.00` `2026-08-05`; pytest invite/profile/RBAC + FE helpers; owner visual OK list+cabinet+matrix / Регрессия + owner visual
- [x] 21.5.2 — Docs: navigation, erp-check/project-structure, cross-ref `2.4.2` / `17.1.2` — `v1.00` `2026-08-05`; nav «Пользователи» vs org «Сотрудники»; Stage 21 note on checklists / Checkpoint документации

---

## Stage 22 — Design v1.0 / Дизайн v1.0

**New in:** `v1.00` (owner approved HTML etalons `2026-08-05`)  
**Новое в:** `v1.00` (утверждённые HTML-эталоны `2026-08-05`)

> **EN:** Soft UI + flat buttons from `docs/design/` into live page content. Process SoT: `docs/design/design-v1-process.md` (`SL-DESIGN-V1-PROCESS-v1`). Task: `docs/tasks/v1.00-stage-22-design-v1.md`. Do **not** re-open Stage `20` data contracts. Stage **22** closed: live through boards `22.3.4` + shell `22.9.4`.  
> **RU:** Soft UI + flat из `docs/design/` в live-контент. Процесс: `design-v1-process.md`. Не переоткрывать Stage `20`. Stage **22** закрыт: live доски `22.3.4` + shell `22.9.4`.

### 22.0 — Process / Процесс

- [x] 22.0.1 — Write `SL-DESIGN-V1-PROCESS`: rules for adding tasks, new sections `22.N`, and patches (`22.N.M.P` / `B*`); etalon-first + MD↔HTML atomic — `v1.00` `2026-08-05`; `docs/design/design-v1-process.md` (`SL-DESIGN-V1-PROCESS-v1`) / Правила задач, разделов и патчей
- [x] 22.0.2 — Register approved etalons (Lead + Order) on `docs/design/index.html` + process registry; link Stage `22.1`/`22.2` hosts — `v1.00` `2026-08-05`; index + process registry / Реестр утверждённых эталонов Лид + Заказ

### 22.1 — Sales · Lead card / Продажи · Карточка лида

> **EN:** Etalon `docs/design/sales/lead-card-reference-v1.html` → `/sales/leads/[id]` (`lead-page.tsx`). Soft UI panels + flat actions; existing fields only.  
> **RU:** Эталон лида → live карточка. Soft UI + flat; только существующие поля.

- [x] 22.1.1 — Contract: etalon → host mapping; Soft UI + flat; field map; shell preserved; out-of-scope vs Stage `20` — `v1.00` `2026-08-05`; `SL-DESIGN-V1-LEAD-v1` in task `v1.00-stage-22-design-v1.md` / Контракт эталон → хост
- [x] 22.1.2 — FE Soft UI layout: header / stages / metrics / tabs / panels per etalon — `v1.00` `2026-08-05`; `.sl-design-v1` on `lead-page.tsx` + Soft UI CSS / FE layout Soft UI
- [x] 22.1.3 — FE flat buttons on lead card actions — `v1.00` `2026-08-05`; flat secondary via `.sl-design-v1` button rules / FE flat-кнопки
- [x] 22.1.4 — Owner visual (desktop + responsive matrix) + docs checkpoint — `v1.00` `2026-08-22`; owner OK `/sales/leads/1001`; erp-check / project-structure / task / Design v1.0 process / Owner visual + docs

### 22.2 — Sales · Sales order card / Продажи · Заказ покупателя

> **EN:** Etalon `docs/design/sales/order-card-reference-v1.html` → `/sales/orders/[id]` (`sales-order-page.tsx`). Compact finance rail **right**, always visible; view filters hide **left** only.  
> **RU:** Эталон заказа → live. Финансы справа компактно и всегда; фильтры скрывают только левую колонку.

- [x] 22.2.1 — Contract: finance rail right sticky compact; filters left-only; Soft UI + flat; field map; shell preserved — `v1.00` `2026-08-05`; `SL-DESIGN-V1-ORDER-v1` / Контракт finance rail + фильтры
- [x] 22.2.2 — FE: relocate finance metrics to right rail (compact 2×3; always visible) — `v1.00` `2026-08-05`; `order-v1-layout` + `order-v1-aside` finance rail / FE финансы справа
- [x] 22.2.3 — FE: view-mode filters must not hide right aside — `v1.00` `2026-08-05`; `metrics: true` all modes; aside not filter-gated / FE фильтры не скрывают правую колонку
- [x] 22.2.4 — FE Soft UI panels + flat buttons on order card — `v1.00` `2026-08-05`; `.sl-design-v1` on order workspace / FE Soft UI + flat
- [x] 22.2.5 — Owner visual + docs (field-links layout note if needed) — `v1.00` `2026-08-22`; owner OK `/sales/orders/1`; finance rail layout note in `order-card-field-links.md` / Owner visual + docs

### 22.3 — Sales · boards / lists / Продажи · доски / списки

> **EN:** Approved etalon `docs/design/sales/leads-board-reference-v1.html` (PT-03 Soft UI). Hosts ≈ `/sales/leads` (primary) + `/sales/orders` (same chrome). Existing fields only.  
> **RU:** Утверждённый эталон досок продаж. Хосты `/sales/leads` и `/sales/orders`.

- [x] 22.3.1 — Owner visual OK on Sales boards Soft UI etalon — `v1.00` `2026-08-23`; owner OK `docs/design/sales/leads-board-reference-v1.html` / Owner visual эталона досок
- [x] 22.3.2 — Contract: etalon → leads/orders boards; Soft UI + flat; existing fields only; shell via `22.9` — `v1.00` `2026-08-23`; `SL-DESIGN-V1-BOARDS-v1` in task / Контракт эталон → доски
- [x] 22.3.3 — FE Soft UI migrate `/sales/leads` + `/sales/orders` per approved etalon — `v1.00` `2026-08-23`; `.sl-design-v1` on `lead-workspace.tsx` + `kanban-page.tsx` / FE Soft UI доски
- [x] 22.3.4 — Owner visual on live sales boards + docs — `v1.00` `2026-08-23`; owner OK `/sales/leads` + `/sales/orders` / Owner visual live + docs

### 22.4 — Production / Производство

> **EN:** Approved etalon `docs/design/production/orders-workspace-reference-v1.html` (KPI + list + shop stage hubs). Hosts ≈ `/production/orders` (primary; `/production` dashboard route has no page).  
> **RU:** Утверждённый эталон производства. Хост `/production/orders`.

- [x] 22.4.1 — Owner visual OK on Production Soft UI etalon (desktop + responsive) — `v1.00` `2026-08-22`; owner OK `docs/design/production/orders-workspace-reference-v1.html` / Owner visual эталона производства
- [x] 22.4.2 — Contract: etalon → production hosts; Soft UI + flat; existing fields only; shell via `22.9` — `v1.00` `2026-08-22`; `SL-DESIGN-V1-PROD-v1` in task / Контракт эталон → хосты
- [x] 22.4.3 — FE Soft UI migrate production workspace per approved etalon — `v1.00` `2026-08-22`; `production-orders-workspace.tsx` + `.sl-design-v1`; KPI from existing PO status / FE Soft UI производство
- [x] 22.4.4 — Owner visual on live production pages + docs checkpoint — `v1.00` `2026-08-22`; owner OK `/production/orders`; erp-check / project-structure / task / Owner visual live + docs

### 22.5 — Warehouse / Склад

> **EN:** Approved etalon `docs/design/warehouse/stock-workspace-reference-v1.html` (tree + list + movements). Host ≈ `/warehouse/stock`.  
> **RU:** Утверждённый эталон склада (дерево + список).

- [x] 22.5.1 — Owner visual OK on Warehouse Soft UI etalon — `v1.00` `2026-08-22`; owner OK `docs/design/warehouse/stock-workspace-reference-v1.html` / Owner visual эталона склада
- [x] 22.5.2 — Contract: tree+list Soft UI; existing stock fields; shell via `22.9` — `v1.00` `2026-08-22`; `SL-DESIGN-V1-WH-v1` in task / Контракт
- [x] 22.5.3 — FE Soft UI migrate warehouse stock workspace — `v1.00` `2026-08-22`; `warehouse-nomenclature-workspace.tsx` + `.sl-design-v1`; in-stock count from ledger / FE Soft UI склад
- [x] 22.5.4 — Owner visual on live warehouse + docs — `v1.00` `2026-08-22`; owner OK `/warehouse/stock`; erp-check / project-structure / task / Owner visual live + docs

### 22.6 — Purchases / Закупки

> **EN:** Approved etalon `docs/design/purchases/hub-reference-v1.html`. Host ≈ `/purchases`.  
> **RU:** Утверждённый эталон закупок.

- [x] 22.6.1 — Owner visual OK on Purchases Soft UI etalon — `v1.00` `2026-08-22`; owner OK `docs/design/purchases/hub-reference-v1.html` / Owner visual эталона закупок
- [x] 22.6.2 — Contract: hub + PO list Soft UI; existing fields; shell via `22.9` — `v1.00` `2026-08-22`; `SL-DESIGN-V1-PUR-v1` in task; no Stage 13 API / Контракт
- [x] 22.6.3 — FE Soft UI migrate purchases hub — `v1.00` `2026-08-22`; `/purchases` + `purchases-hub-workspace.tsx`; empty PO/suppliers (no demo) / FE Soft UI закупки
- [x] 22.6.4 — Owner visual on live purchases + docs — `v1.00` `2026-08-22`; owner OK `/purchases`; erp-check / project-structure / task / Owner visual live + docs

### 22.7 — Settings / Platform / Настройки / Платформа

> **EN:** Approved etalon `docs/design/settings/hub-reference-v1.html`. Host ≈ `/settings` (+ Stage 21 users hub link).  
> **RU:** Утверждённый эталон настроек.

- [x] 22.7.1 — Owner visual OK on Settings Soft UI etalon — `v1.00` `2026-08-22`; owner OK `docs/design/settings/hub-reference-v1.html` / Owner visual эталона настроек
- [x] 22.7.2 — Contract: settings hub Soft UI; catalogs/org/users links; shell via `22.9` — `v1.00` `2026-08-22`; `SL-DESIGN-V1-SET-v1` in task / Контракт
- [x] 22.7.3 — FE Soft UI migrate settings hub — `v1.00` `2026-08-22`; `/settings` + `.sl-design-v1`; existing catalog/org/users links / FE Soft UI настройки
- [x] 22.7.4 — Owner visual on live settings + docs — `v1.00` `2026-08-23`; owner OK `/settings`; erp-check / project-structure / task / Owner visual live + docs

### 22.8 — Dashboard / Home / Главная / Дашборд

> **EN:** Approved etalon `docs/design/dashboard/home-reference-v1.html` (typical Soft UI dashboard: KPI strip, chart stub, activity, shortcuts). Host ≈ `/dashboard`.  
> **RU:** Типовой Soft UI дашборд.

- [x] 22.8.1 — Owner visual OK on Dashboard Soft UI etalon — `v1.00` `2026-08-22`; owner OK `docs/design/dashboard/home-reference-v1.html` / Owner visual эталона дашборда
- [x] 22.8.2 — Contract: dashboard template Soft UI; existing KPIs/widgets only; shell via `22.9` — `v1.00` `2026-08-23`; `SL-DESIGN-V1-DASH-v1` in task; no demo KPI / Контракт
- [x] 22.8.3 — FE Soft UI migrate dashboard home — `v1.00` `2026-08-23`; `/dashboard` + `home-workspace.tsx`; shortcuts to live routes / FE Soft UI дашборд
- [x] 22.8.4 — Owner visual on live dashboard + docs — `v1.00` `2026-08-23`; owner OK `/dashboard` + `/sales/dashboard` Recharts dynamics; erp-check / project-structure / task / Owner visual live + docs

### 22.9 — Soft UI shell chrome (left + top) / Soft UI оболочка (лево + топ)

> **EN:** Approved etalon `docs/design/shared/shell-reference-v1.html` (+ `shell.js` labeled rail + top search/tabs/CTA). Contract `SL-DESIGN-V1-SHELL-v1` + live FE + owner visual `22.9.4`. Nav structure still from `frontend/lib/navigation.ts`.  
> **RU:** Эталон, контракт, FE и owner visual оболочки закрыты.

- [x] 22.9.1 — Owner visual OK on Soft UI shell etalon (desktop + responsive) — `v1.00` `2026-08-22`; owner OK `docs/design/shared/shell-reference-v1.html` / Owner visual эталона shell
- [x] 22.9.2 — Contract: Soft UI rail+topbar vs `DS-SHELL-01/02`; preserve nav from `navigation.ts`; explicit owner gate — `v1.00` `2026-08-23`; `SL-DESIGN-V1-SHELL-v1` in task; live files still frozen / Контракт shell
- [x] 22.9.3 — FE Soft UI migrate `app-sidebar.tsx` + `top-navigation.tsx` per approved etalon (only after `22.9.1`) — `v1.00` `2026-08-23`; `.sl-shell-v1` + rail 220px; nav from `navigation.ts` / FE Soft UI shell
- [x] 22.9.4 — Owner visual on live shell + report `DS-SHELL-01/02 visual contract preserved` or updated contracts — `v1.00` `2026-08-23`; owner OK live shell; `shell-contracts.md` 220px + Soft UI cards / Owner visual live + contracts

---

## Stage 23 — Unified Work Tasks module / Единый модуль Задачи

**New in:** `v1.00` (owner design OK `2026-08-06`)  
**Новое в:** `v1.00` (дизайн утверждён `2026-08-06`)

> **EN:** Replace `LeadTask` + `CollaborationMicrotask` with `WorkTask` (цех=`ProductionStage`, responsible/executor=`PlatformUser`, XOR lead|order|production_order, Telegram-like chat + images, `storage/task-media`). Live `/sales/tasks`. Leave `CollaborationMessage` object staff chat. Spec: `docs/superpowers/specs/2026-08-06-unified-tasks-module-design.md`. ADR-028. Task: `docs/tasks/v1.00-stage-23-unified-tasks.md`. Do **not** reopen Stage 19 message SoT; do **not** change DS-SHELL without `22.9`.  
> **RU:** Замена LeadTask + microtasks на WorkTask (цех, ответственный/исполнитель, якорь, чат с картинками). Live `/sales/tasks`. Object staff-чат CollaborationMessage не трогаем в MVP.

### 23.0 — Contract / Контракт

- [x] 23.0.1 — ADR-028 + design contract (`SL-WORK-TASKS-v1`); boundaries vs `1.2.4` / `19` / `20` — `v1.00` `2026-08-06`; ADR-028; spec + task file / Контракт + ADR закрыты

### 23.1 — Database + file storage / БД + хранение файлов

- [x] 23.1.1 — SQLAlchemy models `WorkTask` / `WorkTaskMessage` / `WorkTaskAttachment` + XOR CHECK — `v1.00` `2026-08-06`; `models/work_tasks.py`; `test_work_tasks_23_1_1.py` / Модели + XOR
- [x] 23.1.2 — Alembic migration (upgrade/downgrade) — `v1.00` `2026-08-06`; `o8p9q0r1s234_work_tasks.py` / Alembic
- [x] 23.1.3 — Storage helper `storage/task-media/{task_id}/…` + mime allowlist — `v1.00` `2026-08-06`; `services/work_task_media.py`; `test_work_task_media_23_1_3.py` / Storage helper

### 23.2 — API / API

- [x] 23.2.1 — `GET/POST /work-tasks`, `GET/PATCH /work-tasks/{id}` — `v1.00` `2026-08-06`; `api/work_tasks.py` + `test_work_tasks_api_23_2_1.py` / CRUD задач
- [x] 23.2.2 — Messages + multipart image upload + file download — `v1.00` `2026-08-06`; messages endpoints + `test_work_tasks_messages_23_2_2.py` / Чат + файлы
- [x] 23.2.3 — Embed lists: lead / order / production-order — `v1.00` `2026-08-06`; embeds_router + `test_work_tasks_embeds_23_2_3.py` / Embed lists
- [x] 23.2.4 — Focused pytest (XOR, filters, upload) — `v1.00` `2026-08-06`; `test_work_tasks_*` suite / Pytest

### 23.3 — FE Sales tasks list / FE список Продажи → Задачи

- [x] 23.3.1 — Replace demo Kanban `/sales/tasks` with live API list (status, цех, responsible, executor, object) — `v1.00` `2026-08-06`; `work-tasks-workspace.tsx` + `lib/work-tasks.ts`; demo Kanban removed / Live list
- [x] 23.3.2 — Filters + slim list DTO (list-page rules) — `v1.00` `2026-08-06`; `WorkTaskListItem` + embeds; `anchor_type`; `test_work_tasks_list_23_3_2.py` / Filters + slim DTO
- [x] 23.3.3 — Create-task drawer (anchor, stage, people) — `v1.00` `2026-08-06`; `work-task-create-drawer.tsx` + `createWorkTask` / Create drawer

### 23.4 — FE task chat card / FE карточка-чат

- [x] 23.4.1 — Route `/sales/tasks/[id]` header + message timeline — `v1.00` `2026-08-06`; `work-task-chat-panel.tsx` + `listWorkTaskMessages` / Chat page
- [x] 23.4.2 — Composer: text + image upload — `v1.00` `2026-08-06`; composer + `/api/work-tasks/.../file` proxy / Composer + images

### 23.5 — Hosts + deprecate old UI / Хосты + вывод старого UI

- [x] 23.5.1 — Lead card Tasks tab → WorkTask — `v1.00` `2026-08-06`; `HostWorkTasksPanel` + `GET /leads/{id}/work-tasks` / Лид
- [x] 23.5.2 — Sales order Tasks tab → WorkTask — `v1.00` `2026-08-06`; order aside Tasks + `GET /orders/{id}/work-tasks` / Заказ
- [x] 23.5.3 — Production order Tasks surface → WorkTask — `v1.00` `2026-08-06`; PO card panel + `GET /production-orders/{id}/work-tasks` / ПО
- [x] 23.5.4 — Remove primary LeadTask panel + collaboration microtasks UI — `v1.00` `2026-08-08`; lead-page LeadTask dialogs removed; OrderCollaborationPanel microtasks UI removed (API retained for `23.6.1`) / Deprecate UI

### 23.6 — Data migration + regression + visual / Миграция данных + регрессия + visual

- [x] 23.6.1 — Alembic data migrate `LeadTask` + `CollaborationMicrotask` → `WorkTask` — `v1.00` `2026-08-08`; `p9q0r1s2t345_migrate_lead_tasks_microtasks_to_work_tasks.py` + `work_task_migration.py`; `test_work_task_migration_23_6_1.py` / Data migrate
- [x] 23.6.2 — Regression (API + FE) + docs checkpoint (erp-check / project-structure / field-links) — `v1.00` `2026-08-08`; work-tasks pytest + `lib/work-tasks.test.mjs`; erp-check / project-structure / field-links synced / Регрессия + docs
- [x] 23.6.3 — Owner visual (list + chat + host tabs) — `v1.00` `2026-08-22`; owner OK / Owner visual

### 23.7 — Order context + chat visual design / Контекст заказа + дизайн чата

> **EN:** Close the WorkTaskRead list-vs-detail DTO gap (real stage/responsible/executor names on the chat header) and surface Sales Order context (number, client, status, amount, desired date) on tasks anchored to `sales_order_id`, plus an overdue-deadline badge. Chat visual pass via `/plugin frontend-design`. Plan: `docs/superpowers/plans/2026-08-08-work-tasks-order-context.md`.
> **RU:** Закрыть разрыв list/detail DTO в `WorkTaskRead` (реальные имена цеха/ответственного/исполнителя в шапке чата) и показать контекст Заказа покупателя (номер, клиент, статус, сумма, срок) для задач с якорем `sales_order_id`, плюс бейдж просроченного дедлайна. Визуальная доработка чата через `/plugin frontend-design`. План: `docs/superpowers/plans/2026-08-08-work-tasks-order-context.md`.

- [x] 23.7.1 — `WorkTaskRead` schema: display names + `sales_order_summary` — `v1.00` `2026-08-22`; `WorkTaskSalesOrderSummary`; `test_work_tasks_api_23_2_1.py` / Схема: имена + сводка заказа
- [x] 23.7.2 — Service enrichment `_to_read` (stage/user names, SalesOrder→Client join) — `v1.00` `2026-08-22`; `_sales_order_summary` in `work_tasks.py` / Обогащение сервиса
- [x] 23.7.3 — FE `lib/work-tasks.ts`: map order summary + real names — `v1.00` `2026-08-22`; `fromApiWorkTask` + `lib/work-tasks.test.mjs` / FE mapper
- [x] 23.7.4 — Chat panel visual redesign (order info card, overdue badge) via `/plugin frontend-design` — `v1.00` `2026-08-22`; order card + existing overdue badge in `WorkTaskChatPanel` / Визуал чата
- [x] 23.7.5 — Backend + frontend regression pass (pytest, node --test, tsc) — `v1.00` `2026-08-22`; work-tasks pytest 16 passed; `lib/work-tasks.test.mjs` 9 passed / Регрессия

### 23.8 — Chat bubbles + list/kanban board stages / Пузыри чата + Канбан стадии

> **EN:** Chat: mine right / others left with session colors. `/sales/tasks` toggle List|Kanban. Separate `work_task_board_stages` CRUD + `work_tasks.board_stage_id` (status enum unchanged). Spec: `docs/superpowers/specs/2026-08-08-work-tasks-chat-kanban-design.md`.
> **RU:** Чат: свои справа / чужие слева. Переключатель Список|Канбан. Отдельные стадии доски CRUD + `board_stage_id`. Spec: `2026-08-08-work-tasks-chat-kanban-design.md`.

- [x] 23.8.1 — Model + Alembic: `work_task_board_stages` seed + `work_tasks.board_stage_id` — `v1.00` `2026-08-08`; `q1r2s3t4u567_add_work_task_board_stages.py` / Модель + миграция
- [x] 23.8.2 — Board stages CRUD API + WorkTask list/update `board_stage_id` — `v1.00` `2026-08-08`; `/work-task-board-stages` + PATCH task; `test_work_task_board_stages_23_8.py` / API стадий + patch задачи
- [x] 23.8.3 — Chat bubbles: mine right / others left + session tint — `v1.00` `2026-08-08`; `WorkTaskChatPanel` + `viewerUserId` / Пузыри чата
- [x] 23.8.4 — FE List|Kanban toggle + stage add/rename/delete + move task — `v1.00` `2026-08-08`; `?view=kanban` + `WorkTasksKanbanBoard` / FE Канбан
- [x] 23.8.5 — Focused tests (BE stages + FE helpers) — `v1.00` `2026-08-08`; pytest board stages + `lib/work-tasks.test.mjs` / Тесты
- [x] 23.8.6 — Owner visual (chat sides + list/kanban) — deferred into modal/chat UX pass `2026-08-08` / Owner visual

### 23.9 — Task chat modal + header enrichment / Модальный чат + шапка

- [x] 23.9.1 — `created_by_platform_user_id` + detail/list display names — `v1.00` `2026-08-08`; Alembic `r2s3t4u5v678` / Назначил
- [x] 23.9.2 — `WorkTaskChatModal` from list/kanban/hosts (lead/order/PO) — `v1.00` `2026-08-08` / Модальный чат
- [x] 23.9.3 — Kanban stage `+` in header; full-width list; image lightbox; due-soon highlight — `v1.00` `2026-08-08` / UX канбан/срок
- [x] 23.9.4 — Owner visual (modal chat + due-soon + header) — `v1.00` `2026-08-22`; owner OK / Owner visual

### 23.10 — Status ↔ board stage sync / Статус ↔ стадия

- [x] 23.10.1 — Server sync: `done` ↔ «Готово»; reopen leaves terminal column — `v1.00` `2026-08-10`; `update_work_task` + repair Alembic `s3t4u5v6w789` / Синхронизация
- [x] 23.10.2 — Task chat UI: status + stage selects, close/reopen — `v1.00` `2026-08-10`; `WorkTaskChatPanel` / UI в задаче
- [x] 23.10.3 — Focused tests (status/board sync) — `v1.00` `2026-08-10`; `test_work_task_status_board_sync.py` / Тесты
- [x] 23.10.4 — Owner visual (close → Готово on kanban) — `v1.00` `2026-08-22`; owner OK / Owner visual

---

## Version gate / Шлюз версии

`v1.00` execution begins after / Исполнение `v1.00` начинается после:

1. Owner confirms `v0.9.0` close / владелец подтверждает закрытие `v0.9.0`
2. Active docs pointer moves to this file / активный указатель документов переключается сюда
3. Further carry-overs or new microtasks are added here with HTML twin sync / дальнейшие переносы и новые микрозадачи добавляются сюда с синхронизацией HTML

## Change log / Журнал изменений

| Date | EN | RU |
|---|---|---|
| `2026-08-01` | Initial draft scaffold (candidates A–J) | Первичный каркас кандидатов A–J |
| `2026-08-01` | Confirmed carry: Stages 13, 15, 16; bilingual MD + HTML language switch | Подтверждённый перенос: этапы 13, 15, 16; двуязычный MD + переключатель в HTML |
| `2026-08-01` | Carry group Stage 2: `2.2.3` + `2.3` + `2.4` split into microtasks | Перенос группы этап 2: `2.2.3` + `2.3` + `2.4` с разбиением на микротаски |
| `2026-08-01` | Carry Stage 7 Specifications with existing microtasks | Перенос этапа 7 Спецификации с существующими микротасками |
| `2026-08-01` | Carry `12.4`–`12.5`, Stage 14; full `18.4` (stubs stay in v0.9) | Перенос `12.4`–`12.5`, этап 14; весь `18.4` (stubs остаются в v0.9) |
| `2026-08-01` | Carry `1.4.3` only (split to microtasks); `1.4.1`/`1.4.2` stay done in v0.9 | Перенос только `1.4.3` (микротаски); `1.4.1`/`1.4.2` остаются закрытыми в v0.9 |
| `2026-08-02` | New Stage 0 platform performance: `0.1.1` full slow-data audit first, then seed `0.2.1`–`0.2.5` (from v0.9 stub `0.4`) | Новый Stage 0 производительность: сначала `0.1.1` полный аудит, затем seed `0.2.1`–`0.2.5` (из stub `0.4` v0.9) |
| `2026-08-05` | New Stage 20: lead client-need cleanup + layout; unify messaging with Stage 19; order card parity | Новый Stage 20: очистка потребности лида + layout; unify переписки со Stage 19; паритет карточки заказа |
| `2026-08-05` | Stage 0.3 LAN access: audit install/remove then implement local-network reachability (`0.3.1`–`0.3.3`) | Stage 0.3 доступ в LAN: аудит установить/удалить, затем реализация (`0.3.1`–`0.3.3`) |
| `2026-08-05` | New Stage 21: Settings / Users cabinet (`/settings/users`); rename Сотрудники→Пользователи; flexible access | Новый Stage 21: кабинет Пользователи; rename; гибкий доступ |
| `2026-08-05` | Stage 0.4: create SalesOrder without Lead (audit then implement; convert-from-lead stays) | Stage 0.4: создание заказа без лида (аудит → реализация; convert сохраняется) |
| `2026-08-05` | Stage 2: add `2.2.4` client folders on `/sales/clients`; refine `2.3.1` (INN, bank accounts, legal/actual address on card) | Stage 2: `2.2.4` папки клиентов; уточнение `2.3.1` (ИНН, счета, юр./факт. адрес) |
| `2026-08-05` | Refine `0.4`: freeform order number + TC via generate (no orphan); refine `16.2.1`: UNF SalesOrder Excel MVP (column map deferred) | Уточнение `0.4`: произвольный номер + ТК через generate; `16.2.1`: MVP Excel заказов УНФ (карта колонок позже) |
| `2026-08-05` | Close `0.1.1` slow-data audit; split `0.2.3` → `0.2.3.1`–`0.2.3.3`; add backlog `0.2.6`–`0.2.8`; note product-models batch already in tree | Закрыт `0.1.1`; split `0.2.3`; backlog `0.2.6`–`0.2.8`; product-models batch уже в дереве |
| `2026-08-05` | Close `0.2.1`–`0.2.5`: list-page contract + product-models confirm + characteristics/warehouse/tech-cards fixes + guardrails/tests/docs; `0.2.6`–`0.2.8` remain backlog | Закрыты `0.2.1`–`0.2.5`; `0.2.6`–`0.2.8` остаются backlog |
| `2026-08-05` | Close `0.3.1`–`0.3.2` LAN audit + `-Lan` bind; stop at `0.3.3` owner smoke | Закрыты `0.3.1`–`0.3.2`; стоп на `0.3.3` smoke владельцем |
| `2026-08-05` | New Stage 22 Design v1.0: process rules; Sales Lead + Order microtasks from approved HTML etalons; TBD scaffolds for other modules | Новый Stage 22 Design v1.0: правила процесса; микротаски Лид + Заказ; TBD-каркасы остальных модулей |
| `2026-08-05` | Stage 22: Soft UI draft etalons for Production/Warehouse/Purchases/Settings/Dashboard + shell chrome (`22.4`–`22.9`); Sales boards remain TBD | Stage 22: draft-эталоны Production/Warehouse/Purchases/Settings/Dashboard + shell (`22.4`–`22.9`); доски продаж — TBD |
| `2026-08-06` | New Stage 23 Unified Work Tasks: replace LeadTask + CollaborationMicrotask; ADR-028; `23.0.1` closed | Новый Stage 23 Единые Задачи: замена LeadTask + microtasks; ADR-028; `23.0.1` закрыт |
| `2026-08-08` | New `23.7`: WorkTask order-context (sales order summary, real display names, overdue badge) + chat visual pass via `/plugin frontend-design`; plan `docs/superpowers/plans/2026-08-08-work-tasks-order-context.md` | Новый `23.7`: контекст заказа в Задачах (сводка заказа, реальные имена, бейдж просрочки) + визуал чата через `/plugin frontend-design`; план `2026-08-08-work-tasks-order-context.md` |
| `2026-08-08` | Closed `23.5.4`: removed primary LeadTask dialogs on lead card + collaboration microtasks UI (API kept for `23.6.1`) | Закрыт `23.5.4`: убраны primary LeadTask-диалоги на лиде и UI microtasks в collaboration (API сохранён для `23.6.1`) |
| `2026-08-08` | Closed `23.6.1`/`23.6.2`: data migrate Alembic `p9q0r1s2t345` + regression/docs checkpoint; next owner visual `23.6.3` | Закрыты `23.6.1`/`23.6.2`: data migrate + регрессия/docs; далее owner visual `23.6.3` |
| `2026-08-08` | New `23.8`: chat bubbles (mine/others) + List|Kanban with CRUD board stages; spec `2026-08-08-work-tasks-chat-kanban-design.md` | Новый `23.8`: пузыри чата + Список|Канбан со стадиями доски; spec `2026-08-08-work-tasks-chat-kanban-design.md` |
| `2026-08-22` | Closed owner visuals `23.6.3` / `23.9.4` / `23.10.4`; closed `23.7.1`–`23.7.5` order context + chat card | Закрыты owner visual `23.6.3` / `23.9.4` / `23.10.4`; закрыт `23.7` контекст заказа + карточка в чате |
| `2026-08-22` | Closed `22.1.4` / `22.2.5`: owner visual OK on live Lead + Order Soft UI; field-links layout note | Закрыты `22.1.4` / `22.2.5`: owner visual live Лид + Заказ; заметка layout в field-links |
| `2026-08-22` | Closed etalon visuals `22.4.1`–`22.9.1`; Production contract `22.4.2` + FE Soft UI `22.4.3`; `22.3` TBD | Закрыты visual эталонов `22.4.1`–`22.9.1`; контракт+FE производства `22.4.2`/`22.4.3`; `22.3` TBD |
| `2026-08-22` | Closed `22.4.4` live Production visual; Warehouse contract `22.5.2` + FE Soft UI `22.5.3` | Закрыт `22.4.4` live производство; склад контракт+FE `22.5.2`/`22.5.3` |
| `2026-08-22` | Closed `22.5.4`: owner visual OK on live Warehouse Soft UI `/warehouse/stock` | Закрыт `22.5.4`: owner visual live склад |
| `2026-08-22` | Closed `22.6.2`/`22.6.3`: Purchases Soft UI hub without Stage 13 demo data | Закрыты `22.6.2`/`22.6.3`: хаб закупок Soft UI без demo Stage 13 |
| `2026-08-22` | Closed `22.6.4` live Purchases visual; Settings contract `22.7.2` + FE Soft UI `22.7.3` | Закрыт `22.6.4` live закупки; настройки контракт+FE `22.7.2`/`22.7.3` |
| `2026-08-23` | Closed `22.7.4` live Settings visual; Dashboard contract `22.8.2` + FE Soft UI `22.8.3` | Закрыт `22.7.4` live настройки; дашборд контракт+FE `22.8.2`/`22.8.3` |
| `2026-08-23` | Closed `22.8.4` live Dashboard visual; shell contract `22.9.2` (`SL-DESIGN-V1-SHELL-v1`) | Закрыт `22.8.4` live дашборд; контракт оболочки `22.9.2` |
| `2026-08-23` | Closed `22.9.3`: Soft UI live shell FE (`app-sidebar` + `top-navigation`) | Закрыт `22.9.3`: Soft UI live оболочка |
| `2026-08-23` | Closed `22.9.4`: owner visual OK on live Soft UI shell; DS-SHELL contracts updated | Закрыт `22.9.4`: owner visual live shell; контракты DS-SHELL обновлены |
| `2026-08-23` | Closed `22.3.1`: owner visual OK on sales boards HTML etalon; open `22.3.2`–`22.3.4` | Закрыт `22.3.1`: owner visual эталона досок; открыты `22.3.2`–`22.3.4` |
| `2026-08-23` | Closed `22.3.2`/`22.3.3`: boards contract `SL-DESIGN-V1-BOARDS-v1` + Soft UI FE; visual `22.3.4` | Закрыты `22.3.2`/`22.3.3`: контракт + Soft UI досок; visual `22.3.4` |
| `2026-08-23` | Closed `22.3.4`: owner visual OK on live sales boards; Stage 22 complete | Закрыт `22.3.4`: owner visual live досок; Stage 22 закрыт |
| `2026-08-23` | Closed `1.4.3.2`: website-form webhook → Lead via `create_lead` + ingest receipts | Закрыт `1.4.3.2`: webhook формы сайта → Lead |
| `2026-08-23` | Closed `1.4.3.3`: SMTP email outbound/inbound → LeadMessage; mock fallback if SMTP unset | Закрыт `1.4.3.3`: SMTP email → LeadMessage; mock если SMTP не задан |
| `2026-08-23` | Closed `1.4.3.4`: persist mailbox settings + `/settings/integrations` admin UI | Закрыт `1.4.3.4`: persist почтового ящика + UI настроек |
| `2026-08-23` | Closed `1.4.3.5`: contour C regression + docs checkpoint; Stage 1.4.3 complete | Закрыт `1.4.3.5`: регрессия контура C; Stage 1.4.3 закрыт |
| `2026-08-23` | Closed `2.2.3.1`–`2.2.3.4`: client history contract + API + card panel; stop at owner visual `2.2.3.5` | Закрыты `2.2.3.1`–`2.2.3.4`: контракт + API + панель истории; стоп на visual `2.2.3.5` |
| `2026-08-23` | Closed `2.2.3.5`: owner visual OK on client history | Закрыт `2.2.3.5`: owner visual истории клиента |
| `2026-08-23` | Closed `2.2.4.1`–`2.2.4.3`: client folders contract + API + list tree; stop at visual `2.2.4.4` | Закрыты `2.2.4.1`–`2.2.4.3`: папки клиентов; стоп на visual `2.2.4.4` |
| `2026-08-23` | Closed `2.2.4.4`: owner visual OK on client folders | Закрыт `2.2.4.4`: owner visual папок клиентов |
| `2026-08-23` | Closed `2.3.1.1`–`2.3.1.4`: client legal requisites + bank accounts on card | Закрыты `2.3.1.1`–`2.3.1.4`: юр. реквизиты и счета на карточке |
| `2026-08-24` | Closed `2.3.2.1`–`2.3.2.4`: client segments + duplicate warning; stop at owner visual before `2.3.3` | Закрыты `2.3.2.1`–`2.3.2.4`: сегменты + предупреждение о дублях; стоп на visual до `2.3.3` |
