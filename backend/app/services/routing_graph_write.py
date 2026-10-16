"""Save one canonical graph, including logical ONE OF endpoints, atomically."""
from sqlalchemy.orm import Session

from app.models.shop_routing import ShopRoutingNodeDependency
from app.schemas.shop_routing import ShopRoutingStageLineWrite
from app.schemas.routing_graph import expanded_dependencies
from app.services.shop_routings import get_routing_template, _validate_stages
from app.services.route_variants import remap_groups


def save_routing_graph(db: Session, template_id: int, graph):
    from app.services.routing_graph import read_template_graph
    try:
        from app.repositories.production_scheduler import lock_scheduler
        lock_scheduler(db)
        template = get_routing_template(db, template_id)
        from app.services.calendar_plan_linkage import assert_route_lines_retirable
        positions = {node.position for node in graph.nodes}
        assert_route_lines_retirable(db, [line.id for line in template.stage_lines if line.stage_order not in positions])
        lines = _validate_stages(db, [ShopRoutingStageLineWrite(
            stage_order=node.position, production_stage_id=node.workshop_id,
            tech_operation_id=node.tech_operation_id, work_center_id=node.work_center_id,
            is_required=node.required,
        ) for node in sorted(graph.nodes, key=lambda node: node.position)])
        template.node_dependencies.clear()
        db.flush()
        # Keep stable line identities for existing CalendarAssignment FKs.
        # Snapshot operation data remains independent of these template updates.
        existing = {line.stage_order: line for line in template.stage_lines}
        saved = []
        for line in lines:
            current = existing.pop(line.stage_order, None)
            if current is None:
                template.stage_lines.append(line)
                saved.append(line)
            else:
                for field in ("production_stage_id", "stage_label", "tech_operation_id", "work_center_id", "is_required"):
                    setattr(current, field, getattr(line, field))
                saved.append(current)
        from app.services.calendar_plan_lifecycle import detach_for_route_lines
        detach_for_route_lines(db, [line.id for line in existing.values()])
        for line in existing.values():
            template.stage_lines.remove(line)
        lines = saved
        db.flush()
        by_position = {line.stage_order: line for line in lines}
        by_node = {node.id: by_position[node.position] for node in graph.nodes}
        template.route_variant_groups = remap_groups(graph.variant_groups, {key: f"template:{line.id}" for key, line in by_node.items()})
        template.dependency_mode = "explicit"
        for edge in expanded_dependencies(graph):
            template.node_dependencies.append(ShopRoutingNodeDependency(
                routing_template_id=template_id,
                predecessor_line_id=by_node[edge.predecessor_node_id].id,
                successor_line_id=by_node[edge.successor_node_id].id,
            ))
        db.commit()
        return read_template_graph(db, template_id)
    except Exception:
        db.rollback()
        raise
