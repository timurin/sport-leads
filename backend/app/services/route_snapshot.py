"""Copy a routing template into an immutable technical-card snapshot."""

from sqlalchemy import delete, select, inspect
from sqlalchemy.orm import Session

from app.models.shop_routing import ShopRoutingNodeDependency, ShopRoutingStageLine, ShopRoutingTemplate
from app.models.tech_operation import TechOperation
from app.models.technical_card import (
    TechnicalCard,
    TechnicalCardRouteEdge,
    TechnicalCardStageResult,
    TechnicalCardStageResultStatus,
)
from app.schemas.routing_graph import RoutingDependency, RoutingGraph, RoutingOperationNode, RoutingWorkshop
from app.services.technical_cards import TechnicalCardValidationError


def validate_template_graph(db: Session, template: ShopRoutingTemplate) -> None:
    """Reject an explicit template that is not one acyclic graph. Sequential templates stay compatible."""
    if template.route_variant_groups:
        from app.services.routing_graph import read_template_graph
        result = read_template_graph(db, template.id)
        if result.gaps:
            raise TechnicalCardValidationError("Invalid variant routing graph")
        return
    mode = template.dependency_mode or "sequential"
    if mode == "sequential":
        return
    lines = list(db.scalars(
        select(ShopRoutingStageLine)
        .where(ShopRoutingStageLine.routing_template_id == template.id)
        .order_by(ShopRoutingStageLine.stage_order, ShopRoutingStageLine.id)
    ))
    edges = list(db.scalars(
        select(ShopRoutingNodeDependency).where(ShopRoutingNodeDependency.routing_template_id == template.id)
    ))
    nodes = []
    for line in lines:
        if line.production_stage_id is None or line.tech_operation_id is None:
            raise TechnicalCardValidationError("Explicit routing has a step without a workshop or operation")
        nodes.append(RoutingOperationNode(
            id=str(line.id),
            workshop_id=line.production_stage_id,
            tech_operation_id=line.tech_operation_id,
            position=line.stage_order,
            required=line.is_required,
            work_center_id=line.work_center_id,
        ))
    try:
        RoutingGraph(
            workshops=tuple(RoutingWorkshop(workshop_id=key) for key in dict.fromkeys(node.workshop_id for node in nodes)),
            nodes=tuple(nodes),
            dependency_mode="explicit",
            edges=tuple(RoutingDependency(predecessor_node_id=str(edge.predecessor_line_id), successor_node_id=str(edge.successor_line_id)) for edge in edges),
        )
    except ValueError as error:
        raise TechnicalCardValidationError(str(error)) from error


def bind_applied_snapshot(db: Session, card: TechnicalCard, template: ShopRoutingTemplate) -> None:
    """Stamp operation identity onto stage results just copied from the template, then freeze edges."""
    lines = {
        line.stage_order: line
        for line in db.scalars(
            select(ShopRoutingStageLine).where(ShopRoutingStageLine.routing_template_id == template.id)
        )
    }
    for stage in card.stage_results:
        line = lines.get(stage.stage_order)
        if line is None or line.production_stage_id != stage.production_stage_id:
            continue
        stage.source_routing_stage_line_id = line.id
        stage.tech_operation_id = line.tech_operation_id
        stage.is_required = bool(line.is_required)
        operation = db.get(TechOperation, line.tech_operation_id) if line.tech_operation_id is not None else None
        if operation is not None:
            stage.operation_name = operation.name
            stage.operation_code = operation.code
    db.flush()
    _replace_edges(db, card, template)
    from app.services.route_verification import record_applied_route
    record_applied_route(db, card)


def copy_template_snapshot(db: Session, card: TechnicalCard) -> bool:
    """Build a snapshot for a card that has none. Ambiguous templates are left untouched."""
    from app.repositories.production_scheduler import lock_scheduler
    lock_scheduler(db)
    if card.stage_results or card.routing_template_id is None:
        return False
    template = db.get(ShopRoutingTemplate, card.routing_template_id)
    if template is None:
        return False
    lines = list(db.scalars(
        select(ShopRoutingStageLine)
        .where(ShopRoutingStageLine.routing_template_id == template.id)
        .order_by(ShopRoutingStageLine.stage_order, ShopRoutingStageLine.id)
    ))
    if not lines or any(line.production_stage_id is None or line.tech_operation_id is None for line in lines):
        return False
    for line in lines:
        operation = db.get(TechOperation, line.tech_operation_id)
        if operation is None:
            return False
        card.stage_results.append(TechnicalCardStageResult(
            stage_order=line.stage_order,
            production_stage_id=line.production_stage_id,
            stage_label=line.stage_label,
            status=TechnicalCardStageResultStatus.PENDING,
            work_center_id=line.work_center_id,
            tech_operation_id=line.tech_operation_id,
            source_routing_stage_line_id=line.id,
            is_required=bool(line.is_required),
            operation_name=operation.name,
            operation_code=operation.code,
        ))
    db.flush()
    _replace_edges(db, card, template)
    from app.services.route_verification import record_applied_route
    record_applied_route(db, card)
    return True


def append_snapshot_line(db: Session, card: TechnicalCard, line: ShopRoutingStageLine) -> TechnicalCardStageResult | None:
    """Add one already-known template line to an existing card snapshot. Does not reread later template edits."""
    from app.repositories.production_scheduler import lock_scheduler
    lock_scheduler(db)
    if any(row.source_routing_stage_line_id == line.id for row in card.stage_results):
        return None
    if line.tech_operation_id is None or line.production_stage_id is None:
        return None
    operation = db.get(TechOperation, line.tech_operation_id)
    if operation is None:
        return None
    from app.services.route_verification import route_review_issue, record_applied_route
    was_verified = route_review_issue(db, card) is None
    stage = TechnicalCardStageResult(
        technical_card_id=card.id,
        stage_order=line.stage_order,
        production_stage_id=line.production_stage_id,
        stage_label=line.stage_label,
        status=TechnicalCardStageResultStatus.PENDING,
        work_center_id=line.work_center_id,
        tech_operation_id=operation.id,
        source_routing_stage_line_id=line.id,
        is_required=bool(line.is_required),
        operation_name=operation.name,
        operation_code=operation.code,
    )
    db.add(stage)
    db.flush()
    if was_verified:
        record_applied_route(db, card)
    return stage


def _replace_edges(db: Session, card: TechnicalCard, template: ShopRoutingTemplate) -> None:
    db.execute(delete(TechnicalCardRouteEdge).where(TechnicalCardRouteEdge.technical_card_id == card.id))
    nodes = [
        row for row in sorted(card.stage_results, key=lambda row: (row.stage_order, row.id or 0))
        if row.tech_operation_id is not None
    ]
    by_source = {row.source_routing_stage_line_id: row for row in nodes if row.source_routing_stage_line_id is not None}
    pairs: list[tuple[TechnicalCardStageResult, TechnicalCardStageResult]] = []
    if (template.dependency_mode or "sequential") == "explicit":
        edges = list(db.scalars(
            select(ShopRoutingNodeDependency).where(ShopRoutingNodeDependency.routing_template_id == template.id)
        ))
        for edge in edges:
            predecessor = by_source.get(edge.predecessor_line_id)
            successor = by_source.get(edge.successor_line_id)
            if predecessor is None or successor is None:
                raise TechnicalCardValidationError("Explicit routing edge does not match the card snapshot")
            pairs.append((predecessor, successor))
    else:
        pairs = list(zip(nodes, nodes[1:]))
    for predecessor, successor in pairs:
        db.add(TechnicalCardRouteEdge(
            technical_card_id=card.id,
            predecessor_stage_result_id=predecessor.id,
            successor_stage_result_id=successor.id,
        ))
    db.flush()
    from app.services.route_variants import copy_variant_snapshot
    copy_variant_snapshot(db, card, template)
    if inspect(card).persistent:
        db.expire(card, ['route_edges'])
    from app.services.technical_card_stages import _sync_current_stage
    _sync_current_stage(card)
    db.flush()
