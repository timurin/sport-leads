import pytest
from sqlalchemy import delete, select
from tests.test_production_scheduler_pc_04_3a import scheduler, run
from tests.test_route_reapply_ic_g01 import fingerprint
from app.models.tech_operation import TechOperation
from app.models.shop_routing import ShopRoutingStageLine
from app.models.technical_card import TechnicalCard, TechnicalCardStageResult, TechnicalCardOperationLine
from app.services.tech_operations import delete_tech_operation
from app.services.calendar_plan_linkage import PlanLinkageConflict
from app.services.operation_retention import card_missing_operation_issues
from app.services.technical_card_stages import start_stage, complete_stage


@pytest.mark.parametrize('status',['pending','in_progress','completed'])
def test_retained_node_without_live_route_reference_protects_operation_and_fact(scheduler,status):
    factory,_=scheduler
    run(factory)
    with factory() as db:
        if status!='pending': start_stage(db,1,1)
        if status=='completed': complete_stage(db,1,1)
        # Remove only the master FK references, retaining frozen nodes/facts/plan.
        db.execute(delete(ShopRoutingStageLine).where(ShopRoutingStageLine.tech_operation_id==1))
        db.commit()
        before=fingerprint(db)
        with pytest.raises(PlanLinkageConflict) as error: delete_tech_operation(db,1)
        assert error.value.code=='tech_operation_retained_by_technical_card'
        assert error.value.category=='INTEGRITY'
        assert 'используется в техкартах' in str(error.value)
        assert error.value.diagnostic.debug_details['references']
        db.rollback()
        assert fingerprint(db)==before and db.get(TechOperation,1)


@pytest.mark.parametrize('card_status',['draft','cancelled','completed'])
def test_operation_line_only_reference_is_retained_for_all_card_states(scheduler,card_status):
    factory,_=scheduler
    with factory() as db:
        db.add(TechOperation(id=90,name='Retained',code='retained',volume_unit='pieces',production_stage_id=1))
        db.flush()
        card=db.get(TechnicalCard,1);card.status=card_status
        db.add(TechnicalCardOperationLine(technical_card_id=1,sequence=99,source_kind='routing',
            tech_operation_id=90,operation_name='Retained',volume=1,volume_unit='pieces'))
        db.commit()
        with pytest.raises(PlanLinkageConflict) as error: delete_tech_operation(db,90)
        assert error.value.diagnostic.debug_details['references'][0]['kind']=='operation_line'
        db.rollback()
        assert db.get(TechOperation,90)


def test_unused_operation_deletes_without_matching_display_name_false_positive(scheduler):
    factory,_=scheduler
    with factory() as db:
        db.add(TechOperation(id=90,name='Unreferenced',code='unreferenced',volume_unit='pieces',production_stage_id=1))
        db.get(TechnicalCard,1).stage_results[0].operation_name='Unreferenced'
        db.commit()
        delete_tech_operation(db,90)
        assert db.get(TechOperation,90) is None and db.get(TechOperation,1)


@pytest.mark.parametrize('reference',['node','line'])
def test_legacy_missing_identity_is_shared_diagnostic_without_guess_or_repair(scheduler,reference):
    from app.services.production_diagnostics import card_diagnostics
    factory,_=scheduler
    with factory() as db:
        card=db.get(TechnicalCard,1)
        if reference=='node': card.stage_results[0].tech_operation_id=999
        else: db.add(TechnicalCardOperationLine(technical_card_id=1,sequence=99,source_kind='routing',
            tech_operation_id=999,operation_name='Items',volume=1,volume_unit='pieces'))
        db.commit()
        before=fingerprint(db)
        issues=card_missing_operation_issues(db,card)
        assert len(issues)==1 and issues[0].operation_id==999 and issues[0].actual_value is None
        assert issues[0].category=='INTEGRITY'
        assert any(d.code==issues[0].code for d in card_diagnostics(db,1).diagnostics)
        assert not any(word in issues[0].message for word in ('999','snapshot','legacy'))
        assert fingerprint(db)==before and db.get(TechOperation,999) is None


def test_delete_http_conflict_keeps_plain_manager_detail_and_diagnostic_headers(scheduler):
    from fastapi.testclient import TestClient
    from app.main import app
    from app.database.session import get_db
    factory,_=scheduler
    overrides=dict(app.dependency_overrides)
    def sessions():
        with factory() as db: yield db
    app.dependency_overrides[get_db]=sessions
    try:
        with TestClient(app) as client:
            response=client.delete('/tech-operations/1')
        assert response.status_code==409
        assert response.headers['X-Diagnostic-Code']=='tech_operation_retained_by_technical_card'
        assert response.headers['X-Diagnostic-Category']=='INTEGRITY'
        detail=response.json()['detail']
        assert isinstance(detail,str) and 'используется в техкартах' in detail
        assert not any(word in detail for word in ('stage_result','snapshot','operation_id'))
    finally:
        app.dependency_overrides.clear();app.dependency_overrides.update(overrides)
