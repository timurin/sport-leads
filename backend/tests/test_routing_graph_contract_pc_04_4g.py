"""G-A foundation only: no Scheduler/fact cutover or live dataset writes."""
import pytest
from pydantic import ValidationError
from sqlalchemy import delete, event, select

from tests.test_production_scheduler_pc_04_3a import TODAY, scheduler, change, add_step
from tests.test_scheduler_scenarios_pc_04_3c import scenario_api
from app.models.technical_card import TechnicalCard, TechnicalCardOperationLine, TechnicalCardRouteEdge, TechnicalCardStageResult
from app.models.shop_routing import ShopRoutingStageLine
from app.schemas.routing_graph import RoutingGraph, RoutingOperationFact
from app.services.routing_graph import read_template_graph, read_card_graph, topological_nodes, workshop_progress


def spec(mode="sequential", edges=()):
    return dict(workshops=[{"workshop_id": 1}, {"workshop_id": 2}], nodes=[
        {"id": "a", "workshop_id": 1, "tech_operation_id": 1, "position": 1},
        {"id": "b", "workshop_id": 1, "tech_operation_id": 2, "position": 2},
        {"id": "c", "workshop_id": 1, "tech_operation_id": 3, "position": 3},
        {"id": "d", "workshop_id": 2, "tech_operation_id": 4, "position": 4},
    ], dependency_mode=mode, edges=edges)


def edge(a, b):
    return dict(predecessor_node_id=a, successor_node_id=b)


def test_default_is_sequential_across_workshops_and_roundtrip():
    graph = RoutingGraph(**spec())
    assert [(e.predecessor_node_id, e.successor_node_id) for e in graph.edges] == [("a", "b"), ("b", "c"), ("c", "d")]
    assert [node.id for node in topological_nodes(graph)] == ["a", "b", "c", "d"]
    assert RoutingGraph.model_validate_json(graph.model_dump_json()) == graph
    with pytest.raises(ValidationError):
        graph.nodes[0].position = 5


def test_explicit_parallel_join_and_reverse_position_dependency():
    graph = RoutingGraph(**spec("explicit", [edge("a", "b"), edge("a", "c"), edge("b", "d"), edge("c", "d")]))
    assert {e.predecessor_node_id for e in graph.edges if e.successor_node_id == "d"} == {"b", "c"}
    assert [node.id for node in topological_nodes(graph)] == ["a", "b", "c", "d"]
    reverse = RoutingGraph(**spec("explicit", [edge("d", "a")]))
    assert [node.id for node in topological_nodes(reverse)].index("d") < [node.id for node in topological_nodes(reverse)].index("a")
    assert not RoutingGraph(**spec("explicit", [])).edges  # Intentional independent roots.


@pytest.mark.parametrize("edges", [[edge("a", "a")], [edge("unknown", "b")], [edge("a", "b"), edge("a", "b")], [edge("a", "b"), edge("b", "a")]])
def test_invalid_dependencies_rejected(edges):
    with pytest.raises(ValidationError):
        RoutingGraph(**spec("explicit", edges))


def test_no_implicit_parallelism_or_invalid_workshop_identity():
    with pytest.raises(ValidationError):
        RoutingGraph(**spec("sequential", [edge("a", "b"), edge("a", "c")]))
    value = spec()
    value["nodes"][0]["workshop_id"] = 99
    with pytest.raises(ValidationError):
        RoutingGraph(**value)


def test_workshop_completion_does_not_move_after_one_child():
    graph = RoutingGraph(**spec())
    facts = tuple(RoutingOperationFact(node_id=key, stage_result_id=index, status="completed" if key == "a" else "pending")
                  for index, key in enumerate(["a", "b", "c", "d"], 1))
    assert not workshop_progress(graph, facts)[0].all_required_completed
    completed = tuple(f.model_copy(update={"status": "completed" if f.node_id != "d" else "pending"}) for f in facts)
    assert workshop_progress(graph, completed)[0].all_required_completed
    assert not workshop_progress(graph, completed)[1].all_required_completed


def seed_snapshot(factory):
    add_step(factory)
    with factory() as db:
        for index in [1, 2]:
            if db.scalar(select(TechnicalCardOperationLine).where(
                TechnicalCardOperationLine.technical_card_id == 1, TechnicalCardOperationLine.sequence == index,
            )) is None:
                db.add(TechnicalCardOperationLine(technical_card_id=1, sequence=index, source_kind="routing", tech_operation_id=index,
                    operation_name="Operation", volume_unit="pieces", volume=100, stage_order=index, production_stage_id=1))
        db.get(TechnicalCard, 1).current_stage_order = 1
        db.commit()


def test_card_projection_reads_own_rows_not_changed_live_template(scheduler):
    factory, engine = scheduler
    seed_snapshot(factory)
    with factory() as db:
        original = read_card_graph(db, 1)
    change(factory, ShopRoutingStageLine, 2, production_stage_id=2)
    writes = []
    def track(_, __, sql, ___, ____, _____):
        if sql.lstrip().split()[0] in {"INSERT", "UPDATE", "DELETE"}:
            writes.append(sql)
    event.listen(engine, "before_cursor_execute", track)
    try:
        with factory() as db:
            assert read_card_graph(db, 1) == original
            template = read_template_graph(db, 1)
            assert template.graph.nodes[1].workshop_id == 2
            assert not original.persisted_dependencies and not original.scheduler_graph_integrated
            assert original.current_workshop_id == 1 and len(original.graph.workshops) == 1
            assert original.projection_only and not writes
    finally:
        event.remove(engine, "before_cursor_execute", track)


def test_incomplete_card_does_not_fall_back_to_template(scheduler):
    factory, _ = scheduler
    with factory() as db:
        db.execute(delete(TechnicalCardRouteEdge).where(TechnicalCardRouteEdge.technical_card_id == 1))
        db.execute(delete(TechnicalCardStageResult).where(TechnicalCardStageResult.technical_card_id == 1))
        db.commit()
        projected = read_card_graph(db, 1)
        assert not projected.graph.nodes and not projected.workshop_progress
        assert projected.gaps[0].reason == "card_snapshot_missing"
        assert len(read_template_graph(db, 1).graph.nodes) == 1


def test_http_graph_read_contract_and_permissions(scenario_api):
    factory, client = scenario_api
    seed_snapshot(factory)
    assert client.get("/shop-routings/1/graph").status_code == 200
    body = client.get("/technical-cards/1/route-graph").json()
    assert body["source"] == "legacy_card_snapshot_projection" and body["current_workshop_id"] == 1
    assert len(body["graph"]["nodes"]) == 2 and len(body["graph"]["workshops"]) == 1
    assert body["projection_only"] and not body["scheduler_graph_integrated"]
    assert client.get("/technical-cards/999/route-graph").status_code == 404
    assert client.get("/shop-routings/999/graph").status_code == 404
