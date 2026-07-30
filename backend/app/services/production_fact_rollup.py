"""Production fact roll-up read model (ADR-018 §8 / Stage 11.2.1.2)."""

from __future__ import annotations

from collections import defaultdict
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.technical_card import (
    TechnicalCard,
    TechnicalCardCompositionLineKind,
    TechnicalCardStatus,
)
from app.repositories import production_orders as repo
from app.schemas.production_order import (
    ProductionFactRollupMaterialLine,
    ProductionFactRollupOperationLine,
    ProductionFactRollupPerformer,
    ProductionFactRollupRead,
)
from app.services.production_orders import (
    ProductionBatchNotFoundError,
    ProductionOrderNotFoundError,
)


def _load_cards(db: Session, card_ids: list[int]) -> list[TechnicalCard]:
    if not card_ids:
        return []
    rows = db.scalars(
        select(TechnicalCard)
        .where(TechnicalCard.id.in_(card_ids))
        .options(
            selectinload(TechnicalCard.stage_results),
            selectinload(TechnicalCard.composition_lines),
            selectinload(TechnicalCard.operation_lines),
        )
        .order_by(TechnicalCard.id.asc())
    ).all()
    return list(rows)


def _status_value(status: object) -> str:
    if isinstance(status, TechnicalCardStatus):
        return status.value
    return str(status)


def _rollup_cards(
    cards: list[TechnicalCard],
    *,
    scope: str,
    production_order_id: int | None,
    production_batch_id: int | None,
) -> ProductionFactRollupRead:
    quantity_total = Decimal("0")
    cards_completed = 0
    cards_in_progress = 0
    cards_other = 0
    duration_total = 0
    scrap_total = Decimal("0")
    rework_total = Decimal("0")

    performer_stages: dict[str, set[str]] = defaultdict(set)
    material_acc: dict[tuple[int | None, str, str | None], dict[str, Decimal | None]] = {}
    operation_acc: dict[
        tuple[str, str | None, int | None, str | None], Decimal
    ] = defaultdict(lambda: Decimal("0"))

    for card in cards:
        quantity_total += card.quantity or Decimal("0")
        status = _status_value(card.status)
        if status == TechnicalCardStatus.COMPLETED.value:
            cards_completed += 1
        elif status == TechnicalCardStatus.IN_PROGRESS.value:
            cards_in_progress += 1
        else:
            cards_other += 1

        for stage in card.stage_results:
            if stage.duration_seconds is not None:
                duration_total += int(stage.duration_seconds)
            if stage.scrap_qty is not None:
                scrap_total += stage.scrap_qty
            if stage.rework_qty is not None:
                rework_total += stage.rework_qty
            name = (stage.performer_name or "").strip()
            if name:
                performer_stages[name].add(stage.stage_label)

        for line in card.composition_lines:
            kind = (
                line.line_kind.value
                if isinstance(line.line_kind, TechnicalCardCompositionLineKind)
                else str(line.line_kind)
            )
            if kind != TechnicalCardCompositionLineKind.MATERIAL.value:
                continue
            key = (line.nomenclature_id, line.snapshot_name, line.unit)
            bucket = material_acc.setdefault(
                key,
                {"planned_qty": None, "fact_qty": None},
            )
            if line.planned_qty is not None:
                current = bucket["planned_qty"]
                bucket["planned_qty"] = (
                    line.planned_qty if current is None else current + line.planned_qty
                )
            if line.fact_qty is not None:
                current = bucket["fact_qty"]
                bucket["fact_qty"] = (
                    line.fact_qty if current is None else current + line.fact_qty
                )

        for line in card.operation_lines:
            volume_unit = (
                line.volume_unit.value
                if hasattr(line.volume_unit, "value")
                else str(line.volume_unit)
            )
            op_key = (
                line.operation_name,
                volume_unit,
                line.stage_order,
                line.stage_label,
            )
            operation_acc[op_key] += line.volume or Decimal("0")

    performers = [
        ProductionFactRollupPerformer(
            performer_name=name,
            stage_labels=sorted(labels),
        )
        for name, labels in sorted(performer_stages.items(), key=lambda item: item[0])
    ]
    materials = [
        ProductionFactRollupMaterialLine(
            nomenclature_id=nomenclature_id,
            snapshot_name=snapshot_name,
            unit=unit,
            planned_qty=values["planned_qty"],
            fact_qty=values["fact_qty"],
        )
        for (nomenclature_id, snapshot_name, unit), values in sorted(
            material_acc.items(),
            key=lambda item: (item[0][1], item[0][0] or 0),
        )
    ]
    operations = [
        ProductionFactRollupOperationLine(
            operation_name=operation_name,
            volume_unit=volume_unit,
            stage_order=stage_order,
            stage_label=stage_label,
            volume=volume,
        )
        for (operation_name, volume_unit, stage_order, stage_label), volume in sorted(
            operation_acc.items(),
            key=lambda item: (
                item[0][2] if item[0][2] is not None else 10**9,
                item[0][0],
            ),
        )
    ]

    return ProductionFactRollupRead(
        scope=scope,
        production_order_id=production_order_id,
        production_batch_id=production_batch_id,
        technical_card_count=len(cards),
        technical_card_ids=[card.id for card in cards],
        quantity_total=quantity_total,
        cards_completed=cards_completed,
        cards_in_progress=cards_in_progress,
        cards_other=cards_other,
        duration_seconds_total=duration_total,
        scrap_qty_total=scrap_total,
        rework_qty_total=rework_total,
        performers=performers,
        materials=materials,
        operations=operations,
    )


def get_production_batch_fact_rollup(
    db: Session, batch_id: int
) -> ProductionFactRollupRead:
    batch = repo.get_production_batch(db, batch_id)
    if batch is None:
        raise ProductionBatchNotFoundError("Партия не найдена")
    card_ids = [link.technical_card_id for link in batch.card_links]
    cards = _load_cards(db, card_ids)
    return _rollup_cards(
        cards,
        scope="batch",
        production_order_id=batch.production_order_id,
        production_batch_id=batch.id,
    )


def get_production_order_fact_rollup(
    db: Session, order_id: int
) -> ProductionFactRollupRead:
    order = repo.get_production_order(db, order_id)
    if order is None:
        raise ProductionOrderNotFoundError("Производственный заказ не найден")
    card_ids: list[int] = []
    seen: set[int] = set()
    for batch in order.batches:
        for link in batch.card_links:
            if link.technical_card_id in seen:
                continue
            seen.add(link.technical_card_id)
            card_ids.append(link.technical_card_id)
    cards = _load_cards(db, card_ids)
    return _rollup_cards(
        cards,
        scope="order",
        production_order_id=order.id,
        production_batch_id=None,
    )
