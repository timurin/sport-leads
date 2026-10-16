"""Frozen applied-route evidence; never certify legacy rows from a live template."""
from datetime import datetime, timezone
from copy import deepcopy
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.audit import AuditEvent
from app.models.technical_card import TechnicalCard, TechnicalCardStageResult, TechnicalCardRouteEdge
from app.schemas.production_diagnostics import ProductionDiagnostic, DiagnosticTraceStep

CODE = "route_requires_review_before_planning"
ENTITY = "technical_card_route_manifest"


def manifest_matches(card, shape: dict, manifest: dict | None) -> bool:
    return (isinstance(manifest, dict) and manifest.get('version') == 1
            and manifest.get('routing_template_id') == card.routing_template_id
            and bool(shape['nodes']) and all(manifest.get(key) == shape[key] for key in ('nodes', 'edges', 'groups')))


def current_shape(db: Session, card: TechnicalCard) -> dict:
    nodes = db.scalars(select(TechnicalCardStageResult).where(TechnicalCardStageResult.technical_card_id == card.id)
                       .order_by(TechnicalCardStageResult.id))
    return dict(nodes=[dict(id=n.id, operation=n.tech_operation_id, workshop=n.production_stage_id,
                           required=n.is_required, order=n.stage_order, equipment=n.work_center_id) for n in nodes],
                edges=sorted([e.predecessor_stage_result_id, e.successor_stage_result_id] for e in db.scalars(
                    select(TechnicalCardRouteEdge).where(TechnicalCardRouteEdge.technical_card_id == card.id))),
                groups=deepcopy(card.route_variant_groups or []))


def record_applied_route(db: Session, card: TechnicalCard) -> None:
    """Called only after a complete canonical apply, in that mutation's transaction."""
    db.flush()
    payload = dict(version=1, routing_template_id=card.routing_template_id, **current_shape(db, card))
    previous = db.scalar(select(AuditEvent).where(AuditEvent.entity_type == ENTITY, AuditEvent.entity_id == str(card.id),
        AuditEvent.action == "route.manifest_created").order_by(AuditEvent.id.desc()))
    if previous is not None and previous.payload == payload:
        return
    actor = db.info.get("audit_actor")
    db.add(AuditEvent(entity_type=ENTITY, entity_id=str(card.id), action="route.manifest_created",
        occurred_at=datetime.now(timezone.utc), source="routing",
        actor_platform_user_id=None if actor is None else actor.id, actor_login=None if actor is None else actor.login,
        payload=payload))
    db.flush()


def route_review_issue(db: Session, card: TechnicalCard) -> ProductionDiagnostic | None:
    if card.routing_template_id is None and not any(n.tech_operation_id is not None for n in card.stage_results):
        return None  # Existing missing_route contract remains authoritative.
    event = db.scalar(select(AuditEvent).where(AuditEvent.entity_type == ENTITY, AuditEvent.entity_id == str(card.id),
        AuditEvent.action == "route.manifest_created").order_by(AuditEvent.id.desc()))
    old = None if event is None else event.payload
    shape = current_shape(db, card)
    valid = isinstance(old, dict) and old.get("version") == 1 and old.get("routing_template_id") == card.routing_template_id
    if manifest_matches(card, shape, old):
        return None
    from app.services.route_reapply import protected_nodes
    protected = sorted(protected_nodes(db, card))
    reason = "manifest_missing" if old is None else "applied_route_changed_or_manifest_invalid"
    # Verification compares the full frozen structure, but diagnostics never
    # echo arbitrary malformed JSON (including unknown secret-bearing fields).
    expected_ids = [n["id"] for n in (old.get("nodes", []) if isinstance(old, dict) and isinstance(old.get("nodes"), list) else [])
                    if isinstance(n, dict) and isinstance(n.get("id"), int)]
    safe_current = dict(nodes=shape["nodes"], edges=shape["edges"],
                        variant_group_count=len(shape["groups"]) if isinstance(shape["groups"], list) else None)
    safe_expected = None if old is None else dict(manifest_event_id=event.id, expected_snapshot_ids=expected_ids)
    title = "Маршрут техкарты требует проверки" if protected else "Не удалось проверить производственный маршрут"
    message = ("В техкарте есть выполненные или начатые операции, поэтому маршрут нельзя обновить автоматически. "
               "Проверьте маршрут вручную или обратитесь к ответственному за производство." if protected else
               "В этой техкарте используется старый маршрут, и система не может подтвердить, что в нём есть все необходимые операции. "
               "Обновите маршрут техкарты перед планированием производства.")
    return ProductionDiagnostic(code=CODE, category="INTEGRITY", module="routing", entity_type="technical_card",
        entity_id=card.id, entity_name=card.number, field="route.verification", field_label=title, message=message,
        fix_scope="technical_card", fix_action="Открыть маршрут" if protected else "Обновить маршрут",
        fix_url=f"/production/tech-cards/{card.id}", reason=reason,
        expected_source="Frozen canonical applied-route manifest", source_value=safe_expected, actual_value=safe_current,
        trace=(DiagnosticTraceStep(source="canonical apply → frozen manifest", value=None if event is None else event.id,
                                   broken=not valid), DiagnosticTraceStep(source="manifest → retained nodes/edges/groups", value=safe_current, broken=True)),
        debug_details=dict(verification_state="unverified", reason=reason, manifest_event_id=None if event is None else event.id,
            snapshot_ids=[n["id"] for n in shape["nodes"]], protected_fact_nodes=protected,
            expected_snapshot_ids=expected_ids,
            technical_action="manual fact-safe review" if protected else "explicit canonical route reapply"))


def assert_route_reviewed(db: Session, card: TechnicalCard) -> None:
    from app.services.calendar_plan_linkage import PlanLinkageConflict
    issue = route_review_issue(db, card)
    if issue:
        raise PlanLinkageConflict(issue)


def assert_safe_refresh(db: Session, card: TechnicalCard) -> None:
    issue = route_review_issue(db, card)
    if issue and issue.debug_details["protected_fact_nodes"]:
        from app.services.route_reapply import RouteReapplyConflict
        error = RouteReapplyConflict([issue])
        error.code = CODE
        raise error
