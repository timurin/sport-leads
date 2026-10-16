"""Bounded joined reads; no composition collections or per-row queries."""
from datetime import date

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.calendar_assignment import CalendarAssignment
from app.models.production_stage import ProductionStage
from app.models.technical_card import TechnicalCard, TechnicalCardOrderGroup, TechnicalCardStageResult


def assignment_rows(db: Session, start: date | None = None, end: date | None = None,
                    stage_id: int | None = None, assignment_id: int | None = None,
                    *, editable_only: bool = False):
    stmt = select(CalendarAssignment, TechnicalCard.number, TechnicalCardOrderGroup.order_number,
                  TechnicalCard.nomenclature_name, TechnicalCard.quantity, ProductionStage.name).join(
        TechnicalCard, TechnicalCard.id == CalendarAssignment.technical_card_id
    ).join(TechnicalCardOrderGroup, TechnicalCardOrderGroup.id == TechnicalCard.order_group_id).join(
        ProductionStage, ProductionStage.id == CalendarAssignment.production_stage_id
    )
    if start is not None:
        stmt = stmt.where(CalendarAssignment.planned_end_date >= start)
    if end is not None:
        stmt = stmt.where(CalendarAssignment.planned_date <= end)
    if stage_id is not None:
        stmt = stmt.where(CalendarAssignment.production_stage_id == stage_id)
    if assignment_id is not None:
        stmt = stmt.where(CalendarAssignment.id == assignment_id)
    if editable_only:
        # Normal board stays historical. The dispatcher list offers only open plans
        # of existing executable cards; a missing/foreign snapshot is not editable.
        pending_node = select(TechnicalCardStageResult.id).where(
            TechnicalCardStageResult.id == CalendarAssignment.stage_result_id,
            TechnicalCardStageResult.technical_card_id == TechnicalCard.id,
            TechnicalCardStageResult.production_stage_id == CalendarAssignment.production_stage_id,
            TechnicalCardStageResult.status == "pending",
            TechnicalCardStageResult.started_at.is_(None),
            TechnicalCardStageResult.completed_at.is_(None),
        ).exists()
        marker = (CalendarAssignment.stage_result_id.is_(None)
                  & CalendarAssignment.routing_stage_line_id.is_(None))
        stmt = stmt.where(TechnicalCard.status.in_(["draft", "in_progress"]), or_(marker, pending_node))
    return db.execute(stmt.order_by(CalendarAssignment.planned_date, CalendarAssignment.production_stage_id,
                                   CalendarAssignment.position, CalendarAssignment.id)).all()


def source_rows(db: Session, search: str, limit: int):
    stmt = select(TechnicalCard.id, TechnicalCard.number, TechnicalCardOrderGroup.order_number,
                  TechnicalCard.nomenclature_name, TechnicalCard.quantity).join(
        TechnicalCardOrderGroup, TechnicalCardOrderGroup.id == TechnicalCard.order_group_id
    ).where(TechnicalCard.status.in_(["draft", "in_progress"]))
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(TechnicalCard.number.ilike(pattern) | TechnicalCardOrderGroup.order_number.ilike(pattern)
                          | TechnicalCard.nomenclature_name.ilike(pattern))
    return db.execute(stmt.order_by(TechnicalCard.id.desc()).limit(limit)).all()
