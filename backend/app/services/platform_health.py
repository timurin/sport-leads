"""Production-wide aggregation of the canonical diagnostics; never applies fixes."""
from collections import Counter

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.technical_card import TechnicalCard
from app.models.tech_operation import TechOperation
from app.models.calendar_assignment import CalendarAssignment
from app.models.calendar_allocation import CalendarAllocation
from app.models.production_capacity import CapacityResource
from app.models.shop_routing import WorkCenter, ShopRoutingTemplate
from app.schemas.production_diagnostics import PlatformHealthRead, ProductionDiagnostic, DiagnosticTraceStep
from app.services.production_diagnostics import card_diagnostics, load_context, operation_diagnostics, unique


def health_diagnostics(db: Session):
    with db.no_autoflush:
        operation_ids=set(db.scalars(select(TechOperation.id)))
        context=load_context(db,operation_ids)
        rows=[issue for op_id in sorted(operation_ids) for issue in operation_diagnostics(context,op_id)]
        card_ids = list(db.scalars(select(TechnicalCard.id).order_by(TechnicalCard.id)))
        for card_id in card_ids:
            rows.extend(card_diagnostics(db,card_id).diagnostics)
        assignments={a.id:a for a in db.scalars(select(CalendarAssignment))}
        resources={r.resource_key:r for r in db.scalars(select(CapacityResource))}
        adapted={r.work_center_id for r in resources.values() if r.work_center_id is not None}
        for center in db.scalars(select(WorkCenter).where(WorkCenter.is_active.is_(True)).order_by(WorkCenter.id)):
            if center.id not in adapted:
                rows.append(ProductionDiagnostic(code="work_center_capacity_missing",category="CONFIGURATION",module="capacity",
                    entity_type="work_center",entity_id=center.id,entity_name=center.name,field="capacity",field_label="Equipment capacity",
                    message="Active equipment has no capacity adapter",fix_scope="work_center",expected_source="CapacityResource.work_center_id",
                    source_value=center.id,actual_value=None,reason="work_center_capacity_missing",fix_action="Configure the equipment's existing capacity adapter",
                    fix_url="/settings/catalogs/work-centers",fix_target={"entity_type":"work_center","entity_id":center.id},
                    trace=(DiagnosticTraceStep(source="WorkCenter.id",value=center.id),DiagnosticTraceStep(source="CapacityResource.work_center_id",broken=True))))
        from app.services.routing_graph import read_template_graph
        for template_id in db.scalars(select(ShopRoutingTemplate.id).order_by(ShopRoutingTemplate.id)):
            rows.extend(read_template_graph(db,template_id).diagnostics)
        for allocation in db.scalars(select(CalendarAllocation).order_by(CalendarAllocation.id)):
            assignment=assignments.get(allocation.assignment_id);resource=resources.get(allocation.resource_key)
            reason=None
            if assignment is None or resource is None:
                reason="calendar_broken_reference"
            elif resource.capacity_unit!=allocation.capacity_unit:
                reason="calendar_allocation_unit_mismatch"
            elif not assignment.planned_date<=allocation.date<=assignment.planned_end_date:
                reason="calendar_allocation_outside_assignment"
            if reason in {"calendar_allocation_unit_mismatch", "calendar_allocation_outside_assignment"} and assignment.technical_card_id in card_ids:
                continue  # The shared card resolver supplies exact expected/actual values.
            if reason:
                rows.append(ProductionDiagnostic(code=reason,category="INTEGRITY",module="calendar",entity_type="calendar_allocation",
                    entity_id=allocation.id,entity_name=f"Allocation {allocation.id}",field="assignment_id/resource_key/date/capacity_unit",
                    field_label="Allocation consistency",message=reason,fix_scope="calendar",expected_source="CalendarAssignment + CapacityResource",
                    source_value=None if resource is None else resource.capacity_unit,actual_value=allocation.capacity_unit,reason=reason,
                    fix_action="Review the persisted plan and resource unit; explicitly replan if appropriate",fix_url="/production/calendar/planning",
                    trace=(DiagnosticTraceStep(source="CalendarAssignment + CapacityResource",broken=True),),
                    debug_details={"assignment_id":allocation.assignment_id,"resource_key":allocation.resource_key,"date":allocation.date.isoformat()}))
        from app.services.calendar_plan_linkage import orphan_allocation_issues, orphan_assignment_issues
        rows.extend(orphan_allocation_issues(db))
        rows.extend(orphan_assignment_issues(db))
        return unique(rows)


def read_health(db, *, category=None,module=None,severity=None,entity_type=None,entity_id=None,limit=100,offset=0):
    rows=[row for row in health_diagnostics(db) if (category is None or row.category==category) and
          (module is None or row.module==module) and (severity is None or row.severity==severity) and
          (entity_type is None or row.entity_type==entity_type) and (entity_id is None or str(row.entity_id)==entity_id)]
    rows.sort(key=lambda r:(r.category,r.module,r.entity_type,str(r.entity_id),r.code,r.field))
    return PlatformHealthRead(total=len(rows),counts_by_category=dict(Counter(r.category for r in rows)),
        counts_by_module=dict(Counter(r.module for r in rows)),counts_by_severity=dict(Counter(r.severity for r in rows)),
        limit=limit,offset=offset,diagnostics=tuple(rows[offset:offset+limit]))
