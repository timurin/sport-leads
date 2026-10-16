"""One graph contract and read-only projections over existing routing entities.

No template fallback for an incomplete card snapshot, and no calendar writes.
Persistent edges and scheduler/fact cutover are the next PC-04.4G slice.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.shop_routing import ShopRoutingNodeDependency, ShopRoutingStageLine, ShopRoutingTemplate
from app.models.technical_card import TechnicalCard, TechnicalCardOperationLine, TechnicalCardRouteEdge, TechnicalCardStageResult
from app.schemas.routing_graph import (
    RoutingDependency, RoutingGraph, RoutingGraphGap, RoutingGraphRead,
    RoutingOperationFact, RoutingOperationNode, RoutingWorkshop, RoutingWorkshopProgress, expanded_dependencies,
)


class RoutingGraphNotFoundError(RuntimeError):
    pass


def topological_nodes(graph: RoutingGraph):
    """Deterministic dependency traversal shared by future planning/fact consumers."""
    predecessors = {node.id: set() for node in graph.nodes}
    for edge in expanded_dependencies(graph):
        predecessors[edge.successor_node_id].add(edge.predecessor_node_id)
    done, result = set(), []
    while len(done) < len(graph.nodes):
        ready = sorted((node for node in graph.nodes if node.id not in done and predecessors[node.id] <= done),
                       key=lambda node: (node.position, node.id))
        node = ready[0]  # DTO validation already rejects cycles.
        result.append(node)
        done.add(node.id)
    return tuple(result)


def _attach_readiness(db: Session, payload: RoutingGraphRead, selections: dict[str, str | None] | None = None) -> RoutingGraphRead:
    from app.services.route_readiness import graph_node_readiness

    from app.services.production_diagnostics import graph_diagnostics, card_diagnostics
    per_node, diagnostics = graph_diagnostics(db, payload.graph, selections)
    nodes = []
    for row in graph_node_readiness(db, payload.graph, selections):
        own = per_node[row.node_id]
        blocking = next((item for item in own if item.severity == "error"), None)
        updates = {"diagnostics": own, "status": "blocked" if blocking else "ready"}
        if blocking and row.reason_code is None:
            updates.update(reason_code=blocking.code, message=blocking.message)
        nodes.append(row.model_copy(update=updates))
    if payload.source != "template_projection":
        diagnostics = card_diagnostics(db, payload.source_id).diagnostics
    elif payload.gaps or not payload.graph.nodes:
        from app.schemas.production_diagnostics import ProductionDiagnostic
        diagnostics = (*diagnostics, ProductionDiagnostic(
            code=payload.gaps[0].reason if payload.gaps else "missing_route", entity_type="shop_routing",
            entity_id=payload.source_id, entity_name=f"Маршрут {payload.source_id}", field="nodes",
            field_label="Операции маршрута", message="Маршрут: снимок операций отсутствует или неполон.", fix_scope="shop_routing"))
    from app.services.production_diagnostics import unique
    return payload.model_copy(update={"node_readiness": tuple(nodes), "diagnostics": unique(diagnostics)})


def _card_selections(card: TechnicalCard) -> dict[str, str | None]:
    return {
        group_id: value.get("selected_operation_snapshot_node_id") if isinstance(value, dict) else None
        for group_id, value in (card.route_variant_selections or {}).items()
    }


def workshop_progress(graph: RoutingGraph, facts: tuple[RoutingOperationFact, ...]):
    statuses = {fact.node_id: fact.status for fact in facts}
    return tuple(RoutingWorkshopProgress(
        workshop_id=workshop.workshop_id,
        required_operations=len(required := [node for node in graph.nodes if node.workshop_id == workshop.workshop_id and node.required]),
        completed_required_operations=sum(statuses.get(node.id) == "completed" for node in required),
        all_required_completed=all(statuses.get(node.id) == "completed" for node in required),
    ) for workshop in graph.workshops)


def _graph(nodes):
    parents = tuple(RoutingWorkshop(workshop_id=key) for key in dict.fromkeys(node.workshop_id for node in nodes))
    return RoutingGraph(workshops=parents, nodes=tuple(nodes))


def _persisted_card_graph(db: Session, card: TechnicalCard, stages) -> RoutingGraphRead | None:
    operations = [stage for stage in stages if stage.tech_operation_id is not None and stage.production_stage_id is not None]
    edges = list(db.scalars(select(TechnicalCardRouteEdge).where(TechnicalCardRouteEdge.technical_card_id == card.id)))
    if not operations or (not edges and not card.route_variant_groups):
        return None
    nodes, facts = [], []
    for stage in operations:
        node = RoutingOperationNode(
            id=f"snapshot:{stage.id}", workshop_id=stage.production_stage_id, tech_operation_id=stage.tech_operation_id,
            position=stage.stage_order, required=stage.is_required, work_center_id=stage.work_center_id,
        )
        nodes.append(node)
        facts.append(RoutingOperationFact(
            node_id=node.id, stage_result_id=stage.id,
            status=stage.status.value if hasattr(stage.status, "value") else stage.status,
        ))
    known = {stage.id for stage in operations}
    if any(edge.predecessor_stage_result_id not in known or edge.successor_stage_result_id not in known for edge in edges):
        return None
    from app.services.route_variants import logical_edges
    snapshot_edges = tuple(RoutingDependency(predecessor_node_id=f"snapshot:{edge.predecessor_stage_result_id}", successor_node_id=f"snapshot:{edge.successor_stage_result_id}") for edge in edges)
    graph = RoutingGraph(
        workshops=tuple(RoutingWorkshop(workshop_id=key) for key in dict.fromkeys(node.workshop_id for node in nodes)),
        nodes=tuple(nodes),
        dependency_mode="explicit",
        edges=logical_edges(snapshot_edges, card.route_variant_groups or []),
        variant_groups=tuple(card.route_variant_groups or []),
    )
    from app.services.route_variants import selection_resolution
    excluded, unresolved = selection_resolution(card)
    effective = RoutingGraph(workshops=graph.workshops, nodes=tuple(node for node in graph.nodes if node.id not in excluded), dependency_mode="explicit", edges=tuple(edge for edge in expanded_dependencies(graph) if edge.predecessor_node_id not in excluded and edge.successor_node_id not in excluded))
    from app.services.technical_card_fact_projection import current_fact_stage
    current_stage = current_fact_stage(card)
    current = current_stage.production_stage_id if current_stage else None
    return _attach_readiness(db, RoutingGraphRead(
        source="card_route_snapshot", source_id=card.id, graph=graph, operation_facts=tuple(facts),
        workshop_progress=() if unresolved else workshop_progress(effective, tuple(facts)), current_workshop_id=current,
        persisted_dependencies=True, scheduler_graph_integrated=True,
    ), _card_selections(card))


def read_template_graph(db: Session, template_id: int) -> RoutingGraphRead:
    template = db.get(ShopRoutingTemplate, template_id)
    if template is None:
        raise RoutingGraphNotFoundError("Routing template not found")
    rows = list(db.scalars(select(ShopRoutingStageLine).where(ShopRoutingStageLine.routing_template_id == template_id)
                          .order_by(ShopRoutingStageLine.stage_order, ShopRoutingStageLine.id)))
    nodes, gaps = [], []
    for row in rows:
        if row.tech_operation_id is None or row.production_stage_id is None:
            gaps.append(RoutingGraphGap(stage_order=row.stage_order, reason="legacy_step_missing_operation_or_workshop"))
            continue
        nodes.append(RoutingOperationNode(
            id=f"template:{row.id}", workshop_id=row.production_stage_id, tech_operation_id=row.tech_operation_id,
            position=row.stage_order, required=bool(row.is_required), work_center_id=row.work_center_id,
        ))
    if template.dependency_mode == "explicit" or template.route_variant_groups:
        stored = list(db.scalars(select(ShopRoutingNodeDependency).where(
            ShopRoutingNodeDependency.routing_template_id == template_id)))
        known = {row.id for row in rows}
        from app.services.route_variants import logical_edges
        template_edges = tuple(RoutingDependency(predecessor_node_id=f"template:{edge.predecessor_line_id}", successor_node_id=f"template:{edge.successor_line_id}") for edge in stored)
        try:
            graph = RoutingGraph(
                workshops=tuple(RoutingWorkshop(workshop_id=key) for key in dict.fromkeys(node.workshop_id for node in nodes)),
                nodes=tuple(nodes),
                dependency_mode="explicit",
                edges=logical_edges(template_edges, template.route_variant_groups or []),
                variant_groups=tuple(template.route_variant_groups or []),
            )
        except ValueError:
            gaps.append(RoutingGraphGap(stage_order=0, reason="invalid_persisted_template_graph"))
            return _attach_readiness(db, RoutingGraphRead(source="template_projection", source_id=template_id, graph=_graph(nodes), gaps=tuple(gaps)))
        return _attach_readiness(db, RoutingGraphRead(
            source="template_projection", source_id=template_id, graph=graph, gaps=tuple(gaps),
            persisted_dependencies=True,
        ))
    return _attach_readiness(db, RoutingGraphRead(source="template_projection", source_id=template_id, graph=_graph(nodes), gaps=tuple(gaps)))


def read_card_graph(db: Session, card_id: int) -> RoutingGraphRead:
    card = db.get(TechnicalCard, card_id)
    if card is None:
        raise RoutingGraphNotFoundError("Technical card not found")
    stages = list(db.scalars(select(TechnicalCardStageResult).where(TechnicalCardStageResult.technical_card_id == card_id)
                            .order_by(TechnicalCardStageResult.stage_order, TechnicalCardStageResult.id)))
    persisted = _persisted_card_graph(db, card, stages)
    if persisted is not None:
        return persisted
    operations = list(db.scalars(select(TechnicalCardOperationLine).where(
        TechnicalCardOperationLine.technical_card_id == card_id, TechnicalCardOperationLine.source_kind == "routing")))
    nodes, facts, gaps = [], [], []
    if not stages:
        gaps.append(RoutingGraphGap(stage_order=0, reason="card_snapshot_missing"))
    for stage in stages:
        matched = [row for row in operations if row.stage_order == stage.stage_order and row.production_stage_id == stage.production_stage_id]
        if len(matched) != 1 or matched[0].tech_operation_id is None or stage.production_stage_id is None:
            gaps.append(RoutingGraphGap(stage_order=stage.stage_order, reason="legacy_snapshot_step_without_unambiguous_operation"))
            continue
        node = RoutingOperationNode(id=f"snapshot:{stage.id}", workshop_id=stage.production_stage_id,
                                    tech_operation_id=matched[0].tech_operation_id, position=stage.stage_order)
        nodes.append(node)
        facts.append(RoutingOperationFact(node_id=node.id, stage_result_id=stage.id,
            status=stage.status.value if hasattr(stage.status, "value") else stage.status))
    graph = _graph(nodes)
    from app.services.technical_card_fact_projection import current_fact_stage
    current_stage = current_fact_stage(card)
    current = current_stage.production_stage_id if current_stage else None
    return _attach_readiness(db, RoutingGraphRead(source="legacy_card_snapshot_projection", source_id=card_id, graph=graph,
        gaps=tuple(gaps), operation_facts=tuple(facts), workshop_progress=() if gaps else workshop_progress(graph, tuple(facts)),
        current_workshop_id=current), _card_selections(card))
