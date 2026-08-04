# Sport-Lead — Roadmap v1.00

**Code:** `SL-ROADMAP-v1.00`  
**Updated:** `2026-08-02`  
**Project version:** `v1.00`  
**Status:** Confirmed carry-over from `v0.9.0` (Stages **1.4.3**, **2** group, **7**, **12.4**–**12.5**, **13**, **14**, **15**, **16**, **18.4**) + **new Stage 0** (platform performance / slow-data). Work starts after `v0.9.0` close.  
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
- Codes keep `v0.9.0` numbering for carried work (`1.4.3.*`, `2.2.3.*`, `2.3.*`, `2.4.*`, `7.*`, `12.4`–`12.5`, `13.*`, `14.*`, `15.*`, `16.*`, `18.4.*`). New Stage **0** uses `0.1` / `0.2.*`.
- Do not execute `v1.00` while `v0.9.0` is still the active project version, unless the owner explicitly starts early.
- Не исполнять `v1.00`, пока активная версия проекта — `v0.9.0`, если владелец явно не начал раньше.
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
| **0** | Platform performance / slow-data (list N+1, fat list DTOs) | Производительность платформы / медленные данные (N+1 списков, тяжёлые list DTO) |

> **EN:** Stage 0 is **new** in `v1.00` (relocated from a brief `0.4` stub in `v0.9.0`). First microtask = full audit; then seed fixes from known product-models analysis.  
> **RU:** Stage 0 **новый** в `v1.00` (перенесён из краткого stub `0.4` в `v0.9.0`). Первый пункт = полный аудит; далее seed-фиксы по известному анализу product-models.

### Remain in v0.9.0 / Остаются в v0.9.0

`1.4.1` / `1.4.2` (collectors + mock connector — already done); `2.2.1` / `2.2.2`; warehouse FG `12.3`; CRM residual visual `1.3.3.6`; auth `17`; admin shell `18.1`–`18.3`; Stage `19`; etc.

`1.4.1` / `1.4.2` уже закрыты в `v0.9.0`; `2.2.1` / `2.2.2`; FG `12.3`; visual `1.3.3.6`; auth `17`; admin `18.1`–`18.3`; Stage `19` — остаются в `v0.9.0`.

> **18.4 decision / Решение по 18.4:** full carry to `v1.00` (no minimum close in `v0.9.0`). Catalog guards already use stable stubs (`product_model_has_journal_operations` / characteristic journal hooks return `False`). Real journal does not block closing `v0.9.0`.  
> Полный перенос в `v1.00` без минимального закрытия в `v0.9.0`: stubs уже держат guards каталога.

> **1.4.3 decision / Решение по 1.4.3:** only open remainder of Stage 1.4. Core + mock (`1.4.1`/`1.4.2`) stay done in `v0.9.0`. Real adapters ≠ Stage `19`; channel transport shared with `16.1`, CRM lead ingest owned here.  
> Переносится только открытый остаток; ядро+mock закрыты в `v0.9.0`.

---

## Stage 0 — Platform performance / Производительность платформы

**New in:** `v1.00` (relocated from `v0.9.0` stub `0.4`)  
**Новое в:** `v1.00` (из stub `0.4` в `v0.9.0`)

> **EN:** Kill slow catalog/list UX caused by RSC **per-row HTTP** (N+1), fat list DTOs, and related data-path debt. Not visual polish. Seed evidence: `/settings/catalogs/product-models` (~20 rows) does `1 + N` `getProductModelAssemblyVariants` for cost column (`frontend/app/(workspace)/settings/catalogs/product-models/page.tsx`).  
> **RU:** Убрать медленные каталоги/списки из‑за **per-row HTTP** в RSC (N+1), жирных list DTO и смежного data-path долга. Не визуальный полиш. Seed: product-models `1 + N` assembly-variants.

### 0.1 — Full slow-data audit (first) / Полный аудит медленных данных (первым)

- [ ] 0.1.1 — Agent/owner audit: FE list/RSC N+1 and waterfall fetches; BE list endpoints with fat `selectinload` / oversized JSON; dependency/runtime cost where it affects local/dev list latency; write findings into Stage 0 roadmap microtasks (MD + HTML twin) before closing this item / Аудит: FE list/RSC N+1 и waterfall; BE list с жирным load/JSON; зависимости/runtime где бьют latency; внести находки в микротаски Stage 0 (MD + HTML) до закрытия пункта

### 0.2 — Known findings (seed `2026-08-02`) / Известные находки (seed)

- [ ] 0.2.1 — Contract: list-page rules — no per-row RSC HTTP; batch/embed summary on list DTO; slim list vs detail; success = list TTFB without N round-trips / Контракт: правила list pages — без per-row RSC HTTP; batch/embed summary; slim list vs detail; критерий = TTFB без N round-trips
- [ ] 0.2.2 — P1 case `/settings/catalogs/product-models`: remove N× assembly-variants (batch cost on `GET /product-models` or bulk endpoint / cost column without SSR N+1) / P1 кейс product-models: убрать N× assembly-variants
- [ ] 0.2.3 — Sibling pass from seed audit: product-characteristics option counts; warehouse stock catalog (`warehouse-nomenclature` 2N); tech-cards list `_card_load_options` — fix or backlog under Stage 0 / Соседний pass: characteristics; warehouse stock; tech-cards list — fix или backlog в Stage 0
- [ ] 0.2.4 — Shared guardrails: short architecture / AGENTS checklist for new list pages; focused tests on product-models batch path / Guardrails: заметка в architecture/AGENTS; тесты batch path product-models
- [ ] 0.2.5 — Docs checkpoint: erp-check / project-structure note + evidence (before/after latency or request count) / Checkpoint документации + evidence до/после

---

## Stage 1.4.3 — Real external lead-source and communication adapters / Реальные адаптеры источников лидов и коммуникаций

**Moved from:** `v0.9.0` `1.4.3` (split into microtasks)  
**Перенесено из:** `v0.9.0`, `1.4.3` (разбито на микротаски)

> **EN:** `1.4.1` collectors/normalization + `1.4.2` mock connector remain closed in `v0.9.0`. Lead card send (`1.2.4.8`) stays on mock until these adapters ship. CRM ingest contour **C** (ADR-020 / import-export inventory). ≠ Stage `19` staff chat.  
> **RU:** `1.4.1` + `1.4.2` остаются закрытыми в `v0.9.0`. Отправка с карточки лида (`1.2.4.8`) на mock до появления адаптеров. Контур CRM ingest **C**. ≠ Stage `19`.

- [ ] 1.4.3.1 — Contract: adapter registry vs collectors (`1.4.1`); lead create/update mapping; ≠ Stage `19` staff chat; relation to `16.1` (shared channel transport, CRM ingest owned here) / Контракт: реестр адаптеров vs collectors (`1.4.1`); mapping create/update лида; ≠ Stage `19`; связь с `16.1` (общий transport, CRM ingest здесь)
- [ ] 1.4.3.2 — First real lead-source adapter (e.g. website form / webhook ingest) wired through normalization core / Первый реальный lead-source адаптер (форма сайта / webhook) через normalization core
- [ ] 1.4.3.3 — First real communication adapter for lead outbound/inbound (replace mock path used by `1.2.4.8` send) / Первый реальный communication адаптер (входящие/исходящие лида; заменить mock path `1.2.4.8`)
- [ ] 1.4.3.4 — Persist connector config + credentials (no secrets in repo); admin/settings surface as needed / Персистентность config/credentials (без секретов в репо); admin/settings при необходимости
- [ ] 1.4.3.5 — Regression tests + docs checkpoint (erp-check / import-export contour C) / Регрессия + checkpoint документации (erp-check / контур C)

---

## Stage 2 — Client history, business data, organizations / История клиента, бизнес-данные, организации

**Moved from:** `v0.9.0` items `2.2.3`, `2.3.*`, `2.4.*` (one group)  
**Перенесено из:** `v0.9.0`, пункты `2.2.3`, `2.3.*`, `2.4.*` (одна группа)

> **EN:** `2.2.1` / `2.2.2` remain in `v0.9.0`. History UI may ship as an embeddable panel; full placement on the client card depends on `2.2.2`.  
> **RU:** `2.2.1` / `2.2.2` остаются в `v0.9.0`. История может быть встраиваемой панелью; полное размещение на карточке клиента зависит от `2.2.2`.

### 2.2.3 — Client lead and order history / История лидов и заказов клиента

- [ ] 2.2.3.1 — Contract: sources (Lead / SalesOrder), filters, sort, empty states; embeddable on future client card (`2.2.2`) — ADR/domain note or task file / Контракт: источники (Lead / SalesOrder), фильтры, сортировка, empty states; встраивание на будущую карточку клиента (`2.2.2`)
- [ ] 2.2.3.2 — Backend: `GET` client history aggregation (leads + orders) + schemas / Backend: агрегация истории клиента (лиды + заказы) + schemas
- [ ] 2.2.3.3 — Frontend: history panel/component wired to API (no demo substitution) / Frontend: панель истории на API (без demo)
- [ ] 2.2.3.4 — Regression tests (API + FE mapper/unit as applicable) / Регрессионные тесты (API + FE)
- [ ] 2.2.3.5 — Owner visual verification / Визуальная проверка владельцем

### 2.3 — Business data and quality / Бизнес-данные и качество

#### 2.3.1 — Legal details and banking data / Юр. реквизиты и банковские данные

- [ ] 2.3.1.1 — Domain fields + validation (INN/KPP/bank etc. as approved) on Client / Доменные поля + валидация (ИНН/КПП/банк и т.п.) на Client
- [ ] 2.3.1.2 — Migration + schemas + API read/write / Миграция + schemas + API read/write
- [ ] 2.3.1.3 — FE edit surface (card section or interim settings form) / FE-форма редактирования (секция карточки или interim)
- [ ] 2.3.1.4 — Regression + docs checkpoint / Регрессия + checkpoint документации

#### 2.3.2 — Segmentation and duplicate detection / Сегментация и дедупликация

- [ ] 2.3.2.1 — Contract: segment tags + duplicate match rules (name/phone/INN) / Контракт: сегменты + правила дублей (name/phone/INN)
- [ ] 2.3.2.2 — Persist segments + duplicate-check service/API / Персистентность сегментов + service/API проверки дублей
- [ ] 2.3.2.3 — FE: segment UI + duplicate warning on create/edit / FE: UI сегментов + предупреждение о дублях
- [ ] 2.3.2.4 — Regression tests / Регрессионные тесты

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

> **EN:** `/settings/organizations/employees` uses demo `employeeRecords`; user linkage → Stage `17.1` later.  
> **RU:** `/settings/organizations/employees` на demo `employeeRecords`; связка с users → Stage `17.1` позже.

- [ ] 2.4.2.1 — Domain: Employee entity vs platform User; org/department links (MVP) / Домен: Employee vs platform User; связи org/department (MVP)
- [ ] 2.4.2.2 — DB + migration + schemas + API / БД + миграция + schemas + API
- [ ] 2.4.2.3 — Wire employees list/card UI to API (remove `employeeRecords`) / Подключить UI сотрудников к API (убрать `employeeRecords`)
- [ ] 2.4.2.4 — Regression + owner visual; auth linkage deferred to `17.1` / Регрессия + visual; auth-связка отложена на `17.1`

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

- [ ] 16.2.1 — 1C:UNF exchange — contour **D** (ADR-020); neighbor to universal job shell, not catalog Excel buttons / Обмен с 1С:УНФ — контур **D** (ADR-020); рядом с universal job shell, не кнопки Excel каталога
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
