# Sport-Lead — Roadmap v1.00

**Code:** `SL-ROADMAP-v1.00`
**Updated:** `2026-08-27` (Stage **12.4** closed; next **12.5.1**; parked `0.5.13` S3 media; Stage **26** `26.9.1`–`26.9.3` closed; Stage **27** 1C:UNF export parked; **Stage 28** standalone TC + numbering parked)
**Project version:** `v1.00`
**Status:** Confirmed carry-over from `v0.9.0` (Stages **1.4.3**, **2** group, **7**, **12.4**–**12.5**, **13**, **14**, **15**, **16**, **18.4**) + **new** Stages **0** (performance + LAN + order-without-lead + **canonical VPS `0.5`**), **20** (Lead / Order UX, closed), **21** (Settings / Users cabinet, closed), **22** (Design v1.0), **23** (Unified Work Tasks), **24** (Sewing cabinet), **25** (Tech-card QR / shop scan), **26** (owner findings: bugs / cosmetics), **27** (1C:UNF document export), **28** (standalone tech cards + unified numbering). Owner started early (`2026-08-05`).
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
- Codes keep `v0.9.0` numbering for carried work (`1.4.3.*`, `2.2.3.*`, `2.2.4.*`, `2.3.*`, `2.4.*`, `7.*`, `12.4`–`12.5`, `13.*`, `14.*`, `15.*`, `16.*`, `18.4.*`). New Stages **0** (`0.1` / `0.2.*` / `0.3.*` / `0.4.*` / **`0.5.*`**), **20** (`20.1`–`20.4`), **21** (`21.1`–`21.5`), **22** (`22.0`–`22.9` Design v1.0; process `docs/design/design-v1-process.md`), **23** (`23.0`–`23.10` Unified Work Tasks; ADR-028), **24** (`24.0`–`24.5` Sewing cabinet), **25** (`25.0`–`25.5` Tech-card QR / shop scan), **26** (`26.0`–`26.9` owner findings; living; owner-pull), **27** (`27.0`–`27.5` 1C:UNF export; owner-pull), **28** (`28.0`–`28.5` standalone tech cards + `{order}-{seq}/{N}`; owner-pull).
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
| **0** | Platform performance / slow-data + LAN + order without Lead + **canonical VPS (`0.5`)** | Производительность / slow-data + LAN + заказ без лида + **канонический VPS (`0.5`)** |
| **20** | Lead / Order card UX + unified messaging | UX карточек лида / заказа + единая внутренняя переписка |
| **21** | Settings / Users cabinet (`/settings/users`) | Настройки / Пользователи (кабинет) |
| **22** | Design v1.0 (HTML etalons → Soft UI platform) | Design v1.0 (HTML-эталоны → Soft UI в платформе) |
| **23** | Unified Work Tasks | Единый модуль Задачи |
| **24** | Sewing cabinet (current slice after Stage 2) | Кабинет швеи (текущий срез после Stage 2) |
| **25** | Tech-card QR + shop scan (after 24) | QR техкарты + скан по маршруту (после 24) |
| **26** | Owner findings: bugs / cosmetics / UX polish (living) | Находки владельца: баги / косметика / UX (живой backlog) |
| **27** | 1C:UNF document export (platform → УНФ) | Выгрузка документов в 1С:УНФ (платформа → УНФ) |
| **28** | Standalone tech cards + unified numbering `{order}-{seq}/{N}` | Самостоятельные техкарты + единая нумерация `{заказ}-{seq}/{N}` |

> **EN:** Stage 0 is **new** in `v1.00`: slow-data (`0.1`/`0.2`), **LAN** (`0.3`), **create SalesOrder without Lead** (`0.4`), and **canonical VPS** (`0.5`, ADR-032). Stages **20** / **21** closed. Stage **22** = Design v1.0 (do **not** re-open `20.*` data contracts). Do **not** re-open closed `3.5.*` / `19.*` / `17.1.2.*` / `17.2.1`–`17.2.3` in `v0.9.0`. Stage **2** closed `2026-08-24`. Stage **24** sewing cabinet closed `2026-08-24`. Stage **25** QR/scan closed `2026-08-25` (owner visual `25.5.2`). Stage **7** Specifications closed `2026-08-25` (owner visual `7.2.2.6`). Stage **26** = living owner findings (bugs/cosmetics); `26.0.1` closed; seed parked; **owner-pull only** — do not auto-start. Stage **27** = 1C:UNF **outbound** document packages (contour D); `27.0.1` closed; `27.1+` parked; **owner-pull only** — do not auto-start; inbound `16.2.1` parked. Stage **28** = standalone TechnicalCard (no required SalesOrder) + planned TC count + display `{orderNo}-{seq}/{N}`; **owner-pull**; do not auto-start; task `docs/tasks/v1.00-stage-28-standalone-tech-cards.md`. Stage **12.4** inventory closed `2026-08-26` (owner visual `12.4.1.6`). Current slice: Stage **12.5** transfers (`12.5.1`). Stage **`0.5`** live apply closed `2026-08-25` (smoke `0.5.12`: `https://sport-lead.ru/login`). Parked **`0.5.13`** S3-compatible media (**owner-pull**; do **not** auto-start; keep VPS disk `0.5.10` while the project is small). `2.4.2` Employees is **not** a 24/25 dependency (sewer = `PlatformUser`). `12.5` / 13–16 / `18.4` / **27** / **28** are not blockers.
>
> **RU:** Stage 0: slow-data + **LAN** (`0.3`) + **заказ без лида** (`0.4`) + **канонический VPS** (`0.5`). Stages **20** / **21** закрыты. Stage **22** = Design v1.0. Stage **2** закрыт `2026-08-24`. Stage **24** закрыт `2026-08-24`. Stage **25** закрыт `2026-08-25`. Stage **7** закрыт `2026-08-25` (owner visual `7.2.2.6`). Stage **26** — живой backlog находок; `26.0.1` закрыт; seed припаркован; старт только по явному коду владельца. Stage **27** — выгрузка документов в 1С:УНФ; `27.0.1` закрыт; `27.1+` припаркован; **owner-pull**; inbound `16.2.1` припаркован. Stage **28** — самостоятельные ТК + плановое кол-во + показ `{заказ}-{seq}/{N}`; **owner-pull**; не стартовать сам; task `docs/tasks/v1.00-stage-28-standalone-tech-cards.md`. Stage **12.4** закрыт `2026-08-26` (owner visual `12.4.1.6`). Текущий срез: Stage **12.5** (`12.5.1` перемещения). Stage **`0.5`** live apply закрыт `2026-08-25` (smoke `https://sport-lead.ru/login`). Припаркован **`0.5.13`** S3 для медиа (**owner-pull**; не стартовать; SoT пока диск VPS `0.5.10`). `2.4.2` Employees **не** зависимость (швея = `PlatformUser`).

### Remain in v0.9.0 / Остаются в v0.9.0

`1.4.1` / `1.4.2` (collectors + mock connector — already done); `2.2.1` / `2.2.2`; warehouse FG `12.3`; CRM residual visual `1.3.3.6`; auth `17`; admin shell `18.1`–`18.3`; Stage `19`; etc.

`1.4.1` / `1.4.2` уже закрыты в `v0.9.0`; `2.2.1` / `2.2.2`; FG `12.3`; visual `1.3.3.6`; auth `17`; admin `18.1`–`18.3`; Stage `19` — остаются в `v0.9.0`.

> **18.4 decision / Решение по 18.4:** full carry to `v1.00` (no minimum close in `v0.9.0`). Catalog guards already use stable stubs (`product_model_has_journal_operations` / characteristic journal hooks return `False`). Real journal does not block closing `v0.9.0`.
> Полный перенос в `v1.00` без минимального закрытия в `v0.9.0`: stubs уже держат guards каталога.

> **1.4.3 decision / Решение по 1.4.3:** only open remainder of Stage 1.4. Core + mock (`1.4.1`/`1.4.2`) stay done in `v0.9.0`. Real adapters ≠ Stage `19`; channel transport shared with `16.1`, CRM lead ingest owned here.
> Переносится только открытый остаток; ядро+mock закрыты в `v0.9.0`.

---

## Stage 0 — Platform performance, LAN access, order-without-lead, and canonical VPS / Производительность, LAN, заказ без лида и канонический VPS

**New in:** `v1.00` (relocated from `v0.9.0` stub `0.4`; LAN `2026-08-05`; order-without-lead `2026-08-05`; canonical VPS `2026-08-25`)
**Новое в:** `v1.00` (из stub `0.4`; LAN и заказ без лида `2026-08-05`; VPS `2026-08-25`)

> **EN:** (1) Kill slow catalog/list UX from RSC **per-row HTTP** (N+1). (2) **LAN** access to local FE/BE (`3001`/`8000`; ≠ production VPS). (3) Enable **SalesOrder create without Lead**. (4) **Canonical VPS Postgres** + local repo + GitHub deploy + owner SSH tunnel (`0.5`; ADR-032). Convert-from-lead stays valid. Do not reopen `17.2.1`–`17.2.3`.
> **RU:** (1) Slow-data / N+1. (2) Доступ из **LAN**. (3) **Создание заказа без лида**. (4) **Каноническая БД на VPS** + локальный репо + Git + tunnel (`0.5`). `17.2.1`–`17.2.3` не переоткрывать.

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

> **EN:** Evidence: `SalesOrder.lead_id` required + `uq_sales_orders_lead_id`; create path = `convert_lead` only (`lead_conversion.py`). Need nullable `lead_id` + create API + UI; convert-from-lead intact. **Numbering:** auto `SO-YYYY-######` **or** owner-entered freeform `number` (unique, ≤50). **TC path:** no orphan TechnicalCard — after create + PRODUCT line, use existing `…/technical-cards/generate` (ADR-016). Enables manual «TC with arbitrary order number» without breaking FG/Spec/shop. Canonical 1C **export** is Stage **27**; inbound UNF Excel (`16.2.1`) is parked.
> **RU:** Сейчас заказ только через convert; `lead_id` обязателен. Нужен nullable `lead_id` + create API + UI. **Номер:** auto или **произвольный** (unique). **ТК:** без orphan — generate после заказа+позиции (ADR-016). Канон выгрузки в 1С — Stage **27**; inbound Excel УНФ (`16.2.1`) припаркован.

- [x] 0.4.1 — Audit/contract: nullable `lead_id` (unique still for non-null); required Client/org/responsible; **number = auto OR freeform unique**; create API vs convert-only; UI entry (`/sales/orders` create); impact on lead convert, order field-links, Stage 20, TC generate (no orphan TC); amend ADR/domain note — `v1.00` `2026-08-05`; `SL-ORDER-WITHOUT-LEAD-v1`; task `docs/tasks/v1.00-stage-0.4-order-without-lead.md`; ADR-001 amend / Контракт закрыт
- [x] 0.4.2 — Implement: migration + schemas/services/API create order without lead (incl. freeform number validation); FE create flow; keep convert-from-lead intact — `v1.00` `2026-08-05`; Alembic `i2j3k4l5m678`/`j3k4l5m6n789`/`k4l5m6n7o890`; `POST /orders` + `POST /clients`; drawer `/sales/orders`; owner visual OK; org via checkbox «Создать организацию?» / Реализация закрыта
- [x] 0.4.3 — Regression (API: convert + without-lead create + freeform number unique) + docs checkpoint (order-card-field-links, erp-check/project-structure) — `v1.00` `2026-08-05`; `test_order_without_lead_0_4.py` 8 passed; field-links Source lead optional; ADR-001 org optional on create / Регрессия + docs закрыты

### 0.5 — Canonical VPS workflow / Канонический VPS (БД + git + деплой)

> **EN:** Canonical **data** = VPS Postgres. Canonical **code** = GitHub `main` after local push. User runtime = **`https://sport-lead.ru`** (Caddy). Owner may point local uvicorn at VPS via SSH tunnel `:5433`. Agent tests stay on local Docker Postgres `:5432`. In-repo `17.2.1`–`17.2.3` stay closed. LAN `0.3` ≠ this block. Live apply closed at `0.5.12`. Media SoT remains VPS `storage/` (`0.5.10`) until parked **`0.5.13`**. Task `docs/tasks/v1.00-stage-0.5-vps-canonical.md`. ADR-032. ADR-011/022 object storage later.
> **RU:** Канонические данные = Postgres на VPS. Код = GitHub `main`. Рантайм пользователей = **`https://sport-lead.ru`**. Tunnel `:5433` — opt-in владельца. Агент тестирует только локальный Docker Postgres. `17.2.*` не переоткрывать. Live apply закрыт на `0.5.12`. Медиа пока диск VPS (`0.5.10`); S3 — припаркованный **`0.5.13`**.

- [x] 0.5.1 — Contract / ADR: VPS Postgres SoT; loopback bind; agent Docker PG only; Git deploy; media-sync; boundary vs LAN `0.3` and closed `17.2` — `v1.00` `2026-08-25`; ADR-032; `SL-VPS-CANONICAL-v1`; task `docs/tasks/v1.00-stage-0.5-vps-canonical.md` / Контракт закрыт
- [x] 0.5.2 — Agent rule + AGENTS / `dev-server-sessions.mdc` (default stack is not tunnel) — `v1.00` `2026-08-25`; `.cursor/rules/vps-canonical-workflow.mdc` / Правило агента
- [x] 0.5.3 — Git gate: owner commit+push closed-roadmap WIP (no `__pycache__`) before first VPS clone — `v1.00` `2026-08-25`; Spec Alembic `e4f5a6b7c890` + ADR-032 / Git gate: commit+push WIP до clone на VPS
- [x] 0.5.4.1 — Assemble host on **Ubuntu 26.04**: Docker Engine + compose plugin (Docker apt repo), git, UFW, curl; TZ `Europe/Moscow`; **no** host Python/Node for the app (`compose.prod.yaml` images) — `v1.00` `2026-08-25`; live VPS `46.173.29.247`; Docker `29.7.2` + Compose `v5.5.0`; UFW `22/80/443`; `scripts/vps-bootstrap-ubuntu-26.04.sh` / Окружение Ubuntu 26.04 (Docker, не native app)
- [x] 0.5.4 — VPS bootstrap on Ubuntu 26.04: deploy user, UFW `22/80/443`, GitHub deploy key, clone, `.env.production` — `v1.00` `2026-08-25`; `/home/deploy/sport-leads` @ `841f64e`; deploy-key `vps-0.5.4-deploy` / Bootstrap хоста Ubuntu 26.04
- [x] 0.5.5 — `compose.prod.yaml`: Postgres `127.0.0.1:5432` + `./storage:/app/storage` bind — `v1.00` `2026-08-25` / Bind loopback + storage
- [x] 0.5.6.1 — Point registrar DNS `sport-lead.ru` (A/AAAA; optional `www` → apex) at the VPS; `SPORT_LEADS_DOMAIN=sport-lead.ru`; `PUBLIC_APP_ORIGIN=https://sport-lead.ru`; only public user origin — `v1.00` `2026-08-25`; Google DNS `8.8.8.8` A `46.173.29.247` (apex + `www`) / DNS `sport-lead.ru` → VPS; единственный публичный origin
- [x] 0.5.6 — First `up --build`, Caddy TLS, `/healthz` `/health` `/health/ready` on `https://sport-lead.ru` (after `0.5.6.1`) — `v1.00` `2026-08-25`; HTTPS 200 healthz/health/ready / Первый up + TLS на sport-lead.ru
- [x] 0.5.7 — One-time data migrate: local `backup_db.ps1` → `prod-restore-db` on VPS — `v1.00` `2026-08-25`; dump `backup/sport_leads-20260825-173102.dump` (local Docker PG host `:5433`); `prod-restore-db.sh`; `/health/ready` ok / Перенос дампа
- [x] 0.5.8 — GitHub Environment `production` + secrets + first `workflow_dispatch` — `v1.00` `2026-08-25`; env `production`; run `32861707751` success; `/healthz` `/health/ready` 200 / Secrets + первый deploy
- [x] 0.5.9 — Tunnel script + `.env.tunnel.example` (local port **5433**) — `v1.00` `2026-08-25`; `scripts/vps-db-tunnel.ps1` / Tunnel
- [x] 0.5.10 — Storage sync script; media SoT = VPS disk — `v1.00` `2026-08-25`; `scripts/sync-storage-from-vps.ps1` / Sync media
- [x] 0.5.11 — Cron `prod-backup-db.sh` on VPS (off-box copy) — `v1.00` `2026-08-25`; deploy crontab `15 2 * * *`; dump `sport_leads-prod-20260825-175911.dump`; off-box `backup/vps-offbox/` / Cron backup
- [x] 0.5.12 — Owner smoke: `https://sport-lead.ru/login` + optional local `:3001` via tunnel; docs checkpoint — `v1.00` `2026-08-25`; HTTPS login form + `/health/ready` 200; Stage `0.5` live apply complete / Smoke на sport-lead.ru
- [ ] 0.5.13 — S3-compatible object storage for media (private bucket; API on VPS; replace disk SoT `0.5.10`) — **parked**; owner-pull; do **not** auto-start while the project is small; no s3fs; ADR-011/022 — `v1.00` / S3 медиа, когда диск VPS станет узким

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

> **EN:** `2.2.1` / `2.2.2` closed in `v0.9.0` (list+card on `/sales/clients`). History `2.2.3` owner OK; **folders** `2.2.4` owner OK `2026-08-23`; legal requisites `2.3.1` shipped on card; **segments/duplicates** `2.3.2` owner visual OK `2026-08-24`; **settlements** `2.3.3` owner visual OK `2026-08-24` (projection of `3.4.2`; ledger `14.2`); **orgs** `2.4.1` owner visual OK `2026-08-24`; **employees** `2.4.2` owner visual OK `2026-08-24` (auth linkage deferred). **Stage 2 closed.**
>
> **RU:** `2.2.1` / `2.2.2` закрыты в `v0.9.0`. История `2.2.3` owner OK; **папки** `2.2.4` owner OK `2026-08-23`; юр. реквизиты `2.3.1` на карточке; **сегменты/дубли** `2.3.2` owner visual OK `2026-08-24`; **взаиморасчёты** `2.3.3` owner visual OK `2026-08-24`; **организации** `2.4.1` owner visual OK `2026-08-24`; **сотрудники** `2.4.2` owner visual OK `2026-08-24`. **Stage 2 закрыт.**

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
- [x] 2.3.2.4 — Regression tests — `v1.00` `2026-08-24`; `test_client_segments_2_3_2.py` + `client-segments.test.mjs` / Регрессионные тесты
- [x] 2.3.2.5 — Owner visual verification — `v1.00` `2026-08-24`; owner OK `/sales/clients` create drawer + `/sales/clients/[id]` segments and INN duplicate warning / Визуальная проверка владельцем

#### 2.3.3 — Settlements and financial client state / Взаиморасчёты и фин. состояние клиента

- [x] 2.3.3.1 — Contract: which balances are SoT (orders/payments Stage 14 vs summary flags); MVP scope — `v1.00` `2026-08-24`; `SL-CLIENT-SETTLEMENTS-v1` `docs/tasks/v1.00-stage-2.3.3-client-settlements.md`; ADR-003 amend; projection of `3.4.2` markers, ledger stays `14.2` / Контракт: сводка с маркеров заказа; ledger → Stage 14
- [x] 2.3.3.2 — Backend summary API (debt/advance/open orders) — no fake ledger — `v1.00` `2026-08-24`; `GET /clients/{id}/settlements-summary`; `client_settlements` schema/service / Backend summary API (долг/аванс/открытые заказы) — без fake ledger
- [x] 2.3.3.3 — FE settlements summary block — `v1.00` `2026-08-24`; `ClientSettlementsSection` on `/sales/clients/[id]` after segments, before history / FE-блок сводки взаиморасчётов
- [x] 2.3.3.4 — Regression + docs; note link to Stage 14 when payments ship — `v1.00` `2026-08-24`; `test_client_settlements_2_3_3.py` + `client-settlements.test.mjs`; UI/API `ledger_stage=14.2` / Регрессия + docs; связь со Stage 14 при платежах
- [x] 2.3.3.5 — Owner visual verification — `v1.00` `2026-08-24`; owner OK `/sales/clients/[id]` settlements block / Визуальная проверка владельцем

### 2.4 — Organizations workspace / Рабочее пространство организаций

#### 2.4.1 — Organizations list and card / Список и карточка организаций

> **EN:** Backend `Organization` + `/organizations` list existed; FE demo `organizationRecords` **dropped** (`2.4.1.3`). Card `/settings/organizations/[id]`.
>
> **RU:** Backend `Organization` + `/organizations` были; demo `organizationRecords` **снят**. Карточка `/settings/organizations/[id]`.

- [x] 2.4.1.1 — Contract: list/card fields vs existing `OrganizationRead`; drop demo path — `v1.00` `2026-08-24`; `SL-ORGANIZATIONS-v1` `docs/tasks/v1.00-stage-2.4.1-organizations.md`; ADR-002 amend / Контракт: поля list/card vs `OrganizationRead`; отказ от demo
- [x] 2.4.1.2 — Extend API if gaps (CRUD/detail) + schemas — `v1.00` `2026-08-24`; `GET|POST|PATCH /organizations`; `OrganizationCreate`/`Update` / Расширить API при пробелах (CRUD/detail) + schemas
- [x] 2.4.1.3 — Wire `/settings/organizations` list to API (remove `organizationRecords`) — `v1.00` `2026-08-24`; `OrganizationsWorkspace` PT-02; demo records removed / Подключить список `/settings/organizations` к API (убрать `organizationRecords`)
- [x] 2.4.1.4 — Persistent organization card route + edit — `v1.00` `2026-08-24`; `/settings/organizations/[id]` PT-05; order `organizationHref` → card / Persistent карточка организации + edit
- [x] 2.4.1.5 — Regression + owner visual — `v1.00` `2026-08-24`; owner OK `/settings/organizations` list + card; `test_organizations_2_4_1.py` + `organizations.test.mjs` / Регрессия + визуальная проверка владельцем

#### 2.4.2 — Employees directory / Справочник сотрудников

> **EN:** `/settings/organizations/employees` on API (`SL-EMPLOYEES-v1`); demo `employeeRecords` **dropped**. User linkage → Stage `17.1` / Stage **21** cabinet. Full Settings **Users** list+cabinet UX → **Stage 21** (`/settings/users`); do not duplicate SoT here.
>
> **RU:** `/settings/organizations/employees` на API; demo `employeeRecords` **снят**. Связка с users → `17.1` / Stage **21**. Кабинет **Пользователи** → **Stage 21** (`/settings/users`); без дубля SoT.

- [x] 2.4.2.1 — Domain: Employee entity vs platform User; org/department links (MVP) — `v1.00` `2026-08-24`; `SL-EMPLOYEES-v1` `docs/tasks/v1.00-stage-2.4.2-employees.md`; org FK + free-text department; no `platform_user_id` / Домен: Employee vs platform User; связи org/department (MVP)
- [x] 2.4.2.2 — DB + migration + schemas + API — `v1.00` `2026-08-24`; Alembic `y9z0a1b2c345`; `GET|POST|PATCH /employees`; `EmployeeCreate`/`Update` / БД + миграция + schemas + API
- [x] 2.4.2.3 — Wire employees list/card UI to API (remove `employeeRecords`) — `v1.00` `2026-08-24`; `EmployeesWorkspace` PT-02; card PT-05; demo records removed / Подключить UI сотрудников к API (убрать `employeeRecords`)
- [x] 2.4.2.4 — Regression + owner visual; auth linkage deferred to `17.1` / Stage 21 — `v1.00` `2026-08-24`; owner OK `/settings/organizations/employees`; `test_employees_2_4_2.py` + `employees.test.mjs` / Регрессия + visual; auth-связка → `17.1` / Stage 21

---

## Stage 7 — Specifications / Спецификации

**Moved from:** `v0.9.0` Stage 7
**Перенесено из:** `v0.9.0`, этап 7

> **EN:** Spec = plan+fact **report document** from filled TC + execution (ADR-004/016/031). Not a prerequisite for TC generate or batch start. Parent = `ProductionBatch` 1:1. Documents registry = link index later. Task: `docs/tasks/v1.00-stage-7-specifications.md`.
> **RU:** Спецификация = **документ-отчёт** план+факт из заполненной ТК + исполнения (ADR-004/016/031). Не prerequisite generate ТК и не gate запуска партии. Родитель = партия 1:1. Реестр Документы = индекс ссылок позже.

**Execute after / Исполнять после:** Stage 25 closed `2026-08-25`. **Stage 7 closed** `2026-08-25` (owner visual `7.2.2.6`).

### 7.1 — Domain and persistence / Домен и персистентность

#### 7.1.1 — Specification architecture / Архитектура спецификации

- [x] 7.1.1.1 — Define specification entities and version lifecycle (from TC / batch context; plan draft vs final plan+fact report) / Сущности спецификации и lifecycle версий — `v1.00` `2026-08-25`; ADR-031; 1:1 `ProductionBatch`; draft/approved/superseded/cancelled / Контракт сущностей + lifecycle
- [x] 7.1.1.2 — Define material, accessory, norm, and substitute scope sourced from TC composition (+ fact consumption binding) / Scope материалов/норм/замен — `v1.00` `2026-08-25`; ADR-031 §3; material lines only; no substitute table / Состав ТК; без таблицы замен
- [x] 7.1.1.3 — Define copy/read contract: assembly + op volumes from order-item / TC; performers / time from execution — not live model edit / Контракт copy/read — `v1.00` `2026-08-25`; ADR-031 §4; sewing fact from Stage 24 ledger / Snapshot с ТК; не live-модель
- [x] 7.1.1.4 — Documentation checkpoint (Documents registry = link index only; no per-type contour) / Checkpoint документации — `v1.00` `2026-08-25`; ADR-004/031; no Documents module in Stage 7 / Реестр Документы позже; Spec у партии

#### 7.1.2 — Specification database core / Ядро БД спецификаций

- [x] 7.1.2.1 — Add SQLAlchemy entities / Добавить SQLAlchemy entities — `v1.00` `2026-08-25`; `Specification*` + TC FK; `test_specifications_7_1_2.py` / SQLAlchemy entities
- [x] 7.1.2.2 — Add Alembic migration / Добавить Alembic migration — `v1.00` `2026-08-25`; Alembic `e4f5a6b7c890` / Миграция
- [x] 7.1.2.3 — Add schemas and backend regression tests / Schemas + backend regression tests — `v1.00` `2026-08-25`; `schemas/specification.py`; `test_specifications_7_2.py` / DTO + list slim

### 7.2 — Specification workflows / Workflows спецификаций

#### 7.2.1 — Specification CRUD API / CRUD API спецификаций

- [x] 7.2.1.1 — Add repository and service CRUD / Repository + service CRUD — `v1.00` `2026-08-25`; `services/specifications.py` create/refresh/approve / Service
- [x] 7.2.1.2 — Add endpoints / Endpoints — `v1.00` `2026-08-25`; `GET/POST /specifications` + refresh/new-draft/approve/cancel-draft / API
- [x] 7.2.1.3 — Add backend regression tests / Backend regression tests — `v1.00` `2026-08-25`; `test_specifications_7_2.py` / API tests

#### 7.2.2 — Specification workspace and card / Workspace и карточка спецификации

- [x] 7.2.2.1 — Add frontend types and API client / Frontend types + API client — `v1.00` `2026-08-25`; `lib/production/specifications.ts` + `-api.ts` / FE client
- [x] 7.2.2.2 — Add workspace/list route (interim; later subsumed by Documents filter) / Workspace/list route (interim; позже Documents filter) — `v1.00` `2026-08-25`; `/production/specifications` PT-02 / List
- [x] 7.2.2.3 — Add detail card (plan+fact blocks; rights-gated edit) / Detail card (блоки план+факт; edit по правам) — `v1.00` `2026-08-25`; PT-07 card; refresh/approve/new-draft; no free-form edit / Card
- [x] 7.2.2.4 — Add loading/error states / Loading/error states — `v1.00` `2026-08-25`; list+detail `loading.tsx`/`error.tsx` / Page states
- [x] 7.2.2.5 — Add frontend regression tests / Frontend regression tests — `v1.00` `2026-08-25`; `specifications.test.mjs` + nav / FE tests
- [x] 7.2.2.6 — Visual verification / Визуальная проверка — `v1.00` `2026-08-25`; owner visual OK list `/production/specifications` + card + batch link / Owner visual OK

#### 7.2.3 — Link specifications to technical card / order context / Связь спецификаций с ТК / контекстом заказа

- [x] 7.2.3.1 — Add backend relation fields (technical_card / order item / model / variant / batch references as approved) / Backend relation fields (ТК / позиция заказа / модель / вариант / batch) — `v1.00` `2026-08-25`; shipped in `e4f5a6b7c890` product lines + header FKs / Relations in 7.1.2
- [x] 7.2.3.2 — Add migration and schemas for specification material + operation (+ fact) lines (snapshot/read from TC + execution) / Миграция + schemas строк материалов/операций (+ факт) — `v1.00` `2026-08-25`; same migration + line DTOs / Lines in 7.1.2
- [x] 7.2.3.3 — Add service: create Spec version from TC composition + assembly snapshot (plan); refresh fact blocks from execution / Service: создать версию Spec из состава ТК + snapshot сборки (plan); обновить факт из исполнения — `v1.00` `2026-08-25`; rebuild from TC + sewing ledger / Refresh from TC
- [x] 7.2.3.4 — Add service validation for active/approved versions where applicable / Валидация active/approved версий — `v1.00` `2026-08-25`; approve requires terminal TCs; refresh only draft / Approve gate
- [x] 7.2.3.5 — Add workspace/card integration showing plan+fact blocks sourced from TC / execution / Интеграция workspace/card с блоками план+факт из ТК / исполнения — `v1.00` `2026-08-25`; card tables + batch link on PO / Plan+fact UI
- [x] 7.2.3.6 — Add regression tests (immutability vs later TC/model edits after Spec approve) / Регрессия (иммутабельность vs правки ТК/модели после approve Spec) — `v1.00` `2026-08-25`; approved planned_qty frozen after TC edit / Immutability test

---

## Stage 12 — Warehouse remainder / Остаток склада (12.4–12.5)

**Moved from:** `v0.9.0` `12.4`, `12.5`
**Перенесено из:** `v0.9.0`, `12.4`, `12.5`

> **EN:** `12.1` structure + `12.2` ledger MVP already shipped in `v0.9.0`. FG docs `12.3` (+ wire `11.2.2.4`) **remain** in `v0.9.0`. Inventory = `StockDocument` type `inventory` + recount lines; post writes signed deltas to the same ledger (ADR-019 amend `2026-08-25`). Task: `docs/tasks/v1.00-stage-12.4-inventory.md`.
> **RU:** `12.1` + `12.2` уже в `v0.9.0`. FG `12.3` (+ `11.2.2.4`) **остаются** в `v0.9.0`. Инвентаризация = тип `inventory` + строки пересчёта; проведение пишет signed delta в тот же регистр.

**Execute after / Исполнять после:** Stage 7 closed `2026-08-25`. Stage **12.4** closed `2026-08-26` (owner visual `12.4.1.6`). Next **`12.5.1`**.

### 12.4 — Inventory / Инвентаризация

#### 12.4.1 — Inventory documents and recount postings / Документы инвентаризации и пересчётные проводки

- [x] 12.4.1.1 — Define inventory document + recount posting contract (book vs counted; signed delta to ledger) / Контракт документа инвентаризации + проводки пересчёта — `v1.00` `2026-08-25`; ADR-019 amend; `SL-STOCK-INVENTORY-v1` / Контракт; без БД
- [x] 12.4.1.2 — Add SQLAlchemy + Alembic for `inventory` doc type and recount lines / SQLAlchemy + Alembic тип `inventory` + строки пересчёта — `v1.00` `2026-08-25`; Alembic `f5a6b7c8d901`; `test_stock_inventory_12_4_1_2.py` / модели + миграция
- [x] 12.4.1.3 — Add service: snapshot book qty, enter counted, post non-zero deltas / Service: снимок книги, факт, проведение дельт — `v1.00` `2026-08-25`; `stock_inventory.py`; `test_stock_inventory_12_4_1_3.py` / snapshot + counted + post
- [x] 12.4.1.4 — Add API + backend regression tests / API + backend tests — `v1.00` `2026-08-25`; `POST /stock/inventory` + fill/refresh/counted/post; `test_stock_inventory_12_4_1_4.py` / slim list
- [x] 12.4.1.5 — Add UI on `/warehouse/movements` (create + card book/counted/delta) / UI журнал + карточка — `v1.00` `2026-08-25`; create drawer + PT-07 book/counted/delta; `stock-inventory.test.mjs` / UI; стоп на visual `12.4.1.6`
- [x] 12.4.1.6 — Visual verification / Визуальная проверка — `v1.00` `2026-08-26`; owner visual OK `/warehouse/movements` list + create drawer + card STK; thead `tr` hydration fix / Owner visual OK; Stage 12.4 complete

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

> **EN:** Contour **D** (ADR-020). **Canonical 1C:UNF outbound** (SalesOrder / approved Spec / ТН-УПД packages; matching **in** УНФ) = Stage **27** — not this block. **`16.2.1` parked:** optional later **inbound** SalesOrder Excel from UNF → platform (`file_io` + dry-run; depends `0.4`; column map after sample). Do not treat inbound as MVP. Neighbor job shell → `16.3`. Delivery/API stay here.
> **RU:** Контур **D**. **Канон выгрузки в 1С:УНФ** = Stage **27**, не этот блок. **`16.2.1` припаркован:** опциональный later **inbound** Excel заказов УНФ→платформа. Не MVP. Оболочка заданий → `16.3`. Доставка/API остаются здесь.

- [ ] 16.2.1 — 1C:UNF **inbound** SalesOrder Excel (UNF → platform) — parked; not MVP; canonical outbound = Stage **27**; neighbor to `16.3`, not catalog Excel buttons / Inbound Excel заказов УНФ→платформа — припаркован; не MVP; канон выгрузки = Stage **27**
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

## Stage 24 — Sewing cabinet / Кабинет швеи

**New in:** `v1.00` (owner ask `2026-08-24`; current slice after Stage 2 close)

**Новое в:** `v1.00` (запрос владельца `2026-08-24`; текущий срез после закрытия Stage 2)

> **EN:** Sewer is a `PlatformUser` with a restricted shell (own cabinet only). Several sewers may work one technical card: take = **reserve** pieces **and/or** sewing operations; remaining pool cannot exceed order qty. Earnings = fact × catalog snapshot (`SewingOperation.cost` / assembly-variant cost) at take. Managers (admin / company lead / technologist / shop master) get `read_any`. Entry in this stage is the sewing queue **inside the cabinet** (no QR). Do **not** split the card across цеха here — TC stays wholly on Пошив. Not `2.4.2` Employee. Not a second SoT vs `11.7` stage fact: this is the multi-sewer **work ledger**. Task: `docs/tasks/v1.00-stage-24-sewing-cabinet.md`.
>
> **RU:** Швея = `PlatformUser`, после входа только свой кабинет. Несколько швей на одной ТК: взяла = **резерв** штук и/или операций; нельзя превысить заказ. Заработок = факт × снимок цены каталога. Мастер/админ/руководитель/технолог видят чужие кабинеты. Вход — очередь пошива в кабинете, без QR. Карта целиком на пошиве. Не справочник `2.4.2`.

**Deps / зависимости:** `11.7`, `17.1.2` / ADR-024, `17.1.2.8`, Stage `21`. **Not deps:** `2.4.2`, Stage `7`, `12.4`–`12.5`, `13`–`16`, `18.4`.

**Execute after / Исполнять после:** Stage 2 closed `2026-08-24`. **Stage 24 closed** `2026-08-24` (owner visual `24.5.2`).

### 24.0 — Contract / Контракт

- [x] 24.0.1 — ADR + contract (`SL-SEWING-CABINET-v1`): work ledger vs `11.7` fact vs Stage 21 profile; not Employee `2.4.2` — `v1.00` `2026-08-24`; ADR-029; `docs/tasks/v1.00-stage-24-sewing-cabinet.md` / Контракт/ADR: журнал пошива ≠ факт `11.7`; швея = `PlatformUser`
- [x] 24.0.2 — Domain: take / reserve / complete / release; pieces and operations; shared remaining pool; price snapshot at take — `v1.00` `2026-08-24`; ADR-029 §3–§5; independent piece vs operation pools / Домен: взять / резерв / отшить / отказаться; штуки и операции; общий остаток; снимок цены при «взяла»

### 24.1 — Access / Доступ

- [x] 24.1.1 — Permission codes `sewing_cabinet.read_own` / `read_any` / `write`; seed role Швея (own only) + admin / company lead / technologist / shop master (`read_any`); ADR-024 amend — `v1.00` `2026-08-24`; Alembic `z0a1b2c3d456`; `ensure_rbac_seed`; ADR-024 / Права + сиды ролей; швея только свой кабинет
- [x] 24.1.2 — Restricted shell: sewer sees only own cabinet; hide rest of ERP in nav **and** API (not menu-only); DS-SHELL visuals unchanged — `v1.00` `2026-08-24`; API middleware + nav filter; stub `/production/sewing-cabinet`; DS-SHELL-01/02 preserved / Оболочка швеи: только кабинет; API тоже режется; DS-SHELL не трогаем

### 24.2 — Sewing work ledger / Журнал пошива

- [x] 24.2.1 — Model + Alembic (who, TC, item vs operation, qty, reserve status, price snapshot) — `v1.00` `2026-08-24`; Alembic `c2d3e4f5a678`; `sewing_work_ledger_entries` / Модель + миграция журнала
- [x] 24.2.2 — API: sewing-stage TC queue, take, release, complete; reject if reserve + fact > ordered — `v1.00` `2026-08-24`; `/sewing-cabinet`; independent pools; `test_sewing_cabinet_24_2.py` / API: очередь пошива, взять, отказаться, закрыть; отказ при превышении заказа

### 24.3 — Own cabinet UI / Свой кабинет

- [x] 24.3.1 — Profile block: name / photo from Stage 21 `PlatformUser` — `v1.00` `2026-08-24`; initials + login; photo later (Stage 21 has no photo field) / Профиль: ФИО и фото из кабинета пользователя
- [x] 24.3.2 — Current work: tech card → operation / item — `v1.00` `2026-08-24`; reserved table + queue take / Сейчас в работе: техкарта → операция / изделие
- [x] 24.3.3 — History + periods day / week / month (+ custom range) — `v1.00` `2026-08-24`; UTC half-open `[start, end)` / История + периоды день / неделя / месяц (+ диапазон)
- [x] 24.3.4 — Earnings: fact × snapshot operation or assembly-variant price — `v1.00` `2026-08-24`; Σ qty × snapshot on completed / Заработок: факт × цена операции или варианта сборки

### 24.4 — Manager view / Кабинеты для мастера

- [x] 24.4.1 — `read_any`: sewer list + open any cabinet — `v1.00` `2026-08-24`; `/production/sewing-cabinet/sewers` + `[platformUserId]`; list embed remaining/earnings / Список швей и чужой кабинет для мастера / админа / технолога / руководителя

### 24.5 — Regression, visual, docs / Регрессия, visual, docs

- [x] 24.5.1 — Regression (API + FE) + docs checkpoint (erp-check / project-structure / ADR-024) — `v1.00` `2026-08-24`; pytest `test_sewing_cabinet_24_2.py` + access + FE `sewing-cabinet.test.mjs`; stop at `24.5.2` / Регрессия + checkpoint документации
- [x] 24.5.2 — Owner visual (own cabinet + manager view) — `v1.00` `2026-08-24`; owner OK `/production/sewing-cabinet` + `/sewers` / Визуальная проверка владельцем

---

## Stage 25 — Tech-card QR and shop scan / QR техкарты и скан по маршруту

**New in:** `v1.00` (owner ask `2026-08-24`; after Stage **24**)

**Новое в:** `v1.00` (запрос владельца `2026-08-24`; после этапа **24**)

> **EN:** One QR on the printed TC (`18.3.8`). Scan (personal phone **or** shop tablet; **own** Sport-Lead login, not a shared цех account) both **moves the route** and **requires shop fact**. Actor = session user; цех = **current or next** only (if several bound цеха via `17.1.2.8`, ask); no skip. Partial qty forward/return on **all** цеха; one TC document; remaining lives on **unit lines** (ADR-016) — do not spawn child TCs. Single TC status: return overrides; else **ready** / **partially ready** / **in work** from ship-readiness (`11.2.2` / `ready_to_ship`). Print/cutting fact reuses `11.5`/`11.6`; sewing scan writes Stage **24** ledger. Amend `12.3.2` FG auto-post for partial qty. Task: `docs/tasks/v1.00-stage-25-tech-card-qr.md`.
>
> **RU:** Один QR на печатной ТК. Скан (телефон или планшет, свой логин) двигает маршрут **и** требует факт цеха. Цех = текущий или следующий; прыжки запрещены. Частичная передача/возврат на всех цехах; одна ТК, остатки по unit lines. Один статус техкарты по готовности к отгрузке. Пошив пишет в журнал Stage 24.

**Deps / зависимости:** Stage **24**, `9.2.2` / `9.3.4`, `11.3`–`11.10`, `11.2.2` / `12.3.2`, `17.1.2.8`, print `18.3.8`.

**Execute after / Исполнять после:** Stage 24 closed. **Stage 25 closed** `2026-08-25` (owner visual `25.5.2`).

### 25.0 — Contract / Контракт

- [x] 25.0.1 — ADR + contract (`SL-TECH-CARD-QR-v1`): one QR; current-or-next; session user; ask цех if several allowed — `v1.00` `2026-08-24`; ADR-030; `docs/tasks/v1.00-stage-25-tech-card-qr.md` / Контракт: один QR; current|next; исполнитель = сессия; спросить цех при нескольких правах
- [x] 25.0.2 — Domain: qty remaining per цех on unit lines; partial return; one TC status (return > ready / partial / in work from ship-readiness); amend `12.3.2` FG post — `v1.00` `2026-08-24`; ADR-030 §4–§6; ADR-016/019/029 amends / Домен остатков по unit lines + единый статус + правка автопостинга ГП

### 25.1 — QR identity + print / QR и печать

- [x] 25.1.1 — Opaque QR token on technical card (not a guessable open id) / Токен QR на техкарте — `v1.00` `2026-08-24`; Alembic `d3e4f5a6b789`; `qr_token` unique; `/production/scan/{token}`
- [x] 25.1.2 — QR on print form `18.3.8` / QR на печатной форме техкарты — `v1.00` `2026-08-24`; `html.qr_block` SVG on `18.3.8`

### 25.2 — Scan entry / Вход скана

- [x] 25.2.1 — Scan page for phone and shop tablet/PC; own login required / Страница скана: телефон и планшет; свой логин — `v1.00` `2026-08-24`; `/production/scan/[token]`; session `PlatformUser`
- [x] 25.2.2 — Цех picker when user has several allowed stages; reject if not current/next / Выбор цеха; отказ если шаг не current/next — `v1.00` `2026-08-24`; GET `/tech-card-scan/{token}`

### 25.3 — Scan actions + fact / Действия скана + факт

- [x] 25.3.1 — Actions: accept in work / complete and transfer / return to previous (partial qty allowed) / Принята / готова и передана / возврат (можно частью qty) — `v1.00` `2026-08-24`; POST accept|complete-transfer|return
- [x] 25.3.2 — Print + cutting: materials, duration, start/ready — reuse `11.5` / `11.6` fact fields / Печать и раскрой: материалы, время, запуск/готовность — те же поля факта — `v1.00` `2026-08-24`; material `fact_qty` + hard-gate `9.3.4`
- [x] 25.3.3 — Design / WTO / QC / packing: scan + existing `11.4` / `11.8`–`11.10` fact / Дизайн, ВТО, ОТК, упаковка: скан + факт своего модуля — `v1.00` `2026-08-24`; performer + work_done on complete/return
- [x] 25.3.4 — Sewing: scan writes Stage 24 ledger (same reserve/limit rules) / Пошив: скан пишет в журнал Stage 24 — `v1.00` `2026-08-24`; accept=take, complete=complete, return=release

### 25.4 — Status + kanban / Статус и канбан

- [x] 25.4.1 — Compute and show the single TC status; kanban must not invent a parallel SoT / Расчёт и показ статуса техкарты; канбан без второй модели — `v1.00` `2026-08-24`; `wip_status` computed; not a second `TechnicalCard.status`

### 25.5 — Regression, visual, docs / Регрессия, visual, docs

- [x] 25.5.1 — Regression (gates, sewing limit, status, print QR) + docs (ADR-016 / `12.3.2` / erp-check / project-structure) / Регрессия + docs — `v1.00` `2026-08-24`; `test_tech_card_scan_25.py`
- [x] 25.5.2 — Owner visual: phone + tablet scan + printed sheet / Owner visual: телефон, планшет, печатный лист — `v1.00` `2026-08-25`; owner OK phone+tablet+print; Stage 25 complete

---

## Stage 26 — Owner findings: bugs, cosmetics, UX polish / Находки владельца: баги, косметика, UX

**New in:** `v1.00` (owner ask `2026-08-25`)
**Новое в:** `v1.00` (запрос владельца `2026-08-25`)

> **EN:** Living backlog. Owner appends findings as `26.N.M` (MD + HTML twin, same iteration). Agent does **not** auto-start `26.*`. Current slice is Stage **12.5** (`12.5.1`). Do **not** re-open closed `20.*` / `22.*` / `3.5.*` / `19.*`. Do not interrupt `12.5`. Do not auto-start Stage **27**. Task: `docs/tasks/v1.00-stage-26-owner-findings.md`. Contract: `SL-OWNER-FINDINGS-v1`.
>
> **RU:** Живой backlog. Владелец дописывает находки кодами `26.N.M` (MD + HTML в той же итерации). Агент **не** стартует `26.*` сам. Текущий срез — Stage **12.5** (`12.5.1`). Не переоткрывать `20` / `22` / `3.5` / `19`. Не прерывать `12.5`. Stage **27** не стартовать сам.

**Execute after / Исполнять после:** only when the owner names a code (e.g. «делай 26.1.2»). / только по явному коду владельца.

### 26.0 — Process / Процесс

- [x] 26.0.1 — Contract: living owner-pull backlog; MD↔HTML atomic; do not interrupt 12.4/12.5; do not reopen 20/22/3.5/19 — `v1.00` `2026-08-25`; `SL-OWNER-FINDINGS-v1`; task `docs/tasks/v1.00-stage-26-owner-findings.md` / Контракт живого backlog

### 26.1 — Sales order card / Карточка заказа `/sales/orders/[id]`

- [x] 26.1.1 — Warn before deleting an order line that has created or started tech cards (number + status); no cascade delete — `v1.00` `2026-08-26`; HTTP 409; host `sales-order-items-unf-demo.tsx`; tests `test_order_item_delete_26_1_1.py` + `order-item-tech-card-guard.test.mjs` / Диалог при удалении позиции с ТК
- [x] 26.1.2 — Payment scale in the right finance rail fills live while typing paid amount (not only after reload) — `v1.00` `2026-08-26`; `paidPercentFromDraft` in `sales-order-metrics.tsx` / Шкала Оплата при вводе
- [x] 26.1.3 — Hide «Количество» from order «Основные сведения» and the same field on the lead («Количество изделий»); no DROP — `v1.00` `2026-08-26`; `order-client-need-details.tsx` + `lead-commercial-details.tsx` / Убрать Количество
- [x] 26.1.4 — Rename «Желаемая дата» → «Дата отгрузки» on the order (same label on lead if still shown) — `v1.00` `2026-08-26`; `order-client-need-details.tsx` + lead `desired_date`; «Планируемая дата заказа» = «Дата входа в производство» (`planned_order_date`) / Дата отгрузки
- [x] 26.1.5 — Source: keep if filled from lead; if empty use the same Select as lead create (`manual` / `website` / `phone` / `email` / `referral` / `vk`) — `v1.00` `2026-08-26`; `leadCreateSourceOptions` / Источник dropdown
- [x] 26.1.6 — Remove aside tab «Переписка»; keep order chat on filter «Коммуникация» (`3.5.7` / Stage 19); do not move ADR-026 off the tech card — `v1.00` `2026-08-26`; `order-card-view-mode.ts` + `sales-order-page.tsx` / Убрать вкладку Переписка справа

### 26.2 — Order tech-cards panel / Техкарты на заказе

> **EN:** Shared host `SalesOrderTechCardsPanel` on filters **Товары** and **Тех карты**. Filter **Документ** (`all`) hides the panel — out of 26.2 unless a new finding.
> **RU:** Общий хост на фильтрах **Товары** и **Тех карты**. Фильтр **Документ** панель скрывает — не 26.2 без новой находки.

- [x] 26.2.1 — Gradient 0–100% readiness bar under the block title (0 = TCs not launched; 100 = ready to ship); remove «Готовность производства» summary block — `v1.00` `2026-08-26`; `order-tech-cards.ts` `readinessPercent`; `sales-order-tech-cards-panel.tsx` / Шкала готовности; убрать блок Готовность производства
- [x] 26.2.2 — Grid 3 mini-cards per row (1 col on narrow); number — title; stage strips (active / done / upcoming); Open as icon at title right; embed `stage_results` on list DTO — `v1.00` `2026-08-26`; `TechnicalCardListRead` on `GET /orders/{id}/technical-cards`; `sales-order-tech-cards-panel.tsx` / Миниблоки 3 в ряд

### 26.3 — Tech-card document / Документ техкарты `/production/tech-cards/[id]`

> **EN:** Host `tech-card-detail-workspace.tsx`. Shop `?stage=` layout stays; 26.3.3 is manager document only (shop already has horizontal chips).
> **RU:** Хост документа ТК. Цеховой `?stage=` не ломаем; 26.3.3 — только менеджерский документ.

- [x] 26.3.1 — Move «Сотрудничество по заказу» (ADR-026) to a right rail on xl+ (sticky); tablet collapse; mobile accordion after header; owner visual on layout in the task file — `v1.00` `2026-08-26`; `tech-card-detail-workspace.tsx`; shop `?stage=` mockup without chat / Правый рейл переписки
- [x] 26.3.2 — «Операции / объёмы», «Схема сборки», «Состав материалов» in one row on large screens — `v1.00` `2026-08-26`; `tech-card-detail-workspace.tsx` `data-tech-card-doc-row3` `xl:grid-cols-3` / Три блока в ряд
- [x] 26.3.3 — Manager «Маршрут / участки» horizontal (shop floor already has chips — do not break) — `v1.00` `2026-08-26`; `data-tech-card-manager-route`; shop `tech-card-shop-floor-body.tsx` chips unchanged / Горизонтальный маршрут менеджера
- [x] 26.3.4 — Rename «Поштучно» → «Персонализация»; move to row 2 after Макет / order data / model+route — `v1.00` `2026-08-26`; `data-tech-card-doc-row2`; shop title unchanged / Персонализация на строке 2

### 26.4 — Nomenclature card / Карточка номенклатуры `/settings/catalogs/nomenclature/[id]`

> **EN:** Host `nomenclature-card.tsx`. Product-type catalog is a picker source, not an auto-whitelist. Variants ≠ product models (ADR-006). Card has no «Варианты» block (`26.4.3`); API/order snapshots stay.
> **RU:** Хост карточки номенклатуры. Каталог вида изделия — источник для `+`, не авто-whitelist. Варианты ≠ модели изделия (ADR-006). Блок «Варианты» на карточке не нужен (`26.4.3`); API/заказ остаются.

- [x] 26.4.1 — «Модели изделий»: show only user-linked whitelist; `+` offers remaining active models of the selected Вид изделия — `v1.00` `2026-08-26`; `nomenclature-available-models-block.tsx`; test `nomenclature-available-models.test.mjs` / Модели только по выбору
- [x] 26.4.2 — «Варианты»: generate / create / edit via existing characteristics API (not empty-state-only) — `v1.00` `2026-08-26`; superseded by `26.4.3` (card block removed) / Выбрать, создать, править варианты
- [x] 26.4.3 — Remove «Варианты» block from nomenclature card (no business/tech need); keep variant API for order snapshots — `v1.00` `2026-08-26`; `nomenclature-card.tsx`; test `nomenclature-variants-26-4-3.test.mjs` / Убрать блок Варианты

### 26.5 — Lead card layout A / Карточка лида `/sales/leads/[id]`

> **EN:** Communication-first two columns (owner pick `2026-08-26`). PT-06 header + stage rail stay. Shell unchanged. Owner visual `26.5.2` closed `2026-08-26`. Quantity hide is `26.1.3`.
> **RU:** Коммуникация — главная колонка; контакт/интерес — узкая левая. Шапку/воронку PT-06 не ломаем. Visual `26.5.2` закрыт.

- [x] 26.5.1 — Layout A: wide composer+feed; narrow left contact/interest accordions; 2–3 header pills instead of 6 MetricCard; no tel/email triple-copy — `v1.00` `2026-08-26`; `lead-page.tsx`; owner visual `26.5.2`; right-column composer superseded by `26.6` / Раскладка A
- [x] 26.5.2 — Owner visual on `/sales/leads/1001` (desktop + narrow) — `v1.00` `2026-08-26` / Visual карточки лида
- [x] 26.5.3 — Slider 92%; Interest fields (direction/category/notes, no sport); Delivery block 3; Metrics block 4 — `v1.00` `2026-08-26`; `lead-card-slider.tsx` / Ширина 92% и блоки
- [x] 26.5.4 — Extra lead-card fields per block + permission `leads.card_fields.manage` on roles — `v1.00` `2026-08-26`; Alembic `g6h7i8j9k012`; ADR-024 / Произвольные поля + RBAC

### 26.6 — Lead card unified feed + event modal / Единое дерево + модалка события

> **EN:** Right column = History-style tree (comms + tasks + notes + internal). Compose/reply in a nested 50% modal over the lead slider. Left facts (`26.5`) stay. Owner visual `26.6.8` closed `2026-08-26`. Shell unchanged.
> **RU:** Правая колонка — дерево как История. Набор/ответ — модалка 50% поверх слайдера. Левые блоки `26.5` не трогать. Visual `26.6.8` закрыт.

- [x] 26.6.1 — Right column is the History tree only; remove feed tabs Коммуникация/Задачи/Заметки/История and the page composer; mobile «Коммуникации» shows the same tree — `v1.00` `2026-08-26`; `lead-page.tsx` / Только дерево справа
- [x] 26.6.2 — Tree includes notes (`comment_added`); event filters Все / Сообщения / Задачи / Заметки / Файлы — `v1.00` `2026-08-26`; `lead-activity-timeline.tsx` / Заметки в дереве
- [x] 26.6.3 — Channel filter: all / phone / email / telegram / whatsapp / vk / website / internal; empty = compact EmptyState — `v1.00` `2026-08-26` / Фильтр каналов
- [x] 26.6.4 — Lead collaboration messages in the same tree (channel internal); remove accordion «Внутренняя переписка»; no ADR-026 API change — `v1.00` `2026-08-26` / Внутренние в дереве
- [x] 26.6.5 — Nested modal `50vw` above lead slider; click event to view title/channel/date/text/files; Escape closes modal only — `v1.00` `2026-08-26`; `lead-event-modal.tsx` / Модалка просмотра
- [x] 26.6.6 — Same modal: compose from header «Написать»; reply on message/internal; reuse send + collaboration send — `v1.00` `2026-08-26` / Набор и ответ
- [x] 26.6.7 — file/system events read-only; task event: view + existing create/complete entry, no kanban in the column — `v1.00` `2026-08-26` / Read-only типы
- [x] 26.6.8 — Owner visual `/sales/leads/1001`: tree+filters; 50% modal; header compose; reply; lead stays under modal — `v1.00` `2026-08-26` / Visual ленты и модалки

### 26.7 — Product model card / Карточка модели `/settings/catalogs/product-models/[id]`

> **EN:** Host `product-model-persistent-card.tsx` (example `/settings/catalogs/product-models/104`). Catalog folders (`6.1.18` `folder_id`) are the model category tree on the list; the card has no folder Select. «Вид изделия» and «Маршрут по умолчанию» already exist — do not replace them.
> **RU:** Хост карточки модели. Категория = папка каталога (`folder_id`). На карточке поля папки нет. «Вид изделия» и «Маршрут по умолчанию» уже Select — не подменять.

- [x] 26.7.1 — Select model category (catalog folder) from a dropdown on the card; persist `folder_id`; empty = no folder — `v1.00` `2026-08-26`; `product-model-persistent-card.tsx`; folders API `6.1.18`; example `/settings/catalogs/product-models/104` / Выбор категории модели в Select

### 26.8 — Common system bugs / Общие баги системы

> **EN:** Cross-module production defects (not a single screen). Media: metadata in VPS Postgres; bytes on VPS bind `./storage` (`0.5.10`). Caddy public origin proxies **Next only** (`web:3000`); API is internal. ≠ parked S3 `0.5.13`.
> **RU:** Кросс-модульные баги продакшена. Метаданные в Postgres VPS; файлы на диске `./storage`. Caddy отдаёт только Next; API снаружи нет. ≠ S3 `0.5.13`.

- [x] 26.8.1 — `https://sport-lead.ru` image upload/display error: same-origin media proxy (or public API origin); do not leave `NEXT_PUBLIC_SPORT_LEADS_API_URL` default `127.0.0.1:8000`; confirm VPS `storage/` write; MIME jpeg/png/webp (empty/HEIC fails); Next serverAction `bodySizeLimit` 10mb vs base64 — `v1.00` `2026-08-26`; `/api/media/[...path]` + `sameOriginApiMediaUrl`; `bodySizeLimit` 15mb; owner report upload fail / Ошибка загрузки картинок на sport-lead.ru
- [x] 26.8.2 — Left sidebar expanded `max(220px, 10vw)` on flex-basis; compact `72px`; DS-SHELL-01 — `v1.00` `2026-08-27`; Tailwind `w-[var]` did not set flex-basis / Ширина левого меню 10%

### 26.9 — Platform nav: sales vs production contours / Меню: контур продаж и производство

> **EN:** Split the left rail into three logical groups so sales and production are separate. Settings may leave the rail (`26.9.2`). SoT `frontend/lib/navigation.ts` (`appSections`). DS-SHELL-01/02 visual; owner visual `26.9.3`. Owner `2026-08-27`: **Склад** and **Закупки** sit in the **Производство** group.
> **RU:** Три логических раздела. Отделить продажи от производства. Склад и Закупки — в контур Производство. Настройки — в иконку справа и слайдер как лид.

- [x] 26.9.1 — Sidebar three groups: (1) **Продажи** = Главная + Продажи + Отчеты + Финансы + Аналитика; (2) **Производство** = Производство + Склад + Закупки; (3) **Настройки** until `26.9.2`. Map existing `appSections` (`dashboard` / `sales` / finance reports + sales nested «Отчёты» — no new report module; `finance`; `analytics`; `production`; `warehouse`; `purchases`; `settings`) — `v1.00` `2026-08-27`; `SIDEBAR_CONTOURS` + `groupSectionsByContour`; reports section reuses `/sales/reports/*`; `app-sidebar.tsx` / Три раздела левого меню
- [x] 26.9.2 — Move **Настройки** out of the sidebar to a DS-SHELL-02 top-right icon; open `/settings` in a right slider like the lead (`LeadCardSlider` / `@leadSlider`); nested `/settings/...` keep URL; full-page route remains for refresh/deep link — `v1.00` `2026-08-27`; `@settingsSlider/(.)settings`; `settings-card-slider.tsx`; `data-settings-topbar-link` / Настройки иконкой и слайдером
- [x] 26.9.3 — Owner visual: expanded + compact sidebar; desktop + md; settings icon + slider vs full `/settings` — `v1.00` `2026-08-27` / Visual меню и слайдера настроек

---

## Stage 27 — 1C:UNF document export / Выгрузка документов в 1С:УНФ

**New in:** `v1.00` (owner ask `2026-08-26`)
**Новое в:** `v1.00` (запрос владельца `2026-08-26`)

> **EN:** Platform is operational SoT. Export **packages** to 1C:UNF so УНФ can create its documents after **semi-manual catalog matching** (propose / link / create). No pre-filled УНФ keys on the platform. Field maps and file volume are **not** fixed here — write them at `27.2.1` / `27.3.1` / `27.4.2` when that export ships. УНФ matching UI is **out of repo**. ≠ Stage `16.1` channels. ≠ print `18.3`. ≠ catalog Excel `4.5`. ≠ job hub `16.3` as SoT. Inbound UNF→platform (`16.2.1`) stays parked. Agent does **not** auto-start `27.1+`. Current slice is Stage **12.5** (`12.5.1`). Task: `docs/tasks/v1.00-stage-27-1c-unf-export.md`. Contract: `SL-1C-UNF-EXPORT-v1`.
>
> **RU:** Платформа ведёт заказ и факты. В УНФ уходят пакеты; сопоставление справочников **в 1С**. Ключи УНФ на платформе заранее не требуются. Карты полей — точечно при той выгрузке. Обработка УНФ вне репо. ≠ `16.1` / `18.3` / `4.5`. Inbound `16.2.1` припаркован. `27.1+` не стартовать сам. Текущий срез — **12.5**.

**Execute after / Исполнять после:** only when the owner names a code (e.g. «делай 27.1.1»). Do not interrupt `12.5`. / только по явному коду владельца. Не прерывать `12.5`.

**Document pairs (UNF receiver, not entity identity) / Пары документов (приёмник УНФ):**

| Sport-Lead | 1C:UNF |
|---|---|
| `SalesOrder` | Заказ покупателя |
| `Specification` (`approved`) | Заказ на производство |
| Товарная накладная / УПД | Товарная накладная / УПД |

### 27.0 — Process / Процесс

- [x] 27.0.1 — Contract: owner-pull; platform→UNF export; three document pairs; matching in 1C; no pre-filled UNF keys; field maps per document at implement time; ≠ `16.1`; inbound `16.2.1` parked — `v1.00` `2026-08-26`; `SL-1C-UNF-EXPORT-v1`; task `docs/tasks/v1.00-stage-27-1c-unf-export.md` / Контракт выгрузки в УНФ

### 27.1 — Shared export shell / Общая выгрузка

> **EN:** No per-document field maps in this block. Payload must carry stable platform ids. Execute `27.1` before `27.2`.
> **RU:** Карт полей документов здесь нет. В пакете — id платформы. `27.1` до `27.2`.

- [ ] 27.1.1 — Export journal + idempotency by platform document id; package carries ids for order / client / organization / nomenclature / variant / Spec version / Журнал выгрузок + идемпотентность; id сущностей в пакете
- [ ] 27.1.2 — File transport MVP (xlsx/csv) + UI entry (not catalog toolbar `4.5`; not print `18.3`; not job hub `16.3` as SoT) / Транспорт файла и точка UI
- [ ] 27.1.3 — Tests for journal/idempotency without live 1C / Тесты журнала без живой 1С

### 27.2 — Sales order → Заказ покупателя

> **EN:** First pointwise field map. Prefer before `27.3` so counterparty/nomenclature matching already exists in УНФ.
> **RU:** Первый точечный маппинг. Желателен до `27.3`.

- [ ] 27.2.1 — Field map for this document (owner + UNF load form) — first implement slice / Карта полей заказа покупателя
- [ ] 27.2.2 — Adapter: `SalesOrder` export package / Адаптер пакета заказа
- [ ] 27.2.3 — Owner visual of file / dry-run / Owner visual файла

### 27.3 — Specification → Заказ на производство

> **EN:** Export last `approved` Spec only — not raw `ProductionOrder` / batch. Spec = plan+fact report (ADR-004/031); UNF production order is the receiver.
> **RU:** Только `approved` Spec, не сырой производственный заказ.

- [ ] 27.3.1 — Field map (approved Spec only) / Карта полей спецификации
- [ ] 27.3.2 — Adapter: approved Specification package / Адаптер пакета Spec
- [ ] 27.3.3 — Owner visual / Owner visual

### 27.4 — Consignment note / UTD / ТН / УПД

> **EN:** Platform has no УПД domain document yet (ADR-005 left it out of invoice MVP). Decide SoT before field map.
> **RU:** УПД в домене нет. Сначала SoT (`27.4.1`), затем карта полей.

- [ ] 27.4.1 — SoT: new sales document on the order **or** assemble from order + `shipped` / `fg_issue` / SoT накладной
- [ ] 27.4.2 — Field map / Карта полей ТН/УПД
- [ ] 27.4.3 — Adapter: ТН/УПД package / Адаптер пакета
- [ ] 27.4.4 — Owner visual / Owner visual

### 27.5 — Checkpoint / Checkpoint

- [ ] 27.5.1 — Regression + docs (contour D, erp-check, project-structure, `16.2.1` pointer) / Регрессия + docs

---

## Stage 28 — Standalone tech cards + unified numbering / Самостоятельные техкарты + единая нумерация

**New in:** `v1.00` (owner ask `2026-08-27`)
**Новое в:** `v1.00` (запрос владельца `2026-08-27`)

> **EN:** Keep contour A: `SalesOrder` → `SalesOrderItem` → PRODUCT → TechnicalCard → (opt.) ProductionOrder/Batch → shops / QR / FG → Spec. Add contour B: TechnicalCard without required SalesOrder (internal ops: scrap, gifts, etc.) via `technical_card_order_groups` (manual order number unique among groups, planned TC count, ship date). Unified **display** number `{orderNo}-{card_seq}/{N}` where `N` = manager-entered planned TC count (live; stored card `number` remains `{orderNo}-{seq}`). Soft progress only — create/generate not blocked when actual ≠ planned. Path B create: nomenclature + order number + planned count + desired date + qty ≥ 1 → unit lines; **no** auto-spawn of N cards. Amend ADR-016 / ADR-004 under `28.0.1`. Parked later: link B→A, PO/Spec without SO, collab without order (`28.5`). Agent does **not** auto-start. Current slice remains Stage **12.5** (`12.5.1`). Task: `docs/tasks/v1.00-stage-28-standalone-tech-cards.md`. Contract: `SL-STANDALONE-TC-v1`.
>
> **RU:** Контур A сохраняется. Контур B: ТК без обязательного заказа покупателя (брак, подарки и т.п.) через группу с ручным номером заказа (unique), плановым кол-вом ТК и датой отгрузки. Показ номера `{заказ}-{seq}/{N}`; `N` вручную, live. Мягкий прогресс — без hard-лимита create/generate. Create B: номенклатура + номер + план + дата + qty → unit lines; автосоздания N карт нет. `28.5` припаркован. Не стартовать сам. Срез — **12.5**.

**Execute after / Исполнять после:** only when the owner names a code (e.g. «делай 28.0.1»). Do not interrupt `12.5`. Do not auto-start `26.9` / `27.1+`. / только по явному коду владельца. Не прерывать `12.5`.

### 28.0 — Contract / Контракт

- [ ] 28.0.1 — Contract + ADR amend plan (016/004): dual contour A/B; display `{orderNo}-{seq}/{N}`; soft planned count; no auto-spawn; task `docs/tasks/v1.00-stage-28-standalone-tech-cards.md`; `SL-STANDALONE-TC-v1` / Контракт standalone ТК + нумерация

### 28.1 — Planned count on SalesOrder + unified display number / Плановое кол-во ТК на заказе + единый показ номера

> **EN:** Path A keeps generate from eligible PRODUCT lines. Planned count is a separate manager field for display/progress.
> **RU:** Generate от позиций не меняется. Плановое кол-во — отдельное ручное поле для показа/прогресса.

- [ ] 28.1.1 — Alembic: `sales_orders.tech_cards_planned_count` (nullable int; when set ≥ 1) / Миграция поля планового кол-ва ТК
- [ ] 28.1.2 — API/schemas: read + PATCH planned count on sales order / API чтения и PATCH планового кол-ва
- [ ] 28.1.3 — Display helper: stored `number` = `{orderNo}-{seq}`; UI/print/list show `…/{N}` live from order field / Хранение без `/{N}`; показ live
- [ ] 28.1.4 — Soft progress on order TC panel (created / planned + status split); no hard gate on create/generate / Мягкий индикатор на панели ТК заказа
- [ ] 28.1.5 — FE: edit planned count on sales order card / FE: поле на карточке заказа
- [ ] 28.1.6 — Tests (API + display helper) / Тесты API и helper показа

### 28.2 — Standalone group + nullable TC FKs + create API / Группа standalone + nullable FK + create API

> **EN:** Group table holds manual order number (unique among groups), planned count, desired date. TC may omit SalesOrder FKs.
> **RU:** Группа хранит ручной номер, план и дату отгрузки. ТК может быть без FK заказа.

- [ ] 28.2.1 — Alembic: `technical_card_order_groups` (`order_number` unique, `tech_cards_planned_count`, `desired_date`); nullable `technical_cards.sales_order_id` / `sales_order_item_id`; FK `order_group_id`; CHECK both SO FKs null or both set; UNIQUE item only when not null / Миграция группы + nullable FK
- [ ] 28.2.2 — Service: create/find group by `order_number`; next `card_seq`; create TC (PRODUCT + qty → unit lines; nomenclature snapshot) / Сервис create группы и ТК
- [ ] 28.2.3 — API `POST` standalone create (+ PATCH group planned count / desired_date) / API create + PATCH группы
- [ ] 28.2.4 — List/detail serializers null-order safe; `order_number` / `desired_date` / `/{N}` from group or SalesOrder / Сериализаторы без обязательного заказа
- [ ] 28.2.5 — Backend tests (unique group number; seq; qty→units; soft over-plan create allowed) / Backend-тесты standalone

### 28.3 — FE production create + document branches / FE create и ветки документа

- [ ] 28.3.1 — Create drawer on `/production/tech-cards`: nomenclature, order number, planned TC count, ship date, qty / Drawer создания standalone ТК
- [ ] 28.3.2 — Detail/list standalone branch: no `/sales/orders/{id}` deep-link; hide order collab rail when no `sales_order_id` / Ветка UI без заказа
- [ ] 28.3.3 — Owner visual: create + list + document header (`…/N`) / Owner visual create/list/шапка

### 28.4 — Print / shop / FG regression + docs checkpoint / Печать / цех / ГП + docs

- [ ] 28.4.1 — Print (`18.3.8`): display number + ship date from SalesOrder **or** order group / Печать: номер и дата отгрузки
- [ ] 28.4.2 — Scan / kanban / FG paths null-order safe / Скан / канбан / ГП без обязательного заказа
- [ ] 28.4.3 — Regression tests + erp-check / project-structure notes / Регрессия + docs checkpoint

### 28.5 — Parked follow-ups / Припаркованные продолжения

> **EN:** Owner-pull; do **not** auto-start with MVP `28.1`–`28.4`.
> **RU:** Owner-pull; не стартовать вместе с MVP.

- [ ] 28.5.1 — Optional link standalone TC → `SalesOrderItem` (if item free) — parked / Опциональная привязка B→A — припарковано
- [ ] 28.5.2 — `ProductionOrder.sales_order_id` nullable for standalone groups — parked / PO без SalesOrder — припарковано
- [ ] 28.5.3 — Spec header without required SalesOrder — parked / Spec без SalesOrder — припарковано
- [ ] 28.5.4 — Collaboration context on TC without order (ADR-026 amend) — parked / Collab без заказа — припарковано

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
| `2026-08-24` | Closed `2.3.2.5`: owner visual OK on client segments / duplicates | Закрыт `2.3.2.5`: owner visual сегментов и дублей |
| `2026-08-24` | Closed `2.3.3.1`: settlements MVP = projection of `3.4.2` order payment markers; ledger SoT remains `14.2`; `SL-CLIENT-SETTLEMENTS-v1` | Закрыт `2.3.3.1`: сводка с маркеров заказа; ledger остаётся `14.2` |
| `2026-08-24` | Closed `2.3.3.2`–`2.3.3.4`: settlements summary API + card block; stop at owner visual `2.3.3.5` | Закрыты `2.3.3.2`–`2.3.3.4`: сводка взаиморасчётов; стоп на visual `2.3.3.5` |
| `2026-08-24` | Closed `2.3.3.5`: owner visual OK on client settlements block | Закрыт `2.3.3.5`: owner visual взаиморасчётов |
| `2026-08-24` | Closed `2.4.1.1`–`2.4.1.4`: organizations contract + CRUD + Settings list/card; drop demo; stop at `2.4.1.5` | Закрыты `2.4.1.1`–`2.4.1.4`: организации API+UI; стоп на visual `2.4.1.5` |
| `2026-08-24` | Closed `2.4.1.5`: owner visual OK on organizations list/card | Закрыт `2.4.1.5`: owner visual организаций |
| `2026-08-24` | Closed `2.4.2.1`–`2.4.2.3`: employees contract + CRUD + Settings list/card; drop demo; stop at `2.4.2.4` | Закрыты `2.4.2.1`–`2.4.2.3`: сотрудники API+UI; стоп на visual `2.4.2.4` |
| `2026-08-24` | Closed `2.4.2.4`: owner visual OK on employees list/card; Stage 2 complete; auth linkage still deferred | Закрыт `2.4.2.4`: owner visual сотрудников; Stage 2 закрыт |
| `2026-08-24` | Closed `24.0.1`–`24.0.2`: sewing cabinet ADR-029 + domain (take/pools/snapshot); stop at `24.1.1` | Закрыты `24.0.1`–`24.0.2`: контракт кабинета швеи; стоп на права `24.1.1` |
| `2026-08-24` | Closed `24.1.1`–`24.1.2`: sewing cabinet RBAC seed + restricted shell (nav + API); stop at ledger `24.2.1` | Закрыты `24.1.1`–`24.1.2`: права/роли + оболочка швеи; стоп на журнал `24.2.1` |
| `2026-08-24` | Closed `24.2.1`–`24.5.1`: sewing work ledger + own/manager cabinet UI; stop at owner visual `24.5.2` | Закрыты `24.2.1`–`24.5.1`: журнал + кабинеты; стоп на visual `24.5.2` |
| `2026-08-24` | Closed `24.5.2`: owner visual OK on sewing cabinet; Stage 24 complete | Закрыт `24.5.2`: owner visual кабинета швеи; Stage 24 закрыт |
| `2026-08-24` | Closed `25.0.1`–`25.0.2`: tech-card QR ADR-030 + domain (unit-line location, status, FG amend); stop at token `25.1.1` | Закрыты `25.0.1`–`25.0.2`: контракт QR/скана; стоп на токен `25.1.1` |
| `2026-08-24` | Closed `25.1.1`–`25.5.1`: opaque QR + print + scan commands/status/FG/sewing ledger; stop at owner visual `25.5.2` | Закрыты `25.1.1`–`25.5.1`: QR/скан до visual `25.5.2` |
| `2026-08-24` | New Stages 24 (sewing cabinet) + 25 (tech-card QR / shop scan); queued after current Stage 2; 25 depends on 24 | Новые этапы 24 (кабинет швеи) + 25 (QR техкарты / скан); в очереди после текущего Stage 2; 25 зависит от 24 |
| `2026-08-25` | Closed `25.5.2`: owner visual OK phone + tablet scan + printed sheet; Stage 25 complete | Закрыт `25.5.2`: owner visual скана и печати; Stage 25 закрыт |
| `2026-08-25` | Closed `7.1.1.1`–`7.1.1.4`: Spec ADR-031 + contract (batch parent, versions, copy/read, no Documents module); stop at DB `7.1.2.1` | Закрыты `7.1.1.1`–`7.1.1.4`: контракт спецификации; стоп на БД `7.1.2.1` |
| `2026-08-25` | Closed `7.1.2.1`–`7.1.2.2`: Spec SQLAlchemy + Alembic `e4f5a6b7c890`; stop at schemas `7.1.2.3` | Закрыты `7.1.2.1`–`7.1.2.2`: модели + миграция; стоп на schemas `7.1.2.3` |
| `2026-08-25` | Closed `7.1.2.3`–`7.2.2.5` + `7.2.3.*`: Spec API + list/card plan+fact; stop at owner visual `7.2.2.6` | Закрыты schemas/API/UI спецификации; стоп на visual `7.2.2.6` |
| `2026-08-25` | Closed `7.2.2.6`: owner visual OK specs list+card+batch link; Stage 7 complete | Закрыт `7.2.2.6`: owner visual спецификаций; Stage 7 закрыт |
| `2026-08-25` | Split `12.4.1` → `12.4.1.1`–`12.4.1.6`; closed `12.4.1.1` inventory contract (ADR-019 amend); stop at persistence `12.4.1.2` | Сплит `12.4.1`; закрыт контракт инвентаризации; стоп на БД `12.4.1.2` |
| `2026-08-25` | Closed `12.4.1.2`: `StockDocumentType.INVENTORY` + `stock_inventory_lines`; Alembic `f5a6b7c8d901`; stop at service `12.4.1.3` | Закрыт `12.4.1.2`: тип `inventory` + строки пересчёта; стоп на service `12.4.1.3` |
| `2026-08-25` | Closed `12.4.1.3`: inventory snapshot/counted/post deltas; stop at API `12.4.1.4` | Закрыт `12.4.1.3`: service инвентаризации; стоп на API `12.4.1.4` |
| `2026-08-25` | Closed `12.4.1.4`: inventory HTTP API + regression; stop at UI `12.4.1.5` | Закрыт `12.4.1.4`: API инвентаризации; стоп на UI `12.4.1.5` |
| `2026-08-25` | New Stage `0.5` canonical VPS (ADR-032): closed `0.5.1`/`0.5.2`/`0.5.5`/`0.5.9`/`0.5.10`; pause `12.4.1.5`; owner `0.5.3`+ live apply | Новый `0.5` канонический VPS; закрыты контракт/правило/compose/tunnel/sync; пауза `12.4.1.5` |
| `2026-08-25` | Closed `12.4.1.5`: inventory UI on `/warehouse/movements` (create + card); stop at owner visual `12.4.1.6` | Закрыт `12.4.1.5`: UI инвентаризации; стоп на visual `12.4.1.6` |
| `2026-08-25` | Added `0.5.6.1`: DNS `sport-lead.ru` → VPS; only public origin `https://sport-lead.ru`; execute before `0.5.6` TLS | Добавлен `0.5.6.1`: DNS sport-lead.ru на VPS; единственный публичный origin |
| `2026-08-25` | Added `0.5.4.1`: host environment on Ubuntu **26.04** (Docker CE + compose; no native app runtime); `0.5.4` is clone/env on that OS | Добавлен `0.5.4.1`: окружение Ubuntu 26.04; `0.5.4` — clone/env |
| `2026-08-25` | `0.5.4.1` in-repo host script `scripts/vps-bootstrap-ubuntu-26.04.sh` (checkbox open until live VPS) | Скрипт bootstrap Ubuntu 26.04; чекбокс открыт до live host |
| `2026-08-25` | Closed `0.5.4.1`: live Ubuntu 26.04 host Docker CE `29.7.2` + Compose `v5.5.0`; TZ Moscow; UFW 22/80/443; stop at git gate `0.5.3` then clone `0.5.4` | Закрыт `0.5.4.1`: Docker на Ubuntu 26.04; стоп на `0.5.3` / clone `0.5.4` |
| `2026-08-25` | Closed `0.5.3`: Spec + Stage 0.5 artifacts on `main` (no pycache); next clone `0.5.4` | Закрыт `0.5.3`: WIP в `main`; далее clone `0.5.4` |
| `2026-08-25` | Closed `0.5.4`: VPS `/home/deploy/sport-leads` @ `841f64e`; GitHub deploy-key read-only; `.env.production` on host; next DNS `0.5.6.1` | Закрыт `0.5.4`: clone + env на VPS; далее DNS |
| `2026-08-25` | Closed `0.5.6.1`: Google DNS A `sport-lead.ru` + `www` → `46.173.29.247`; next first up `0.5.6` | Закрыт `0.5.6.1`: DNS на VPS; далее `0.5.6` |
| `2026-08-25` | Closed `0.5.6`: compose up + Caddy TLS; `https://sport-lead.ru/healthz` `/health` `/health/ready` HTTP 200; next dump `0.5.7` | Закрыт `0.5.6`: TLS + health; далее dump |
| `2026-08-25` | Closed `0.5.7`: local Docker PG dump `sport_leads-20260825-173102.dump` → `prod-restore-db` on VPS; `/health/ready` ok; next `0.5.8` | Закрыт `0.5.7`: дамп на VPS; далее GitHub deploy |
| `2026-08-25` | Closed `0.5.8`: GitHub env `production` + SSH secrets; workflow_dispatch run `32861707751` success; next cron `0.5.11` | Закрыт `0.5.8`: первый Actions deploy; далее cron |
| `2026-08-25` | Closed `0.5.11`: deploy crontab 02:15 MSK + 7-day disk retention; first dump off-box to `backup/vps-offbox/`; next owner smoke `0.5.12` | Закрыт `0.5.11`: cron backup; далее smoke |
| `2026-08-25` | Closed `0.5.12`: HTTPS `https://sport-lead.ru/login` form + `/health/ready` 200; Stage `0.5` complete | Закрыт `0.5.12`: smoke login; Stage `0.5` закрыт |
| `2026-08-25` | New Stage **26** living owner findings (bugs/cosmetics); closed `26.0.1` contract; seed `26.1`–`26.3` parked; owner-pull only; current slice still `12.4.1.6` | Новый Stage **26** живой backlog; закрыт `26.0.1`; seed припаркован; текущий срез `12.4.1.6` |
| `2026-08-26` | Closed `26.1.1`: refuse deleting an order line that still has a tech card (number + status, HTTP 409, no cascade); remaining seed `26.1.2`+ parked | Закрыт `26.1.1`: нельзя удалить позицию с техкартой (номер + статус, 409, без каскада) |
| `2026-08-26` | Closed `26.1.2`: payment scale fills live from typed paid amount (`paidPercentFromDraft`); remaining seed `26.1.3`+ parked | Закрыт `26.1.2`: шкала Оплата живая при вводе суммы |
| `2026-08-26` | Closed `26.4.1`–`26.4.2`: nomenclature models whitelist-only + variants generate/create UI; `26.5.1`–`26.5.2` still open (lead layout A + owner visual) | Закрыты `26.4.1`–`26.4.2`; лид `26.5` открыт |
| `2026-08-26` | Closed `26.5.3`–`26.5.4`: lead slider 90%; Interest/Delivery/Metrics; extra card fields + `leads.card_fields.manage`; `26.5.1`/`26.5.2` still open | Закрыты `26.5.3`–`26.5.4`; visual `26.5.2` открыт |
| `2026-08-26` | Closed `12.4.1.6`: owner visual OK inventory list+drawer+card; thead `tr` hydration fix; Stage 12.4 complete; next `12.5.1` | Закрыт `12.4.1.6`: owner visual инвентаризации; Stage 12.4 закрыт; далее `12.5.1` |
| `2026-08-26` | Closed `26.5.1`/`26.5.2`/`26.6.8` owner visual; closed `26.1.3` hide Количество on order+lead (no DROP) | Закрыты visual `26.5.1`/`26.5.2`/`26.6.8`; закрыт `26.1.3` Количество скрыто |
| `2026-08-26` | Closed `26.1.4`: order «Желаемая дата» → «Дата отгрузки»; lead field not shown; no column rename | Закрыт `26.1.4`: Дата отгрузки на заказе |
| `2026-08-26` | Closed `26.1.6`: removed order aside tab «Переписка»; order chat on filter «Коммуникация»; ADR-026 stays on tech card | Закрыт `26.1.6`: вкладка Переписка снята; чат на фильтре Коммуникация |
| `2026-08-26` | Closed `26.2.1`: gradient readiness bar under tech-cards title (0 = not launched, 100 = ready to ship); removed «Готовность производства» summary | Закрыт `26.2.1`: шкала готовности под заголовком ТК; сводка убрана |
| `2026-08-26` | Closed `26.2.2`: order TC mini-cards 3-col grid, stage strips, icon Open; slim list DTO with `stage_results` | Закрыт `26.2.2`: миниблоки ТК 3 в ряд + стрипы этапов |
| `2026-08-26` | Closed `26.3.1`: ADR-026 collab sticky right rail on xl; tablet/mobile «Переписка» collapse; shop mockup without chat | Закрыт `26.3.1`: рейл переписки на документе ТК |
| `2026-08-26` | Closed `26.3.2`: ops / assembly / materials in one xl row; route and Поштучно stay below | Закрыт `26.3.2`: три блока ТК в ряд |
| `2026-08-26` | Closed `26.3.3`: manager route stages as horizontal wrap cards; shop chips unchanged | Закрыт `26.3.3`: горизонтальный маршрут менеджера |
| `2026-08-26` | Closed `26.3.4`: rename Поштучно → Персонализация; block after Макет row (shop title unchanged) | Закрыт `26.3.4`: Персонализация на строке 2 |
| `2026-08-26` | Closed `26.7.1`: product-model card category Select (`folder_id`); empty = no folder; PATCH sends folder_id | Закрыт `26.7.1`: Select категории модели |
| `2026-08-26` | Closed `26.8.1`: same-origin `/api/media/[...path]` proxy; `sameOriginApiMediaUrl`; empty MIME from extension; serverAction 15mb | Закрыт `26.8.1`: прокси картинок; не `:8000` в браузере |
| `2026-08-27` | Fixed `26.8.2` render: expanded sidebar flex-basis `max(220px, 10vw)` (Tailwind `w-[var]` did not set flex-basis) | Исправлено `26.8.2`: flex-basis max(220px, 10vw) |
| `2026-08-26` | New Stage **27** 1C:UNF outbound export (SalesOrder / approved Spec / ТН-УПД); closed `27.0.1` contract; `27.1+` parked owner-pull; `16.2.1` inbound parked (not MVP) | Новый Stage **27** выгрузка в УНФ; закрыт `27.0.1`; `27.1+` припаркован; inbound `16.2.1` не MVP |
| `2026-08-26` | Added `26.7.1`: product-model card category Select (`folder_id` / catalog folders); parked owner-pull; example `/settings/catalogs/product-models/104` | Добавлен `26.7.1`: Select категории модели на карточке; припаркован |
| `2026-08-26` | Added parked `0.5.13`: S3-compatible media when VPS disk is the constraint; keep `0.5.10` disk SoT; owner-pull; do not auto-start; live apply `0.5.12` stays closed | Добавлен припаркованный `0.5.13`: S3 для медиа; SoT пока диск VPS; не стартовать |
| `2026-08-26` | Added `26.8` common system bugs; parked `26.8.1` sport-lead.ru image upload (Caddy→Next only; browser media URL uses `NEXT_PUBLIC_*` default `:8000`; bytes on VPS `storage/`) | Добавлен `26.8.1`: ошибка картинок на sport-lead.ru |
| `2026-08-27` | Parked `26.9.1`–`26.9.3`: sidebar three contours (sales cluster / production / settings); settings gear + lead-style slider; Склад/Закупки stay until owner places | Добавлен `26.9`: разделить меню продажи/производство; настройки в иконку |
| `2026-08-27` | Closed `26.9.1`: three sidebar contours; Отчеты = existing `/sales/reports/*`; Склад+Закупки in Производство; settings stay in rail | Закрыт `26.9.1`: три раздела меню |
| `2026-08-27` | Closed `26.9.2`: settings leave the rail; DS-SHELL-02 gear; `/settings` intercept slider like lead; nested `/settings/...` stay full pages; hard refresh full hub | Закрыт `26.9.2`: настройки иконкой и слайдером |
| `2026-08-27` | Closed `26.9.3`: owner visual OK expanded + compact sidebar; desktop + md; settings gear + slider vs full `/settings` | Закрыт `26.9.3`: owner OK меню и слайдер настроек |
| `2026-08-27` | New Stage **28** standalone tech cards + unified display `{order}-{seq}/{N}`; soft planned TC count; all `28.0`–`28.5` open; owner-pull; task `v1.00-stage-28-standalone-tech-cards.md`; `SL-STANDALONE-TC-v1` | Новый Stage **28** самостоятельные ТК + нумерация; все коды открыты; owner-pull |
