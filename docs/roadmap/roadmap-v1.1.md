# Sport-Lead — Roadmap v1.1

**Code:** `SL-ROADMAP-v1.1`
**Updated:** `2026-10-05`
**Project version:** `v1.1`
**Status:** Open queue carried from `v1.00`. Owner visual checkpoints of already shipped work closed `2026-10-02`.

**Canonical twin:**
- Markdown (master): `docs/roadmap/roadmap-v1.1.md`
- HTML report: `docs/erp/status/roadmap-v1.1.html`

**Related:**
- Closed history `v1.00`: `docs/roadmap/roadmap-v1.00.md` (+ HTML twin)
- History `v0.9.0`: `docs/roadmap/roadmap.md` (+ HTML twin)
- Structure: `docs/architecture/project-structure.md`
- ERP-check: `docs/architecture/erp-check.md`

---

## Language note / Примечание о языке

| EN | RU |
|---|---|
| This Markdown keeps bilingual titles. | Заголовки и пункты даны на двух языках. |
| Use the HTML twin for **EN ↔ RU**. | Переключение **EN ↔ RU** — в HTML-близнеце. |

---

## Rules / Правила

- `[x]` = done / выполнено; `[ ]` = open / не выполнено.
- Codes stay as in `v1.00`. This file holds only the still-open items (plus the stage notes needed to execute them).
- Коды те же, что в `v1.00`. Здесь только ещё открытые пункты и заметки, без которых их нельзя исполнять.
- Do not auto-start parked owner-pull items: `0.5.13`, `12.5.2`, `16.2.1`, Stage **27** (`27.1+`).
- Не стартовать самому припаркованные owner-pull: `0.5.13`, `12.5.2`, `16.2.1`, Stage **27**.
- Next unfinished procurement item after closed `13.1.2`: **`13.2.1`**. Start it only when the owner names that code.
- Следующий открытый пункт закупок после закрытого `13.1.2`: **`13.2.1`**. Стартовать, когда владелец назовёт код.
- MD ↔ HTML twins stay atomic on checkbox / title / note changes.

## Closed on this cut (stay in v1.00) / Закрыто в этом срезе (остаётся в v1.00)

Owner confirmed visual `2026-10-02` / Владелец подтвердил визуал `2026-10-02`:

- `13.1.2.6` — purchase orders list + card (`/purchases/orders`); Stage **13.1.2** complete
- `26.3.14`, `26.3.15` — tech-card order bind on `/production/tech-cards/6`
- `26.11.13` — tech-card list responsible + filter
- `26.12.1`, `26.12.2` — personalization qty and product-model card modal

These are not repeated below. Future “owner visual” lines inside Stage **27** stay open: that export has not been built.

---

## Stage 0.5 — S3 media / S3 медиа

> EN: Only the parked remainder of canonical VPS. Disk SoT `0.5.10` stays until the owner pulls `0.5.13`. No s3fs. ADR-011/022. Do not auto-start.
> RU: Только припаркованный остаток канонического VPS. Диск `0.5.10` остаётся, пока владелец не вызовет `0.5.13`. Без s3fs. ADR-011/022. Не стартовать самому.

### 0.5.13 — Object storage / Объектное хранилище

- [ ] 0.5.13 — S3-compatible object storage for media (private bucket; API on VPS; replace disk SoT `0.5.10`) — parked; owner-pull; do not auto-start while the project is small; no s3fs; ADR-011/022 / S3 медиа, когда диск VPS станет узким

---

## Stage 12.5 — Reserves / Резервы

> EN: `12.4` inventory and `12.5.1` transfers are closed in `v1.00`. `12.5.2` is later / owner-pull. Do not auto-start.
> RU: Инвентаризация `12.4` и перемещения `12.5.1` закрыты в `v1.00`. `12.5.2` — later / owner-pull. Не стартовать самому.

### 12.5.2 — Reserves / Резервы

- [ ] 12.5.2 — Reserves (sales/production) — later / Резервы (продажи/производство) — later

---

## Stage 13.2 — Supply execution / Исполнение поставок

> EN: Suppliers `13.1.1` and purchase orders `13.1.2` are closed in `v1.00` (owner visual `13.1.2.6` OK `2026-10-02`, ADR-033 / ADR-034). Next procurement slice is receipts. Do not start until the owner names `13.2.1`.
> RU: Поставщики `13.1.1` и заказы поставщикам `13.1.2` закрыты в `v1.00` (owner visual `13.1.2.6` OK `2026-10-02`). Дальше — поступления. Не начинать, пока владелец не назовёт `13.2.1`.

### 13.2 — Receipts and demand / Поступления и потребность

- [ ] 13.2.1 — Receipts and returns / Поступления и возвраты
- [ ] 13.2.2 — Demand planning and minimum stock linkage / Планирование потребности и связь с минимальным остатком

---

## Stage 14 — Shipping and Payments / Отгрузка и платежи

> EN: Carried from `v1.00` / `v0.9.0`. Shipping documents sit on top of the warehouse issue that is already `shipped` (ADR-019). Do not duplicate that issue.
> RU: Перенесено из `v1.00` / `v0.9.0`. Документы отгрузки — поверх уже `shipped` складского списания (ADR-019). Issue не дублировать.

### 14.1 — Shipping / Отгрузка

- [ ] 14.1.1 — Shipping orders, packaging, delivery, and documents — on top of already `shipped` warehouse issue (ADR-019); do not duplicate issue / Заказы на отгрузку, упаковка, доставка и документы — поверх уже `shipped` (складское списание ADR-019); не дублировать issue

### 14.2 — Payments / Платежи

- [ ] 14.2.1 — Invoices, payments, advances, and debt / Счета, оплаты, авансы и задолженность
- [ ] 14.2.2 — Settlements by order and client / Взаиморасчёты по заказу и клиенту

---

## Stage 15 — Costing and Analytics / Себестоимость и аналитика

> EN: `15.2.1` CRM dashboard and base order analytics already shipped in `v0.9.0`. Not repeated here.
> RU: `15.2.1` CRM-дашборд и базовая аналитика заказов уже закрыты в `v0.9.0`. Здесь не повторяется.

### 15.1 — Costing / Себестоимость

- [ ] 15.1.1 — Planned, normative, and actual costing / Плановая, нормативная и фактическая себестоимость
- [ ] 15.1.2 — Margin and plan-fact analysis / Маржа и план-факт анализ

### 15.2 — Analytics / Аналитика

- [ ] 15.2.2 — ERP analytics and management P&L / ERP-аналитика и управленческий P&L

---

## Stage 16 — Integrations / Интеграции

> EN: Lead ingest adapters stay `1.4.3` (closed in `v1.00`). Canonical 1C:UNF outbound is Stage **27**, not `16.2.1`. `16.2.1` inbound Excel stays parked, not MVP.
> RU: Ingest лидов — закрытый `1.4.3`. Канон выгрузки в 1С:УНФ — Stage **27**, не `16.2.1`. Inbound Excel `16.2.1` припаркован, не MVP.

### 16.1 — External channels / Внешние каналы

> EN: Platform channel connectors. Lead ingest stays `1.4.3` (shared transport OK, no duplicate CRM SoT).
> RU: Канальные коннекторы. Ingest лидов — `1.4.3` (общий transport OK, без дубля CRM SoT).

- [ ] 16.1.1 — Website forms, email, VK, Telegram, and telephony / Формы сайта, email, VK, Telegram и телефония
- [ ] 16.1.2 — Google Sheets and webhooks / Google Sheets и webhooks

### 16.2 — Enterprise exchange / Корпоративный обмен

> EN: Contour D (ADR-020). Outbound UNF packages = Stage 27. `16.2.1` parked inbound. Neighbor job shell = `16.3`.
> RU: Контур D (ADR-020). Выгрузка в УНФ = Stage 27. `16.2.1` — припаркованный inbound. Оболочка заданий = `16.3`.

- [ ] 16.2.1 — 1C:UNF inbound SalesOrder Excel (UNF → platform) — parked; not MVP; canonical outbound = Stage 27; neighbor to `16.3`, not catalog Excel buttons / Inbound Excel заказов УНФ→платформа — припаркован; не MVP; канон выгрузки = Stage 27
- [ ] 16.2.2 — Delivery and payment-system integrations / Интеграции доставки и платёжных систем
- [ ] 16.2.3 — External API for third-party systems / Внешний API для сторонних систем

### 16.3 — Universal import and export / Универсальный импорт и экспорт

> EN: ADR-020 job shell (section picker + journal) over the same adapters as section toolbars (`4.5`). Do not pull domain-inline `9.3.2` here.
> RU: ADR-020: оболочка заданий поверх адаптеров тулбаров (`4.5`). Доменный inline `9.3.2` сюда не тянуть.

- [ ] 16.3.1 — Contract: job runner + section adapter registry (upload → map → validate → dry-run → commit; audit hooks) / Контракт: runner заданий + реестр адаптеров разделов (upload → map → validate → dry-run → commit; audit hooks)
- [ ] 16.3.2 — Wire nomenclature adapter from `4.5` into the job shell / Подключить адаптер номенклатуры из `4.5` к оболочке заданий
- [ ] 16.3.3 — Administration UI: jobs list + section picker (no duplicate SoT) / UI администрирования: список заданий + выбор раздела (без дубля SoT)
- [ ] 16.3.4 — Regression tests + documentation checkpoint / Регрессионные тесты + checkpoint документации

---

## Stage 18.4 — Global operations journal / Глобальный журнал операций

> EN: Full carry from `v0.9.0` via `v1.00`. Stubs `product_model_has_journal_operations` and characteristic journal hooks still return `False`. Admin shell `18.1`–`18.3` stays in `v0.9.0`.
> RU: Полный перенос из `v0.9.0` через `v1.00`. Stubs журнала всё ещё возвращают `False`. Оболочка admin `18.1`–`18.3` остаётся в `v0.9.0`.

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

## Stage 27 — 1C:UNF document export / Выгрузка документов в 1С:УНФ

> EN: `27.0.1` contract is closed in `v1.00` (`SL-1C-UNF-EXPORT-v1`). `27.1+` stays owner-pull. Do not auto-start. Matching UI is out of repo. Inbound `16.2.1` stays parked. Field maps are written when that document ships (`27.2.1` / `27.3.1` / `27.4.2`).
> RU: Контракт `27.0.1` закрыт в `v1.00`. `27.1+` — owner-pull. Не стартовать самому. Обработка УНФ вне репо. Inbound `16.2.1` припаркован.

**Document pairs (UNF receiver) / Пары документов (приёмник УНФ):**

| Sport-Lead | 1C:UNF |
|---|---|
| `SalesOrder` | Заказ покупателя |
| `Specification` (`approved`) | Заказ на производство |
| Товарная накладная / УПД | Товарная накладная / УПД |

### 27.1 — Shared export shell / Общая выгрузка

> EN: No per-document field maps in this block. Package carries stable platform ids. Execute `27.1` before `27.2`.
> RU: Карт полей документов здесь нет. В пакете — id платформы. `27.1` до `27.2`.

- [ ] 27.1.1 — Export journal + idempotency by platform document id; package carries ids for order / client / organization / nomenclature / variant / Spec version / Журнал выгрузок + идемпотентность; id сущностей в пакете
- [ ] 27.1.2 — File transport MVP (xlsx/csv) + UI entry (not catalog toolbar `4.5`; not print `18.3`; not job hub `16.3` as SoT) / Транспорт файла и точка UI
- [ ] 27.1.3 — Tests for journal/idempotency without live 1C / Тесты журнала без живой 1С

### 27.2 — Sales order → Заказ покупателя

> EN: First field map. Prefer before `27.3`.
> RU: Первый маппинг. Желателен до `27.3`.

- [ ] 27.2.1 — Field map for this document (owner + UNF load form) — first implement slice / Карта полей заказа покупателя
- [ ] 27.2.2 — Adapter: `SalesOrder` export package / Адаптер пакета заказа
- [ ] 27.2.3 — Owner visual of file / dry-run / Owner visual файла

### 27.3 — Specification → Заказ на производство

> EN: Export last `approved` Spec only, not a raw production order.
> RU: Только последняя `approved` Spec, не сырой производственный заказ.

- [ ] 27.3.1 — Field map (approved Spec only) / Карта полей спецификации
- [ ] 27.3.2 — Adapter: approved Specification package / Адаптер пакета Spec
- [ ] 27.3.3 — Owner visual / Owner visual

### 27.4 — Consignment note / UTD / ТН / УПД

> EN: No УПД domain document yet. Decide SoT in `27.4.1` before the field map.
> RU: Документа УПД в домене нет. Сначала SoT в `27.4.1`, затем карта полей.

- [ ] 27.4.1 — SoT: new sales document on the order, or assemble from order plus shipped and fg_issue / SoT накладной
- [ ] 27.4.2 — Field map / Карта полей ТН/УПД
- [ ] 27.4.3 — Adapter: ТН/УПД package / Адаптер пакета
- [ ] 27.4.4 — Owner visual / Owner visual

### 27.5 — Checkpoint / Checkpoint

- [ ] 27.5.1 — Regression + docs (contour D, erp-check, project-structure, `16.2.1` pointer) / Регрессия + docs

---

## Production Calendar v0.1 — manual-first / Производственный календарь

> Design frozen 2026-10-05; UI-A–UI-H OWNER-APPROVED. Owner-selected PC-03.1 lightweight queue MVP implemented: one CalendarAssignment table, weekly UI-A and CRUD; project check 10/10, live responsive QA. PC-03 remains in progress; PC-04…PC-10 open. This slice supersedes the earlier five-table persistence proposal only within its explicit scope.

### PC-01…PC-10 — product and implementation checkpoints

- [x] PC-01 — Read-only repository audit; `2026-10-03`, reuse matrix, risks, open decisions and checks: `docs/tasks/production-calendar-pc-01-audit.md`; application/migrations unchanged; `git diff --check` passed, project check 7/10 (environment + existing lint errors); PC-02 remains open; detail and acceptance in production-calendar-v0.1.md
- [x] PC-02 — Architecture/data/API contract; `2026-10-03`, `docs/architecture/production-calendar-pc-02.md`; documentation-only, existing models/API/migrations unchanged; diff/MD↔HTML passed, project check 7/10 (environment, existing lint and TC test failure); business decisions and failed check block implementation; PC-03 open; detail and acceptance in production-calendar-v0.1.md
- [x] PC-02.1 — Lightweight design freeze and minimal implementation contract; CLOSED 2026-10-05 per docs/tasks/pc-02-1-lightweight-design-freeze-implementation-contract.md; docs/architecture/production-calendar-implementation-v0.1.md; documentation-only, P1 B1 closed 2026-10-05 (13 regression tests); baseline checks remain open, PC-03 not started
- [x] PC-02.1-B1 — B1 CLOSED 2026-10-05: refresh updates header/pattern only; saved materials, plan/fact and IDs preserved; 13 regression tests passed; PC-03 not started; `docs/tasks/pc-02-1-b1-fix-refresh-model-material-loss.md`; no API/schema/migrations changes; baseline checks remain blocked by local DB/lint
- [ ] PC-03 — In progress: PC-03.1 lightweight queue MVP complete per docs/tasks/pc-03-1-lightweight-production-queue-mvp.md; remaining implementation checkpoints open. Capacity, dependency engine, execution, dashboard/deviations excluded from this slice.
- [x] PC-03.1 — PC-03.1 lightweight queue MVP CLOSED 2026-10-05; CalendarAssignment only, migration u0v1w2x3y456; authenticated batch API and /production/calendar UI-A; 479 backend / 299 frontend tests, project check 10/10, live CRUD/reload/filter and 1440/1024/768/390/320 px. Evidence: docs/tasks/pc-03-1-lightweight-production-queue-mvp.md. PC-03 remains open; capacity/workflow/UI-G/H deferred.
- [x] PC-03.2 — PC-03.2 navigation integration CLOSED 2026-10-05; Production → Очередь производства, five primary links, parent opens /production/calendar; UI-E/F/G/H entry pages explicitly not implemented. 15 navigation / 300 frontend / 479 backend tests; project check 10/10; isolated shell browser QA 1440/1024/768/390/320 px; authenticated route QA limited by bootstrap 401. Evidence: docs/tasks/pc-03-2-production-queue-navigation.md. Backend/DB/business logic unchanged; PC-03 open.
- [x] PC-03.3 — PC-03.3 manual scheduling on CalendarAssignment CLOSED 2026-10-05; /production/calendar/planning, UI-A assignment deep link, date/stage/position/note prefill, before/after preview, existing PUT and return to destination week; quantity read-only from TC. Backend/API/DB/migrations unchanged. 23 targeted frontend / 11 existing calendar backend / 305 full frontend / 479 full backend tests; project check 10/10; live Chromium 1440/1366/1280/1024/768/390/320 px, real 409 and reload persistence. Evidence: docs/tasks/pc-03-3-manual-scheduling-calendar-assignment.md; PC-03 open, UI-F/G/H deferred.
- [x] PC-03.4A — PC-03.4A Capacity backend contract CLOSED 2026-10-05; 14 logical resource keys reusing ProductionStage/WorkCenter; two settings/exception tables, migration v1w2x3y4z567; GET/PUT capacity/settings, PUT/DELETE dated exceptions, read-only POST capacity/load-state with separate units and unknown norms. 45 targeted / 513 full backend tests; project check 10/10; local PostgreSQL upgrade/check/downgrade/upgrade/check and live persistence passed. Contract: docs/architecture/production-calendar-capacity-pc-03-4a.md. Frontend/UI-A unchanged by Codex; PC-03.4B temporary adapter still requires contract alignment; UI-F integration not claimed. PC-03 open.
- [x] PC-03.4D — PC-03.4D Queue Load Indicators CLOSED 2026-10-05; UI-A stage/date badges from existing POST capacity/load-state, one settings read + bounded resource/date requests (six in flight), no frontend formulas or mixed-unit section percentage; unknown stays explicit, reserve/near/over never gate assignment creation/move. 17 targeted / 323 frontend / 513 backend tests; project check 10/10; real API Chromium seven widths, four states, empty days, create/move while over, 503/retry. Evidence: docs/tasks/pc-03-4d-queue-load-indicators-cursor.md. Backend/DB/UI-F/navigation unchanged; PC-03 open.
- [x] PC-03.5A — PC-03.5A Automatic Entry Stage CLOSED 2026-10-05; minimal POST assignments accepts technical_card_id/planned_date/optional note, server chooses launch_preparation (Подготовка к запуску) and stable date/stage tail position; legacy create stage/position rejected422. Existing dispatcher PUT/read/reference quantity preserved. Data-only migration w2x3y4z5a678; procurement remains milestone on entry stage. 61 targeted / 529 backend tests; project check10/10; local migration cycle, eight concurrent creates and durable move verified. Contract docs/architecture/production-calendar-entry-pc-03-5a.md. Frontend PC-03.5B separate; PC-03 open.
- [x] PC-03.6A — PC-03.6A Operation Date Range implemented 2026-10-06: planned_start_date aliases legacy planned_date; persisted planned_end_date with inclusive range CHECK/backfill; PUT accepts start/end, GET board uses overlap, minimal POST remains single-day. Migration x3y4z5a6b789; 71 targeted / 539 backend tests passed; PostgreSQL migration cycle/backfill verified. Contract docs/architecture/production-calendar-date-range-pc-03-6a.md. Frontend PC-03.6B separate; PC-03 remains open.
- [x] PC-03.7A — PC-03.7A Shared CapacityResource CLOSED 2026-10-06 per owner M:N decision: TechOperation owns technology, CapacityResource owns capacity; existing settings renamed in place, dated exceptions preserved, print_operator shared by sublimation and heat_transfer without resource copies. Migration y4z5a6b7c890; canonical resource CRUD and operation links, legacy capacity/load-state compatible. 53 targeted / 555 backend / 331 frontend tests; project check 10/10; isolated PostgreSQL migration cycle and exact data preservation verified. Contract docs/architecture/production-calendar-shared-capacity-pc-03-7a.md. Other resources remain unlinked until explicitly selected; frontend PC-03.7B separate; PC-03 open.
- [ ] PC-03.7B — In progress: Unified Tech Operation Capacity UI; follows owner M:N decision in production-calendar-shared-capacity-pc-03-7a.md. Owner-selected guarded edit modal PC-03.7B-B1 complete; shared CapacityResource/link adapter integration and authenticated runtime acceptance remain open. docs/tasks/pc-03-7b-unified-tech-operation-capacity-ui-cursor.md; no scheduler.
- [x] PC-03.7B-B1 — PC-03.7B-B1 Guarded TechOperation edit modal CLOSED 2026-10-06 per owner visual request: desktop/mobile Edit opens populated dialog, header Save/Cancel/X, dirty discard confirmation for Cancel/X/Escape/backdrop, beforeunload and pending-save protection; pending date exception and failed save preserve inputs. DS-PT-02-CATALOG; 17 Chromium checks at 1440/1366/1280/1024/768/390/320 px; 7 targeted / 331 frontend / 555 backend tests, project check 10/10. Evidence docs/tasks/pc-03-7b-b1-tech-operation-edit-modal.md. Backend/contracts/migrations unchanged; complete shared-resource frontend integration PC-03.7B remains open.
- [ ] PC-04 — Add existing technical card to calendar queue; sources prefilled, no duplicate order; detail in minimal implementation contract
- [x] PC-04.2 — PC-04.2 Demand Calculation Contract CLOSED as architecture specification 2026-10-07 per owner task after stated PC-04.1 prerequisites. Canonical production-demand-pc-04-2.md defines step-scoped ResourceDemand DTO/status/provenance, adapter registry, verified TC/assembly inputs, exact unit equality, shared resources, missing/manual policy and future tests. No executable Demand/API/DB/frontend/Scheduler changes; hourly-throughput mismatches and absent fixed/operator/design/split inputs remain explicit implementation limits. Project check10/10; 565 backend tests. docs/tasks/pc-04-2-demand-calculation-contract.md. Historical PC-04 queue checkpoint and Scheduler implementation remain open.
- [x] PC-04.3A — PC-04.3A Scheduler Engine Core CLOSED 2026-10-07 per owner task. Explicit POST /technical-cards/{card_id}/schedule reuses read-only Demand and canonical resources; complete standalone card plan is persisted atomically, with concurrent resource constraints, exceptions/occupancy, 120-date forward horizon, protected anchors and retained launch_preparation marker. Decimal quantum prevents overflow/lost work; deadline_missed is saved with signed buffer/delay. 31 targeted / 601 backend / 334 frontend tests; project check10/10, PostgreSQL concurrent shared-resource commands verified in isolated local schema. No migration/frontend/production apply/commit/push. Contract docs/architecture/production-scheduler-core-pc-04-3a.md; task docs/tasks/pc-04-3a-scheduler-engine-core-codex.md. Historical PC-04 queue checkpoint and remaining module stages stay open.
- [x] PC-04.3C — PC-04.3C Scheduler Scenario Validation CLOSED 2026-10-07 after engine PC-04.3A and existing UI PC-04.3B. 13 isolated HTTP scenarios verify real Demand, persisted assignment/allocation totals and units, three-step sequencing, shared budgets, exceptions, deadline risk, blocked preservation and deterministic recalculation with manual anchors/entry marker. 44 targeted tests including local PostgreSQL concurrency; 614 backend / 340 frontend tests; project check10/10. Four actual responses replayed through PC-04.3B presentation helpers. No runtime/frontend/schema/migration changes or new P0/P1; existing cutting-method and external-writer lock limits remain. Evidence: docs/tasks/pc-04-3c-scheduler-scenario-validation-codex.md and backend/tests/test_scheduler_scenarios_pc_04_3c.py. Historical PC-04 and remaining module stay open; no commit/push.
- [x] PC-04.4A — PC-04.4A Production Queue Mass Scheduler Backend CLOSED 2026-10-07 after PC-04.3A/B/C. POST /production-calendar/schedule selects standalone draft/in_progress cards, priority/null-last/date/created/id order, and reuses the single-card engine with atomic queue rebuild. Blocked old plans are restored via SAVEPOINT replay; manual/fact/past/locked/entry occupancy retained. Shared transaction advisory lock serializes mass and single commands. Summary includes planned/blocked/deadline/preserved counts and per-card deviations. 55 targeted tests plus one PostgreSQL replay regression; full project check10/10 with 631 backend / 340 frontend tests. No migration/frontend/production apply/commit/push. Bottleneck aggregation deferred; contract docs/architecture/production-queue-scheduler-pc-04-4a.md; task docs/tasks/pc-04-4a-production-queue-mass-scheduler-backend-codex.md. Historical PC-04 and remaining module stay open.
- [ ] PC-04.4D — PC-04.4D Work Centers as Capacity Source IN PROGRESS 2026-10-07. Codex backend part PC-04.4D-A verified; Cursor equipment UI and approved profile extension remain open. Existing WorkCenter owns one canonical CapacityResource adapter, with M:N operation links and physical allocations; no duplicate machine rates/catalog. Audit found eight actual local centers, not four configured plotters; 30 VIS-STRESS source cards preserved. Evidence docs/tasks/pc-04-4d-work-centers-as-capacity-source.md; contract docs/architecture/work-center-capacity-pc-04-4d.md. No production apply/commit/push.
- [x] PC-04.4D-A — PC-04.4D-A backend CLOSED 2026-10-07. Audited existing WorkCenter/ProductionStage and unique capacity adapter; equipment capacity/exceptions/queue/load endpoints reuse one store. Scheduler chooses one compatible active physical machine with mandatory labor/team constraints, exposes work_center_id, protects allocation identity, retains priority/horizon. Four-rate/six-card print fixtures, 64 targeted and 43 compatibility checks, local PostgreSQL 30-card VIS-STRESS print clone deterministic with no overflow and unchanged source rows; 641 backend / 346 frontend tests, project check10/10. No models/migrations/frontend changes. ColorProfile and required-profile gap documented, no hidden rule. Contract docs/architecture/work-center-capacity-pc-04-4d.md; overall PC-04.4D and historical PC-04 remain open.
- [x] PC-04.4F — PC-04.4F Demand-Capacity Contract Audit CLOSED 2026-10-07 as audit only. Read-only local DB and eight Demand reads establish all-operation matrix, sewing zero/provenance behavior, manual-cut versus opt-cut/shared cutters configuration, print machine/operator separation, and BUSINESS RULE MISSING for VTO/design/operator. Core amounts use verified quantity/volume/seconds, not arbitrary labor base_rate; WorkCenter capacity remains one adapter. Findings C1 cutting readiness/rate coupling and C2 legacy hourly load-unit mismatch require separate compatible contracts. No backend runtime/frontend/schema/migration/config changes or stress commands. 9 focused Demand tests passed; project check10/10 with 641 backend / 351 frontend tests; VIS-STRESS cards/planning/assignments/allocations unchanged. Evidence docs/architecture/demand-capacity-audit-pc-04-4f.md; task docs/tasks/pc-04-4f-demand-capacity-contract-audit-codex.md. Audit completion does not close production readiness, PC-04.4D or historical PC-04.
- [x] PC-04.4G — PC-04.4G Unified Routing Graph CLOSED 2026-10-08. The routing template is copied into an immutable technical-card snapshot; Scheduler, demand steps and Kanban current workshop read that snapshot. Migration a7b8c9d0e123. Local PostgreSQL upgrade plus isolated upgrade/downgrade/upgrade passed. 30 VIS-STRESS cards, 125 stage rows and 125 operation rows unchanged; manual locks kept. 664 backend / 352 frontend tests; project check 10/10. Cross-workshop parallel Kanban is not enabled. Contract docs/architecture/unified-routing-graph-pc-04-4g.md; task docs/tasks/pc-04-4g-bc-unified-routing-runtime-self-check-codex.md. Historical PC-04 remains open.
- [x] PC-04.4G-A — PC-04.4G-A Routing Graph Contract and Read-only Projections CLOSED 2026-10-07. Shared frozen DTO validates sequential/default and explicit fork/join DAGs; real ProductionStage parents and TechOperation children, deterministic traversal. GET /shop-routings/{id}/graph and /technical-cards/{id}/route-graph batch existing rows; missing snapshot never falls back to live template, gaps explicit. Projection-only flags prevent claims of persisted edges or Scheduler integration; required-child completion is read-only, no automatic Kanban change. 11 targeted / 653 backend / 352 frontend tests, project check10/10; existing P1 drift reproduced without persistence; G-B/G-C closed on 2026-10-08. No migration/frontend/stress/commit/push. Evidence docs/tasks/pc-04-4g-a-routing-graph-contract-projections.md.
- [x] PC-04.4I — PC-04.4I ONE OF backend CLOSED 2026-10-08. Logical variant groups, immutable snapshot and preliminary default; only selected members contribute Demand, Capacity, Calendar and Kanban completion. Selection/confirmation API reuses auth/audit and scheduler transaction gate, protects facts/manual/locked plans, replans and returns deadline impact. Migration b8c9d0e1f234; local upgrade/alembic check and isolated reversible cycle passed. 29 new tests, 50 self-check/regression tests, 693 backend / 358 frontend tests; project check 10/10. VIS-STRESS 30 cards/125 stages/125 operations unchanged. Existing WIP retained; no frontend/production apply/commit/push. Contract docs/architecture/variant-routing-one-of-pc-04-4i.md; task docs/tasks/pc-04-4i-variant-routing-one-of-scheduler-codex.md. UI PC-04.4J and historical PC-04 remain open.
- [x] PC-04.4M — PC-04.4M Unified Production Readiness Diagnostics CLOSED 2026-10-09. One frozen diagnostic DTO/resolver presents Demand and existing Scheduler reasons with stable code/severity/entity/field/message/fix_scope for operations, routing default nodes and effective card selections. Exact norm/capacity/input/equipment ownership; alternatives do not block, snapshot immutable. Catalog remains 3 batched queries. 10 new regressions, 74 targeted tests, 706 backend / 369 frontend tests; project check 10/10. No DB schema migration, new norms, frontend, VIS-STRESS writes or commit/push. Existing explicit_hours business-rule gap remains visible. Task docs/tasks/pc-04-4m-unified-production-readiness-diagnostics-codex.md. Broader calendar checkpoints remain open.
- [x] PC-04.4O — PC-04.4O Explicit Demand Rule backend CLOSED 2026-10-09. TechOperation nullable demand_rule=fixed_per_order/per_item and positive integer demand_duration_seconds; Decimal hours feed existing Demand/Scheduler, Capacity unchanged. Missing rule/value identifies the operation and exact admin field in shared diagnostics; filling it clears all applicable levels. Migration c9d0e1f2a345, local upgrade/alembic check and isolated reversible cycle passed; legacy norms remain NULL. 23 new tests, 115 targeted, 729 backend / 373 frontend tests; project check 10/10. Existing data and VIS-STRESS 30 cards/130 stages/130 operation rows unchanged. No frontend/WorkCenter/production apply/commit/push. Contract docs/architecture/production-demand-pc-04-2.md; task docs/tasks/pc-04-4o-explicit-demand-rule-codex.md. Admin UI and broader calendar checkpoints remain separate/open.
- [x] PC-04.4Q — PC-04.4Q Readiness Persistence CLOSED 2026-10-10. Root cause: the resource time-norm input wrote capacity_resources.base_rate while explicit-hours Demand reads TechOperation.demand_rule/demand_duration_seconds. The misleading input is removed and saved operation readiness uses shared backend diagnostics. Local Design 6 / routing 1 / card 2 fixed-per-order and per-item DB/API/runtime roundtrips, backend restart and Chromium UI save/reload passed. Original norms restored; test session revoked; Scheduler preflight read-only, other card blockers retained. 2 targeted backend / 10 targeted frontend; 731 backend / 377 frontend tests; project check 10/10. No new schema/migration or production apply. Evidence docs/tasks/pc-04-4q-end-to-end-readiness-persistence-fix-codex.md. Broader calendar checkpoints remain open; no commit/push.
- [ ] PC-04.4S — PC-04.4S Calendar Stress Dataset REBUILT; Scheduler validation BLOCKED 2026-10-10. Authorized exact VIS-STRESS-001..030 IDs26..55 and owned children removed atomically; 30 CAL-STRESS-001..030 IDs86..115 created using 5 real active models, 2 allowed routes, 30 quantities, 8/10/8/4 size/risk input groups, 15 ONE OF selections (5 laser/5 lay/5 manual, 9 preliminary/6 confirmed). Ready0/blocked30: 60 missing print meters, 30 zero sewing norm diagnostics and 5 laser pieces-versus-linear_meter mismatches. No fake norm/resource or catalog changes. Mass command not run (<25 ready); 30 entry markers visible via HTTP/UI at 1440/390, zero operation assignments/allocations. Unrelated business/calendar/catalog fingerprints and DB integrity preserved. Rebuild8.274s/preflight3.149s; trial rollback, 8 targeted tests, 739 backend/381 frontend tests, project check10/10. Task docs/tasks/pc-04-4s-rebuild-30-tk-stress-dataset-and-calendar-check-codex.md. Fill verified inputs/norms and reconcile laser units before separate Scheduler acceptance; no commit/push/production apply.
- [x] PC-04.4T — PC-04.4T Route/Assembly Operation Inputs CLOSED 2026-10-10. Root cause: route and assembly rows were initialized to volume=0 despite existing accepted model/routing inputs; attribution to G/I/M/Q is not proven (HEAD also used zero). Binding now fills pieces from quantity, meters only from a unique compatible active model/routing norm, and sewing pieces from multiplicity*quantity. Nullable frozen volume_qty_per_item (migration d0e1f2a3b456) supports quantity import without live catalog rereads; shop override clears basis and explicit model change invalidates only derived old-model inputs. Legacy/manual values are not backfilled. CAL-STRESS-001 quantity8 now has print5.600m from existing0.700 norms and other volumes8; print diagnostics cleared, genuine assembly1 zero-time blocker remains. Real new-card quantity1-to8, route-reapply and DB/API/UI checks passed; only card86 persisted, all30 retained, other29/catalogs/calendar preserved. 17 new cases/48 targeted, 756 backend/381 frontend tests; project check10/10, local upgrade/Alembic check and isolated reversible migration cycle passed. Demand/ONE OF/Capacity/Scheduler semantics and public DTO unchanged. Evidence docs/tasks/pc-04-4t-restore-route-and-assembly-operation-demand-codex.md. PC-04.4S stays open; no commit/push/production apply.
- [x] PC-04.4U — PC-04.4U Route Norm Persistence and Cache Audit CLOSED 2026-10-10. CACHE NOT ROOT CAUSE: 29 old CAL-STRESS cards retained zero/null operation inputs after T repaired only card86. Piece producers now honor unique compatible model-route norms as meter producers do; implicit one-item default applies only without a configured norm. Canonical source ProductModelOperationNorm.norm_qty_per_item/unit is copied into frozen volume_qty_per_item; quantity uses the saved basis, manual overrides retain totals, explicit reapply accepts current norms. Committed temporary model1/route1 quantity8 card verified in fresh PostgreSQL/API/UI reads with print5.600 and pieces8.000, then deleted with its owned group. 29 stress cards/329 inputs restored, including22 meter rows; all30 retained, routing nodes/edges/ONE OF/calendar/non-stress/catalog fingerprints unchanged. 36 genuine missing-meter inputs,30 sewing-time diagnostics and5 laser unit mismatches remain; ready0, mass scheduling not run, PC-04.4S stays open. 5 new cases/22 focused,761 backend/381 frontend tests; project check10/10, DB integrity and git diff check passed. No new migration/DTO/frontend/Capacity/WorkCenter/Scheduler changes. Evidence docs/tasks/pc-04-4u-route-norms-to-techcard-persistence-cache-audit-codex.md, ignored logs/pc-04-4u. No commit/push/production apply.
- [x] PC-05.0A — PC-05.0A READY FOR OWNER REVIEW 2026-10-10. Owner-selected documentation only; no roadmap stage transition. Canonical docs/architecture/SL-DATA-FLOW-v1.md maps13 real source/persistence/consumer chains with fields, formulas, update/reapply semantics, invariants, failures, diagnostic codes and validated code links. Offline docs/erp/status/SL-DATA-FLOW-v1.html generated from the Markdown by scripts/generate_data_flow.py; search, anchors, expandable sections, colored flow blocks and invariant tables verified at1440/390 with no JS errors/overflow. Explicitly distinguishes frozen route topology/volume basis from live standalone sewing times, operation demand rules and resources. Project check10/10:761 backend/384 frontend tests; twin --check and git diff check passed. No runtime/product UI/model/migration/data writes/commit/push. Evidence docs/tasks/pc-05-0a-sl-data-flow-v1-codex.md and ignored logs/pc-05-0a. Owner visual review pending; PC-04.4S and overall PC-05 remain open.
- [x] PC-05.0C — PC-05.0C PLATFORM DIAGNOSTICS FOUNDATION READY FOR UI 2026-10-10. Existing ProductionDiagnostic/resolver extended with categories, provenance, safe trace and fix metadata. Read-only authenticated audit.read platform-health API aggregates production operations/templates/cards/equipment/calendar, filtered summary counts and paginated diagnostics; card trace uses the identical resolver. Distinguishes configuration, source/copy/derived data-flow gaps, scheduler runtime exhaustion and integrity failures; no auto-fix or business rule changes. 8 new contract tests/40 final focused; project check10/10 with769 backend/384 frontend tests. Local PG diagnostic scan emitted zero INSERT/UPDATE/DELETE. Data-flow updated: DF-DIAGNOSTICS; HTML twin synced. No models/migrations/frontend/business-data mutation/commit/push. Full-scan production scope/cost documented; UI separate. Evidence docs/tasks/pc-05-0c-platform-diagnostics-foundation-codex.md and docs/architecture/platform-diagnostics-pc-05-0c.md; ignored logs/pc-05-0c.
- [x] PC-05.0D — PC-05.0D CALENDAR INTEGRITY DIAGNOSTIC PROVENANCE READY 2026-10-10. Shared started_step_without_saved_plan diagnostic now INTEGRITY/calendar with snapshot node, operation/workshop, fact status/start timestamp, nullable assignment/mode/date/locks and allocation trace. Card diagnostic/trace API includes read-only calendar assignment summaries. Same-node broken routing mapping is snapshot_mapping_missing; absent assignment without verified history stays unknown. Real card121/STRESS_TEST-1 snapshot867 Design in_progress at stored2026-10-10T12:58:07.505060+02:00 has no assignment; DB trace matched and zero SQL writes. 6 new cases/14 focused; project check10/10 with775 backend/384 frontend tests. Data-flow updated: DF-DIAGNOSTICS, DF-SCHEDULER-CALENDAR; HTML twin synced. No Scheduler/Capacity/Demand semantics, model/migration/frontend/data mutation/replan/commit/push. History absence remains explicit. Evidence docs/tasks/pc-05-0d-calendar-integrity-diagnostic-provenance-codex.md; ignored logs/pc-05-0d. Broader PC-05/PC-04.4S remain open.
- [x] PC-05.1A — PC-05.1A PLATFORM DEBUG MODE PERSISTENCE READY 2026-10-10. Existing settings singleton now stores nonnullable debug_mode defaultfalse; GET/PUT boolean, legacy omitted field preserves current flag, authorization unchanged. Migration e1f2a3b4c567 local upgrade and isolated reversible cycle passed. Minimal existing frontend DTO/draft/PUT/checkbox synchronization closes BACKEND GAP; Debug Center/shell frames retained. Real HTTP/PG/UI false-true-backend restart-true-false persistence and1440/390 checks passed; finalfalse, other settings unchanged, test sessions revoked. 4 focused backend/8 focused frontend; project check10/10 with775 backend/388 frontend tests; diff check passed. Data-flow: no changes required. HTML twin synced. No Diagnostics Engine/Scheduler/Demand/Calendar changes or production apply/commit/push. Evidence docs/tasks/pc-05-1a-persist-platform-debug-mode-codex.md; ignored logs/pc-05-1a. Broader PC-05/PC-04.4S remain open.
- [x] PC-05.1B — PC-05.1B CALENDAR PLAN LIFECYCLE AUDIT AND START INVARIANT READY 2026-10-11. Canonical AuditEvent stores six transactional calendar lifecycle events with node/operation/assignment IDs, UTC time, actor/source and safe before/after states; no new model/migration. Saved-plan gate covers standalone contour B calendar operations on start/fact/complete/reopen and QR/WIP implicit transitions; contour A remains outside the current Scheduler contract. HTTP409 cannot_start_without_saved_plan/INTEGRITY; calendar CRUD serialized with Scheduler. Diagnostics exposes latest audit provenance and confirmed deleted/detached reasons; legacy unknown stays unknown. STRESS_TEST-1 id121/node867 not reset/replanned: no accounting/output records, but one located unit and no authoritative test/no-real-start evidence; zero local SQL writes. 25 new regressions; project check10/10 with800 backend/388 frontend tests;247 FK checks no orphans; diff/generator checks passed. Data-flow updated: DF-SCHEDULER-CALENDAR, DF-DIAGNOSTICS, DF-KANBAN-FACT, DF-ROUTE-SNAPSHOT, DF-ONE-OF. HTML twin synced. No frontend/production apply/commit/push; broader PC-05/PC-04.4S remain open. Evidence docs/tasks/pc-05-1b-calendar-plan-lifecycle-audit-and-start-invariant-codex.md; ignored logs/pc-05-1b.
- [x] PC-05.2 — PC-05.2 PLATFORM INVARIANT COVERAGE AUDIT READY FOR OWNER REVIEW 2026-10-11. Targeted41-invariant/10-DF coverage matrix distinguishes write guards, read-only checks, intentional incomplete drafts and legacy DB corruption. Risk rows P0=1/P1=7/P2=13/P3=20 (P3 includes protected/informational rows, not20 defects). Six isolated tests prove started-fact loss on explicit reapply, manual started-plan deletion, allocation date/unit mismatch, stale quantity plan start and partial legacy snapshot accepted by Scheduler. No guards/data auto-fix implemented; P0/P1 remain open, priority backlog IC-G01..G06 + diagnostics/cleanup recommendations only. Shared Debug Center resolver local scan58 diagnostics/zero SQL writes; STRESS_TEST-1 remains unknown/unrepaired. Report docs/architecture/SL-INVARIANT-COVERAGE-v1.md + generated offline HTML with counters/filters/module matrix/DF links/backlog; Chromium1440/1024/768/390/320 tests passed. Data-flow documented: DF-ROUTE-SNAPSHOT guard limit; DF-WORKCENTER/DF-SCHEDULER-CALENDAR actual equipment persistence via allocations, not nonexistent assignment column. Project check10/10 with806 backend/388 frontend;120 targeted; diff/generator checks passed. HTML twin synced. No runtime/model/migration/frontend product/production apply/commit/push; no stage transition. Broader PC-05/PC-04.4S remain open. Evidence docs/tasks/pc-05-2-platform-invariant-coverage-audit-codex.md; ignored logs/pc-05-2.
- [ ] PC-05 — Route operation generation; detail and acceptance in production-calendar-v0.1.md
- [ ] PC-06 — Manual day allocation; detail and acceptance in production-calendar-v0.1.md
- [ ] PC-07 — Load calculation; detail and acceptance in production-calendar-v0.1.md
- [ ] PC-08 — Weekly board; detail and acceptance in production-calendar-v0.1.md
- [ ] PC-09 — Read-only technical-card fact and launch eligibility; existing execution API unchanged; detail in minimal implementation contract
- [ ] PC-10 — Regression and release; detail and acceptance in production-calendar-v0.1.md

### PC-UI-01…PC-UI-12 — interface design before implementation

- [x] PC-UI-01 — Platform UI audit; owner approved UI-A–UI-E `2026-10-03` per `docs/tasks/pc-09-finalize-design-and-production-capacity-v01.md`; evidence `docs/design/production-calendar/ui-audit.md`; application shell unchanged
- [x] PC-UI-02 — Screen map and navigation; OWNER-APPROVED 2026-10-05 per lightweight design freeze; docs/design/production-calendar/navigation.md; proposed runtime routes in minimal contract, no application changes
- [x] PC-UI-03 — Unified UI contract; OWNER-APPROVED 2026-10-05 per lightweight design freeze; docs/design/production-calendar/ui-contract.md; DESIGN-APPROVED=true, runtime QA remains an implementation check
- [x] PC-UI-04 — UI-A weekly load board; owner approved `2026-10-03` per PC-09 design task; evidence `docs/design/production-calendar/screens/weekly-board.md` and autonomous HTML; DESIGN-APPROVED=true per owner freeze 2026-10-05
- [x] PC-UI-05 — UI-B create order; owner approved per `docs/tasks/pc-ui-06-production-order-detail-prototype.md` after PC-UI-05.1; `docs/design/production-calendar/screens/create-order.md` and autonomous HTML prototype, checks recorded in screen spec; no application/API changes; overall DESIGN-APPROVED=true per owner freeze 2026-10-05
- [x] PC-UI-06 — UI-C order detail; OWNER-APPROVED per `docs/tasks/pc-ui-07-section-day-detail-prototype.md` after PC-UI-06.1; `docs/design/production-calendar/screens/production-order.md` and autonomous HTML prototype; no application/API changes; DESIGN-APPROVED=true per owner freeze 2026-10-05
- [x] PC-UI-07 — UI-D section day; owner approved `2026-10-03` per PC-09 design task; evidence `docs/design/production-calendar/screens/section-day.md` and autonomous HTML; no application/API changes
- [x] PC-UI-08 — UI-E manual planning; owner approved base design `2026-10-03` per PC-09 design task; evidence `docs/design/production-calendar/screens/manual-scheduling.md`, autonomous HTML, resource contract and Edge 1440/1366/1280/1024/768/390/320 checks; no application/API changes; DESIGN-APPROVED=true per owner freeze 2026-10-05
- [x] PC-UI-09 — UI-F capacities; OWNER-APPROVED after PC-UI-09.1 per `docs/tasks/pc-ui-10-11-gantt-risks-autonomous-v01.md`; `docs/design/production-calendar/screens/capacity-settings.md` and autonomous HTML; Edge resource scenarios and responsive checks recorded; no app/API changes, DESIGN-APPROVED=true per owner freeze 2026-10-05
- [x] PC-UI-10 — UI-G production calendar dashboard; OWNER-APPROVED 2026-10-05 per lightweight design freeze; screens/gantt.md and gantt-prototype.html; source path retained, application not implemented
- [x] PC-UI-11 — UI-H deviation center; OWNER-APPROVED 2026-10-05 per lightweight design freeze; screens/risks-conflicts.md and autonomous HTML; application not implemented
- [x] PC-UI-12 — Cross-screen design freeze and scalability 5/30/50/100; OWNER-APPROVED 2026-10-05; docs/design/production-calendar/review-checklist.md; DESIGN-APPROVED=true per lightweight design freeze; previous Edge/runtime QA not falsely marked passed
