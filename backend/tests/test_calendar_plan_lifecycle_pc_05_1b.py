from datetime import timedelta

import pytest
from sqlalchemy import select

from tests.test_production_scheduler_pc_04_3a import scheduler, TODAY, run
from app.models.audit import AuditEvent
from app.models.auth import PlatformUser
from app.models.calendar_assignment import CalendarAssignment
from app.models.technical_card import TechnicalCard
from app.schemas.production_calendar import AssignmentUpdate
from app.schemas.technical_card import TechnicalCardStageFactRequest
from app.services.calendar_diagnostics import card_calendar_evidence
from app.services.calendar_plan_lifecycle import (
    ENTITY, CannotStartWithoutSavedPlan, detach_for_nodes, detach_for_route_lines,
)
from app.services.production_calendar import remove, save
from app.services.technical_card_stages import start_stage, start_technical_card, complete_stage, update_stage_fact, rollback_stage


def events(db):
    return list(db.scalars(select(AuditEvent).where(AuditEvent.entity_type == ENTITY).order_by(AuditEvent.id)))


@pytest.mark.parametrize("command", [
    lambda db: start_technical_card(db, 1),
    lambda db: start_stage(db, 1, 1),
    lambda db: complete_stage(db, 1, 1),
    lambda db: update_stage_fact(db, 1, 1, TechnicalCardStageFactRequest(work_done="test")),
])
def test_all_implicit_start_paths_reject_missing_plan_without_mutation(scheduler, command):
    factory, _ = scheduler
    with factory() as db:
        with pytest.raises(CannotStartWithoutSavedPlan) as error:
            command(db)
        assert error.value.code == "cannot_start_without_saved_plan"
        assert error.value.category == "INTEGRITY"
        card = db.get(TechnicalCard, 1)
        assert card.status == "draft" and card.stage_results[0].status == "pending"
        assert card.stage_results[0].started_at is None and not events(db)


def test_launch_keeps_first_workshop_waiting(scheduler):
    factory, _ = scheduler
    from app.models.product_model import ProductModel
    with factory() as db:
        model = ProductModel(article="201.1", name="Launch fixture", size_type="men", status="active")
        db.add(model)
        db.flush()
        db.get(TechnicalCard, 1).product_model_id = model.id
        db.commit()
    run(factory)
    with factory() as db:
        start_technical_card(db, 1)
        card = db.get(TechnicalCard, 1)
        assert card.status == "draft"
        assert card.stage_results[0].status == "pending"
        assert card.stage_results[0].started_at is None


@pytest.mark.parametrize("mode,locked", [("auto", False), ("manual_adjusted", True), ("locked", True)])
def test_saved_plan_start_complete_and_reopen_emit_transactional_events(scheduler, mode, locked):
    factory, _ = scheduler
    plan = run(factory)
    with factory() as db:
        row = db.get(CalendarAssignment, plan.steps[0].assignment_id)
        row.planning_mode, row.manual_lock = mode, locked
        db.commit()
        start_stage(db, 1, 1)
        complete_stage(db, 1, 1)
        rollback_stage(db, 1, 1)
        recorded = events(db)
        assert [r.payload["event_type"] for r in recorded] == [
            "assignment_created", "operation_started", "operation_completed", "operation_started"]
        assert all(r.payload["calendar_assignment_id"] == row.id for r in recorded)
        assert all(r.payload["snapshot_node_id"] == plan.steps[0].snapshot_node_id for r in recorded)
        assert all(r.payload["tech_operation_id"] == 1 for r in recorded)
        assert recorded[1].payload["new_state"] == {"status": "in_progress"}
        assert recorded[2].payload["new_state"] == {"status": "completed"}


@pytest.mark.parametrize("field,value", [("stage_result_id", None), ("routing_stage_line_id", None), ("production_stage_id", 2)])
def test_invalid_binding_is_not_a_saved_operation_plan(scheduler, field, value):
    factory, _ = scheduler
    plan = run(factory)
    with factory() as db:
        setattr(db.get(CalendarAssignment, plan.steps[0].assignment_id), field, value)
        db.commit()
        with pytest.raises(CannotStartWithoutSavedPlan):
            start_stage(db, 1, 1)


def test_replan_has_before_after_and_old_assignment_id(scheduler):
    factory, _ = scheduler
    old = run(factory)
    new = run(factory)
    with factory() as db:
        recorded = events(db)
        assert [r.payload["event_type"] for r in recorded] == [
            "assignment_created", "assignment_deleted", "assignment_created", "assignment_replanned"]
        last = recorded[-1].payload
        assert last["previous_state"]["calendar_assignment_id"] == old.steps[0].assignment_id
        assert last["calendar_assignment_id"] == new.steps[0].assignment_id
        assert last["new_state"]["stage_result_id"] == new.steps[0].snapshot_node_id


def test_delete_audit_explains_started_missing_plan(scheduler):
    factory, _ = scheduler
    plan = run(factory)
    with factory() as db:
        remove(db, plan.steps[0].assignment_id)
        # Historical/direct-DB corruption remains diagnosable; IC-G02 forbids
        # this sequence through supported start/delete commands.
        db.get(TechnicalCard, 1).stage_results[0].status = "in_progress"
        issue = card_calendar_evidence(db, db.get(TechnicalCard, 1))[1][0]
        assert issue.reason == "assignment_deleted"
        assert issue.debug_details["calendar_assignment_id"] is None
        last = issue.debug_details["last_lifecycle_event"]
        assert last["source"] == "calendar_api" and last["occurred_at"]
        assert last["calendar_assignment_id"] == plan.steps[0].assignment_id
        assert last["reason"] == "explicit_assignment_delete"


@pytest.mark.parametrize("detach", ["snapshot", "route"])
def test_detach_event_preserves_identity_and_diagnostic(scheduler, detach):
    factory, _ = scheduler
    plan = run(factory)
    with factory() as db:
        card = db.get(TechnicalCard, 1)
        if detach == "snapshot":
            detach_for_nodes(db, [card.stage_results[0].id], reason="snapshot_reapplied")
        else:
            detach_for_route_lines(db, [card.stage_results[0].source_routing_stage_line_id])
        db.commit()
        card.stage_results[0].status = "in_progress"  # Deliberately corrupt legacy fixture.
        issue = card_calendar_evidence(db, card)[1][0]
        assert issue.reason == "assignment_deleted"
        assert any(e.payload["event_type"] == "assignment_detached" for e in events(db))
        assert issue.debug_details["last_lifecycle_event"]["calendar_assignment_id"] == plan.steps[0].assignment_id


def test_manual_move_and_detach_are_audited(scheduler):
    factory, _ = scheduler
    plan = run(factory)
    with factory() as db:
        save(db, AssignmentUpdate(production_stage_id=1, planned_date=TODAY,
             planned_end_date=TODAY + timedelta(days=1), position=0), plan.steps[0].assignment_id)
        assert events(db)[-1].payload["event_type"] == "assignment_replanned"
        from app.services.calendar_plan_linkage import PlanLinkageConflict
        with pytest.raises(PlanLinkageConflict):
            save(db, AssignmentUpdate(production_stage_id=2, planned_date=TODAY,
                 planned_end_date=TODAY, position=0, routing_stage_line_id=None), plan.steps[0].assignment_id)
        assert events(db)[-1].payload["event_type"] == "assignment_replanned"


def test_legacy_broken_fact_remains_unknown_without_audit(scheduler):
    factory, _ = scheduler
    with factory() as db:
        card = db.get(TechnicalCard, 1)
        card.stage_results[0].status = "in_progress"
        db.commit()
        issue = card_calendar_evidence(db, card)[1][0]
        assert issue.reason == "unknown"
        assert issue.debug_details["last_lifecycle_event"] is None


def test_dry_run_and_rollback_do_not_leave_lifecycle_events(scheduler):
    factory, _ = scheduler
    run(factory, persist=False)
    with factory() as db:
        assert not events(db)
        from app.services.production_scheduler import schedule_card_in_transaction
        plan = schedule_card_in_transaction(db, 1, persist=True, today=TODAY)
        assert plan.status == "planned"
        db.rollback()
    with factory() as db:
        assert not events(db)


def test_rejected_http_start_exposes_integrity_code(scheduler):
    from app.api.technical_cards import _http_error
    error = _http_error(CannotStartWithoutSavedPlan())
    assert error.status_code == 409
    assert error.headers["X-Diagnostic-Code"] == "cannot_start_without_saved_plan"
    assert error.headers["X-Diagnostic-Category"] == "INTEGRITY"
    assert "производственный план" in error.detail


def test_authenticated_actor_and_safe_payload_are_preserved(scheduler):
    factory, _ = scheduler
    with factory() as db:
        actor = PlatformUser(login="planner", password_hash="secret_hash", display_name="Planner", is_active=True)
        db.add(actor)
        db.flush()
        db.info["audit_actor"] = actor
        from app.services.production_scheduler import schedule_card
        plan = schedule_card(db, 1, today=TODAY)
        complete_stage(db, 1, 1, actor=actor)
        assert plan.persisted
        recorded = events(db)
        assert all(r.actor_platform_user_id == actor.id and r.actor_login == "planner" for r in recorded)
        assert "secret_hash" not in str([r.payload for r in recorded])


def test_existing_legacy_start_cannot_bypass_guard_through_fact_update(scheduler):
    factory, _ = scheduler
    with factory() as db:
        card = db.get(TechnicalCard, 1)
        card.status = "in_progress"
        card.current_stage_order = 1
        card.stage_results[0].status = "in_progress"
        db.commit()
        with pytest.raises(CannotStartWithoutSavedPlan):
            update_stage_fact(db, 1, 1, TechnicalCardStageFactRequest(work_done="fact"))
        assert card.stage_results[0].work_done is None


def test_real_template_line_deletion_emits_detach_before_fk_action(scheduler):
    factory, _ = scheduler
    plan = run(factory)
    with factory() as db:
        from app.services.shop_routings import update_routing_template
        from app.schemas.shop_routing import ShopRoutingTemplateUpdate
        update_routing_template(db, 1, ShopRoutingTemplateUpdate(stages=[{
            "stage_order": 1, "production_stage_id": 1, "tech_operation_id": 1}]))
        row = db.get(CalendarAssignment, plan.steps[0].assignment_id)
        assert row is None
        assert events(db)[-1].payload["event_type"] == "assignment_deleted"
        assert events(db)[-1].payload["previous_state"]["routing_stage_line_id"] == 1


def test_wip_sync_cannot_implicitly_start_without_saved_plan(scheduler):
    factory, _ = scheduler
    from app.models.technical_card import TechnicalCardUnitLine
    from app.services.tech_card_wip import sync_card_from_unit_locations
    with factory() as db:
        card = db.get(TechnicalCard, 1)
        card.unit_lines.append(TechnicalCardUnitLine(unit_index=1, production_stage_id=1))
        db.commit()
        with pytest.raises(CannotStartWithoutSavedPlan):
            sync_card_from_unit_locations(db, card)
        assert card.status == "draft" and card.stage_results[0].status == "pending"
        assert not events(db)


def test_wip_sync_writes_start_event_with_saved_plan(scheduler):
    factory, _ = scheduler
    from app.models.technical_card import TechnicalCardUnitLine
    from app.services.tech_card_wip import sync_card_from_unit_locations
    run(factory)
    with factory() as db:
        card = db.get(TechnicalCard, 1)
        card.unit_lines.append(TechnicalCardUnitLine(unit_index=1, production_stage_id=1))
        db.flush()
        sync_card_from_unit_locations(db, card)
        db.commit()
        assert events(db)[-1].payload["event_type"] == "operation_started"
        assert events(db)[-1].payload["reason"] == "unit_location_sync"
        assert events(db)[-1].source == "unit_wip"


def test_qr_rejects_missing_plan_with_integrity_code_and_no_unit_mutation(scheduler):
    from fastapi.testclient import TestClient
    from app.main import app
    from app.api.deps_auth import get_current_platform_user
    from app.database.session import get_db
    from app.models.technical_card import TechnicalCardUnitLine
    from app.models.stage_executors import platform_user_stage_access
    factory, _ = scheduler
    with factory() as db:
        user = PlatformUser(login="qr-operator", password_hash="test", display_name="QR", is_active=True, roles=[])
        db.add(user)
        card = db.get(TechnicalCard, 1)
        card.qr_token = "pc-05-1b-opaque-token"
        unit = TechnicalCardUnitLine(technical_card_id=1, unit_index=1, production_stage_id=1)
        db.add(unit)
        db.flush()
        db.execute(platform_user_stage_access.insert().values(platform_user_id=user.id, production_stage_id=1))
        db.commit()
        unit_id = unit.id
    def override_db():
        with factory() as db:
            yield db
    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_platform_user] = lambda: user
    try:
        with TestClient(app) as client:
            response = client.post("/tech-card-scan/pc-05-1b-opaque-token/accept", json={
                "unit_line_ids": [unit_id], "production_stage_id": 1})
            assert response.status_code == 409, response.text
            assert response.headers["X-Diagnostic-Code"] == "cannot_start_without_saved_plan"
            assert response.headers["X-Diagnostic-Category"] == "INTEGRITY"
            assert "производственный план" in response.json()["detail"]
        with factory() as db:
            assert db.get(TechnicalCardUnitLine, unit_id).last_transfer_kind is None
            assert db.get(TechnicalCard, 1).status == "draft"
            assert not events(db)
    finally:
        app.dependency_overrides.clear()


def test_wip_uses_selected_variant_route_and_does_not_require_excluded_plan(scheduler):
    from tests.test_route_variants_pc_04_4i import seed_variant
    from app.models.technical_card import TechnicalCardUnitLine
    from app.services.tech_card_wip import ordered_stages, sync_card_from_unit_locations
    from app.services.route_variants import selection_resolution
    factory, _ = scheduler
    seed_variant(factory)
    plan = run(factory, card=3)
    assert plan.persisted
    with factory() as db:
        card = db.get(TechnicalCard, 3)
        active = ordered_stages(card)
        excluded, _ = selection_resolution(card)
        assert not any(f"snapshot:{s.id}" in excluded for s in active)
        card.unit_lines.append(TechnicalCardUnitLine(unit_index=1, production_stage_id=active[0].production_stage_id))
        db.flush()
        sync_card_from_unit_locations(db, card)
        db.commit()
        assert all(s.status == "pending" for s in card.stage_results if f"snapshot:{s.id}" in excluded)
