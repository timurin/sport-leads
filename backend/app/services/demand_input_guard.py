"""Transaction guard limited to persisted inputs consumed by saved plans.

Future invalidation is derived from immutable stamps, not a second status store.
Confirmed-fact input changes fail the flush transaction and must be rolled back.
"""
from sqlalchemy import event, inspect, select
from sqlalchemy.orm import Session

from app.models.calendar_assignment import CalendarAssignment
from app.models.calendar_allocation import CalendarAllocation
from app.models.technical_card import TechnicalCard, TechnicalCardStageResult, TechnicalCardOperationLine
from app.models.tech_operation import TechOperation
from app.models.product_model import AssemblyOperationLine
from app.models.sales import SalesOrderItemAssemblyOperationSnapshot
from app.models.production_capacity import CapacityResource, ProductionCapacityException, TechOperationCapacityResource
from app.models.shop_routing import WorkCenter

FIELDS = {
    TechnicalCard: {"quantity", "product_model_id", "assembly_variant_id", "route_variant_groups", "route_variant_selections", "planning_start_date", "shipping_date", "priority"},
    TechnicalCardOperationLine: {"volume", "volume_unit", "cutting_method", "stage_order", "production_stage_id", "tech_operation_id", "sewing_operation_id", "operation_name"},
    TechnicalCardStageResult: {"stage_order", "production_stage_id", "tech_operation_id", "source_routing_stage_line_id"},
    TechOperation: {"volume_unit", "production_stage_id", "code", "demand_rule", "demand_duration_seconds"},
    AssemblyOperationLine: {"duration_seconds", "quantity_per_item", "sewing_operation_id", "operation_name", "assembly_variant_id"},
    SalesOrderItemAssemblyOperationSnapshot: {"duration_seconds", "quantity_per_item", "sewing_operation_id", "operation_name"},
    CapacityResource: {"capacity_unit", "resource_type", "calculation_mode", "norm_rates", "base_rate", "staff_count", "hours_per_day", "shifts_per_day", "efficiency", "working_days", "include_in_calendar_load", "work_center_id"},
    WorkCenter: {"is_active", "production_stage_id"},
    ProductionCapacityException: {"date", "capacity", "unavailable"},
    TechOperationCapacityResource: {"tech_operation_id", "resource_key"},
}


@event.listens_for(Session, "before_flush")
def collect_changed_inputs(db, flush_context, instances):
    candidates = []
    for row in set(db.dirty) | set(db.deleted) | set(db.new):
        fields = FIELDS.get(type(row))
        if fields and (row in db.deleted or row in db.new or any(inspect(row).attrs[key].history.has_changes()
                for key in fields if key in inspect(row).attrs)):
            candidates.append(row)
    if not candidates:
        return
    # Partial historical-domain test schemas have no calendar subsystem.
    if not inspect(db.connection()).has_table("calendar_assignments") or not inspect(db.connection()).has_table("technical_card_stage_results"):
        return
    from app.repositories.production_scheduler import lock_scheduler
    lock_scheduler(db)
    card_ids, operation_ids, resource_keys, center_ids = set(), set(), set(), set()
    for row in candidates:
        if isinstance(row, TechnicalCard):
            if row.id: card_ids.add(row.id)
        elif isinstance(row, (TechnicalCardOperationLine, TechnicalCardStageResult)):
            if row.technical_card_id: card_ids.add(row.technical_card_id)
        elif isinstance(row, (TechOperation, TechOperationCapacityResource)):
            value = row.id if isinstance(row, TechOperation) else row.tech_operation_id
            if value: operation_ids.add(value)
        elif isinstance(row, AssemblyOperationLine):
            card_ids.update(db.scalars(select(TechnicalCard.id).where(TechnicalCard.assembly_variant_id == row.assembly_variant_id)))
        elif isinstance(row, SalesOrderItemAssemblyOperationSnapshot):
            card_ids.update(db.scalars(select(TechnicalCard.id).where(TechnicalCard.sales_order_item_id == row.order_item_id)))
        elif isinstance(row, WorkCenter):
            if row.id: center_ids.add(row.id)
        else:
            resource_keys.add(row.resource_key)
    if operation_ids:
        card_ids.update(db.scalars(select(TechnicalCardStageResult.technical_card_id).where(TechnicalCardStageResult.tech_operation_id.in_(operation_ids))))
    if center_ids:
        resource_keys.update(db.scalars(select(CapacityResource.resource_key).where(CapacityResource.work_center_id.in_(center_ids))))
    if resource_keys:
        card_ids.update(db.scalars(select(CalendarAssignment.technical_card_id).join(CalendarAllocation)
            .where(CalendarAllocation.resource_key.in_(resource_keys))))
    db.info.setdefault("demand_changed_cards", set()).update(card_ids)


@event.listens_for(Session, "after_flush_postexec")
def protect_confirmed_inputs(db, flush_context):
    ids = db.info.pop("demand_changed_cards", set())
    if not ids:
        return
    from app.services.calendar_plan_freshness import stale_issue
    from app.services.calendar_plan_linkage import PlanLinkageConflict
    for assignment in db.scalars(select(CalendarAssignment).where(CalendarAssignment.technical_card_id.in_(ids))):
        node = db.get(TechnicalCardStageResult, assignment.stage_result_id) if assignment.stage_result_id else None
        if node and node.status in {"in_progress", "completed"}:
            issue = stale_issue(db, assignment)
            if issue:
                raise PlanLinkageConflict(issue)
