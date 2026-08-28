"""Copy / hard-delete technical cards (Stage 26.11)."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.production_order import ProductionBatchCardLink
from app.models.sewing_work_ledger import SewingWorkLedgerEntry
from app.models.technical_card import (
    TechnicalCard,
    TechnicalCardCompositionLine,
    TechnicalCardOperationLine,
    TechnicalCardStatus,
    TechnicalCardUnitLine,
)
from app.services.standalone_technical_cards import (
    _get_or_create_order_group,
    _next_group_card_seq,
)
from app.services.tech_card_qr import ensure_qr_token
from app.services.technical_card_settings import get_technical_card_settings
from app.services.technical_cards import (
    TechnicalCardConflictError,
    TechnicalCardNotFoundError,
    TechnicalCardValidationError,
    _technical_card_number,
    get_technical_card,
)


def delete_draft_technical_card(db: Session, card_id: int) -> None:
    card = get_technical_card(db, card_id)
    if card.status != TechnicalCardStatus.DRAFT:
        raise TechnicalCardConflictError("Удалить можно только техкарту в статусе Черновик")
    ledger = db.scalar(
        select(func.count())
        .select_from(SewingWorkLedgerEntry)
        .where(SewingWorkLedgerEntry.technical_card_id == card.id)
    )
    if int(ledger or 0) > 0:
        raise TechnicalCardConflictError("Нельзя удалить техкарту: есть записи кабинета швеи")
    batch_link = db.scalar(
        select(ProductionBatchCardLink.id).where(
            ProductionBatchCardLink.technical_card_id == card.id
        )
    )
    if batch_link is not None:
        raise TechnicalCardConflictError("Нельзя удалить техкарту: она в производственной партии")
    db.delete(card)
    db.flush()


def copy_technical_card(
    db: Session,
    card_id: int,
    *,
    created_by_platform_user_id: int | None = None,
) -> TechnicalCard:
    source = get_technical_card(db, card_id)
    if source.nomenclature_id is None:
        raise TechnicalCardValidationError("Нельзя копировать техкарту без номенклатуры")

    settings = get_technical_card_settings(db)
    order_number = f"copy-{source.id}"
    desired = (
        source.order_group.desired_date
        if source.order_group is not None
        else date.today()
    )
    planned = (
        source.order_group.tech_cards_planned_count
        if source.order_group is not None
        else 1
    )
    group = _get_or_create_order_group(
        db,
        order_number=order_number,
        planned_count=planned,
        desired_date=desired,
    )
    if source.order_group is not None and source.order_group.client_id is not None:
        if group.client_id is None:
            group.client_id = source.order_group.client_id
    card_seq = _next_group_card_seq(db, group.id)
    number = _technical_card_number(
        group.order_number, card_seq, settings.numbering_template
    )
    clone = TechnicalCard(
        sales_order_id=None,
        sales_order_item_id=None,
        order_group_id=group.id,
        number=number,
        card_seq=card_seq,
        status=TechnicalCardStatus.DRAFT,
        quantity=source.quantity,
        nomenclature_id=source.nomenclature_id,
        nomenclature_name=source.nomenclature_name,
        nomenclature_type=source.nomenclature_type,
        product_model_id=source.product_model_id,
        product_model_article=source.product_model_article,
        product_model_name=source.product_model_name,
        product_model_size_type=source.product_model_size_type,
        assembly_variant_id=source.assembly_variant_id,
        assembly_variant_name=source.assembly_variant_name,
        assembly_variant_total_cost=source.assembly_variant_total_cost,
        routing_template_id=source.routing_template_id,
        routing_template_name=source.routing_template_name,
        notes=source.notes,
        created_by_platform_user_id=created_by_platform_user_id,
        responsible_platform_user_id=created_by_platform_user_id,
        unit_lines=[],
        composition_lines=[],
        operation_lines=[],
        stage_results=[],
    )
    for line in source.unit_lines:
        clone.unit_lines.append(
            TechnicalCardUnitLine(
                unit_index=line.unit_index,
                size_type=line.size_type,
                size=line.size,
                personalization=line.personalization,
                print_number=line.print_number,
                color=line.color,
                notes=line.notes,
            )
        )
    for line in source.composition_lines:
        clone.composition_lines.append(
            TechnicalCardCompositionLine(
                sequence=line.sequence,
                line_kind=line.line_kind,
                nomenclature_id=line.nomenclature_id,
                snapshot_name=line.snapshot_name,
                planned_qty=line.planned_qty,
                fact_qty=None,
                production_stage_id=line.production_stage_id,
                unit=line.unit,
                notes=line.notes,
            )
        )
    for line in source.operation_lines:
        clone.operation_lines.append(
            TechnicalCardOperationLine(
                sequence=line.sequence,
                source_kind=line.source_kind,
                tech_operation_id=line.tech_operation_id,
                sewing_operation_id=line.sewing_operation_id,
                operation_name=line.operation_name,
                volume_unit=line.volume_unit,
                volume=Decimal(line.volume),
                stage_order=line.stage_order,
                production_stage_id=line.production_stage_id,
                stage_label=line.stage_label,
            )
        )
    db.add(clone)
    db.flush()
    ensure_qr_token(db, clone)
    db.flush()
    return get_technical_card(db, clone.id)
