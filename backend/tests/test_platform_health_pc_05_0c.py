"""Shared entity/platform diagnostics, real category distinctions and read-only API."""
from decimal import Decimal

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select, event

from tests.test_operation_input_population_pc_04_4t import inputs, create, TODAY
from tests.test_production_scheduler_pc_04_3a import scheduler
from app.api.platform_health import router, health_access
from app.api.deps_auth import get_current_platform_user
from app.database.session import get_db
from app.models.production_capacity import CapacityResource
from app.models.technical_card import TechnicalCard, TechnicalCardStageResult
from app.models.calendar_assignment import CalendarAssignment
from app.models.calendar_allocation import CalendarAllocation
from app.services.production_diagnostics import card_diagnostics
from app.services.platform_health import read_health


def test_configuration_and_same_diagnostic_across_views(inputs):
    with inputs() as db:
        card=create(db)
        db.get(CapacityResource,"sewers").hours_per_day=None
        db.commit()
        entity=next(r for r in card_diagnostics(db,card.id).diagnostics if r.code=="resource_capacity_not_configured")
        assert entity.category=="CONFIGURATION" and entity.field=="hours_per_day"
        platform=read_health(db)
        assert entity in platform.diagnostics
        assert entity.expected_source and entity.trace and entity.fix_url


def test_source_exists_but_route_snapshot_missing(inputs):
    with inputs() as db:
        card=create(db)
        for row in list(card.stage_results):
            card.stage_results.remove(row);db.delete(row)
        db.flush()
        issue=next(r for r in card_diagnostics(db,card.id).diagnostics if r.code=="route_requires_review_before_planning")
        assert issue.category=="INTEGRITY" and issue.source_value and issue.actual_value["nodes"]==[]
        assert any(step.broken for step in issue.trace)


def test_existing_norm_missing_copy_and_wrong_derived_total(inputs):
    with inputs() as db:
        card=create(db)
        line=next(r for r in card.operation_lines if r.tech_operation_id==1)
        line.volume=0;line.volume_qty_per_item=None;db.flush()
        issue=next(r for r in card_diagnostics(db,card.id).diagnostics if r.code=="operation_input_snapshot_missing")
        assert issue.category=="DATA_FLOW" and issue.source_value=="0.700"
        line.volume_qty_per_item=Decimal("0.700");line.volume=Decimal("99");db.flush()
        issue=next(r for r in card_diagnostics(db,card.id).diagnostics if r.code=="derived_volume_mismatch")
        assert issue.category=="DATA_FLOW" and issue.debug_details["expected_volume"]=="5.600"


def test_valid_inputs_exhausted_horizon_is_runtime(scheduler):
    factory,_=scheduler
    with factory() as db:
        # Valid throughput config, genuinely more work than the 120-day budget.
        db.get(TechnicalCard,1).quantity=Decimal("999999")
        db.commit()
        issue=next(r for r in card_diagnostics(db,1).diagnostics if r.code=="120_day_horizon_exhausted")
        assert issue.category=="RUNTIME" and issue.module=="scheduler"


def test_broken_soft_operation_reference_is_integrity(inputs):
    with inputs() as db:
        card=create(db)
        card.stage_results[0].tech_operation_id=9999;db.flush()
        issues=card_diagnostics(db,card.id).diagnostics
        assert any(r.category=="INTEGRITY" and r.code=="broken_reference" for r in issues)


def test_api_filters_counts_trace_and_no_writes(scheduler):
    factory,engine=scheduler
    app=FastAPI();app.include_router(router)
    app.dependency_overrides[get_current_platform_user]=lambda:object()
    app.dependency_overrides[health_access]=lambda:object()
    with factory() as db:
        db.get(CapacityResource,"items").hours_per_day=None;db.commit();card_id=1
    def session():
        with factory() as db:yield db
    app.dependency_overrides[get_db]=session
    writes=[]
    def track(conn,cursor,statement,parameters,context,executemany):
        if statement.lstrip().upper().startswith(("INSERT","UPDATE","DELETE")):writes.append(statement)
    event.listen(engine,"before_cursor_execute",track)
    try:
        with TestClient(app) as client:
            response=client.get('/platform-health',params={'category':'CONFIGURATION','module':'capacity','limit':1})
            assert response.status_code==200
            data=response.json();assert data['total']>=1 and len(data['diagnostics'])==1
            assert sum(data['counts_by_category'].values())==data['total']
            trace=client.get(f'/platform-health/technical-cards/{card_id}/trace');assert trace.status_code==200
            assert client.get('/platform-health',params={'category':'INVALID'}).status_code==422
            assert client.get('/platform-health/technical-cards/9999/trace').status_code==404
        assert not writes
    finally:event.remove(engine,"before_cursor_execute",track)


def test_malformed_variant_is_integrity_without_exposing_validation_payload(inputs):
    with inputs() as db:
        card=create(db);card.route_variant_groups=[{"secret":"do-not-expose"}];db.flush()
        result=card_diagnostics(db,card.id)
        assert result.diagnostics[0].category=="INTEGRITY"
        assert 'do-not-expose' not in result.model_dump_json()


def test_calendar_unit_mismatch_is_integrity(scheduler):
    factory,_=scheduler
    with factory() as db:
        db.add(CalendarAllocation(assignment_id=10,resource_key="items",date=TODAY,allocated_amount=1,capacity_unit="linear_meter"))
        db.commit()
        health=read_health(db,category="INTEGRITY",module="calendar")
        assert any(r.code=="calendar_allocation_unit_mismatch" for r in health.diagnostics)
