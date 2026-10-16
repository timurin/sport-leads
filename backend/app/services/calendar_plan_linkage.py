"""IC-G02: saved snapshot/assignment/allocation ownership and retirement guards."""
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.audit import AuditEvent
from app.models.calendar_allocation import CalendarAllocation
from app.models.calendar_assignment import CalendarAssignment
from app.models.production_capacity import CapacityResource, TechOperationCapacityResource
from app.models.shop_routing import WorkCenter
from app.models.technical_card import TechnicalCard, TechnicalCardStageResult
from app.schemas.production_diagnostics import ProductionDiagnostic, DiagnosticTraceStep
from app.services.technical_cards import TechnicalCardConflictError


class PlanLinkageConflict(TechnicalCardConflictError):
    category = "INTEGRITY"

    def __init__(self, issue: ProductionDiagnostic):
        self.diagnostic = issue
        self.code = issue.code
        self.category = issue.category
        super().__init__(issue.message)

    @property
    def headers(self) -> dict[str, str]:
        return {"X-Diagnostic-Code": self.code, "X-Diagnostic-Category": self.category}


def mapping(row) -> dict:
    return dict(technical_card_id=row.technical_card_id, snapshot_node_id=row.stage_result_id,
                routing_stage_line_id=row.routing_stage_line_id, workshop_id=row.production_stage_id)


def resource_mapping_valid(db: Session, resource: CapacityResource | None, workshop_id: int | None,
                           operation_id: int | None = None) -> bool:
    if resource is None:
        return False
    if resource.work_center_id is not None:
        center = db.get(WorkCenter, resource.work_center_id)
        return center is not None and center.production_stage_id == resource.production_stage_id == workshop_id
    if resource.production_stage_id is None or resource.production_stage_id == workshop_id:
        return True
    # Nonphysical shared resources may serve multiple workshops through the
    # existing explicit operation links. Do not invent a new capacity boundary.
    return db.scalar(select(TechOperationCapacityResource.tech_operation_id).where(
        TechOperationCapacityResource.tech_operation_id == operation_id,
        TechOperationCapacityResource.resource_key == resource.resource_key)) is not None


def issue(db: Session, row: CalendarAssignment, code: str, *, reason: str,
          expected: dict | None = None, actual: dict | None = None) -> ProductionDiagnostic:
    node = db.get(TechnicalCardStageResult, row.stage_result_id) if row.stage_result_id else None
    allocations = list(db.scalars(select(CalendarAllocation.id).where(CalendarAllocation.assignment_id == row.id)))
    details = dict(technical_card_id=row.technical_card_id, snapshot_node_id=row.stage_result_id,
                   operation_id=None if node is None else node.tech_operation_id, assignment_id=row.id,
                   allocation_ids=allocations, allocation_count=len(allocations),
                   expected_mapping=expected, actual_mapping=actual or mapping(row), reason_code=reason)
    return ProductionDiagnostic(code=code, category="INTEGRITY", module="calendar",
        entity_type="technical_card", entity_id=row.technical_card_id, entity_name=f"ТК {row.technical_card_id}",
        operation_id=details["operation_id"], field=f"production_plan.assignment.{row.id}",
        field_label="Сохранённый план операции", message=f"Назначение {row.id}: {reason}. Связь производственного плана защищена.",
        fix_scope="technical_card", expected_source="StageResult -> CalendarAssignment -> CalendarAllocation",
        source_value=expected, actual_value=details["actual_mapping"], reason=reason,
        fix_action="Проверить сохранённый snapshot, факт и историю плана; будущий план удалить и явно перепланировать. План с фактом требует отдельного согласованного сценария.",
        fix_url=f"/production/tech-cards/{row.technical_card_id}", debug_details=details,
        trace=(DiagnosticTraceStep(source="Saved snapshot mapping", value=expected, broken=True),))


def assignment_issues(db: Session, row: CalendarAssignment) -> list[ProductionDiagnostic]:
    node = db.get(TechnicalCardStageResult, row.stage_result_id) if row.stage_result_id else None
    # Entry/workshop queue markers predate operation scheduling. They carry no
    # operation identity or allocations, and must not be guessed into a node.
    has_allocations = db.scalar(select(CalendarAllocation.id).where(CalendarAllocation.assignment_id == row.id).limit(1))
    if row.stage_result_id is None:
        if row.routing_stage_line_id is None and has_allocations is None:
            return []
        return [issue(db, row, "calendar_assignment_missing_snapshot", reason="missing_snapshot_node")]
    if node is None:
        return [issue(db, row, "calendar_assignment_missing_snapshot", reason="snapshot_node_not_found")]
    expected = dict(technical_card_id=node.technical_card_id, snapshot_node_id=node.id,
                    routing_stage_line_id=node.source_routing_stage_line_id or node.id,
                    workshop_id=node.production_stage_id, operation_id=node.tech_operation_id)
    if node.technical_card_id != row.technical_card_id or node.production_stage_id != row.production_stage_id:
        return [issue(db, row, "calendar_assignment_snapshot_mismatch", reason="snapshot_ownership_or_workshop_mismatch", expected=expected)]
    if node.tech_operation_id is None or row.routing_stage_line_id != expected["routing_stage_line_id"]:
        return [issue(db, row, "calendar_assignment_operation_mismatch", reason="operation_routing_identity_mismatch", expected=expected)]
    for allocation in db.scalars(select(CalendarAllocation).where(CalendarAllocation.assignment_id == row.id)):
        resource = db.get(CapacityResource, allocation.resource_key)
        if not resource_mapping_valid(db, resource, node.production_stage_id, node.tech_operation_id):
            return [issue(db, row, "calendar_assignment_snapshot_mismatch", reason="allocation_resource_workshop_mismatch", expected=expected,
                          actual=mapping(row) | {"resource_key": allocation.resource_key})]
    # Audit is evidence of the operation bound when this assignment was saved,
    # independent of later live-template edits. Legacy without evidence stays
    # unproven; never infer an old operation from current position/order.
    for event in db.scalars(select(AuditEvent).where(AuditEvent.entity_type == "calendar_plan_lifecycle",
            AuditEvent.entity_id == str(row.technical_card_id), AuditEvent.action == "calendar.assignment_created")
            .order_by(AuditEvent.id.desc())):
        payload = event.payload or {}
        if payload.get("calendar_assignment_id") == row.id:
            if payload.get("snapshot_node_id") != node.id or payload.get("tech_operation_id") != node.tech_operation_id:
                return [issue(db, row, "calendar_assignment_operation_mismatch", reason="saved_operation_evidence_mismatch",
                              expected=expected, actual=mapping(row) | {"operation_id": payload.get("tech_operation_id")})]
            break
    return []


def card_linkage_issues(db: Session, card_id: int) -> list[ProductionDiagnostic]:
    return [diagnostic for row in db.scalars(select(CalendarAssignment).where(CalendarAssignment.technical_card_id == card_id))
            for diagnostic in assignment_issues(db, row)]


def assert_retirable(db: Session, rows: list[CalendarAssignment]) -> None:
    from app.services.route_reapply import protected_nodes
    from app.repositories.production_scheduler import lock_scheduler
    lock_scheduler(db)
    protected = {}
    for row in rows:
        db.execute(select(TechnicalCard.id).where(TechnicalCard.id == row.technical_card_id).with_for_update())
        card = db.get(TechnicalCard, row.technical_card_id)
        if card is None:
            raise PlanLinkageConflict(issue(db, row, "calendar_assignment_snapshot_mismatch", reason="missing_card"))
        if card.id not in protected:
            protected[card.id] = protected_nodes(db, card)
        nodes = [s for s in card.stage_results if s.id == row.stage_result_id or
                 (row.routing_stage_line_id is not None and (s.source_routing_stage_line_id or s.id) == row.routing_stage_line_id)]
        if any(s.id in protected[card.id] for s in nodes):
            raise PlanLinkageConflict(issue(db, row, "calendar_assignment_snapshot_mismatch", reason="production_fact_plan_protected",
                                            expected=mapping(row)))


def assert_route_lines_retirable(db: Session, line_ids: list[int]) -> None:
    rows = list(db.scalars(select(CalendarAssignment).where(CalendarAssignment.routing_stage_line_id.in_(line_ids))))
    assert_retirable(db, rows)


def retire_assignments(db: Session, rows: list[CalendarAssignment], *, reason: str, source: str,
                       detached: bool = False, actor=None) -> None:
    from app.services.calendar_plan_lifecycle import assignment_event, assignment_state, append_event
    assert_retirable(db, rows)  # Entire batch before audit or deletion.
    for row in rows:
        if detached:
            node = db.get(TechnicalCardStageResult, row.stage_result_id) if row.stage_result_id else None
            append_event(db, event_type="assignment_detached", card_id=row.technical_card_id,
                node_id=row.stage_result_id, operation_id=None if node is None else node.tech_operation_id,
                assignment_id=row.id, previous_state=assignment_state(row), new_state=None,
                reason=reason, source=source, actor=actor)
        assignment_event(db, row, "assignment_deleted", previous_state=assignment_state(row), reason=reason, source=source, actor=actor)
    db.execute(delete(CalendarAllocation).where(CalendarAllocation.assignment_id.in_([row.id for row in rows])))
    for row in rows:
        db.delete(row)
    db.flush()


def assert_update_mapping(db: Session, row: CalendarAssignment, values: dict) -> None:
    issues = assignment_issues(db, row)
    if issues:
        raise PlanLinkageConflict(issues[0])
    if row.stage_result_id is not None and any(values.get(key, getattr(row, key)) != getattr(row, key)
            for key in ("production_stage_id", "routing_stage_line_id")):
        raise PlanLinkageConflict(issue(db, row, "calendar_assignment_operation_mismatch", reason="manual_operation_remap_forbidden",
            expected=mapping(row), actual=mapping(row) | {key: values[key] for key in values if key in mapping(row)}))
    if row.stage_result_id is None and values.get("routing_stage_line_id") is not None:
        raise PlanLinkageConflict(issue(db, row, "calendar_assignment_missing_snapshot", reason="manual_operation_binding_requires_schedule"))


def orphan_allocation_issues(db: Session) -> list[ProductionDiagnostic]:
    rows = db.scalars(select(CalendarAllocation).outerjoin(CalendarAssignment,
        CalendarAllocation.assignment_id == CalendarAssignment.id).where(CalendarAssignment.id.is_(None)))
    return [ProductionDiagnostic(code="calendar_allocation_orphan", category="INTEGRITY", module="calendar",
        entity_type="calendar_allocation", entity_id=row.id, entity_name=f"Allocation {row.id}", field="assignment_id", field_label="Назначение",
        message=f"Allocation {row.id}: назначение {row.assignment_id} отсутствует.", fix_scope="calendar",
        expected_source="CalendarAllocation.assignment_id -> CalendarAssignment.id",
        reason="missing_assignment", fix_action="Проверить историю и принадлежность записи; автоматическое исправление не выполняется.",
        debug_details=dict(technical_card_id=None, snapshot_node_id=None, operation_id=None,
            assignment_id=row.assignment_id, allocation_ids=[row.id], allocation_count=1,
            expected_mapping={"assignment_id": row.assignment_id}, actual_mapping={"assignment_id": None}),
        fix_url="/production/calendar/planning") for row in rows]


def orphan_assignment_issues(db: Session) -> list[ProductionDiagnostic]:
    """Visible even when a missing card cannot participate in the card resolver."""
    with db.no_autoflush:
        rows = list(db.scalars(select(CalendarAssignment).outerjoin(
            TechnicalCard, TechnicalCard.id == CalendarAssignment.technical_card_id
        ).where(TechnicalCard.id.is_(None)).order_by(CalendarAssignment.id)))
        allocations: dict[int, list[int]] = {row.id: [] for row in rows}
        if rows:
            for allocation in db.scalars(select(CalendarAllocation).where(
                    CalendarAllocation.assignment_id.in_(allocations)).order_by(CalendarAllocation.id)):
                allocations[allocation.assignment_id].append(allocation.id)
        return [ProductionDiagnostic(
            code="calendar_assignment_without_technical_card", category="INTEGRITY", module="calendar",
            entity_type="calendar_assignment", entity_id=row.id, entity_name=f"Назначение {row.id}",
            field="technical_card_id", field_label="Техкарта",
            message="В производственном плане найдено назначение без техкарты.",
            fix_scope="calendar", fix_action="Проверьте историю назначения и обратитесь к администратору.",
            fix_url="/production/calendar/planning", expected_source="CalendarAssignment.technical_card_id -> TechnicalCard.id",
            source_value=row.technical_card_id, actual_value=None, reason="technical_card_missing",
            debug_details={"assignment_id": row.id, "technical_card_id": row.technical_card_id,
                           "allocation_ids": allocations[row.id], "allocation_count": len(allocations[row.id])},
            trace=(DiagnosticTraceStep(source="CalendarAssignment.technical_card_id", value=row.technical_card_id),
                   DiagnosticTraceStep(source="TechnicalCard.id", broken=True)),
        ) for row in rows]
