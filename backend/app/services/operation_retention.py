"""IC-RS05: retained soft operation identities prevent destructive catalog deletion."""
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.technical_card import TechnicalCard, TechnicalCardStageResult, TechnicalCardOperationLine
from app.models.tech_operation import TechOperation
from app.schemas.production_diagnostics import ProductionDiagnostic, DiagnosticTraceStep


def retained_references(db: Session, operation_id: int) -> list[dict]:
    refs = []
    for model, kind in [(TechnicalCardStageResult, "stage_result"), (TechnicalCardOperationLine, "operation_line")]:
        for row in db.scalars(select(model).where(model.tech_operation_id == operation_id).order_by(model.id)):
            refs.append(dict(kind=kind, id=row.id, technical_card_id=row.technical_card_id,
                             status=getattr(row, "status", None)))
    return refs


def deletion_issue(operation_id: int, references: list[dict]) -> ProductionDiagnostic:
    return ProductionDiagnostic(code="tech_operation_retained_by_technical_card", category="INTEGRITY",
        module="routing", entity_type="tech_operation", entity_id=operation_id, entity_name="Производственная операция",
        field="operation_identity", field_label="Операция используется в техкартах",
        message="Нельзя удалить операцию: она используется в техкартах. Сохраните её, чтобы не потерять производственные данные.",
        fix_scope="tech_operation", fix_action="Открыть операции", fix_url="/settings/catalogs/tech-operations",
        reason="retained_operation_identity", expected_source="Retained technical-card operation references",
        source_value=operation_id, actual_value=references,
        trace=(DiagnosticTraceStep(source="retained technical-card references → TechOperation",value=operation_id),),
        debug_details=dict(operation_id=operation_id, references=references,
                           technical_action="Reject hard delete; no automatic archive/deactivate/remap"))


def card_missing_operation_issues(db: Session, card: TechnicalCard) -> list[ProductionDiagnostic]:
    refs = []
    for model, kind in [(TechnicalCardStageResult, "stage_result"), (TechnicalCardOperationLine, "operation_line")]:
        for row in db.scalars(select(model).outerjoin(TechOperation, model.tech_operation_id == TechOperation.id)
            .where(model.technical_card_id == card.id, model.tech_operation_id.is_not(None), TechOperation.id.is_(None))):
            refs.append(dict(kind=kind,id=row.id,operation_id=row.tech_operation_id,status=getattr(row,"status",None)))
    return [ProductionDiagnostic(code="technical_card_operation_reference_missing", category="INTEGRITY",
        module="routing", entity_type="technical_card",entity_id=card.id,entity_name=card.number,
        field="route.operation_identity",field_label="Производственная операция требует проверки",
        message="В техкарте не найдена производственная операция. Обратитесь к ответственному за производство.",
        fix_scope="technical_card",fix_action="Открыть техкарту",fix_url=f"/production/tech-cards/{card.id}",
        operation_id=operation_id,reason="retained_operation_missing",expected_source="Retained reference → TechOperation.id",
        source_value=operation_id,actual_value=None,
        trace=(DiagnosticTraceStep(source="retained operation → catalog",value=operation_id,broken=True),),
        debug_details=dict(operation_id=operation_id,references=[r for r in refs if r["operation_id"]==operation_id],
            technical_action="Manual identity review; do not infer from name or rewrite facts"))
        for operation_id in sorted({r["operation_id"] for r in refs})]
