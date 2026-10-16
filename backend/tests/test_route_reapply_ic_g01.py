from datetime import datetime, timezone
import json

import pytest
from sqlalchemy import select, event

from tests.test_production_scheduler_pc_04_3a import scheduler, run, add_step
from tests.test_scheduler_scenarios_pc_04_3c import scenario_api
from app.models.audit import AuditEvent
from app.models.calendar_assignment import CalendarAssignment
from app.models.calendar_allocation import CalendarAllocation
from app.models.shop_routing import ShopRoutingStageLine, ShopRoutingTemplate, ShopRoutingNodeDependency
from app.models.technical_card import TechnicalCard, TechnicalCardRouteEdge
from app.services.technical_card_stages import start_stage, complete_stage, update_stage_fact
from app.services.technical_cards import apply_routing_template
from app.schemas.technical_card import TechnicalCardStageFactRequest
from app.services.route_reapply import RouteReapplyConflict, CODE
from app.services.production_diagnostics import card_diagnostics


def row_state(row):
    def normalized(value):
        if isinstance(value, datetime):
            return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
        return value
    return {col.name: normalized(getattr(row,col.name)) for col in row.__table__.columns}


def fingerprint(db, card_id=1):
    card = db.get(TechnicalCard,card_id)
    return dict(stages=[row_state(s) for s in card.stage_results],
                volumes=[row_state(s) for s in card.operation_lines],
                assignments=[row_state(s) for s in db.scalars(select(CalendarAssignment).where(CalendarAssignment.technical_card_id==card_id))],
                allocations=[row_state(s) for s in db.scalars(select(CalendarAllocation))],
                audit=[row_state(s) for s in db.scalars(select(AuditEvent))])


@pytest.mark.parametrize("status", ["in_progress", "completed"])
def test_identical_reapply_preserves_fact_node_inputs_plan_and_audit(scheduler,status):
    factory,_ = scheduler
    plan = run(factory)
    with factory() as db:
        start_stage(db,1,1)
        update_stage_fact(db,1,1,TechnicalCardStageFactRequest(performer_name="Operator",work_done="Recorded",duration_seconds=60,notes="Fact",scrap_qty=0,rework_qty=0))
        if status=="completed":
            complete_stage(db,1,1)
        before = fingerprint(db)
        card = apply_routing_template(db,1,1)
        assert card.stage_results[0].status == status
        assert fingerprint(db) == before
        assert db.get(CalendarAssignment,plan.steps[0].assignment_id).stage_result_id == card.stage_results[0].id


@pytest.mark.parametrize("field,value", [("tech_operation_id",2),("production_stage_id",2),("stage_order",2),
                                        ("is_required",False),("stage_label","Changed")])
def test_protected_node_change_rejected_without_business_or_audit_writes(scheduler,field,value):
    factory,engine = scheduler
    run(factory)
    with factory() as db:
        start_stage(db,1,1)
        setattr(db.get(ShopRoutingStageLine,1),field,value)
        db.commit()
        before=fingerprint(db)
        writes=[]
        def track(conn,cursor,statement,parameters,context,executemany):
            if statement.lstrip().upper().startswith(("INSERT","UPDATE","DELETE")):
                writes.append(statement)
        event.listen(engine,"before_cursor_execute",track)
        try:
            with pytest.raises(RouteReapplyConflict) as error:
                apply_routing_template(db,1,1)
            assert error.value.code==CODE and error.value.category=="INTEGRITY"
            assert field in error.value.diagnostics[0].debug_details["attempted_changes"]
            assert fingerprint(db)==before and not writes
        finally:
            event.remove(engine,"before_cursor_execute",track)


def test_removed_started_node_rejected_and_debug_center_has_same_detail(scheduler):
    factory,_ = scheduler
    run(factory)
    with factory() as db:
        card=start_stage(db,1,1)
        # Stable line identity, but the new graph omits the old operation.
        line=db.get(ShopRoutingStageLine,1)
        line.tech_operation_id=None
        db.commit()
        with pytest.raises(RouteReapplyConflict) as error:
            apply_routing_template(db,1,1)
        issue=next(d for d in card_diagnostics(db,1).diagnostics if d.code==CODE)
        assert issue.debug_details==error.value.diagnostics[0].debug_details
        assert issue.debug_details["snapshot_node_id"]==card.stage_results[0].id
        assert issue.operation_id==1 and issue.fix_action and issue.category=="INTEGRITY"


def test_future_only_change_allowed_and_completed_prefix_keeps_id_and_edge(scheduler):
    factory,_ = scheduler
    add_step(factory)
    run(factory)
    with factory() as db:
        complete_stage(db,1,1)
        card=db.get(TechnicalCard,1)
        before=row_state(card.stage_results[0])
        assignments={a.stage_result_id:row_state(a) for a in db.scalars(select(CalendarAssignment))}
        line=db.get(ShopRoutingStageLine,2)
        line.stage_label="Future label"
        db.commit()
        card=apply_routing_template(db,1,1)
        assert row_state(card.stage_results[0])==before
        future=card.stage_results[1]
        assert future.stage_label=="Future label" and future.status=="pending"
        assert row_state(db.scalar(select(CalendarAssignment).where(CalendarAssignment.stage_result_id==before["id"])))==assignments[before["id"]]
        edges=list(db.scalars(select(TechnicalCardRouteEdge)))
        assert len(edges)==1 and edges[0].predecessor_stage_result_id==before["id"] and edges[0].successor_stage_result_id==future.id
        assert all(db.get(CalendarAssignment,a.assignment_id) is not None for a in db.scalars(select(CalendarAllocation)))


def test_new_predecessor_of_started_step_rejected(scheduler):
    factory,_ = scheduler
    add_step(factory)
    run(factory)
    with factory() as db:
        start_stage(db,1,1)
        template=db.get(ShopRoutingTemplate,1)
        template.dependency_mode="explicit"
        db.add(ShopRoutingNodeDependency(routing_template_id=1,predecessor_line_id=2,successor_line_id=1))
        db.commit()
        with pytest.raises(RouteReapplyConflict) as error:
            apply_routing_template(db,1,1)
        assert "protected_predecessors_changed" in error.value.diagnostics[0].debug_details["attempted_changes"]


@pytest.mark.parametrize("legacy", ["known_operation", "bare_fact"])
def test_legacy_snapshot_never_infers_or_replaces_fact_identity(scheduler,legacy):
    factory,_ = scheduler
    with factory() as db:
        card=db.get(TechnicalCard,1)
        stage=card.stage_results[0]
        stage.source_routing_stage_line_id=None
        if legacy=="bare_fact": stage.tech_operation_id=None
        stage.status="in_progress"
        stage.started_at=datetime.now(timezone.utc)
        db.commit()
        before=row_state(stage)
        if legacy=="bare_fact":
            with pytest.raises(RouteReapplyConflict): apply_routing_template(db,1,1)
        else:
            apply_routing_template(db,1,1)
        assert row_state(stage)==before


def test_recorded_fact_fields_on_pending_node_are_protected(scheduler):
    factory,_ = scheduler
    with factory() as db:
        card=db.get(TechnicalCard,1)
        card.stage_results[0].duration_seconds=0
        db.commit()
        before=row_state(card.stage_results[0])
        apply_routing_template(db,1,1)
        assert row_state(card.stage_results[0])==before
        db.get(ShopRoutingStageLine,1).tech_operation_id=2
        db.commit()
        with pytest.raises(RouteReapplyConflict): apply_routing_template(db,1,1)


@pytest.mark.parametrize("change_default", [False,True])
def test_started_one_of_choice_is_preserved_or_conflicts(scheduler,change_default):
    from tests.test_route_variants_pc_04_4i import seed_variant
    factory,_ = scheduler
    nodes=seed_variant(factory)
    run(factory,card=3)
    with factory() as db:
        card=db.get(TechnicalCard,3)
        selected_id=int(nodes[3].split(":")[1])
        stage=next(s for s in card.stage_results if s.id==selected_id)
        stage.status="in_progress"
        stage.started_at=datetime.now(timezone.utc)
        card.status="in_progress"
        db.commit()
        before=fingerprint(db,3)
        selection=dict(card.route_variant_selections)
        if change_default:
            template=db.get(ShopRoutingTemplate,card.routing_template_id)
            raw=[dict(g) for g in template.route_variant_groups]
            group=raw[0]
            group["default_operation_node_id"]=next(m["operation_node_id"] for m in group["members"] if m["operation_node_id"]!=group["default_operation_node_id"])
            template.route_variant_groups=raw
            db.commit()
            with pytest.raises(RouteReapplyConflict) as error: apply_routing_template(db,3,card.routing_template_id)
            assert "started_one_of_choice_changed" in error.value.diagnostics[0].debug_details["attempted_changes"]
        else:
            apply_routing_template(db,3,card.routing_template_id)
        assert card.route_variant_selections==selection
        assert row_state(stage)==next(s for s in before["stages"] if s["id"]==selected_id)


def test_conflict_http_contract_keeps_string_message_and_machine_details(scheduler):
    from app.api.technical_cards import _http_error
    factory,_ = scheduler
    run(factory)
    with factory() as db:
        start_stage(db,1,1)
        db.get(ShopRoutingStageLine,1).tech_operation_id=2
        db.commit()
        with pytest.raises(RouteReapplyConflict) as error: apply_routing_template(db,1,1)
        response=_http_error(error.value)
        assert response.status_code==409 and isinstance(response.detail,str)
        assert response.headers["X-Diagnostic-Code"]==CODE
        assert response.headers["X-Diagnostic-Category"]=="INTEGRITY"
        assert json.loads(response.headers["X-Diagnostic-Details"])[0]["operation_id"]==1


def test_reapply_http_rejects_before_plan_fact_and_audit_mutation(scenario_api):
    factory, client = scenario_api
    run(factory)
    with factory() as db:
        start_stage(db, 1, 1)
        db.get(ShopRoutingStageLine, 1).tech_operation_id = 2
        db.commit()
        before = fingerprint(db)
    response = client.post("/technical-cards/1/apply-routing", json={"routing_template_id": 1})
    assert response.status_code == 409
    assert response.headers["X-Diagnostic-Code"] == CODE
    assert response.headers["X-Diagnostic-Category"] == "INTEGRITY"
    assert isinstance(response.json()["detail"], str)
    with factory() as db:
        assert fingerprint(db) == before


@pytest.mark.parametrize("evidence", ["material", "wip", "volume", "sewing_ledger"])
def test_confirmed_fact_sources_and_manual_volume_survive_reapply(scheduler, evidence):
    from app.models.technical_card import (
        TechnicalCardCompositionLine, TechnicalCardUnitLine, TechnicalCardOperationLine,
    )
    factory, _ = scheduler
    with factory() as db:
        card = db.get(TechnicalCard, 1)
        if evidence == "material":
            row = TechnicalCardCompositionLine(sequence=1, snapshot_name="Material",
                production_stage_id=1, fact_qty=0)
            card.composition_lines.append(row)
        elif evidence == "wip":
            row = TechnicalCardUnitLine(unit_index=1, production_stage_id=1, last_transfer_kind="accept")
            card.unit_lines.append(row)
        else:
            if evidence == "volume":
                card.stage_results[0].work_done = "Confirmed"
            row = TechnicalCardOperationLine(sequence=1, source_kind="routing", tech_operation_id=1,
                operation_name="Items", stage_order=1, production_stage_id=1, volume_unit="pieces",
                volume=17, volume_qty_per_item=None)
            card.operation_lines.append(row)
            if evidence == "sewing_ledger":
                from app.models.auth import PlatformUser
                from app.models.sewing_work_ledger import SewingWorkLedgerEntry
                user = PlatformUser(login="fact-owner", display_name="Fact owner", password_hash="unused")
                db.add(user)
                db.flush()
                ledger = SewingWorkLedgerEntry(platform_user_id=user.id, technical_card_id=1,
                    operation_line_id=row.id, kind="operation", qty=1, status="completed",
                    completed_at=datetime.now(timezone.utc), unit_price=1, price_label="Applied price")
                db.add(ledger)
        db.commit()
        before, stage_before = row_state(row), row_state(card.stage_results[0])
        apply_routing_template(db, 1, 1)
        assert row_state(row) == before and row_state(card.stage_results[0]) == stage_before
        db.get(ShopRoutingStageLine, 1).tech_operation_id = 2
        db.commit()
        with pytest.raises(RouteReapplyConflict):
            apply_routing_template(db, 1, 1)
        assert row_state(row) == before


def test_started_confirmed_nondefault_choice_survives_identical_reapply(scheduler):
    from tests.test_route_variants_pc_04_4i import seed_variant
    factory, _ = scheduler
    nodes = seed_variant(factory)
    with factory() as db:
        card = db.get(TechnicalCard, 3)
        selected = nodes[2]
        confirmed = {"selected_operation_snapshot_node_id": selected, "selection_status": "confirmed",
            "selected_at": "2026-10-11T10:00:00+00:00", "selected_by": None,
            "confirmation_at": "2026-10-11T10:01:00+00:00", "confirmation_by": None}
        card.route_variant_selections = {"cutting": confirmed}
        stage = next(row for row in card.stage_results if f"snapshot:{row.id}" == selected)
        stage.status = "in_progress"
        db.commit()
        before = row_state(stage)
        apply_routing_template(db, 3, 1)
        assert card.route_variant_selections == {"cutting": confirmed}
        assert row_state(stage) == before
