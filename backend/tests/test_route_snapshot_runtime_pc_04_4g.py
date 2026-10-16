"""PC-04.4G-B/C: card snapshot is the scheduler and workshop runtime source."""
from datetime import timedelta

from sqlalchemy import event, func, select
from sqlalchemy.exc import IntegrityError

from tests.test_production_scheduler_pc_04_3a import TODAY, scheduler, run
from app.models.calendar_assignment import CalendarAssignment
from app.models.shop_routing import ShopRoutingNodeDependency, ShopRoutingStageLine, ShopRoutingTemplate
from app.models.tech_operation import TechOperation
from app.models.technical_card import TechnicalCard, TechnicalCardRouteEdge, TechnicalCardStageResult
from app.schemas.routing_graph import RoutingDependency, RoutingGraph, RoutingOperationNode, RoutingWorkshop
from app.services.production_demand_snapshot import load_card_demand_snapshot
from app.services.production_scheduler import schedule_card
from app.services.route_snapshot import append_snapshot_line, copy_template_snapshot, validate_template_graph
from app.services.technical_card_stages import _previous_stages_completed, _sync_current_stage
from app.services.technical_cards import TechnicalCardValidationError
import pytest


def test_template_edit_does_not_change_an_existing_snapshot(scheduler):
    factory, _ = scheduler
    before = run(factory)
    assert len(before.steps) == 1
    with factory() as db:
        original = [(row.stage_order, row.tech_operation_id, row.source_routing_stage_line_id) for row in db.scalars(
            select(TechnicalCardStageResult).where(TechnicalCardStageResult.technical_card_id == 1).order_by(TechnicalCardStageResult.stage_order)
        )]
        edges = db.scalar(select(func.count()).select_from(TechnicalCardRouteEdge).where(TechnicalCardRouteEdge.technical_card_id == 1))
        db.add(TechOperation(id=3, name="Added", code="added", volume_unit="pieces", production_stage_id=1))
        db.flush()
        db.add(ShopRoutingStageLine(id=3, routing_template_id=1, stage_order=3, stage_label="Added", production_stage_id=2, tech_operation_id=3))
        db.get(ShopRoutingStageLine, 1).stage_order = 5
        db.commit()
    after = run(factory)
    assert len(after.steps) == 1 and after.steps[0].routing_stage_line_id == before.steps[0].routing_stage_line_id
    with factory() as db:
        assert [(row.stage_order, row.tech_operation_id, row.source_routing_stage_line_id) for row in db.scalars(
            select(TechnicalCardStageResult).where(TechnicalCardStageResult.technical_card_id == 1).order_by(TechnicalCardStageResult.stage_order)
        )] == original
        assert db.scalar(select(func.count()).select_from(TechnicalCardRouteEdge).where(TechnicalCardRouteEdge.technical_card_id == 1)) == edges
        card = TechnicalCard(id=3, order_group_id=1, card_seq=3, number="SCHED-3", quantity=100, routing_template_id=1,
                             planning_start_date=TODAY, shipping_date=TODAY + timedelta(days=15))
        db.add(card)
        db.flush()
        assert copy_template_snapshot(db, card)
        db.commit()
        assert {row.source_routing_stage_line_id for row in card.stage_results} == {1, 3}
        assert {row.source_routing_stage_line_id for row in db.scalars(select(TechnicalCardStageResult).where(TechnicalCardStageResult.technical_card_id == 1))} == {1}


def test_parallel_and_join_use_snapshot_edges(scheduler):
    factory, _ = scheduler
    with factory() as db:
        db.add(TechOperation(id=20, name="Branch", code="branch", volume_unit="pieces", production_stage_id=1))
        db.add(TechOperation(id=21, name="Join", code="join", volume_unit="pieces", production_stage_id=2))
        db.flush()
        root = db.scalar(select(TechnicalCardStageResult).where(TechnicalCardStageResult.technical_card_id == 1))
        branch_line = ShopRoutingStageLine(id=2, routing_template_id=1, stage_order=2, stage_label="Production", production_stage_id=1, tech_operation_id=20)
        other_line = ShopRoutingStageLine(id=3, routing_template_id=1, stage_order=3, stage_label="Production", production_stage_id=1, tech_operation_id=20)
        join_line = ShopRoutingStageLine(id=4, routing_template_id=1, stage_order=4, stage_label="Packing", production_stage_id=2, tech_operation_id=21)
        db.add_all([branch_line, other_line, join_line])
        db.flush()
        from app.services.route_snapshot import append_snapshot_line
        card = db.get(TechnicalCard, 1)
        branch = append_snapshot_line(db, card, branch_line)
        other = append_snapshot_line(db, card, other_line)
        join = append_snapshot_line(db, card, join_line)
        db.add_all([
            TechnicalCardRouteEdge(technical_card_id=1, predecessor_stage_result_id=root.id, successor_stage_result_id=branch.id),
            TechnicalCardRouteEdge(technical_card_id=1, predecessor_stage_result_id=root.id, successor_stage_result_id=other.id),
            TechnicalCardRouteEdge(technical_card_id=1, predecessor_stage_result_id=branch.id, successor_stage_result_id=join.id),
            TechnicalCardRouteEdge(technical_card_id=1, predecessor_stage_result_id=other.id, successor_stage_result_id=join.id),
        ])
        from app.models.production_capacity import TechOperationCapacityResource
        db.add(TechOperationCapacityResource(tech_operation_id=20, resource_key="items"))
        db.add(TechOperationCapacityResource(tech_operation_id=21, resource_key="items"))
        card.quantity = 20
        # Finalize the deliberately constructed new DAG fixture as applied evidence.
        from app.services.route_verification import record_applied_route
        record_applied_route(db, card)
        db.commit()
    result = run(factory)
    assert result.status == "planned" and len(result.steps) == 4
    by_line = {step.routing_stage_line_id: step for step in result.steps}
    assert by_line[2].planned_start_date == by_line[3].planned_start_date
    assert by_line[2].planned_start_date >= by_line[1].planned_end_date
    assert by_line[4].planned_start_date >= max(by_line[2].planned_end_date, by_line[3].planned_end_date)


def test_assignment_points_at_snapshot_operation(scheduler):
    factory, _ = scheduler
    result = run(factory)
    with factory() as db:
        row = db.get(CalendarAssignment, result.steps[0].assignment_id)
        stage = db.scalar(select(TechnicalCardStageResult).where(TechnicalCardStageResult.technical_card_id == 1, TechnicalCardStageResult.tech_operation_id == 1))
        assert row.stage_result_id == stage.id
        assert row.routing_stage_line_id == stage.source_routing_stage_line_id
        assert row.planning_mode == "auto" and not row.manual_lock


def test_workshop_advances_only_after_all_required_children(scheduler):
    factory, _ = scheduler
    with factory() as db:
        db.add(TechOperation(id=30, name="Second", code="second", volume_unit="pieces", production_stage_id=1))
        db.add(TechOperation(id=31, name="Third", code="third", volume_unit="pieces", production_stage_id=1))
        db.add(TechOperation(id=32, name="Next shop", code="next-shop", volume_unit="pieces", production_stage_id=2))
        db.flush()
        from app.services.route_snapshot import append_snapshot_line
        card = db.get(TechnicalCard, 1)
        for index, operation_id, stage_id, label in [(2, 30, 1, "Production"), (3, 31, 1, "Production"), (4, 32, 2, "Packing")]:
            line = ShopRoutingStageLine(id=index, routing_template_id=1, stage_order=index, stage_label=label, production_stage_id=stage_id, tech_operation_id=operation_id)
            db.add(line)
            db.flush()
            append_snapshot_line(db, card, line)
        db.commit()

    def workshop_after(done):
        with factory() as db:
            card = db.get(TechnicalCard, 1)
            for stage in card.stage_results:
                if stage.tech_operation_id in done:
                    stage.status = "completed"
            _sync_current_stage(card)
            current = next(stage for stage in card.stage_results if stage.stage_order == card.current_stage_order)
            return current.production_stage_id

    assert workshop_after({1}) == 1
    assert workshop_after({1, 30}) == 1
    assert workshop_after({1, 30, 31}) == 2


def test_optional_skipped_predecessor_does_not_block(scheduler):
    factory, _ = scheduler
    with factory() as db:
        db.add(TechOperation(id=40, name="Optional next", code="opt-next", volume_unit="pieces", production_stage_id=1))
        db.flush()
        line = ShopRoutingStageLine(id=40, routing_template_id=1, stage_order=2, stage_label="Production", production_stage_id=1, tech_operation_id=40)
        db.add(line)
        db.flush()
        card = db.get(TechnicalCard, 1)
        second = append_snapshot_line(db, card, line)
        first = db.scalar(select(TechnicalCardStageResult).where(TechnicalCardStageResult.technical_card_id == 1, TechnicalCardStageResult.stage_order == 1))
        first.is_required = False
        first.status = "skipped"
        db.add(TechnicalCardRouteEdge(technical_card_id=1, predecessor_stage_result_id=first.id, successor_stage_result_id=second.id))
        db.commit()
        _previous_stages_completed(db, card, second)
        first.is_required = True
        with pytest.raises(TechnicalCardValidationError):
            _previous_stages_completed(db, card, second)


def test_cross_template_and_missing_edge_are_rejected(scheduler):
    factory, _ = scheduler
    with factory() as db:
        db.add(ShopRoutingTemplate(id=2, name="Other", code="other", is_active=True))
        db.add(TechOperation(id=41, name="Foreign", code="foreign", volume_unit="pieces", production_stage_id=1))
        db.flush()
        db.add(ShopRoutingStageLine(id=41, routing_template_id=2, stage_order=1, stage_label="Production", production_stage_id=1, tech_operation_id=41))
        db.flush()
        db.add(ShopRoutingNodeDependency(routing_template_id=1, predecessor_line_id=41, successor_line_id=1))
        with pytest.raises(IntegrityError):
            db.commit()
    with factory() as db:
        db.add(ShopRoutingNodeDependency(routing_template_id=1, predecessor_line_id=1, successor_line_id=999))
        with pytest.raises(IntegrityError):
            db.commit()


def test_unknown_graph_edge_is_rejected():
    with pytest.raises(ValueError, match="distinct nodes"):
        RoutingGraph(
            workshops=(RoutingWorkshop(workshop_id=1),),
            nodes=(RoutingOperationNode(id="a", workshop_id=1, tech_operation_id=1, position=1),),
            dependency_mode="explicit",
            edges=(RoutingDependency(predecessor_node_id="a", successor_node_id="missing"),),
        )


def test_invalid_explicit_template_is_rejected(scheduler):
    factory, _ = scheduler
    with factory() as db:
        db.add(TechOperation(id=8, name="Cycle", code="cycle", volume_unit="pieces", production_stage_id=1))
        db.flush()
        db.add(ShopRoutingStageLine(id=8, routing_template_id=1, stage_order=8, stage_label="Production", production_stage_id=1, tech_operation_id=8))
        template = db.get(ShopRoutingTemplate, 1)
        template.dependency_mode = "explicit"
        db.add_all([
            ShopRoutingNodeDependency(routing_template_id=1, predecessor_line_id=1, successor_line_id=8),
            ShopRoutingNodeDependency(routing_template_id=1, predecessor_line_id=8, successor_line_id=1),
        ])
        db.commit()
    with factory() as db:
        with pytest.raises(TechnicalCardValidationError):
            validate_template_graph(db, db.get(ShopRoutingTemplate, 1))


def test_snapshot_load_is_not_per_operation(scheduler):
    factory, engine = scheduler
    statements = []
    def track(_, __, sql, ___, ____, _____):
        if sql.lstrip().upper().startswith("SELECT"):
            statements.append(sql)
    event.listen(engine, "before_cursor_execute", track)
    try:
        with factory() as db:
            load_card_demand_snapshot(db, 1)
            one = len(statements)
            statements.clear()
            load_card_demand_snapshot(db, 1)
            assert len(statements) == one
            assert one <= 12
    finally:
        event.remove(engine, "before_cursor_execute", track)


def test_mass_schedule_keeps_each_card_snapshot(scheduler):
    factory, _ = scheduler
    with factory() as db:
        db.add(TechOperation(id=9, name="Only new", code="only-new", volume_unit="pieces", production_stage_id=1))
        db.flush()
        line = ShopRoutingStageLine(id=9, routing_template_id=1, stage_order=9, stage_label="Production", production_stage_id=1, tech_operation_id=9)
        db.add(line)
        db.flush()
        from app.models.production_capacity import TechOperationCapacityResource
        db.add(TechOperationCapacityResource(tech_operation_id=9, resource_key="items"))
        card = TechnicalCard(id=4, order_group_id=1, card_seq=4, number="SCHED-4", quantity=100, routing_template_id=1,
                             planning_start_date=TODAY, shipping_date=TODAY + timedelta(days=15))
        db.add(card)
        db.flush()
        copy_template_snapshot(db, card)
        db.commit()
    with factory() as db:
        first = schedule_card(db, 1, today=TODAY)
        second = schedule_card(db, 4, today=TODAY)
        db.commit()
    assert len(first.steps) == 1
    assert {step.routing_stage_line_id for step in second.steps} == {1, 9}
