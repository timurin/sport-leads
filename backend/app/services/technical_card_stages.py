"""Technical card stage machine and gates (ADR-016 / Stage 9.2.2).

Card statuses:
  draft → in_progress → completed
  draft → cancelled (existing cancel draft)

Stage statuses (snapshot order on card):
  pending → in_progress → completed
  Gates: stage N cannot start until 1…N-1 are completed.
  Op-volume lines do not bypass gates.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.technical_card import (
    TechnicalCard,
    TechnicalCardStageResult,
    TechnicalCardStageResultStatus,
    TechnicalCardStatus,
)
from app.schemas.technical_card import (
    TechnicalCardStageCompleteRequest,
    TechnicalCardStageStartRequest,
)
from app.services.technical_cards import (
    TechnicalCardConflictError,
    TechnicalCardNotFoundError,
    TechnicalCardValidationError,
    get_technical_card,
)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _ordered_stages(card: TechnicalCard) -> list[TechnicalCardStageResult]:
    return sorted(card.stage_results, key=lambda row: (row.stage_order, row.id))


def _stage_by_order(
    card: TechnicalCard, stage_order: int
) -> TechnicalCardStageResult:
    for stage in card.stage_results:
        if stage.stage_order == stage_order:
            return stage
    raise TechnicalCardNotFoundError(f"Stage {stage_order} not found on technical card")


def _assert_card_executable(card: TechnicalCard) -> None:
    if card.status == TechnicalCardStatus.CANCELLED:
        raise TechnicalCardConflictError("Cancelled technical card cannot execute stages")
    if card.status == TechnicalCardStatus.COMPLETED:
        raise TechnicalCardConflictError("Completed technical card cannot execute stages")
    if not card.stage_results:
        raise TechnicalCardValidationError(
            "Technical card has no routing stages; assign a shop routing before execution"
        )


def _previous_stages_completed(card: TechnicalCard, stage_order: int) -> None:
    for stage in _ordered_stages(card):
        if stage.stage_order >= stage_order:
            break
        if stage.status != TechnicalCardStageResultStatus.COMPLETED:
            raise TechnicalCardValidationError(
                f"Stage {stage.stage_order} must be completed before stage {stage_order}"
            )


def _sync_current_stage(card: TechnicalCard) -> None:
    stages = _ordered_stages(card)
    next_open = next(
        (
            stage
            for stage in stages
            if stage.status
            in {
                TechnicalCardStageResultStatus.PENDING,
                TechnicalCardStageResultStatus.IN_PROGRESS,
            }
        ),
        None,
    )
    if next_open is None:
        card.current_stage_order = stages[-1].stage_order if stages else None
        card.current_stage_label = stages[-1].stage_label if stages else None
        return
    card.current_stage_order = next_open.stage_order
    card.current_stage_label = next_open.stage_label


def _maybe_complete_card(card: TechnicalCard) -> None:
    stages = _ordered_stages(card)
    if stages and all(
        stage.status == TechnicalCardStageResultStatus.COMPLETED for stage in stages
    ):
        card.status = TechnicalCardStatus.COMPLETED
        last = stages[-1]
        card.current_stage_order = last.stage_order
        card.current_stage_label = last.stage_label


def start_technical_card(db: Session, card_id: int) -> TechnicalCard:
    """draft → in_progress; start first pending stage."""
    card = get_technical_card(db, card_id)
    if card.status == TechnicalCardStatus.CANCELLED:
        raise TechnicalCardConflictError("Cancelled technical card cannot be started")
    if card.status == TechnicalCardStatus.COMPLETED:
        raise TechnicalCardConflictError("Completed technical card cannot be started")
    if not card.stage_results:
        raise TechnicalCardValidationError(
            "Technical card has no routing stages; assign a shop routing before start"
        )

    if card.status == TechnicalCardStatus.DRAFT:
        card.status = TechnicalCardStatus.IN_PROGRESS

    first = _ordered_stages(card)[0]
    if first.status == TechnicalCardStageResultStatus.PENDING:
        first.status = TechnicalCardStageResultStatus.IN_PROGRESS
        first.started_at = first.started_at or _utc_now()
    _sync_current_stage(card)
    db.commit()
    return get_technical_card(db, card_id)


def start_stage(
    db: Session,
    card_id: int,
    stage_order: int,
    payload: TechnicalCardStageStartRequest | None = None,
) -> TechnicalCard:
    card = get_technical_card(db, card_id)
    _assert_card_executable(card)
    stage = _stage_by_order(card, stage_order)
    _previous_stages_completed(card, stage_order)

    if stage.status == TechnicalCardStageResultStatus.COMPLETED:
        raise TechnicalCardConflictError(f"Stage {stage_order} is already completed")
    if stage.status == TechnicalCardStageResultStatus.SKIPPED:
        raise TechnicalCardConflictError(f"Stage {stage_order} was skipped")

    if card.status == TechnicalCardStatus.DRAFT:
        card.status = TechnicalCardStatus.IN_PROGRESS

    if stage.status == TechnicalCardStageResultStatus.PENDING:
        stage.status = TechnicalCardStageResultStatus.IN_PROGRESS
        stage.started_at = _utc_now()

    if payload and payload.performer_name:
        stage.performer_name = payload.performer_name

    _sync_current_stage(card)
    db.commit()
    return get_technical_card(db, card_id)


def complete_stage(
    db: Session,
    card_id: int,
    stage_order: int,
    payload: TechnicalCardStageCompleteRequest | None = None,
) -> TechnicalCard:
    card = get_technical_card(db, card_id)
    _assert_card_executable(card)
    stage = _stage_by_order(card, stage_order)
    _previous_stages_completed(card, stage_order)

    if stage.status == TechnicalCardStageResultStatus.COMPLETED:
        raise TechnicalCardConflictError(f"Stage {stage_order} is already completed")
    if stage.status == TechnicalCardStageResultStatus.SKIPPED:
        raise TechnicalCardConflictError(f"Stage {stage_order} was skipped")

    if card.status == TechnicalCardStatus.DRAFT:
        card.status = TechnicalCardStatus.IN_PROGRESS

    if stage.status == TechnicalCardStageResultStatus.PENDING:
        stage.status = TechnicalCardStageResultStatus.IN_PROGRESS
        stage.started_at = stage.started_at or _utc_now()

    stage.status = TechnicalCardStageResultStatus.COMPLETED
    stage.completed_at = _utc_now()
    if payload is not None:
        if payload.performer_name is not None:
            stage.performer_name = payload.performer_name
        if payload.scrap_qty is not None:
            stage.scrap_qty = payload.scrap_qty
        if payload.rework_qty is not None:
            stage.rework_qty = payload.rework_qty
        if payload.notes is not None:
            stage.notes = payload.notes

    _sync_current_stage(card)
    _maybe_complete_card(card)
    if card.status != TechnicalCardStatus.COMPLETED:
        # Advance pointer to next pending/in_progress after complete.
        _sync_current_stage(card)
        next_pending = next(
            (
                row
                for row in _ordered_stages(card)
                if row.status == TechnicalCardStageResultStatus.PENDING
            ),
            None,
        )
        if next_pending is not None:
            card.current_stage_order = next_pending.stage_order
            card.current_stage_label = next_pending.stage_label

    db.commit()
    return get_technical_card(db, card_id)


def rollback_stage(db: Session, card_id: int, stage_order: int) -> TechnicalCard:
    """Controlled rollback: reopen a completed stage if no later stage has progressed."""
    card = get_technical_card(db, card_id)
    if card.status == TechnicalCardStatus.CANCELLED:
        raise TechnicalCardConflictError("Cancelled technical card cannot rollback stages")
    if not card.stage_results:
        raise TechnicalCardValidationError("Technical card has no routing stages")

    stage = _stage_by_order(card, stage_order)
    if stage.status != TechnicalCardStageResultStatus.COMPLETED:
        raise TechnicalCardValidationError(
            f"Only completed stages can be rolled back (stage {stage_order} is {stage.status})"
        )

    for later in _ordered_stages(card):
        if later.stage_order <= stage_order:
            continue
        if later.status != TechnicalCardStageResultStatus.PENDING:
            raise TechnicalCardValidationError(
                f"Cannot rollback stage {stage_order}: later stage {later.stage_order} "
                f"is {later.status}"
            )

    stage.status = TechnicalCardStageResultStatus.IN_PROGRESS
    stage.completed_at = None
    # Keep started_at / performer / scrap / rework for audit; clear scrap/rework on reopen.
    stage.scrap_qty = None
    stage.rework_qty = None

    if card.status == TechnicalCardStatus.COMPLETED:
        card.status = TechnicalCardStatus.IN_PROGRESS

    _sync_current_stage(card)
    db.commit()
    return get_technical_card(db, card_id)


# Re-export Decimal for type checkers / callers that patch scrap.
__all__ = [
    "start_technical_card",
    "start_stage",
    "complete_stage",
    "rollback_stage",
    "Decimal",
]
