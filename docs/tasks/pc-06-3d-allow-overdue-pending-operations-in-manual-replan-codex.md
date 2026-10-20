# PC-06.3D — Allow overdue pending operations in manual replan

## Исполнитель
Codex

## Проблема
В ручном планировании операция `ВТО` имеет:
- текущую плановую дату: 14.10.2026;
- состояние: не начата / pending;
- новая дата: 30.10.2026.

Текущая дата уже позже 14.10.2026, поэтому backend считает операцию не `future` и возвращает protection error:

`Можно переносить только будущую неначатую операцию. Факт и закреплённый план защищены.`

Для бизнеса это неверно: просроченная, но НЕ начатая операция как раз должна быть доступна для перепланирования.

## Цель
Разрешить ручной перенос:
- future pending operations;
- overdue pending operations.

По-прежнему запрещать:
- in_progress;
- completed;
- операции с защищённым/locked plan;
- операции с production fact.

## Новое правило editable operation

Операция может быть перепланирована, если одновременно:
- snapshot node status = pending / waiting;
- production fact отсутствует;
- assignment не locked/protected;
- TechnicalCard не completed/shipped;
- replan не нарушает остальные canonical guards.

Плановая дата операции может быть:
- в будущем;
- сегодня;
- в прошлом.

Дата в прошлом сама по себе НЕ является причиной protection.

## Dependency semantics

### single
Если перенос одной overdue/pending операции нарушает зависимость с последующими операциями:
- вернуть `manual_replan_dependency`;
- manager message:
  `Перенос только этой операции нарушает последовательность маршрута. Используйте режим «Эту и последующие».`

Не возвращать `manual_replan_protected`, если операция сама по себе editable.

### downstream
Должен позволять перенести overdue pending operation и пересчитать все зависимые future/pending downstream nodes.

Не двигать:
- in_progress;
- completed;
- protected fact.

Если downstream упирается в защищённый узел — вернуть blocker с конкретной причиной.

## Error classification

Проверить mapping:

- `manual_replan_protected`
  только для fact/in_progress/completed/locked;

- `manual_replan_dependency`
  для нарушения DAG при single;

- `manual_replan_capacity`
  для нехватки мощности;

- `manual_replan_changed`
  для stale preview;

- `manual_replan_blocked`
  для остальных canonical blockers.

Не использовать protected как универсальную ошибку.

## UI contract handoff
После backend fix Cursor должен получать:

Для overdue pending + single, если downstream dependency ломается:
- `manual_replan_dependency`;
- suggestion `Эту и последующие`.

Для overdue pending + downstream:
- normal preview с affected operations / ETA / slack / risk.

## Tests

Минимум:

1. pending future -> editable;
2. pending today -> editable;
3. pending overdue -> editable;
4. overdue pending + valid single -> preview/apply PASS;
5. overdue pending + single dependency conflict -> `manual_replan_dependency`;
6. overdue pending + downstream -> downstream replan PASS;
7. in_progress overdue/date irrelevant -> protected;
8. completed -> protected;
9. locked assignment -> protected;
10. production fact unchanged after replan;
11. Calendar/ETA updated;
12. no orphan assignments/allocations.

## E2E
Использовать safe planning-only card.

Воспроизвести:
- operation planned in past;
- status pending;
- target date in future.

Проверить:
- single даёт dependency blocker, если должен;
- downstream даёт валидный preview;
- apply меняет только plan;
- Kanban/Queue/current_workshop не меняются.

## Не делать
- Scheduler redesign;
- Kanban/Queue changes;
- Calendar redesign;
- production fact changes;
- commit/push.

## Acceptance
Готово, если просроченная, но неначатая операция доступна для ручного перепланирования, а ошибки dependency/protection классифицируются корректно.

Финальная строка:

`PC-06.3D OVERDUE PENDING MANUAL REPLAN READY`

## Implementation report — 2026-10-16

Selected PC-06.3D explicitly by owner to correct the PC-06.3B future-only protection rule. Only this backend microtask executed;no stage transition or next-task implementation.

Changed backend/app/services/manual_route_replan.py and production_scheduler.py;new regressions backend/tests/test_overdue_manual_replan_pc_06_3d.py. No models,migration,new public payload fields or frontend patch. Original date age no longer prevents selected pending/no-fact operation replan;waiting/current/ready placement alone is not a fact/lock. Target date remains today/future. Missing/unselected saved nodes or past target classify manual_replan_blocked. Card terminal/shipped,explicit locks,started/completed and canonical stage/material/unit/ledger fact remain protected. Selected manual_adjusted can be explicitly moved again as before;other manual/locked/protected nodes remain anchors.

The manual service provides internal editable_overdue_node_ids only for eligible pending nodes in its selected/downstream effective scope. Shared _protected allow_overdue defaults false: ordinary Scheduler and Queue retain old past-anchor behavior. No duration/capacity/work calendar/WorkCenter/DAG algorithm redesign. Manual post-proposal validation checks all selected effective predecessor dates, including historical anchors that ordinary Scheduler preserves. Thus single old pending successor conflict returns dependency,never silent cascade;downstream can move old eligible pending descendants. A protected downstream blocker names the operation and exact node/reason. Existing revision/fingerprint,capacity and atomic persistence/audit/ETA are unchanged. No production/Kanban/current-workshop/queue_position/fact writes.

Cursor handoff: same POST /production-calendar/manual-planning/preview and /apply and same schema/tokens/modes. For overdue editable pending + single sequence conflict,use manual_replan_dependency and render server suggestion to choose downstream (this and subsequent operations). For overdue pending + downstream,normal affected operations/ETA/slack/risk and apply_allowed. manual_replan_protected is reserved for fact/started/completed/locked/terminal protection;not original-date age. Concrete downstream protection includes snapshot_node_id and downstream_protected. Updated canonical contract: ../architecture/manual-planning-route-replan-pc-06-3b.md. No UI calculations or frontend changes made.

Tests:11 new cases cover original future/today/past,valid overdue single preview/apply,overdue single historical dependency,overdue downstream replan,started/completed,locked row,protected historical/future dependent node with concrete reason,current pending without fact,and unchanged ordinary Scheduler past anchors.64 targeted cases pass with3B concurrency/atomicity and existing Queue/Scheduler suites. Production facts/card fields remain identical;Calendar/ETA agree and allocations have no missing parent.

Safe local E2E planning-only card163,PC063D-OVERDUE-20261016-1,SKU201.2,quantity4 retained with manifest/origin note. Canonical create/model binding/apply route services and existing Scheduler historical clock2026-10-14 used only to seed this new overdue fixture. Initial WTO selection found the current source route instead ends in two QC operations;scope dependency recorded here,no source route/config mutation. The penultimate pending QC operation reproduces the same original14October->target30October scenario under actual current-date API calls. Single returns manual_replan_dependency;downstream previews/applies2 pending nodes;ETA14->30October,persisted summary and Calendar match;repeat409. Preview0 SQL writes and full26-table hash equality. Before/after replan comparison excludes only the new fixture's replaced assignment/allocation rows;all other baseline rows across26 tables,including157/158/159,catalogs/stock/sewing,are unchanged. New card quantity/unit/material/operation/snapshot/stage/current-workshop/status unchanged by apply;249 FK/0 orphans. Evidence ignored logs/pc-06-3d/live-proof.json,live_e2e.py,manifest.json. No production fact changes or unrelated data cleanup.

Docs: PM-PLAN and DF-SCHEDULER-CALENDAR updated;3B contract superseded in the affected eligibility paragraphs. IC-SC-04/05 coverage and generated invariant twin updated;42-row invariant inventory/severity counts unchanged. Roadmap/ERP/project-structure matching3D item and both HTML status twins synchronized. Recommended next iteration: Cursor verification of existing3C UI with the new dependency suggestion and overdue pending server response;frontend/backend payload remains compatible. No commit/push,production apply or stage advance.

Required full project check10/10 PASS:1026 backend/453 frontend,lint/tsc/build,OpenAPI/Alembic/Compose. Full backend ran once through project check after targeted stabilization. NewP0/P1:none found;global/scoped git diff --check PASS. HTML twin synced.
