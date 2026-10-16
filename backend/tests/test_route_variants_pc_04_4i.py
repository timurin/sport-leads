"""ONE OF self-check through real graph persistence, Demand, scheduler and facts."""
from copy import deepcopy
from datetime import timedelta

import pytest
from sqlalchemy import select, func
from pydantic import ValidationError

from tests.test_production_scheduler_pc_04_3a import TODAY, scheduler, run
from tests.test_scheduler_scenarios_pc_04_3c import scenario_api
from app.models.calendar_assignment import CalendarAssignment
from app.models.calendar_allocation import CalendarAllocation
from app.models.production_capacity import CapacityResource, TechOperationCapacityResource
from app.models.shop_routing import ShopRoutingTemplate
from app.models.technical_card import TechnicalCard, TechnicalCardStageResult
from app.models.audit import AuditEvent
from app.schemas.routing_graph import RoutingGraph
from app.schemas.route_variants import RouteVariantSelectionWrite
from app.services.routing_graph_write import save_routing_graph
from app.services.routing_graph import read_card_graph, read_template_graph
from app.services.route_snapshot import copy_template_snapshot
from app.services.route_variants import resolve_effective_route_snapshot, read_variant_selections, set_variant_selection
from app.services.production_demand import read_technical_card_demand
from app.services.production_queue_scheduler import schedule_queue
from app.services.technical_card_stages import _sync_current_stage, _maybe_complete_card, _previous_stages_completed, start_stage
from app.services.technical_cards import TechnicalCardConflictError, TechnicalCardValidationError


def graph_payload(default="lay", mode="sequential"):
    return dict(workshops=[dict(workshop_id=1)],
                nodes=[dict(id=key, workshop_id=1, tech_operation_id=operation, position=position)
                       for key, operation, position in [("before", 1, 1), ("manual", 1, 2), ("lay", 1, 3), ("laser", 2, 4), ("after", 1, 5)]],
                dependency_mode=mode,
                edges=[] if mode == "sequential" else [dict(predecessor_node_id="before", successor_node_id="cutting"), dict(predecessor_node_id="cutting", successor_node_id="after")],
                variant_groups=[dict(id="cutting", workshop_id=1, name="Способ раскроя", default_operation_node_id=default,
                                     members=[dict(operation_node_id=key, position=i) for i, key in enumerate(["manual", "lay", "laser"], 1)])])


def seed_variant(factory, default="lay", mode="sequential"):
    with factory() as db:
        db.add(CapacityResource(resource_key="laser", name="Laser", resource_type="throughput", capacity_unit="item",
                                calculation_mode="rate", production_stage_id=1, base_rate=200, staff_count=1,
                                hours_per_day=1, working_days=list(range(7))))
        db.add(TechOperationCapacityResource(tech_operation_id=2, resource_key="laser"))
        db.commit()
        save_routing_graph(db, 1, RoutingGraph.model_validate(graph_payload(default, mode)))
        card = TechnicalCard(id=3, order_group_id=1, card_seq=3, number="VAR-3", quantity=100, routing_template_id=1,
                             planning_start_date=TODAY, shipping_date=TODAY + timedelta(days=20))
        db.add(card)
        db.flush()
        assert copy_template_snapshot(db, card)
        db.commit()
        return {stage.stage_order: f"snapshot:{stage.id}" for stage in card.stage_results}


def patch(factory, node, *, status="preliminary", replan=True):
    with factory() as db:
        return set_variant_selection(db, 3, "cutting", RouteVariantSelectionWrite(
            selected_operation_snapshot_node_id=node, selection_status=status, replan=replan), today=TODAY)


@pytest.mark.parametrize("mode", ["sequential", "explicit"])
def test_logical_group_edges_effective_dag_and_preliminary_plan(scheduler, mode):
    factory, _ = scheduler
    nodes = seed_variant(factory, mode=mode)
    with factory() as db:
        template = read_template_graph(db, 1)
        assert len(template.graph.edges) == 2
        assert {edge.successor_node_id for edge in template.graph.edges} >= {"cutting"}
        full = read_card_graph(db, 3).graph
        assert len(full.nodes) == 5 and len(full.variant_groups) == 1
        effective = resolve_effective_route_snapshot(db, 3)
        assert {node.id for node in effective.graph.nodes} == {nodes[1], nodes[3], nodes[5]}
        assert set(effective.excluded_alternatives) == {nodes[2], nodes[4]}
        assert not effective.unresolved_groups
        assert read_variant_selections(db, 3)[0].selection_status == "preliminary"
        demand = read_technical_card_demand(db, 3)
        assert len(demand.steps) == 3 and all(step.status == "ready" for step in demand.steps)
        assert sum(int(row.amount) for step in demand.steps for row in step.demands) == 300
    result = run(factory, 3)
    assert result.persisted and result.status == "planned" and len(result.steps) == 3
    assert [step.snapshot_node_id for step in result.steps] == [int(nodes[i].split(":")[1]) for i in [1, 3, 5]]
    assert result.steps[1].planned_start_date >= result.steps[0].planned_end_date
    assert result.steps[2].planned_start_date >= result.steps[1].planned_end_date


@pytest.mark.parametrize("mutation", ["empty", "duplicate", "wrong_default", "wrong_workshop", "cycle", "member_edge"])
def test_invalid_graph_rejected(mutation):
    data = graph_payload(mode="explicit")
    group = data["variant_groups"][0]
    if mutation == "empty":
        group["members"] = []
    elif mutation == "duplicate":
        data["variant_groups"].append({**deepcopy(group), "id": "duplicate"})
    elif mutation == "wrong_default":
        group["default_operation_node_id"] = "before"
    elif mutation == "wrong_workshop":
        group["workshop_id"] = 2
    elif mutation == "cycle":
        data["edges"].append(dict(predecessor_node_id="after", successor_node_id="before"))
    else:
        data["edges"][0]["successor_node_id"] = "manual"
    with pytest.raises(ValidationError):
        RoutingGraph.model_validate(data)


def test_no_default_blocks_without_guessing(scheduler):
    factory, _ = scheduler
    seed_variant(factory, None)
    result = run(factory, 3)
    assert result.status == "blocked" and result.deviations[0].code == "variant_not_selected"
    with factory() as db:
        assert read_technical_card_demand(db, 3).issues[0].reason_code == "variant_not_selected"
        assert db.scalar(select(func.count()).select_from(CalendarAssignment).where(CalendarAssignment.technical_card_id == 3)) == 0


def test_no_default_cannot_complete_workshop_and_first_selection_unblocks(scheduler):
    factory, _ = scheduler
    nodes = seed_variant(factory, None)
    with factory() as db:
        card = db.get(TechnicalCard, 3)
        for position in [1, 5]:
            db.get(TechnicalCardStageResult, int(nodes[position].split(":")[1])).status = "completed"
        _sync_current_stage(card)
        _maybe_complete_card(card)
        assert card.status != "completed" and card.current_stage_order in {2, 3, 4}
    result = patch(factory, nodes[4])
    assert result.plan.persisted and result.selection.selected_at


def test_blocked_replan_keeps_new_choice_and_returns_explicit_blocker(scheduler):
    factory, _ = scheduler
    nodes = seed_variant(factory)
    run(factory, 3)
    with factory() as db:
        db.get(CapacityResource, "laser").base_rate = None
        db.commit()
    result = patch(factory, nodes[4])
    assert result.requires_replan and result.plan.status == "blocked"
    with factory() as db:
        assert read_variant_selections(db, 3)[0].selected_operation_snapshot_node_id == nodes[4]
        assert not db.scalar(select(CalendarAssignment).where(CalendarAssignment.stage_result_id == int(nodes[3].split(":")[1])))


def test_change_releases_old_capacity_replans_and_confirms(scheduler):
    factory, _ = scheduler
    nodes = seed_variant(factory)
    first = run(factory, 3)
    changed = patch(factory, nodes[4])
    assert changed.plan.persisted and not changed.requires_replan and changed.plan.planned_completion_date
    assert set(step.snapshot_node_id for step in changed.plan.steps) == {int(nodes[i].split(":")[1]) for i in [1, 4, 5]}
    with factory() as db:
        rows = list(db.scalars(select(CalendarAssignment).where(CalendarAssignment.technical_card_id == 3)))
        assert all(row.stage_result_id != int(nodes[3].split(":")[1]) for row in rows)
        allocations = list(db.execute(select(CalendarAllocation, CalendarAssignment).join(CalendarAssignment).where(CalendarAssignment.technical_card_id == 3)))
        laser = [(allocation, assignment) for allocation, assignment in allocations if allocation.resource_key == "laser"]
        assert len(laser) == 1 and laser[0][1].stage_result_id == int(nodes[4].split(":")[1])
        assert len(read_technical_card_demand(db, 3).steps) == 3
    confirmation = patch(factory, nodes[4], status="confirmed")
    assert not confirmation.requires_replan and confirmation.selection.confirmation_at
    assert run(factory, 3).status == "planned"
    with factory() as db:
        assert {event.action for event in db.scalars(select(AuditEvent).where(
            AuditEvent.action.like("technical_card.variant.%")))} == {
                "technical_card.variant.selected", "technical_card.variant.changed", "technical_card.variant.confirmed"}
        removed = list(db.scalars(select(AuditEvent).where(AuditEvent.action == "calendar.assignment_deleted")))
        assert any(event.payload["reason"] == "route_variant_changed" and
                   event.payload["snapshot_node_id"] == int(nodes[3].split(":")[1]) for event in removed)
    assert first.steps[1].snapshot_node_id != changed.plan.steps[1].snapshot_node_id


def test_change_without_replan_returns_forecast_and_requires_replan(scheduler):
    factory, _ = scheduler
    nodes = seed_variant(factory)
    run(factory, 3)
    changed = patch(factory, nodes[4], replan=False)
    assert changed.requires_replan and changed.plan.status == "planned" and not changed.plan.persisted
    assert run(factory, 3).persisted


@pytest.mark.parametrize("protection", ["in_progress", "completed", "manual", "locked", "card_locked"])
def test_protected_variant_cannot_change(scheduler, protection):
    factory, _ = scheduler
    nodes = seed_variant(factory)
    run(factory, 3)
    with factory() as db:
        old = int(nodes[3].split(":")[1])
        if protection in {"in_progress", "completed"}:
            db.get(TechnicalCardStageResult, old).status = protection
        elif protection == "card_locked":
            db.get(TechnicalCard, 3).plan_locked = True
        else:
            assignment = db.scalar(select(CalendarAssignment).where(CalendarAssignment.stage_result_id == old))
            if protection == "manual":
                assignment.planning_mode = "manual_adjusted"
            else:
                assignment.planning_mode = "locked"
            assignment.manual_lock = True
        db.commit()
        before = [(row.id, row.stage_result_id) for row in db.scalars(select(CalendarAssignment).where(CalendarAssignment.technical_card_id == 3))]
    with pytest.raises(TechnicalCardConflictError):
        patch(factory, nodes[4])
    with factory() as db:
        assert read_variant_selections(db, 3)[0].selected_operation_snapshot_node_id == nodes[3]
        assert [(row.id, row.stage_result_id) for row in db.scalars(select(CalendarAssignment).where(CalendarAssignment.technical_card_id == 3))] == before


def test_unselected_members_do_not_block_workshop_or_card_completion(scheduler):
    factory, _ = scheduler
    nodes = seed_variant(factory)
    with factory() as db:
        card = db.get(TechnicalCard, 3)
        for position in [1, 5]:
            db.get(TechnicalCardStageResult, int(nodes[position].split(":")[1])).status = "completed"
        _sync_current_stage(card)
        assert card.current_stage_order == 3
        _maybe_complete_card(card)
        assert card.status != "completed"
        selected = db.get(TechnicalCardStageResult, int(nodes[3].split(":")[1]))
        selected.status = "completed"
        _sync_current_stage(card)
        _maybe_complete_card(card)
        assert card.status == "completed"
        assert all(db.get(TechnicalCardStageResult, int(nodes[position].split(":")[1])).status == "pending" for position in [2, 4])
        assert read_card_graph(db, 3).workshop_progress[0].all_required_completed


def test_fact_gates_follow_selected_dependencies(scheduler):
    factory, _ = scheduler
    nodes = seed_variant(factory)
    with factory() as db:
        card = db.get(TechnicalCard, 3)
        after = db.get(TechnicalCardStageResult, int(nodes[5].split(":")[1]))
        with pytest.raises(TechnicalCardValidationError):
            _previous_stages_completed(db, card, after)
        db.get(TechnicalCardStageResult, int(nodes[3].split(":")[1])).status = "completed"
        _previous_stages_completed(db, card, after)
    with factory() as db:
        with pytest.raises(Exception, match="Stage 2 not found"):
            start_stage(db, 3, 2)


def test_template_edits_leave_card_snapshot_and_selection_immutable(scheduler):
    factory, _ = scheduler
    seed_variant(factory)
    with factory() as db:
        before = deepcopy(db.get(TechnicalCard, 3).route_variant_groups)
        selection = deepcopy(db.get(TechnicalCard, 3).route_variant_selections)
        data = graph_payload("laser")
        data["variant_groups"][0]["name"] = "Changed template"
        save_routing_graph(db, 1, RoutingGraph.model_validate(data))
        db.expire_all()
        assert db.get(TechnicalCard, 3).route_variant_groups == before
        assert db.get(TechnicalCard, 3).route_variant_selections == selection
    assert run(factory, 3).status == "planned"


def test_mass_scheduler_mixes_ordinary_preliminary_and_confirmed(scheduler):
    factory, _ = scheduler
    nodes = seed_variant(factory)
    patch(factory, nodes[4], status="confirmed")
    with factory() as db:
        card = TechnicalCard(id=4, order_group_id=1, card_seq=4, number="VAR-4", quantity=20, routing_template_id=1,
                             planning_start_date=TODAY, shipping_date=TODAY + timedelta(days=20))
        db.add(card)
        db.flush()
        assert copy_template_snapshot(db, card)
        db.commit()
        result = schedule_queue(db, today=TODAY)
        assert result.planned_cards == 4 and result.blocked_cards == 0
        assert read_variant_selections(db, 4)[0].selection_status == "preliminary"
        own = list(db.scalars(select(CalendarAssignment).where(CalendarAssignment.technical_card_id == 3)))
        assert {row.stage_result_id for row in own} == {int(nodes[i].split(":")[1]) for i in [1, 4, 5]}


def test_explicit_independent_nodes_do_not_become_sequential_after_resolution(scheduler):
    from app.services.production_demand_snapshot import load_card_demand_snapshot
    factory, _ = scheduler
    seed_variant(factory)
    with factory() as db:
        data = graph_payload(mode="explicit")
        data["edges"] = []
        save_routing_graph(db, 1, RoutingGraph.model_validate(data))
        card = TechnicalCard(id=4, order_group_id=1, card_seq=4, number="VAR-4", quantity=20, routing_template_id=1,
                             planning_start_date=TODAY, shipping_date=TODAY + timedelta(days=20))
        db.add(card)
        db.flush()
        assert copy_template_snapshot(db, card)
        db.commit()
        effective = resolve_effective_route_snapshot(db, 4)
        assert not effective.graph.edges and len(effective.graph.nodes) == 3
        assert all(not step.predecessor_ids for step in load_card_demand_snapshot(db, 4).steps)
        _previous_stages_completed(db, card, card.stage_results[-1])


def test_graph_save_validation_is_atomic_and_retains_line_identity(scheduler):
    from app.models.shop_routing import ShopRoutingStageLine
    from app.services.shop_routings import ShopRoutingValidationError
    factory, _ = scheduler
    seed_variant(factory)
    with factory() as db:
        before = read_template_graph(db, 1)
        identities = list(db.scalars(select(ShopRoutingStageLine.id).where(ShopRoutingStageLine.routing_template_id == 1).order_by(ShopRoutingStageLine.stage_order)))
        data = graph_payload()
        data["nodes"][0]["tech_operation_id"] = 999999
        with pytest.raises(ShopRoutingValidationError):
            save_routing_graph(db, 1, RoutingGraph.model_validate(data))
        assert read_template_graph(db, 1) == before
        save_routing_graph(db, 1, RoutingGraph.model_validate(graph_payload("laser")))
        assert list(db.scalars(select(ShopRoutingStageLine.id).where(ShopRoutingStageLine.routing_template_id == 1).order_by(ShopRoutingStageLine.stage_order))) == identities


def test_api_graph_save_selection_read_confirm_and_wrong_member(scenario_api):
    factory, client = scenario_api
    nodes = seed_variant(factory)
    # Persist actor so the existing audit FK is exercised.
    from app.models.auth import PlatformUser
    with factory() as db:
        db.add(PlatformUser(id=90, login="scenario-planner", display_name="Planner", password_hash="test"))
        db.commit()
    response = client.get("/technical-cards/3/route-variants")
    assert response.status_code == 200 and response.json()[0]["selection_status"] == "preliminary"
    response = client.patch("/technical-cards/3/route-variants/cutting", json=dict(selected_operation_snapshot_node_id=nodes[3], selection_status="confirmed"))
    assert response.status_code == 200 and response.json()["selection"]["confirmation_by"] == 90
    assert client.patch("/technical-cards/3/route-variants/cutting", json=dict(selected_operation_snapshot_node_id=nodes[1])).status_code == 422
    response = client.put("/shop-routings/1/graph", json=graph_payload(mode="explicit"))
    assert response.status_code == 200 and len(response.json()["graph"]["variant_groups"]) == 1
