"""PC-04.4I: immutable ONE OF metadata and one mutable selection per card/group."""
from dataclasses import dataclass
from datetime import datetime, timezone, date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.technical_card import TechnicalCard, TechnicalCardStageResult
from app.schemas.routing_graph import RoutingVariantGroup, RoutingDependency, RoutingGraph
from app.services.technical_cards import TechnicalCardConflictError, TechnicalCardNotFoundError, TechnicalCardValidationError


def remap_groups(groups, mapping):
    result = []
    for raw in groups:
        group = RoutingVariantGroup.model_validate(raw).model_dump(mode="json")
        for member in group["members"]:
            member["operation_node_id"] = mapping[member["operation_node_id"]]
        if group["default_operation_node_id"] is not None:
            group["default_operation_node_id"] = mapping[group["default_operation_node_id"]]
        result.append(group)
    return result


def logical_edges(edges, groups):
    membership = {member["operation_node_id"]: group["id"] for group in groups for member in group["members"]}
    pairs = dict.fromkeys((membership.get(edge.predecessor_node_id, edge.predecessor_node_id),
                          membership.get(edge.successor_node_id, edge.successor_node_id)) for edge in edges)
    return tuple(RoutingDependency(predecessor_node_id=a, successor_node_id=b) for a, b in pairs if a != b)


def copy_variant_snapshot(db: Session, card: TechnicalCard, template) -> None:
    mapping = {f"template:{stage.source_routing_stage_line_id}": f"snapshot:{stage.id}" for stage in card.stage_results}
    card.route_variant_groups = remap_groups(template.route_variant_groups or [], mapping)
    card.route_variant_selections = {
        group["id"]: dict(selected_operation_snapshot_node_id=group["default_operation_node_id"] if group["active"] else None,
                          selection_status="preliminary", selected_at=None, selected_by=None,
                          confirmation_at=None, confirmation_by=None)
        for group in card.route_variant_groups
    }
    from app.services.audit import append_audit_event
    from app.models.auth import PlatformUser
    actor = db.get(PlatformUser, card.created_by_platform_user_id) if card.created_by_platform_user_id else None
    for group_id, selection in card.route_variant_selections.items():
        if selection["selected_operation_snapshot_node_id"] is not None:
            append_audit_event(db, actor=actor, action="technical_card.variant.selected",
                               entity_type="technical_card", entity_id=card.id,
                               payload={"group_id": group_id, "automatic_default": True, **selection})


def selection_resolution(card):
    excluded, unresolved = set(), []
    for raw in card.route_variant_groups or []:
        group = RoutingVariantGroup.model_validate(raw)
        members = {member.operation_node_id for member in group.members}
        selection = (card.route_variant_selections or {}).get(group.id, {})
        selected = selection.get("selected_operation_snapshot_node_id")
        if group.active and selected not in members:
            unresolved.append(group.id)
            selected = None
        if not group.active:
            selected = None
        excluded.update(members - {selected})
    return excluded, tuple(unresolved)


def active_stage_results(card):
    excluded, _ = selection_resolution(card)
    return [stage for stage in card.stage_results if f"snapshot:{stage.id}" not in excluded]


@dataclass(frozen=True)
class EffectiveRouteSnapshot:
    graph: RoutingGraph
    excluded_alternatives: tuple[str, ...]
    unresolved_groups: tuple[str, ...]


def resolve_effective_route_snapshot(db: Session, card_id: int) -> EffectiveRouteSnapshot:
    from app.services.routing_graph import read_card_graph
    from app.schemas.routing_graph import expanded_dependencies
    card = db.get(TechnicalCard, card_id)
    if card is None:
        raise TechnicalCardNotFoundError("Technical card not found")
    graph = read_card_graph(db, card_id).graph
    excluded, unresolved = selection_resolution(card)
    nodes = tuple(node for node in graph.nodes if node.id not in excluded)
    edges = tuple(edge for edge in expanded_dependencies(graph)
                  if edge.predecessor_node_id not in excluded and edge.successor_node_id not in excluded)
    return EffectiveRouteSnapshot(
        RoutingGraph(workshops=graph.workshops, nodes=nodes, dependency_mode="explicit", edges=edges),
        tuple(sorted(excluded)), unresolved,
    )


def read_variant_selections(db: Session, card_id: int):
    from app.schemas.route_variants import RouteVariantRead
    card = db.get(TechnicalCard, card_id)
    if card is None:
        raise TechnicalCardNotFoundError("Technical card not found")
    return [RouteVariantRead(group=RoutingVariantGroup.model_validate(group),
                             **(card.route_variant_selections or {}).get(group["id"], {}))
            for group in card.route_variant_groups or []]


def set_variant_selection(db: Session, card_id: int, group_id: str, payload, *, actor=None, today: date | None = None):
    from app.models.calendar_assignment import CalendarAssignment
    from app.repositories.production_scheduler import lock_scheduler
    from app.schemas.route_variants import RouteVariantChangeRead
    from app.services.production_scheduler import schedule_card_in_transaction
    from app.services.technical_card_stages import _sync_current_stage
    from app.services.audit import append_audit_event
    try:
        lock_scheduler(db)
        card = db.scalar(select(TechnicalCard).where(TechnicalCard.id == card_id).with_for_update()
                         .execution_options(populate_existing=True))
        if card is None:
            raise TechnicalCardNotFoundError("Technical card not found")
        group = next((group for group in card.route_variant_groups or [] if group["id"] == group_id), None)
        if group is None:
            raise TechnicalCardNotFoundError("Variant group not found on this card")
        if not group["active"] or card.status in {"completed", "cancelled"}:
            raise TechnicalCardConflictError("Variant selection is not editable on this card/group")
        node = payload.selected_operation_snapshot_node_id
        if node not in {member["operation_node_id"] for member in group["members"]}:
            raise TechnicalCardValidationError("Selected operation must belong to this snapshot group")
        previous = (card.route_variant_selections or {}).get(group_id, {})
        old_node = previous.get("selected_operation_snapshot_node_id")
        changed = old_node != node
        if not changed and previous.get("selection_status") == "confirmed" and payload.selection_status == "preliminary":
            raise TechnicalCardConflictError("Confirmed selection cannot be demoted without changing the variant")
        stages = list(db.scalars(select(TechnicalCardStageResult).where(TechnicalCardStageResult.technical_card_id == card_id)
                                 .with_for_update().execution_options(populate_existing=True)))
        old_stage = next((stage for stage in stages if f"snapshot:{stage.id}" == old_node), None)
        if changed:
            if card.plan_locked:
                raise TechnicalCardConflictError("Card plan is locked; unlock before changing variant")
            # Protect downstream facts too: changing a predecessor invalidates their route history.
            effective = resolve_effective_route_snapshot(db, card_id)
            affected = {old_node} if old_node else set()
            for _ in effective.graph.nodes:
                affected.update(edge.successor_node_id for edge in effective.graph.edges if edge.predecessor_node_id in affected)
            if any(f"snapshot:{stage.id}" in affected and stage.status in {"in_progress", "completed"} for stage in stages):
                raise TechnicalCardConflictError("Cannot change variant: selected operation or its successor has started/completed")
            assignments = list(db.scalars(select(CalendarAssignment).where(CalendarAssignment.technical_card_id == card_id)
                                          .with_for_update()))
            old_assignments = [row for row in assignments if old_stage is not None and
                               (row.stage_result_id == old_stage.id or
                                (row.stage_result_id is None and row.routing_stage_line_id == old_stage.source_routing_stage_line_id))]
            if any(row.manual_lock or row.planning_mode != "auto" for row in old_assignments):
                raise TechnicalCardConflictError("Old variant has manual/locked assignments; resolve them before changing selection")
            from app.services.calendar_plan_linkage import retire_assignments
            retire_assignments(db, old_assignments, reason="route_variant_changed", source="route_variant", actor=actor)
        now = datetime.now(timezone.utc).isoformat()
        selection = dict(previous)
        selection.update(selected_operation_snapshot_node_id=node, selection_status=payload.selection_status)
        if changed:
            selection.update(selected_at=now, selected_by=None if actor is None else actor.id,
                             confirmation_at=None, confirmation_by=None)
        confirmed = payload.selection_status == "confirmed" and (changed or previous.get("selection_status") != "confirmed")
        if confirmed:
            selection.update(confirmation_at=now, confirmation_by=None if actor is None else actor.id)
        card.route_variant_selections = {**(card.route_variant_selections or {}), group_id: selection}
        _sync_current_stage(card)
        if changed:
            append_audit_event(db, actor=actor, action="technical_card.variant." + ("changed" if old_node else "selected"),
                               entity_type="technical_card", entity_id=card_id,
                               payload={"group_id": group_id, "old_node": old_node, **selection})
        if confirmed:
            append_audit_event(db, actor=actor, action="technical_card.variant.confirmed",
                               entity_type="technical_card", entity_id=card_id,
                               payload={"group_id": group_id, **selection})
        db.flush()
        plan = schedule_card_in_transaction(db, card_id, persist=payload.replan, today=today) if changed else None
        if plan is not None and payload.replan and plan.status == "planned":
            plan.persisted = True
        db.commit()
        selected = next(row for row in read_variant_selections(db, card_id) if row.group.id == group_id)
        return RouteVariantChangeRead(selection=selected, requires_replan=changed and not (plan and plan.persisted), plan=plan)
    except Exception:
        db.rollback()
        raise
