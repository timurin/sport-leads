import pytest
from sqlalchemy import delete, select
from tests.test_production_scheduler_pc_04_3a import scheduler, run, add_step
from tests.test_route_reapply_ic_g01 import fingerprint
from app.models.audit import AuditEvent
from app.models.technical_card import TechnicalCard, TechnicalCardRouteEdge
from app.models.shop_routing import ShopRoutingTemplate
from app.services.route_verification import CODE, ENTITY, route_review_issue
from app.services.calendar_plan_linkage import PlanLinkageConflict
from app.services.route_reapply import RouteReapplyConflict
from app.services.technical_cards import apply_routing_template
from app.services.technical_card_stages import start_stage, complete_stage


def forget_manifest(db):
    db.execute(delete(AuditEvent).where(AuditEvent.entity_type == ENTITY))
    db.commit()


def test_legacy_route_blocks_schedule_start_and_explicit_refresh_allows_planning(scheduler):
    factory, _ = scheduler
    with factory() as db:
        forget_manifest(db)
        before = fingerprint(db)
        issue = route_review_issue(db, db.get(TechnicalCard, 1))
        assert issue.category == "INTEGRITY" and issue.fix_action == "Обновить маршрут"
        assert issue.reason == "manifest_missing" and issue.debug_details["verification_state"] == "unverified"
        assert not any(word in issue.message.lower() for word in ("snapshot", "legacy", "исторический снимок", "verified"))
        with pytest.raises(PlanLinkageConflict) as error: start_stage(db, 1, 1)
        assert error.value.code == CODE and fingerprint(db) == before
    blocked = run(factory)
    assert not blocked.persisted and blocked.deviations[0].reason == CODE
    with factory() as db:
        assert fingerprint(db) == before
        apply_routing_template(db, 1, 1)
        assert route_review_issue(db, db.get(TechnicalCard, 1)) is None
    assert run(factory).persisted
    with factory() as db: start_stage(db, 1, 1)


@pytest.mark.parametrize("status", ["in_progress", "completed"])
def test_unverified_fact_refresh_rejects_and_preserves_everything(scheduler, status):
    factory, _ = scheduler
    run(factory)
    with factory() as db:
        start_stage(db, 1, 1)
        if status == "completed": complete_stage(db, 1, 1)
        forget_manifest(db)
        before = fingerprint(db)
        issue = route_review_issue(db, db.get(TechnicalCard, 1))
        assert issue.fix_action == "Открыть маршрут" and issue.debug_details["protected_fact_nodes"]
        with pytest.raises(RouteReapplyConflict): apply_routing_template(db, 1, 1)
        db.rollback()
        assert fingerprint(db) == before
    assert run(factory).status == "blocked"


@pytest.mark.parametrize("corruption", ["required_node", "edge", "operation"])
def test_applied_manifest_detects_partial_or_changed_snapshot(scheduler, corruption):
    factory, _ = scheduler
    add_step(factory)
    with factory() as db:
        card = db.get(TechnicalCard, 1)
        if corruption == "required_node":
            row = card.stage_results[1]
            card.stage_results.remove(row)
            db.delete(row)
        elif corruption == "edge":
            # add_step is the explicit canonical append helper; its existing
            # graph is sequential fallback, so add then delete a frozen edge.
            from app.services.route_snapshot import _replace_edges
            _replace_edges(db, card, db.get(ShopRoutingTemplate, 1))
            from app.services.route_verification import record_applied_route
            record_applied_route(db, card)
            db.execute(delete(TechnicalCardRouteEdge).where(TechnicalCardRouteEdge.technical_card_id == 1))
        else:
            card.stage_results[1].tech_operation_id = 1
        db.commit()
        assert route_review_issue(db, card).reason == "applied_route_changed_or_manifest_invalid"
    assert run(factory).status == "blocked"


def test_live_template_edit_never_recovers_or_invalidates_old_route(scheduler):
    from app.models.shop_routing import ShopRoutingStageLine
    factory, _ = scheduler
    with factory() as db:
        db.get(ShopRoutingStageLine, 1).stage_label = "Live master changed"
        db.commit()
        assert route_review_issue(db, db.get(TechnicalCard, 1)) is None
        forget_manifest(db)
        assert route_review_issue(db, db.get(TechnicalCard, 1)).reason == "manifest_missing"


def test_diagnostics_exposes_manager_copy_and_debug_evidence(scheduler):
    from app.services.production_diagnostics import card_diagnostics
    factory, _ = scheduler
    with factory() as db:
        forget_manifest(db)
        issue = next(d for d in card_diagnostics(db, 1).diagnostics if d.code == CODE)
        assert issue.field_label == "Не удалось проверить производственный маршрут"
        assert issue.trace and issue.debug_details["snapshot_ids"]


def test_queue_and_manual_enqueue_cannot_create_assignments_for_unverified_route(scheduler):
    from app.services.production_queue_scheduler import schedule_queue
    from app.services.production_calendar import enqueue
    from app.schemas.production_calendar import AssignmentCreate
    from tests.test_production_scheduler_pc_04_3a import TODAY
    factory, _ = scheduler
    with factory() as db:
        forget_manifest(db)
        before = fingerprint(db)
        with pytest.raises(PlanLinkageConflict): enqueue(db, AssignmentCreate(technical_card_id=2, planned_date=TODAY))
        db.rollback()
        assert fingerprint(db) == before
        result = schedule_queue(db, today=TODAY)
        assert result.blocked_cards == 2 and result.planned_cards == 0
        assert fingerprint(db) == before


def test_manifest_is_atomic_with_apply_and_no_read_repair(scheduler):
    from app.services.route_verification import record_applied_route
    factory, _ = scheduler
    with factory() as db:
        forget_manifest(db)
        record_applied_route(db, db.get(TechnicalCard, 1))
        db.rollback()
        assert route_review_issue(db, db.get(TechnicalCard, 1)).reason == "manifest_missing"
        assert db.scalar(select(AuditEvent.id).where(AuditEvent.entity_type == ENTITY)) is None


@pytest.mark.parametrize("legacy", [False, True])
def test_invalid_route_groups_block_with_manager_diagnostic_not_server_error(scheduler, legacy):
    from app.services.production_diagnostics import card_diagnostics
    factory, _ = scheduler
    with factory() as db:
        if legacy: forget_manifest(db)
        card = db.get(TechnicalCard, 1)
        card.route_variant_groups = [{"invalid": True}]
        db.commit()
        assert card_diagnostics(db, 1).diagnostics[0].code == CODE
    assert run(factory).deviations[0].reason == CODE


def test_retained_operations_with_lost_route_binding_cannot_start(scheduler):
    factory, _ = scheduler
    run(factory)
    with factory() as db:
        db.get(TechnicalCard, 1).routing_template_id = None
        db.commit()
        with pytest.raises(PlanLinkageConflict) as error: start_stage(db, 1, 1)
        assert error.value.code == CODE
