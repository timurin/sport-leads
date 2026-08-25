"""Unit-line location and computed tech-card WIP status (ADR-030 / 25.4)."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.technical_card import (
    TechnicalCard,
    TechnicalCardStageResult,
    TechnicalCardStageResultStatus,
    TechnicalCardStatus,
    TechnicalCardUnitLine,
)
from app.services.technical_card_stages import (
    current_stage_result,
    resolve_production_stage_code,
)

TRANSFER_ACCEPT = "accept"
TRANSFER_FORWARD = "forward"
TRANSFER_RETURN = "return"

WIP_RETURN = "return"
WIP_READY = "ready"
WIP_PARTIAL = "partial_ready"
WIP_IN_WORK = "in_work"

SHIP_STAGE_CODES = frozenset({"ready_to_ship", "shipped"})


def ordered_stages(card: TechnicalCard) -> list[TechnicalCardStageResult]:
    return sorted(card.stage_results or [], key=lambda row: (row.stage_order, row.id))


def live_unit_lines(card: TechnicalCard) -> list[TechnicalCardUnitLine]:
    return [row for row in (card.unit_lines or []) if not row.is_scrapped]


def unit_location_stage(
    card: TechnicalCard, unit: TechnicalCardUnitLine
) -> TechnicalCardStageResult | None:
    stages = ordered_stages(card)
    if unit.production_stage_id is not None:
        match = next(
            (
                stage
                for stage in stages
                if stage.production_stage_id == unit.production_stage_id
            ),
            None,
        )
        if match is not None:
            return match
    return current_stage_result(card)


def seed_unit_locations_from_first_stage(card: TechnicalCard) -> None:
    stages = ordered_stages(card)
    if not stages:
        return
    first = stages[0]
    for unit in card.unit_lines or []:
        if unit.production_stage_id is None:
            unit.production_stage_id = first.production_stage_id


def next_stage(
    card: TechnicalCard, stage: TechnicalCardStageResult
) -> TechnicalCardStageResult | None:
    later = [row for row in ordered_stages(card) if row.stage_order > stage.stage_order]
    return later[0] if later else None


def previous_stage(
    card: TechnicalCard, stage: TechnicalCardStageResult
) -> TechnicalCardStageResult | None:
    earlier = [
        row for row in ordered_stages(card) if row.stage_order < stage.stage_order
    ]
    return earlier[-1] if earlier else None


def compute_wip_status(db: Session, card: TechnicalCard) -> str:
    units = live_unit_lines(card)
    if not units:
        if card.status == TechnicalCardStatus.COMPLETED:
            return WIP_READY
        if card.status == TechnicalCardStatus.DRAFT:
            return WIP_IN_WORK
        return WIP_IN_WORK
    if any(unit.last_transfer_kind == TRANSFER_RETURN for unit in units):
        return WIP_RETURN
    ship_count = 0
    for unit in units:
        stage = unit_location_stage(card, unit)
        code = resolve_production_stage_code(
            db,
            stage.production_stage_id if stage is not None else None,
            stage.stage_label if stage is not None else None,
        )
        if code in SHIP_STAGE_CODES:
            ship_count += 1
    if ship_count == len(units):
        return WIP_READY
    if ship_count > 0:
        return WIP_PARTIAL
    return WIP_IN_WORK


def sync_card_from_unit_locations(db: Session, card: TechnicalCard) -> None:
    units = live_unit_lines(card)
    stages = ordered_stages(card)
    if not stages:
        return
    now = datetime.now(timezone.utc)
    located: list[tuple[TechnicalCardUnitLine, TechnicalCardStageResult]] = []
    for unit in units:
        stage = unit_location_stage(card, unit)
        if stage is not None:
            located.append((unit, stage))
    if not located:
        return

    orders = {stage.stage_order for _unit, stage in located}
    lag_order = min(orders)
    lag = next(stage for stage in stages if stage.stage_order == lag_order)
    card.current_stage_order = lag.stage_order
    card.current_stage_label = lag.stage_label
    if card.status == TechnicalCardStatus.DRAFT:
        card.status = TechnicalCardStatus.IN_PROGRESS

    for stage in stages:
        has_here = any(row.stage_order == stage.stage_order for _unit, row in located)
        all_past = all(row.stage_order > stage.stage_order for _unit, row in located)
        if has_here:
            if stage.status == TechnicalCardStageResultStatus.PENDING:
                stage.status = TechnicalCardStageResultStatus.IN_PROGRESS
                stage.started_at = stage.started_at or now
            elif stage.status == TechnicalCardStageResultStatus.COMPLETED:
                stage.status = TechnicalCardStageResultStatus.IN_PROGRESS
                stage.completed_at = None
        elif all_past:
            if stage.status != TechnicalCardStageResultStatus.COMPLETED:
                stage.status = TechnicalCardStageResultStatus.COMPLETED
                stage.completed_at = stage.completed_at or now

    last = stages[-1]
    last_code = resolve_production_stage_code(
        db, last.production_stage_id, last.stage_label
    )
    all_on_last = all(row.stage_order == last.stage_order for _unit, row in located)
    if all_on_last and last_code == "shipped":
        card.status = TechnicalCardStatus.COMPLETED
        last.status = TechnicalCardStageResultStatus.COMPLETED
        last.completed_at = last.completed_at or now
    elif card.status == TechnicalCardStatus.COMPLETED and not all_on_last:
        card.status = TechnicalCardStatus.IN_PROGRESS
