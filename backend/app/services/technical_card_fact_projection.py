"""Compatibility entry points; all state rules live in production_state."""
from app.services.production_state import resolve_fact_state, state_for, read_fields, projection_mismatch, value


def current_fact_stage(card):
    state=resolve_fact_state(card)
    return next((row for row in card.stage_results if row.stage_order==state.current_stage_order),None)


def fact_projection(card):
    return read_fields(state_for(card))


def fact_integrity_issues(card):
    state=state_for(card)
    if state.diagnostics:
        return state.diagnostics
    issues=[]
    from app.schemas.production_diagnostics import ProductionDiagnostic
    if ((card.fulfillment_status is not None and state.lifecycle_status != 'completed')
            or (state.lifecycle_status == 'completed' and card.fulfillment_status is None)):
        issues.append(ProductionDiagnostic(code='production_fulfillment_mismatch', category='INTEGRITY',
            module='production', entity_type='technical_card', entity_id=card.id, entity_name=card.number,
            field='fulfillment_status', field_label='Готовность к отгрузке',
            message='Состояние отгрузки не соответствует завершению производства. Обратитесь к администратору.',
            fix_scope='technical_card', expected_source='Completed production and persisted fulfillment',
            source_value=state.lifecycle_status, actual_value=card.fulfillment_status,
            fix_action='Проверить состояние производства и историю отгрузки'))
    for consumer,actual in [
        ('stored_current_stage_cache',dict(current_stage_order=card.current_stage_order,current_stage_label=card.current_stage_label)),
        ('stored_lifecycle_cache',dict(lifecycle_status=value(card.status))),
    ]:
        if consumer=='stored_lifecycle_cache' and value(card.status)=='draft' and state.lifecycle_status=='planned':
            continue
        issue=projection_mismatch(card,state,consumer,actual)
        if issue:
            issues.append(issue)
    return issues
