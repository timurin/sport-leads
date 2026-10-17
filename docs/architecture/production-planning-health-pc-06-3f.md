# PC-06.3F — Production Planning Health

Canonical backend read contract, 2026-10-17. Cursor handoff. No frontend patch or migration.

## API / DTO

- Authenticated `GET /technical-cards/{card_id}/planning-health` → `PlanningHealth`; anonymous401, missing404.
- Authenticated `GET /production-calendar/manual-planning/cards?limit=100&offset=0` → `ManualPlanningCardHealth[]`; limit1–500, offset≥0. Active standalone cards, including unplanned; stable ID order. No operations array or per-card requests.
- Shared `PlanningHealthSummary`: detail adds `operations`, list adds `number`. Schemas/service: backend/app/schemas/planning_health.py, backend/app/services/planning_health.py.

| Summary fields | Type / meaning |
|---|---|
| technical_card_id, planning_date | int, platform timezone DATE (Calendar/manual helper) |
| planning_state | not_planned / actual / stale / invalid / completed |
| replan_required | bool; active stale/partial/invalid or overdue pending |
| eta, shipping_date, slack_days, on_time | DATE?, DATE?, int?, bool?; existing PersistedPlanSummary |
| risk_level | existing manual-preview unknown / on_time / late |
| current_workshop_id, current_workshop_name | int?, str?; canonical ProductionState |
| route_total_operations, completed_operations, in_progress_operations, pending_operations | int selected snapshot technology counts; skipped contributes to total only |
| has_overdue_operations, overdue_operation_count | bool, int |
| earliest_overdue_operation, earliest_overdue_snapshot_node_id | str?, int? |
| earliest_overdue_workshop, earliest_overdue_date, overdue_days | str?, DATE?, int (no overdue: null/null/0) |
| next_operation, next_snapshot_node_id, next_operation_date | str?, int?, DATE?; first selected pending outside current visit, snapshot order |
| has_planning_issues | bool; active overdue/replan, no plan or late ETA |

Operation fields: snapshot_node_id:int, operation_name:str, workshop_id:int?, workshop_name:str, operation_status:str (pending/in_progress/completed/skipped), planned_start:DATE?, planned_end:DATE?, is_overdue:bool, overdue_days:int, is_protected:bool, can_replan:bool, warning_code:str?.

## Semantics

Overdue = selected pending operation, no canonical production evidence, saved start strictly before planning_date, active card. Today/future, started/completed/skipped and terminal cards never produce overdue. Protection reuses protected_nodes: stage fields/timestamps, material quantities, unit movement/warehouse flags, sewing/stock ledgers. Locks do not erase overdue; past dates do not protect pending. Earliest sorts date then snapshot order/ID.

State mapping: planned + saved → actual; partial/stale → stale; invalid → invalid; other → not_planned. Completed production or shipped wins over freshness → completed. Cancelled is excluded from list and suppresses active attention in detail. Original ProductionState/persisted-plan contracts retain their semantics.

actual describes input freshness; replan_required can still be true for elapsed pending dates. Overdue does not invent late ETA. Risk uses saved ETA vs shipping, no new ETA formula. Terminal cards retain historical forecast but replan_required/overdue/has_planning_issues=false. Unplanned has no ETA, unknown risk, replan_required=false, has_planning_issues=true (initial planning needed).

can_replan = selected saved pending node passing shared manual protection predicate with valid same-node/workshop/routing/date-span binding. Selected manual_adjusted is eligible; locked is protected. Missing plan: can_replan=false, is_protected=false, warning_code=saved_selected_operation_required. Protection reason: manual_replan_protected. Eligibility does not guarantee a date: preview still checks inputs, DAG, capacity and scope; existing revision/fingerprint/apply remain required.

next_operation means future route placement; its calendar date can already be past. Frontend filters: has_overdue_operations, risk_level=='late', replan_required, !has_planning_issues. No client business calculations or detail-per-row fetches. Dashboard deferred.

Batch preloads route, assignments, state and canonical fact inputs; same SQL count for one/multiple cards. No Scheduler, health cache, repair, audit or writes on read. Legacy corruption is never repaired here.

## Evidence and examples

Local test163 on2026-10-17:5 overdue pending operations fromOct14, ETAOct30, shippingNov6, slack7, risk on_time, planning_state actual, replan_required true. Facts157/158/159 and26 tables unchanged;0 SQL writes;249 FK checks,0 orphans. Complete response examples follow. Detail contains the common fields plus operations; list contains common fields plus number.

### List item

```json
{
  "technical_card_id": 163,
  "planning_date": "2026-10-17",
  "planning_state": "actual",
  "replan_required": true,
  "eta": "2026-10-30",
  "shipping_date": "2026-11-06",
  "slack_days": 7,
  "on_time": true,
  "risk_level": "on_time",
  "current_workshop_id": 1,
  "current_workshop_name": "Дизайн",
  "route_total_operations": 7,
  "completed_operations": 0,
  "in_progress_operations": 0,
  "pending_operations": 7,
  "has_overdue_operations": true,
  "overdue_operation_count": 5,
  "earliest_overdue_operation": "Дизайн",
  "earliest_overdue_snapshot_node_id": 1168,
  "earliest_overdue_workshop": "Дизайн",
  "earliest_overdue_date": "2026-10-14",
  "overdue_days": 3,
  "next_operation": "Сублимационная печать",
  "next_snapshot_node_id": 1169,
  "next_operation_date": "2026-10-14",
  "has_planning_issues": true,
  "number": "PC063D-OVERDUE-20261016-1"
}
```

### Detail response

```json
{
  "technical_card_id": 163,
  "planning_date": "2026-10-17",
  "planning_state": "actual",
  "replan_required": true,
  "eta": "2026-10-30",
  "shipping_date": "2026-11-06",
  "slack_days": 7,
  "on_time": true,
  "risk_level": "on_time",
  "current_workshop_id": 1,
  "current_workshop_name": "Дизайн",
  "route_total_operations": 7,
  "completed_operations": 0,
  "in_progress_operations": 0,
  "pending_operations": 7,
  "has_overdue_operations": true,
  "overdue_operation_count": 5,
  "earliest_overdue_operation": "Дизайн",
  "earliest_overdue_snapshot_node_id": 1168,
  "earliest_overdue_workshop": "Дизайн",
  "earliest_overdue_date": "2026-10-14",
  "overdue_days": 3,
  "next_operation": "Сублимационная печать",
  "next_snapshot_node_id": 1169,
  "next_operation_date": "2026-10-14",
  "has_planning_issues": true,
  "operations": [
    {
      "snapshot_node_id": 1168,
      "operation_name": "Дизайн",
      "workshop_id": 1,
      "workshop_name": "Дизайн",
      "operation_status": "pending",
      "planned_start": "2026-10-14",
      "planned_end": "2026-10-14",
      "is_overdue": true,
      "overdue_days": 3,
      "is_protected": false,
      "can_replan": true,
      "warning_code": null
    },
    {
      "snapshot_node_id": 1169,
      "operation_name": "Сублимационная печать",
      "workshop_id": 3,
      "workshop_name": "Печать",
      "operation_status": "pending",
      "planned_start": "2026-10-14",
      "planned_end": "2026-10-14",
      "is_overdue": true,
      "overdue_days": 3,
      "is_protected": false,
      "can_replan": true,
      "warning_code": null
    },
    {
      "snapshot_node_id": 1170,
      "operation_name": "Термоперенос",
      "workshop_id": 3,
      "workshop_name": "Печать",
      "operation_status": "pending",
      "planned_start": "2026-10-14",
      "planned_end": "2026-10-14",
      "is_overdue": true,
      "overdue_days": 3,
      "is_protected": false,
      "can_replan": true,
      "warning_code": null
    },
    {
      "snapshot_node_id": 1171,
      "operation_name": "Ручной раскрой",
      "workshop_id": 2,
      "workshop_name": "Раскрой",
      "operation_status": "pending",
      "planned_start": "2026-10-14",
      "planned_end": "2026-10-14",
      "is_overdue": true,
      "overdue_days": 3,
      "is_protected": false,
      "can_replan": true,
      "warning_code": null
    },
    {
      "snapshot_node_id": 1172,
      "operation_name": "Пошив",
      "workshop_id": 4,
      "workshop_name": "Пошив",
      "operation_status": "pending",
      "planned_start": "2026-10-14",
      "planned_end": "2026-10-14",
      "is_overdue": true,
      "overdue_days": 3,
      "is_protected": false,
      "can_replan": true,
      "warning_code": null
    },
    {
      "snapshot_node_id": 1173,
      "operation_name": "ВТО",
      "workshop_id": 6,
      "workshop_name": "Контроль качества",
      "operation_status": "pending",
      "planned_start": "2026-10-30",
      "planned_end": "2026-10-30",
      "is_overdue": false,
      "overdue_days": 0,
      "is_protected": false,
      "can_replan": true,
      "warning_code": null
    },
    {
      "snapshot_node_id": 1174,
      "operation_name": "Упаковка",
      "workshop_id": 6,
      "workshop_name": "Контроль качества",
      "operation_status": "pending",
      "planned_start": "2026-10-30",
      "planned_end": "2026-10-30",
      "is_overdue": false,
      "overdue_days": 0,
      "is_protected": false,
      "can_replan": true,
      "warning_code": null
    }
  ]
}
```
