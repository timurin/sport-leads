# PC-06.2 — Calendar Consistency and Persisted Plan

## Исполнитель
Codex

## Цель
Закрыть оставшиеся P2 календарного контура без изменения подтверждённой production architecture.

Baseline:
- Calendar = план;
- Queue = порядок ожидания;
- Kanban = факт;
- production core / fulfillment не менять;
- Dashboard из scope календаря исключён.

## Context
Использовать:
- `SL-PROJECT-MEMORY-v1`
- `DF-SCHEDULER-CALENDAR`
- `DF-KANBAN-FACT`
- relevant invariant coverage
- targeted calendar/scheduler/read-model symbols only

Без repo-wide scan.

## 1. Статус конкретной операции
Каждый CalendarAssignment отображает status только своего snapshot node:
- pending -> запланирована/ожидает;
- in_progress -> в работе;
- completed -> завершена.

Не распространять `in_progress` одной операции на соседние операции того же workshop.

Проверить кейс:
- Сублимационная печать in_progress;
- Термоперенос pending;
- Calendar показывает разные состояния.

## 2. Будущие assignments
Weekly Calendar должен показывать все assignments выбранной недели:
- current;
- future;
- completed/history в рамках текущего contract.

Future assignment не меняет Kanban/current_workshop.

Не скрывать assignment только потому, что operation ещё не current.

## 3. Dates / dependencies audit
Проверить sequential snapshot DAG.

Для `A -> B`:
- B не начинается раньше допустимого завершения A;
- dates соответствуют duration/capacity;
- parallel nodes могут идти одновременно только по graph contract;
- ONE OF планирует только выбранную ветку.

Отдельно исследовать кейс, когда 7 operations попадают в один день:
- допустимо ли это из-за коротких duration/capacity;
- либо scheduler игнорирует temporal dependencies.

Если найден дефект — исправить targeted.

## 4. Persisted ETA / forecast
После reload persisted plan должен восстанавливать planning summary.

Минимум:
- planned start;
- expected completion / ETA;
- shipping date;
- risk/slack, если уже canonical;
- stale/replan-required state.

Не считать ETA на frontend.

Переиспользовать existing planning/readiness API, если подходит.

## 5. Defensive Calendar integrity
Подтвердить после PC-06.1B:
- deleted TechnicalCards не возвращаются в active Calendar/manual planning;
- completed существующие ТК сохраняют historical assignments;
- no orphan assignments/allocations.

## 6. Не менять
Не трогать:
- Kanban progression;
- Queue semantics;
- material fact flow;
- TechnicalCard.quantity;
- readiness roadmap;
- ready_to_ship/shipped;
- warehouse;
- Dashboard;
- manual planning UX;
- capacities UI.

## 7. Tests
Минимум:
1. same workshop: first in_progress, second pending -> statuses differ;
2. future assignment visible;
3. sequential dependency dates valid;
4. parallel dates valid;
5. ONE OF only selected branch planned;
6. persisted assignments -> ETA visible after reload/read;
7. stale plan -> ETA marked stale/not current;
8. deleted TK absent from active Calendar/manual planning;
9. completed history preserved;
10. no orphan assignments/allocations.

## 8. Test data
Использовать safe test data или создать отдельную test TK только на SKU:
- 201.1
- 201.2
- 211.1
- 211.2
- 211.3

Не менять production facts карт 157/158/159 без необходимости.

## 9. Docs
Если semantics меняются:
- targeted Project Memory;
- `DF-SCHEDULER-CALENDAR`;
- invariant coverage;
- HTML twins where required.

## Проверки
- targeted backend tests;
- full backend tests once;
- frontend tests only if contract affected;
- project check;
- DB integrity;
- git diff --check.

Commit/push не выполнять в рамках PC-06.2.

## Acceptance
Готово, если:
1. Calendar показывает state конкретной snapshot operation;
2. future assignments видны;
3. sequential/parallel dates соответствуют DAG;
4. persisted ETA восстанавливается после reload;
5. deleted TK не возвращаются в active planning;
6. новых P0/P1 нет;
7. production core не изменён.

Финальная строка:

`PC-06.2 CALENDAR CONSISTENCY AND PERSISTED PLAN READY`

## Implementation report — 2026-10-16

Selected PC-06.2 explicitly by owner after PC-06.1A v2; no automatic stage transition. Two read/UI defects fixed: workshop in_progress no longer propagates to adjacent pending operations; weekly board no longer hides future/completed assignments. Production core, Kanban, Queue, fulfillment, materials, quantity, readiness roadmap, Scheduler algorithm, Dashboard, manual planning UX and capacity UI were not changed. No migration.

Files: backend production_calendar service/schema add exact node/status/name; new services/persisted_plan.py and schemas/persisted_plan.py supply detail-only summary through technical_cards mapper/schema. Frontend calendar.ts, weekly-board and production-state-label render node-owned statuses and all saved stickers; API type and tech-card-process restore server summary, reset transient plan when persisted summary changes, and label noncurrent forecasts. Tests: new test_calendar_consistency_pc_06_2.py (five cases), persisted-plan.test.mjs and node-status frontend test; existing sticker expectation updated for all-assignment visibility. No list DTO expansion or per-row list fetch.

Dates/dependencies audit: existing inclusive local DATE contract permits B.start == A.end. Shared resource occupancy prevents reuse of exhausted daily capacity; there are no intraday timestamps and no claim of sub-day temporal sequencing. Seven short sequential operations fit70/100 daily capacity, all in one day, and every successor starts >= predecessor end. Existing multi-day/sequential, parallel/join and selected ONE OF suites pass. No temporal Scheduler defect found under its approved granularity. A saved ETA is a plan projection, not an automatic recalculation from today's execution delays.

Persisted forecast: min/max selected operation assignment dates, card shipping date and canonical Scheduler deadline/slack formula. Entry markers/unselected alternatives excluded. Shared ProductionState planning_state controls is_current/replan_required; stale/invalid/partial saved forecast is explicit. Malformed variant selection produces invalid/no invented ETA. No Scheduler execution, frontend date arithmetic or plan/fact persistence on reload. Existing detail mapper can establish a missing QR token (pre-existing behavior outside this task); zero-write regression prepares an established token, and live157/158/159 already have tokens.

Verification:60 targeted backend cases passed, including five new cases plus existing PC-06.1B delete/rollback/foreign-key-disabled orphan fixture/completed-history and snapshot/ONE OF/Scheduler suites. Eleven targeted frontend tests pass. Real local PostgreSQL/API/RBAC read-only proof uses the existing auth/session dependency harness: three weeks inspected;12–18 October returns36 saved assignments,13 future,19 completed operation statuses,15 editable rows. Actual158 has sublimation in_progress and heat-transfer pending.159 remains completed with7 historical assignments, absent editable planning. Detail GETs for157/158/159 restore identical ETA/start/shipping/slack/state twice. All26 source/business table hashes unchanged,0 SQL writes;249 FKs/0 orphan references. Safe existing data only; no test cards created and no changes to157/158/159 facts. Evidence: ignored logs/pc-06-2/live-proof.json and live_read.py.

Data-flow updated: DF-SCHEDULER-CALENDAR (including index), with unchanged DF-KANBAN-FACT production semantics. Project memory PM-PLAN, invariant read/Calendar coverage and approved UI context updated. HTML twins generated/checked;42 invariant inventory/severity counts unchanged. UI uses existing weekly Calendar and manager process patterns; browser screenshots and breakpoint verification not performed, no visual acceptance claimed. Recommended next iteration: owner visual review, especially simultaneous operations and restored stale forecast; no further task started.

Required full project check10/10 PASS:1002 backend/438 frontend,lint/tsc/build,OpenAPI/Alembic/Compose. Full backend ran once through project check. Scoped diff --check PASS; global diff retains the pre-existing unrelated P3 EOF blank line in frontend/components/settings/shop-routing-detail-workspace.tsx:237. New P0/P1:none found. Roadmap/ERP-check/project-structure PC-06.2 marked done with synchronized HTML done:true;PC-06.1B remains open. HTML twin synced. No production apply,commit/push.
