# PC-06.1B — Remove Deleted TechnicalCards from Manual Planning

## Исполнитель
Codex

## Проблема
В `/production/calendar/manual-planning` остаются назначения техкарт, которые ранее были удалены.

На UI видны старые `CalendarAssignment` для удалённых ТК (`E2E-PROD-*`, `UX-OP-*` и др.).

Этого быть не должно.

## Цель
Удалённая TechnicalCard не должна отображаться:
- в ручном планировании;
- в активном Calendar;
- в Queue/Kanban;
- в других active production projections.

При этом не ломать production history для существующих completed ТК.

---

## 1. Сначала установить root cause

Targeted audit:

`TechnicalCard delete`
→ `CalendarAssignment`
→ `CalendarAllocation`
→ manual-planning query/read model

Определить, что именно происходит:
- assignments физически остаются после hard delete;
- TechnicalCard soft-deleted, а query её не фильтрует;
- FK nullable / ON DELETE behavior оставляет orphan-like plan rows;
- read model читает stale assignments без проверки TechnicalCard existence/state.

Без repo-wide scan.

---

## 2. Canonical invariant

### Deleted TechnicalCard
Если ТК действительно удалена:
- она не должна иметь active editable planning assignments;
- manual planning не должна её показывать;
- активный Calendar не должен её показывать;
- allocations этих active assignments не должны оставаться.

### Existing completed TechnicalCard
Не путать с delete:
- completed ТК сохраняет production/calendar history;
- historical assignments не удалять только потому, что lifecycle completed.

То есть:
`deleted != completed`.

---

## 3. Delete cleanup

Для безопасно удаляемой ТК без защищённого production fact:

при delete cleanup должен атомарно удалить/деактивировать:
- future/editable CalendarAssignments;
- CalendarAllocations этих assignments;
- queue-specific planning state, если есть;
- related plan audit only если текущая canonical delete semantics это требует.

Не удалять unrelated production facts.

Если delete уже запрещён при production fact — сохранить guard.

---

## 4. Read-model protection

Даже после cleanup manual-planning query должен быть defensive:

Не возвращать assignment, если:
- TechnicalCard отсутствует;
- TechnicalCard soft-deleted/archived согласно текущей модели;
- assignment не является active/editable plan item.

Не скрывать валидную историю completed существующей ТК в historical Calendar views.

---

## 5. Existing stale data

Найти только stale assignments, относящиеся к реально удалённым ТК.

Перед cleanup вывести:
`assignment_id | technical_card_id | order/TK reference | allocation count | date | workshop`

Не делать broad delete.

После подтверждения condition:
- удалить orphan/stale active planning rows;
- удалить связанные allocations;
- проверить FK/integrity.

Не трогать `STAB-P1-001-1` id 159 и другие существующие реальные/unknown ТК.

---

## 6. Diagnostics

Добавить/переиспользовать integrity diagnostic:

`calendar_assignment_without_technical_card`

или эквивалент существующего naming.

Category:
`INTEGRITY`

Manager-facing:
`В производственном плане найдено назначение без техкарты.`

Debug:
assignment id / technical_card_id / allocation refs.

---

## 7. Tests

Минимум:

1. create TK + assignments → delete safe TK → assignments removed/not active;
2. allocations cleanup вместе с assignments;
3. deleted/soft-deleted TK не появляется в manual planning;
4. deleted TK не появляется в active Calendar;
5. completed existing TK history сохраняется;
6. protected production fact не удаляется;
7. no orphan assignments/allocations;
8. manual-planning defensive filter works on stale fixture.

---

## 8. E2E verification

Открыть:

`/production/calendar/manual-planning`

Подтвердить:
- удалённые E2E/UX тестовые ТК больше не видны;
- существующие валидные ТК отображаются;
- выбор недели не возвращает stale rows.

Также проверить основной Calendar.

---

## Context
Использовать:
- `SL-PROJECT-MEMORY-v1`
- `DF-SCHEDULER-CALENDAR`
- relevant invariant coverage
- targeted calendar/delete symbols only

---

## Не делать
- redesign manual planning;
- Scheduler rewrite;
- Calendar UI redesign;
- delete completed history;
- broad DB cleanup;
- commit/push.

---

## Acceptance

Готово, если:
1. удалённые ТК не появляются в ручном планировании;
2. active assignments/allocations удалённых ТК очищаются;
3. defensive query не возвращает stale rows;
4. completed history существующих ТК сохранена;
5. FK/orphan checks clean;
6. новых P0/P1 нет.

Финальная строка:

`PC-06.1B DELETED TECHCARDS REMOVED FROM ACTIVE PLANNING`


## Targeted audit / dependency notes

Local PostgreSQL :5432 audit: no missing-card assignments, validated ON DELETE CASCADE on assignment→card and allocation→assignment, 247 FK checks/0 orphans. No soft-delete/archive field exists on TechnicalCard; deleted != completed. E2E-PROD-001-1/157 and UX-OP-001-1/158 still exist, raw status in_progress, with protected production facts. Assignments351–364 are not proven deleted-card data and must not be deleted by prefix. 157 has4 completed/3 pending assigned operations;158 has1 completed/1 in_progress/5 pending. Existing pending future work remains valid and is preserved.159/STAB-P1-001-1 exists/completed, protected. Before-cleanup table saved in logs/pc-06-1b/pre-cleanup.json (assignment/card/order/allocation/date/workshop); eligible orphan cleanup set is empty, no live DELETE authorized by a name assumption.

Root cause in this checked-out/local environment: the manual component consumes unfiltered historical /board, offering existing completed/started operations alongside pending work. Existing hard delete relies on DB cascade; default inner-joined board already excludes genuinely absent cards. Strengthen delete with the existing shared retirement transaction/fact protection and explicit allocation cleanup; add an editable-only read scope without removing completed history. Newly discovered route dependency: /manual-planning does not exist here; canonical manual page is /planning. Add a query-preserving redirect alias, not a second implementation. Browser skill read, but required Node/browser tools absent in enabled tools; visual E2E unavailable. HTTP/API/client contract evidence will be reported separately.


## Implementation / verification — 2026-10-15

Selected PC-06.1B per owner task. Canonical local root/ports retained; branch main/previous WIP preserved. Root-cause scope: TechnicalCard hard delete → plan cascade/retirement → joined read → manual component; no repository-wide scan. The live premise "these E2E/UX cards were deleted" is not confirmed:157/158 still exist with protected fact, and UI/server delete correctly reject non-draft cards rather than report false success. No names/prefixes were used as deletion authority.

Backend changes: services/tech_card_copy_delete.py (existing locked card + fact guard + shared retirement before delete); repositories/production_calendar.py (joined editable-only filter); services/production_calendar.py and api/production_calendar.py (optional editable_only flag, default history retained); services/calendar_plan_linkage.py + platform_health.py (orphan-card plan diagnostic with batched allocation refs); new tests/test_deleted_planning_pc_06_1b.py. Existing FK CASCADE/nullability verified, no soft-delete field, no new model/schema migration. No Scheduler/placement/fact/lifecycle rewrite.

Frontend data-only changes: calendarBoardPath optional editableOnly parameter; manual component requests it; successful delete action reuses calendarPathsAfterSchedule invalidation (new concrete dependency: previously only TK/kanban paths invalidated); manual-planning/page.tsx redirects to canonical planning and preserves query parameters. Existing UI-E/PT-02/manual/editor/Calendar layouts and JSX frames unchanged. Five focused calendar planning client tests PASS. Redirect and revalidatePath bundled Next docs consulted; no shell edit.

Delete uses existing retire_assignments to preflight protected fact and remove allocations/assignments/queue_position atomically before card delete; existing audit rows preserved and standard assignment_deleted events appended. No history deletion solely for completed status. Tests cover safe delete with plans/allocations/queue order and unrelated plans, rollback, completed and started protection/history, legacy draft fact protection, corrupted orphan fixture excluded in both board scopes + INTEGRITY diagnostic, actual API scoped filter with valid records retained. 45 targeted backend tests PASS (7 new cases and existing IC-G02/platform tests);17 initial combined Calendar/delete tests PASS.

Live read-only HTTP-route verification via TestClient with existing local auth/session harness: three weeks checked. 12–18 Oct:36 historical rows,16 editable;159 has7 historical assignments and0 editable, all preserved.157/158 retain8 valid pending operations; their completed/started operations are not offered as manual edits.19–25 Oct:0/0;5–11 Oct:1 historical/0 editable. All returned rows belong to existing cards. SQL observer0 INSERT/UPDATE/DELETE; hashes across26 source/business tables unchanged, including159 and157/158.247 FK checks/0 orphans, cleanup candidate IDs=[]; live cleanup0. Evidence logs/pc-06-1b/pre-cleanup.json, live-proof.json, audit.py, verify_live.py. This is not a claim that existing fact-bearing E2E/UX records were deleted.

Browser/visual E2E limitation: [browser:control-in-app-browser SKILL.md](/C:/Users/user/.codex/plugins/cache/openai-bundled/browser/26.707.72221/skills/control-in-app-browser/SKILL.md) states: "Only the Node REPL `js` tool ... can be used to control the selected browser." Required js/browser tools are not available after discovery. No independent browser controller substituted. Canonical frontend3001 and backend8000 respond; frontend manual URL request redirects to login (no authenticated browser session available), so no visual week switching/interactive E2E claimed. Actual API week-switch/read-model checks above and frontend/build tests are separate evidence. Browser E2E remains for an authenticated available browser; no data-deletion permission is requested or inferred from this.

Project memory updated PM-PLAN; data-flow updated DF-SCHEDULER-CALENDAR/DF-DIAGNOSTICS; IC-SC-02/04 evidence and UI-CALENDAR updated. Generated DF/invariant HTML twins synced/checked. No global invariant count change. Full project check result and status sync recorded after completion. No commit/push, production apply, broad cleanup, unrelated P2 fixes or next stage.


## Final implementation checks / remaining verification

`python scripts/check_project.py` PASS 10/10:988 backend tests (one full run),431 frontend tests,lint/TypeScript/build,Alembic no-new-operations check,Compose. New alias is present in the Next build route manifest. Focused backend45/45 and client5/5 PASS. OpenAPI optional editable_only defaults false; old board contract preserved. Scoped whitespace PASS; global diff retains only old unrelated P3 EOF blank line in frontend/components/settings/shop-routing-detail-workspace.tsx:237.

New P0/P1:none in tested implementation. Migrations:none. Backend/data-layer result is reviewable and verified; visual E2E at an authenticated browser remains unavailable, so the microtask is not marked fully completed in canonical status: Roadmap/project-structure `[ ]`, ERP `[~]`, matching HTML done:false with evidence. HTML twin synced. No next task/stage started. Recommended next iteration: authenticated browser E2E with week switching, while preserving the existing fact-bearing157/158/159. A cleanup of those existing cards is outside this deleted-card-only task; no additional destructive action was inferred.

Files: backend/services tech_card_copy_delete.py,production_calendar.py,calendar_plan_linkage.py,platform_health.py; backend/repositories/production_calendar.py; backend/api/production_calendar.py; new backend/tests/test_deleted_planning_pc_06_1b.py. Frontend lib/production/calendar.ts,calendar-planning.test.mjs; components/production/calendar-manual-scheduling.tsx (request only); app/(workspace)/production/calendar/manual-planning/page.tsx alias; tech-cards/tech-card-actions.ts (cache invalidation). Targeted memory/data-flow/invariants/UI context and status twins updated. Layout/JSX frames unchanged (UI-E/PT-02), no visual acceptance claimed. Full source diffs and baseline snapshots are in logs/pc-06-1b; existing WIP preserved.

PC-06.1B DELETED TECHCARDS REMOVED FROM ACTIVE PLANNING
