# PC-05.6C — Safe Workshop Queue Reorder API + Preview

## Исполнитель
Codex

## Контекст
PC-05.6B завершил frontend:
- Kanban = факт;
- DnD между участками удалён;
- отдельная вкладка `Очередь`;
- reorder только для ожидающих ТК одного участка;
- есть preview на frontend;
- `Применить очередь` пока не сохраняет порядок.

BACKEND GAP:
нет API безопасной перестановки очереди одного участка с расчётом влияния на даты/ETA.

## Цель
Добавить backend contract для:
1. получения канонической очереди участка;
2. preview нового порядка;
3. безопасного применения порядка;
4. controlled replan только затронутых будущих операций.

## Context
Использовать:
1. `SL-PROJECT-MEMORY-v1`
2. только релевантные цепочки:
   - `DF-SCHEDULER-CALENDAR`
   - `DF-DEMAND-CAPACITY`
   - `DF-DIAGNOSTICS`
3. targeted code only.

Без repo-wide scan.

## 1. Каноническая очередь
Queue item = ожидающая, ещё не начатая планируемая ТК/операция текущего участка.

Не включать:
- in_progress;
- completed;
- protected production fact;
- операции другого участка;
- будущие snapshot nodes, которые ещё не queue-ready по canonical flow.

Порядок — backend source-of-truth.

## 2. GET queue
Добавить/расширить API чтения очереди участка.

Минимальный response item:
- technical_card_id;
- technical_card_number;
- snapshot_node_id;
- workshop_id/name;
- operation_id/name;
- queue_position;
- priority;
- planned_start;
- planned_end;
- eta/shipping_date;
- risk/status;
- protected/read_only.

Не дублировать существующий endpoint, если можно расширить его.

## 3. Preview reorder
Добавить read-only preview action.

Input:
- workshop_id;
- ordered queue item ids / snapshot_node_ids.

Backend проверяет:
- все элементы одного workshop;
- все queue-eligible;
- нет in_progress/completed;
- нет duplicate/missing ids;
- нет чужих ТК;
- protected rows не изменяются.

Preview возвращает:
- old_position -> new_position;
- old/new planned_start;
- old/new planned_end;
- old/new ETA;
- shipping risk change;
- downstream operations affected;
- warnings/blockers;
- `can_apply`.

Preview ничего не сохраняет.

## 4. Apply reorder
Отдельное явное применение.

Backend:
- сохраняет canonical manual queue order / priority override;
- запускает controlled replan только затронутого scope;
- не перепланирует production facts;
- сохраняет lifecycle/audit event;
- возвращает новый queue + affected plan summary.

Не использовать общий `TechnicalCard.priority` как замену queue order, если semantics другая.

## 5. Semantics
Зафиксировать:
- Calendar = weekly plan
- Queue = порядок ожидающих работ
- Kanban = факт

Queue reorder:
- меняет только порядок будущих работ;
- не меняет current_workshop;
- не меняет lifecycle fact;
- не переводит карточки между Kanban columns.

## 6. Concurrency
Preview/apply должны использовать revision/version/fingerprint очереди.

Если очередь изменилась между preview и apply:
- HTTP 409;
- code: `workshop_queue_changed`;
- нужен новый preview.

## 7. Diagnostics
Ошибки:
- `queue_item_not_waiting`
- `queue_cross_workshop_reorder`
- `queue_contains_protected_fact`
- `workshop_queue_changed`
- `queue_replan_failed`

Manager-facing message простым языком.
Technical IDs/trace — Debug.

## 8. Audit
Фиксировать:
- workshop;
- affected TK/snapshot ids;
- old order;
- new order;
- actor/source;
- timestamp;
- replan result.

Использовать существующий audit mechanism.

## 9. Tests
Минимум:
- valid reorder same workshop;
- cross-workshop rejected;
- in_progress rejected;
- completed rejected;
- stale revision -> 409;
- preview does not persist;
- apply persists order;
- apply replans only affected future operations;
- Kanban current_workshop unchanged;
- lifecycle status unchanged;
- downstream ETA changes correctly;
- no orphan assignments/allocations;
- IC-G01..G04 protections preserved.

После targeted PASS:
- backend full tests once;
- project check;
- DB integrity;
- git diff --check.

Frontend не менять, кроме минимальной contract sync если unavoidable.

## 10. Existing data
Не менять существующие production facts.
Не выполнять mass reorder.
Тестировать на test/stress queue data, если есть waiting records.

## Data-flow/docs
Если semantics уточнены:
- обновить `DF-SCHEDULER-CALENDAR`;
- `SL-PROJECT-MEMORY-v1`;
- invariant matrix только если guard/invariant добавлен;
- HTML twin sync once.

## Не делать
- Kanban UI;
- Scheduler rewrite;
- Capacity refactor;
- 30-TK stress test;
- commit/push.

## Acceptance
Готово, если frontend PC-05.6B сможет:
1. загрузить queue;
2. отправить новый порядок на preview;
3. показать влияние на даты/ETA;
4. применить reorder;
5. получить новый серверный порядок;
6. не затронуть production fact/Kanban.

Финальная строка:
`PC-05.6C SAFE WORKSHOP QUEUE REORDER API READY`

## Результат — 2026-10-13

Выбрана PC-05.6C прямым указанием владельца после PC-05.6B frontend backend-gap. Завершён только backend contract; другой WIP сохранён.

### Что поставлено

- GET `/production-calendar/workshops/{workshop_id}/queue`: каноническая slim waiting очередь текущего selected snapshot узла standalone ТК. Поля карточки/операции/цеха, position, dates/ETA/shipping/risk и revision. Batch reads; число SQL запросов не растёт per-row. In_progress/completed/protected/невыбранные/не queue-ready nodes исключены. Contour A sales-order Scheduler не выдуман.
- POST того же пути `/preview`: exact permutation одного участка; in-memory simulation существующего Scheduler без SQL writes. Old/new positions/dates/ETA/risk, downstream IDs, proposed plans, warnings/blockers/can_apply. Незавершённая конфигурация блокирует расчёт, deadline risk показан warning без скрытой подмены норм.
- POST `/apply`: revision + preview_fingerprint, повторный расчёт под shared scheduler advisory lock; changed suffix + future DAG descendants только. Остальные операции остаются anchors; факт/current workshop/lifecycle/priority не меняются. Protected/manual/past downstream не переписываются; конфликт блокирует всю транзакцию. Reorder/order/plans/audit атомарны.
- Nullable positive CalendarAssignment.queue_position — новый persistence field в существующем plan store, отдельно от daily position и TechnicalCard.priority. Single-card replacement сохраняет override; mass Scheduler использует manual waiting order внутри workshop batch slots и сохраняет его после replay. Нового Scheduler/Capacity/fact store нет.
- Shared ProductionDiagnostic содержит manager message и Debug details/trace. HTTP409 `detail={message, diagnostic}` + X-Diagnostic-Code/Category; старые endpoints не изменены. Preview/apply имеют существующий planning permission, GET authenticated, audit actor из session. AuditEvent action production_calendar.workshop_queue_reordered хранит workshop/old-new/affected/actor-time/source/replan result.

### Файлы и контракты

Новые файлы: backend/app/schemas/workshop_queue.py;backend/app/services/workshop_queue.py;backend/tests/test_workshop_queue_pc_05_6c.py;backend/tests/test_workshop_queue_postgres_pc_05_6c.py;backend/alembic/versions/f2a3b4c5d678_workshop_queue_position.py;docs/architecture/workshop-queue-pc-05-6c.md.
Изменения: backend/app/api/production_calendar.py;backend/app/models/calendar_assignment.py;backend/app/services/production_scheduler.py и production_queue_scheduler.py. Model/DTO field queue_position добавлен только в CalendarAssignment; separate queue DTO отвечает за API. Public AssignmentUpdate/date board shape и card status enums сохранены. ETA берётся как max step end для parallel branches.
Документация: affected DF sections/index, memory, IC-SC-06 matrix, ADR-025 audit catalog, roadmap/project structure/ERP checkpoints и HTML twins. Не весь существующий diff этих файлов принадлежит задаче.

Миграция f2a3b4c5d678 после e1f2a3b4c567: local Docker PostgreSQL:5432 upgrade head и Alembic drift PASS; isolated PostgreSQL upgrade/downgrade/upgrade сохраняет прежние columns/data. Existing queue_position=NULL, без backfill/массовой правки. Production/VPS миграции не выполнялись.

### Проверки

- 29 новых cases: waiting/cross-workshop/protected/completed/started/duplicate/missing/unknown; preview zero-write; fresh/stale input revision; bad fingerprint; atomic apply + partial-persist rollback; unchanged prefix/fact/anchors; correct downstream ETA/risk; ONE OF; auth/permission/actor; noop; single/batch override; bounded GET SQL; actual PostgreSQL concurrent apply and migration cycle.
- IC-G01..G04/ONE OF/queue/concurrency focused160 PASS, затем отдельно final constant-query GET case; task SQLite27 cases PASS, PostgreSQL2 PASS. Полный backend958 PASS внутри единственного финального project check.
- Project check10/10 PASS:958 backend/402 frontend, compile/import/OpenAPI/models/collector/mock/Alembic, frontend lint/tsc/test/build,Compose. Нет нового full повторного прогона после PASS; после docs sync проверяются только docs/twins.
- Local audit: waiting MINI-STRESS-2011 найден; workshop содержит non-stress waiting rows, поэтому live preview/apply/reorder не запускался. Valid apply проверен в UUID-owned isolated PostgreSQL schemas, не на production facts. Source/fact/plan/audit rows локального scan неизменны,0 SQL writes,247 FK/0 orphan references. Evidence logs/pc-05-6c/local-queue-audit.json,db-integrity.json,targeted.log,project-check.log.
- Scoped git diff --check PASS. Global git diff --check: существующий P3 вне scope — frontend/components/settings/shop-routing-detail-workspace.tsx:237 new blank line at EOF; файл владельца не исправлялся. Не маскируется как полный global PASS.

### Canonical sync и границы

Data-flow updated: DF-SCHEDULER-CALENDAR,DF-DEMAND-CAPACITY,DF-DIAGNOSTICS,index. Project memory updated. IC-SC-06 добавлен covered/P3;42 invariants,P0=0/P1=0/P2=13/P3=29. Новых P0/P1 нет; прежний P2/P3 backlog не исправлялся. HTML twin synced; affected MD [x] соответствует HTML done:true, generated DF/invariant --check PASS. Canonical diff:logs/pc-05-6c/canonical-docs.diff.

Frontend/Kanban UI не менялись; визуальный template/breakpoint report к backend task не применим. Полная integration вкладки «Очередь» с GET/preview/apply — следующая отдельная owner-selected задача; backend contract позволяет её выполнить. Broad shared occupancy/configuration fingerprint имеет bounded query count, но production-wide row volume; масштабная performance readiness не заявлена. Single explicit scheduling может независимо менять dates при сохранённом manual order; task не переписывает engine.

Commit/push/production apply,mass reorder,30-TK stress test,data repair,next stage не выполнялись. Overall stage остаётся open; результат готов к review владельца.

PC-05.6C SAFE WORKSHOP QUEUE REORDER API READY
