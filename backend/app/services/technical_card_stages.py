"""Technical card stage machine and gates (ADR-016 / Stage 9.2.2).

Card statuses:
  draft → in_progress → completed
  draft → cancelled (existing cancel draft)

Stage statuses (snapshot order on card):
  pending → in_progress → completed
  Gates: stage N cannot start until 1…N-1 are completed.
  Op-volume lines do not bypass gates.
  Material hard-gate (`9.3.4.3`): cutting/print cannot complete while any
  MATERIAL bound to that production_stage_id lacks fact_qty.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.auth import PlatformUser
from app.models.production_stage import ProductionStage
from app.models.shop_routing import WorkCenter
from app.models.technical_card import (
    TechnicalCard,
    TechnicalCardCompositionLineKind,
    TechnicalCardStageResult,
    TechnicalCardStageResultStatus,
    TechnicalCardStatus,
)
from app.services import audit as audit_service
from app.schemas.technical_card import (
    TechnicalCardStageCompleteRequest,
    TechnicalCardStageFactRequest,
    TechnicalCardStageStartRequest,
)
from app.services.technical_cards import (
    TechnicalCardConflictError,
    TechnicalCardNotFoundError,
    TechnicalCardValidationError,
    get_technical_card,
)

# MVP hard material gate stage codes (ADR-016 / 9.3.4).
MATERIAL_FACT_GATE_STAGE_CODES = frozenset({"cutting", "print"})

STAGE_LABEL_TO_CODE = {
    "дизайн": "design",
    "раскрой": "cutting",
    "печать": "print",
    "пошив": "sewing",
    "вто": "wto",
    "отк": "qc",
    "упаковка": "packaging",
    "готовы к отгрузке": "ready_to_ship",
    "отгружены": "shipped",
}


def resolve_production_stage_code(
    db: Session,
    production_stage_id: int | None,
    stage_label: str | None,
) -> str | None:
    if production_stage_id is not None:
        production_stage = db.get(ProductionStage, production_stage_id)
        if production_stage is not None:
            code = (production_stage.code or "").strip().lower()
            if code:
                return code
    label = (stage_label or "").strip().lower()
    return STAGE_LABEL_TO_CODE.get(label)


def current_stage_result(card: TechnicalCard) -> TechnicalCardStageResult | None:
    if card.current_stage_order is None:
        return None
    return next(
        (row for row in card.stage_results if row.stage_order == card.current_stage_order),
        None,
    )


def assert_shop_module_current_stage(
    db: Session,
    card: TechnicalCard,
    required_code: str,
) -> TechnicalCardStageResult:
    """Bind shop writes to the card's current routing step for the given цех code."""
    normalized = required_code.strip().lower()
    current = current_stage_result(card)
    if current is None:
        raise TechnicalCardValidationError(
            f"Shop module `{normalized}` requires a current routing stage on the card"
        )
    if card.current_stage_order != current.stage_order:
        raise TechnicalCardValidationError(
            f"Shop fact can only be written on the current stage "
            f"(current={card.current_stage_order})"
        )
    stage_code = resolve_production_stage_code(
        db, current.production_stage_id, current.stage_label
    )
    if stage_code != normalized:
        raise TechnicalCardValidationError(
            f"Shop module `{normalized}` can only write when current "
            f"routing stage matches that цех (got `{stage_code or current.stage_label}`)"
        )
    return current


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


def _composition_line_kind_value(line) -> str:
    kind = line.line_kind
    return kind.value if hasattr(kind, "value") else str(kind)


def _assert_material_fact_gate(
    db: Session, card: TechnicalCard, stage: TechnicalCardStageResult
) -> None:
    """Reject cutting/print complete when bound MATERIAL lines lack fact_qty."""
    if stage.production_stage_id is None:
        return
    production_stage = db.get(ProductionStage, stage.production_stage_id)
    if production_stage is None:
        return
    code = (production_stage.code or "").strip().lower()
    if code not in MATERIAL_FACT_GATE_STAGE_CODES:
        return

    missing_names: list[str] = []
    for row in card.composition_lines:
        if _composition_line_kind_value(row) != TechnicalCardCompositionLineKind.MATERIAL.value:
            continue
        if row.production_stage_id != stage.production_stage_id:
            continue
        if row.fact_qty is None:
            missing_names.append(row.snapshot_name or f"line#{row.id}")

    if missing_names:
        names = ", ".join(missing_names[:5])
        extra = "" if len(missing_names) <= 5 else f" (+{len(missing_names) - 5})"
        raise TechnicalCardValidationError(
            f"Cannot complete {production_stage.name} ({code}): "
            f"MATERIAL fact_qty required for: {names}{extra}"
        )


assert_material_fact_gate = _assert_material_fact_gate


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
    *,
    actor: PlatformUser | None = None,
) -> TechnicalCard:
    card = get_technical_card(db, card_id)
    _assert_card_executable(card)
    stage = _stage_by_order(card, stage_order)
    _previous_stages_completed(card, stage_order)

    if stage.status == TechnicalCardStageResultStatus.COMPLETED:
        raise TechnicalCardConflictError(f"Stage {stage_order} is already completed")
    if stage.status == TechnicalCardStageResultStatus.SKIPPED:
        raise TechnicalCardConflictError(f"Stage {stage_order} was skipped")

    _assert_material_fact_gate(db, card, stage)

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
        if payload.work_done is not None:
            stage.work_done = payload.work_done
        if payload.duration_seconds is not None:
            stage.duration_seconds = payload.duration_seconds

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

    stage_code = resolve_production_stage_code(
        db, stage.production_stage_id, stage.stage_label
    )
    from app.services.fg_stock_posting import post_fg_on_stage_complete

    post_fg_on_stage_complete(db, card, stage_code)

    if actor is not None:
        audit_service.append_audit_event(
            db,
            actor=actor,
            action=audit_service.ACTION_SHOP_STAGE_COMPLETE,
            entity_type="technical_card",
            entity_id=card_id,
            payload={
                "stage_order": stage_order,
                "stage_code": stage_code,
                "stage_label": stage.stage_label,
            },
        )

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

    stage_code = resolve_production_stage_code(
        db, stage.production_stage_id, stage.stage_label
    )
    from app.services.fg_stock_posting import assert_fg_stage_rollback_allowed

    assert_fg_stage_rollback_allowed(db, card, stage_code)

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


def rollback_stage_for_shop_kanban(
    db: Session,
    card_id: int,
    stage_order: int,
    *,
    actor: PlatformUser | None = None,
) -> TechnicalCard:
    """Shop-kanban rollback for test convenience.

    Unlike `rollback_stage`, this allows later stages to be `in_progress`.
    When later stage is `in_progress`, it is reset back to `pending` so the
    card can be safely reopened at the earlier completed stage.
    """
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

    stage_code = resolve_production_stage_code(
        db, stage.production_stage_id, stage.stage_label
    )
    from app.services.fg_stock_posting import assert_fg_stage_rollback_allowed

    assert_fg_stage_rollback_allowed(db, card, stage_code)

    for later in _ordered_stages(card):
        if later.stage_order <= stage_order:
            continue
        if later.status == TechnicalCardStageResultStatus.SKIPPED:
            raise TechnicalCardValidationError(
                f"Cannot rollback stage {stage_order}: later stage {later.stage_order} was skipped"
            )
        if later.status in {
            TechnicalCardStageResultStatus.PENDING,
            TechnicalCardStageResultStatus.IN_PROGRESS,
            TechnicalCardStageResultStatus.COMPLETED,
        }:
            # For kanban/test rollback: later stages must be reopened.
            later.status = TechnicalCardStageResultStatus.PENDING
            later.started_at = None
            later.completed_at = None
            later.scrap_qty = None
            later.rework_qty = None

    stage.status = TechnicalCardStageResultStatus.IN_PROGRESS
    stage.completed_at = None
    # Keep started_at / performer / scrap / rework for audit; clear scrap/rework on reopen.
    stage.scrap_qty = None
    stage.rework_qty = None

    if card.status == TechnicalCardStatus.COMPLETED:
        card.status = TechnicalCardStatus.IN_PROGRESS

    _sync_current_stage(card)
    if actor is not None:
        audit_service.append_audit_event(
            db,
            actor=actor,
            action=audit_service.ACTION_SHOP_STAGE_ROLLBACK_KANBAN,
            entity_type="technical_card",
            entity_id=card_id,
            payload={
                "stage_order": stage_order,
                "stage_code": stage_code,
                "stage_label": stage.stage_label,
            },
        )
    db.commit()
    return get_technical_card(db, card_id)


def update_stage_fact(
    db: Session,
    card_id: int,
    stage_order: int,
    payload: TechnicalCardStageFactRequest,
) -> TechnicalCard:
    """Write shop fact fields onto a stage result without completing the stage.

    Bind rule (`11.4.4+` / `11.7.4`): when `shop_stage_code` is set, the target stage must
    match that ProductionStage.code and must be the card's current stage.
    Пошив (`sewing`) / ВТО (`wto`) / Упаковка (`packaging`) write performer /
    work_done / duration only — no material gate. ОТК (`qc`) may also set
    scrap_qty / rework_qty / notes.
    """
    card = get_technical_card(db, card_id)
    _assert_card_executable(card)
    stage = _stage_by_order(card, stage_order)

    if card.current_stage_order != stage_order:
        raise TechnicalCardValidationError(
            f"Shop fact can only be written on the current stage "
            f"(current={card.current_stage_order}, requested={stage_order})"
        )

    if stage.status == TechnicalCardStageResultStatus.COMPLETED:
        raise TechnicalCardConflictError(
            f"Stage {stage_order} is already completed; reopen via rollback to edit fact"
        )
    if stage.status == TechnicalCardStageResultStatus.SKIPPED:
        raise TechnicalCardConflictError(f"Stage {stage_order} was skipped")

    required_code = (payload.shop_stage_code or "").strip().lower() or None
    if required_code:
        assert_shop_module_current_stage(db, card, required_code)

    if payload.work_center_id is not None:
        work_center = db.get(WorkCenter, payload.work_center_id)
        if work_center is None:
            raise TechnicalCardValidationError("Work center not found")
        if not work_center.is_active:
            raise TechnicalCardValidationError("Work center is inactive")
        if required_code and work_center.production_stage_id is not None:
            wc_stage = db.get(ProductionStage, work_center.production_stage_id)
            wc_code = (
                (wc_stage.code or "").strip().lower() if wc_stage is not None else None
            )
            if wc_code and wc_code != required_code:
                raise TechnicalCardValidationError(
                    f"Work center belongs to another цех (`{wc_code}`), not `{required_code}`"
                )

    _previous_stages_completed(card, stage_order)

    if card.status == TechnicalCardStatus.DRAFT:
        card.status = TechnicalCardStatus.IN_PROGRESS
    if stage.status == TechnicalCardStageResultStatus.PENDING:
        stage.status = TechnicalCardStageResultStatus.IN_PROGRESS
        stage.started_at = stage.started_at or _utc_now()

    if payload.performer_name is not None:
        stage.performer_name = payload.performer_name
    if payload.work_done is not None:
        stage.work_done = payload.work_done
    if payload.duration_seconds is not None:
        stage.duration_seconds = payload.duration_seconds
    if payload.scrap_qty is not None:
        stage.scrap_qty = payload.scrap_qty
    if payload.rework_qty is not None:
        stage.rework_qty = payload.rework_qty
    if payload.notes is not None:
        stage.notes = payload.notes
    if "work_center_id" in payload.model_fields_set:
        stage.work_center_id = payload.work_center_id

    _sync_current_stage(card)
    db.commit()
    return get_technical_card(db, card_id)


def assign_planned_work_center(
    db: Session,
    card_id: int,
    stage_order: int,
    work_center_id: int | None,
) -> TechnicalCard:
    """Set planned equipment on a stage without shop-current bind (`11.1.2.4`)."""
    card = get_technical_card(db, card_id)
    _assert_card_executable(card)
    stage = _stage_by_order(card, stage_order)

    if stage.status == TechnicalCardStageResultStatus.COMPLETED:
        raise TechnicalCardConflictError(
            f"Stage {stage_order} is completed; reopen via rollback to change equipment"
        )
    if stage.status == TechnicalCardStageResultStatus.SKIPPED:
        raise TechnicalCardConflictError(f"Stage {stage_order} was skipped")

    if work_center_id is not None:
        work_center = db.get(WorkCenter, work_center_id)
        if work_center is None:
            raise TechnicalCardValidationError("Work center not found")
        if not work_center.is_active:
            raise TechnicalCardValidationError("Work center is inactive")
        if (
            work_center.production_stage_id is not None
            and stage.production_stage_id is not None
            and work_center.production_stage_id != stage.production_stage_id
        ):
            raise TechnicalCardValidationError(
                "Work center belongs to another цех than this stage"
            )

    stage.work_center_id = work_center_id
    db.commit()
    return get_technical_card(db, card_id)


# Re-export Decimal for type checkers / callers that patch scrap.
__all__ = [
    "MATERIAL_FACT_GATE_STAGE_CODES",
    "start_technical_card",
    "start_stage",
    "complete_stage",
    "rollback_stage",
    "rollback_stage_for_shop_kanban",
    "update_stage_fact",
    "assign_planned_work_center",
    "Decimal",
]
