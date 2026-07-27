"""Technical card generate / unit-line sync (ADR-016 / Stage 9.2.1).

Eligible = linked nomenclature `PRODUCT` (MVP). Spec is outbound (Stage 7) — not
required for generate. Routing / TechOperation snapshot applied when Stage 8
catalogs exist (ADR-017); otherwise left empty (no demo rows).
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.nomenclature import Nomenclature, NomenclatureType
from app.models.product_model import ProductModel
from app.models.sales import SalesOrder, SalesOrderItem
from app.models.tech_operation import TechOperation
from app.models.technical_card import (
    TechnicalCard,
    TechnicalCardCompositionLine,
    TechnicalCardCompositionLineKind,
    TechnicalCardOperationLine,
    TechnicalCardStageResult,
    TechnicalCardStageResultStatus,
    TechnicalCardStatus,
    TechnicalCardUnitLine,
    TechOperationVolumeUnit,
)
from dataclasses import dataclass, field

from app.schemas.technical_card import (
    TechnicalCardApplySpecification,
    TechnicalCardCompositionLineWrite,
    TechnicalCardOperationLineWrite,
    TechnicalCardPreviewLine,
    TechnicalCardPreviewRead,
    TechnicalCardSkippedLine,
    TechnicalCardUnitLineBulkItem,
    TechnicalCardUnitLineUpdate,
    TechnicalCardUnitLineWrite,
)


class TechnicalCardNotFoundError(RuntimeError):
    pass


class TechnicalCardValidationError(RuntimeError):
    pass


class TechnicalCardConflictError(RuntimeError):
    pass


@dataclass
class TechnicalCardGenerateResult:
    sales_order_id: int
    created: list[TechnicalCard] = field(default_factory=list)
    revived: list[TechnicalCard] = field(default_factory=list)
    skipped: list[TechnicalCardSkippedLine] = field(default_factory=list)


def _card_load_options():
    return (
        selectinload(TechnicalCard.composition_lines),
        selectinload(TechnicalCard.unit_lines),
        selectinload(TechnicalCard.operation_lines),
        selectinload(TechnicalCard.stage_results),
    )


def get_technical_card(db: Session, card_id: int) -> TechnicalCard:
    card = db.scalar(
        select(TechnicalCard).options(*_card_load_options()).where(TechnicalCard.id == card_id)
    )
    if card is None:
        raise TechnicalCardNotFoundError("Technical card not found")
    return card


def list_technical_cards_for_order(db: Session, order_id: int) -> list[TechnicalCard]:
    order = db.get(SalesOrder, order_id)
    if order is None:
        raise TechnicalCardNotFoundError("Order not found")
    return list(
        db.scalars(
            select(TechnicalCard)
            .options(*_card_load_options())
            .where(TechnicalCard.sales_order_id == order_id)
            .order_by(TechnicalCard.card_seq, TechnicalCard.id)
        ).all()
    )


def list_technical_cards(
    db: Session,
    *,
    sales_order_id: int | None = None,
    status: str | None = None,
    stage: str | None = None,
    search: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[tuple[TechnicalCard, str | None]]:
    """Global production list. Returns (card, order_number) pairs."""
    statement = (
        select(TechnicalCard, SalesOrder.number)
        .join(SalesOrder, SalesOrder.id == TechnicalCard.sales_order_id)
        .options(*_card_load_options())
    )
    if sales_order_id is not None:
        statement = statement.where(TechnicalCard.sales_order_id == sales_order_id)
    if status and status.strip():
        statement = statement.where(TechnicalCard.status == status.strip())
    if stage and stage.strip():
        pattern = f"%{stage.strip().lower()}%"
        statement = statement.where(
            func.lower(func.coalesce(TechnicalCard.current_stage_label, "")).like(pattern)
        )
    if search and search.strip():
        pattern = f"%{search.strip().lower()}%"
        statement = statement.where(
            func.lower(TechnicalCard.number).like(pattern)
            | func.lower(func.coalesce(TechnicalCard.nomenclature_name, "")).like(pattern)
            | func.lower(func.coalesce(TechnicalCard.product_model_article, "")).like(pattern)
            | func.lower(func.coalesce(TechnicalCard.product_model_name, "")).like(pattern)
            | func.lower(SalesOrder.number).like(pattern)
        )
    statement = (
        statement.order_by(TechnicalCard.updated_at.desc(), TechnicalCard.id.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = db.execute(statement).unique().all()
    return [(card, order_number) for card, order_number in rows]


def unit_line_count_from_quantity(quantity: Decimal) -> int:
    try:
        qty = Decimal(quantity)
    except (InvalidOperation, TypeError) as error:
        raise TechnicalCardValidationError("Invalid order line quantity") from error
    if qty < 1 or qty != qty.to_integral_value():
        raise TechnicalCardValidationError(
            "Technical card unit lines require a whole positive quantity"
        )
    return int(qty)


def _nomenclature_for_item(db: Session, item: SalesOrderItem) -> Nomenclature | None:
    if item.nomenclature_id is None:
        return None
    return db.get(Nomenclature, item.nomenclature_id)


def is_eligible_order_item(db: Session, item: SalesOrderItem) -> tuple[bool, str | None]:
    if item.nomenclature_id is None:
        return False, "no_nomenclature"
    nomenclature = _nomenclature_for_item(db, item)
    if nomenclature is None:
        return False, "nomenclature_missing"
    if nomenclature.nomenclature_type != NomenclatureType.PRODUCT:
        return False, "not_product"
    try:
        unit_line_count_from_quantity(item.quantity)
    except TechnicalCardValidationError:
        return False, "quantity_not_whole"
    return True, None


def _existing_card_by_item(
    db: Session, sales_order_item_id: int
) -> TechnicalCard | None:
    return db.scalar(
        select(TechnicalCard).where(TechnicalCard.sales_order_item_id == sales_order_item_id)
    )


def _next_card_seq(db: Session, sales_order_id: int) -> int:
    current = db.scalar(
        select(func.max(TechnicalCard.card_seq)).where(
            TechnicalCard.sales_order_id == sales_order_id
        )
    )
    return int(current or 0) + 1


def _default_unit_line(item: SalesOrderItem, unit_index: int) -> TechnicalCardUnitLine:
    return TechnicalCardUnitLine(
        unit_index=unit_index,
        size=item.size_range,
        personalization=item.personalization,
        color=item.color,
        print_number=None,
    )


def _apply_header_snapshots(
    card: TechnicalCard,
    *,
    item: SalesOrderItem,
    nomenclature: Nomenclature,
) -> None:
    card.quantity = item.quantity
    card.nomenclature_id = nomenclature.id
    card.nomenclature_name = item.snapshot_name or nomenclature.name
    card.nomenclature_type = (
        nomenclature.nomenclature_type.value
        if isinstance(nomenclature.nomenclature_type, NomenclatureType)
        else str(nomenclature.nomenclature_type)
    )
    card.product_model_id = item.product_model_id
    card.product_model_article = item.product_model_article
    card.product_model_name = item.product_model_name
    card.product_model_size_type = item.product_model_size_type
    card.assembly_variant_id = item.assembly_variant_id
    card.assembly_variant_name = item.assembly_variant_name
    card.assembly_variant_total_cost = item.assembly_variant_total_cost
    # Spec soft-ref stays empty until Stage 7 outbound; routing applied via snapshot helper.


def _apply_routing_snapshot_from_model(db: Session, card: TechnicalCard) -> None:
    """Snapshot ProductModel.default routing into TC header, stage_results, op-volume lines."""
    if card.product_model_id is None:
        return
    model = db.get(ProductModel, card.product_model_id)
    if model is None or model.default_routing_template_id is None:
        return

    from app.repositories import shop_routings as shop_routings_repo

    template = shop_routings_repo.get_routing_template(
        db, model.default_routing_template_id
    )
    if template is None or not template.is_active:
        return

    card.routing_template_id = template.id
    card.routing_template_name = template.name

    # Clear prior stage/op rows if re-applying (revive path).
    for collection in (card.stage_results, card.operation_lines):
        for row in list(collection):
            collection.remove(row)
            db.delete(row)
    db.flush()

    first_stage = None
    op_sequence = 1
    for stage in sorted(template.stage_lines, key=lambda row: row.stage_order):
        card.stage_results.append(
            TechnicalCardStageResult(
                stage_order=stage.stage_order,
                production_stage_id=stage.production_stage_id,
                stage_label=stage.stage_label,
                status=TechnicalCardStageResultStatus.PENDING,
            )
        )
        if first_stage is None:
            first_stage = stage
        if stage.tech_operation_id is None:
            continue
        op = db.get(TechOperation, stage.tech_operation_id)
        if op is None or not op.is_active:
            continue
        card.operation_lines.append(
            TechnicalCardOperationLine(
                sequence=op_sequence,
                tech_operation_id=op.id,
                operation_name=op.name,
                volume_unit=op.volume_unit,
                volume=Decimal("0"),
                stage_order=stage.stage_order,
                production_stage_id=stage.production_stage_id,
                stage_label=stage.stage_label,
            )
        )
        op_sequence += 1

    if first_stage is not None:
        card.current_stage_order = first_stage.stage_order
        card.current_stage_label = first_stage.stage_label
    db.flush()


def sync_unit_lines(db: Session, card: TechnicalCard, item: SalesOrderItem) -> TechnicalCard:
    """Align unit-line count with order-item quantity (add / remove from the end)."""
    if card.status == TechnicalCardStatus.CANCELLED:
        raise TechnicalCardValidationError("Cannot sync unit lines on a cancelled card")
    if card.status == TechnicalCardStatus.COMPLETED:
        raise TechnicalCardValidationError("Cannot sync unit lines on a completed card")

    target = unit_line_count_from_quantity(item.quantity)
    card.quantity = item.quantity
    lines = sorted(card.unit_lines, key=lambda row: row.unit_index)

    while len(lines) < target:
        next_index = (lines[-1].unit_index + 1) if lines else 1
        line = _default_unit_line(item, next_index)
        card.unit_lines.append(line)
        lines.append(line)

    while len(lines) > target:
        line = lines.pop()
        card.unit_lines.remove(line)
        db.delete(line)

    db.flush()
    return card


def _seed_pattern_line_from_model(db: Session, card: TechnicalCard) -> None:
    if card.product_model_id is None:
        return
    model = db.get(ProductModel, card.product_model_id)
    if model is None or not model.patterns_path:
        return
    card.composition_lines.append(
        TechnicalCardCompositionLine(
            sequence=1,
            line_kind=TechnicalCardCompositionLineKind.PATTERN,
            snapshot_name=f"Лекала: {model.article}",
            notes=model.patterns_path,
        )
    )


def _build_new_card(
    db: Session,
    *,
    order: SalesOrder,
    item: SalesOrderItem,
    nomenclature: Nomenclature,
) -> TechnicalCard:
    card_seq = _next_card_seq(db, order.id)
    card = TechnicalCard(
        sales_order_id=order.id,
        sales_order_item_id=item.id,
        number=f"{order.number}-{card_seq}",
        card_seq=card_seq,
        status=TechnicalCardStatus.DRAFT,
        quantity=item.quantity,
        unit_lines=[],
        composition_lines=[],
        operation_lines=[],
        stage_results=[],
    )
    _apply_header_snapshots(card, item=item, nomenclature=nomenclature)
    for index in range(1, unit_line_count_from_quantity(item.quantity) + 1):
        card.unit_lines.append(_default_unit_line(item, index))
    _seed_pattern_line_from_model(db, card)
    _apply_routing_snapshot_from_model(db, card)
    db.add(card)
    db.flush()
    return card


def _revive_cancelled_card(
    db: Session,
    *,
    card: TechnicalCard,
    item: SalesOrderItem,
    nomenclature: Nomenclature,
) -> TechnicalCard:
    card.status = TechnicalCardStatus.DRAFT
    _apply_header_snapshots(card, item=item, nomenclature=nomenclature)
    # Drop prior child rows and rebuild unit lines from current qty.
    for collection in (
        card.composition_lines,
        card.operation_lines,
        card.stage_results,
        card.unit_lines,
    ):
        for row in list(collection):
            collection.remove(row)
            db.delete(row)
    db.flush()
    for index in range(1, unit_line_count_from_quantity(item.quantity) + 1):
        card.unit_lines.append(_default_unit_line(item, index))
    _seed_pattern_line_from_model(db, card)
    _apply_routing_snapshot_from_model(db, card)
    db.flush()
    return card


def preview_technical_cards(db: Session, order_id: int) -> TechnicalCardPreviewRead:
    order = db.get(SalesOrder, order_id)
    if order is None:
        raise TechnicalCardNotFoundError("Order not found")

    items = list(
        db.scalars(
            select(SalesOrderItem)
            .where(SalesOrderItem.order_id == order_id)
            .order_by(SalesOrderItem.position, SalesOrderItem.id)
        ).all()
    )
    lines: list[TechnicalCardPreviewLine] = []
    create_count = 0
    revive_count = 0

    for item in items:
        eligible, skip_reason = is_eligible_order_item(db, item)
        existing = _existing_card_by_item(db, item.id)
        planned: int | None = None
        if eligible:
            planned = unit_line_count_from_quantity(item.quantity)

        would_create = False
        would_revive = False
        if eligible and existing is None:
            would_create = True
            create_count += 1
        elif eligible and existing is not None and existing.status == TechnicalCardStatus.CANCELLED:
            would_revive = True
            revive_count += 1

        lines.append(
            TechnicalCardPreviewLine(
                sales_order_item_id=item.id,
                position=item.position,
                snapshot_name=item.snapshot_name,
                quantity=item.quantity,
                eligible=eligible,
                skip_reason=None if eligible else skip_reason,
                existing_card_id=existing.id if existing else None,
                existing_status=existing.status if existing else None,
                would_create=would_create,
                would_revive=would_revive,
                planned_unit_line_count=planned,
            )
        )

    return TechnicalCardPreviewRead(
        sales_order_id=order.id,
        order_number=order.number,
        lines=lines,
        create_count=create_count,
        revive_count=revive_count,
    )


def generate_technical_cards(
    db: Session,
    order_id: int,
    *,
    sales_order_item_ids: list[int] | None = None,
) -> TechnicalCardGenerateResult:
    order = db.get(SalesOrder, order_id)
    if order is None:
        raise TechnicalCardNotFoundError("Order not found")

    items = list(
        db.scalars(
            select(SalesOrderItem)
            .where(SalesOrderItem.order_id == order_id)
            .order_by(SalesOrderItem.position, SalesOrderItem.id)
        ).all()
    )
    if sales_order_item_ids is not None:
        wanted = set(sales_order_item_ids)
        unknown = wanted - {item.id for item in items}
        if unknown:
            raise TechnicalCardValidationError(
                f"Order item(s) not on this order: {sorted(unknown)}"
            )
        items = [item for item in items if item.id in wanted]

    created: list[TechnicalCard] = []
    revived: list[TechnicalCard] = []
    skipped: list[TechnicalCardSkippedLine] = []

    for item in items:
        eligible, skip_reason = is_eligible_order_item(db, item)
        existing = _existing_card_by_item(db, item.id)

        if not eligible:
            skipped.append(
                TechnicalCardSkippedLine(
                    sales_order_item_id=item.id,
                    reason=skip_reason or "not_eligible",
                    existing_card_id=existing.id if existing else None,
                )
            )
            continue

        nomenclature = _nomenclature_for_item(db, item)
        assert nomenclature is not None

        if existing is None:
            card = _build_new_card(
                db, order=order, item=item, nomenclature=nomenclature
            )
            created.append(card)
            continue

        if existing.status == TechnicalCardStatus.CANCELLED:
            card = _revive_cancelled_card(
                db,
                card=existing,
                item=item,
                nomenclature=nomenclature,
            )
            revived.append(card)
            continue

        skipped.append(
            TechnicalCardSkippedLine(
                sales_order_item_id=item.id,
                reason="card_exists",
                existing_card_id=existing.id,
            )
        )

    db.commit()
    created_ids = [card.id for card in created]
    revived_ids = [card.id for card in revived]
    return TechnicalCardGenerateResult(
        sales_order_id=order.id,
        created=[get_technical_card(db, card_id) for card_id in created_ids],
        revived=[get_technical_card(db, card_id) for card_id in revived_ids],
        skipped=skipped,
    )


def sync_technical_card_unit_lines(db: Session, card_id: int) -> TechnicalCard:
    card = get_technical_card(db, card_id)
    item = db.get(SalesOrderItem, card.sales_order_item_id)
    if item is None:
        raise TechnicalCardValidationError("Order item not found for technical card")
    sync_unit_lines(db, card, item)
    db.commit()
    return get_technical_card(db, card_id)


def cancel_draft_technical_card(db: Session, card_id: int) -> TechnicalCard:
    card = get_technical_card(db, card_id)
    if card.status != TechnicalCardStatus.DRAFT:
        raise TechnicalCardConflictError("Only draft technical cards can be cancelled")
    card.status = TechnicalCardStatus.CANCELLED
    db.commit()
    return get_technical_card(db, card_id)


def _assert_composition_editable(card: TechnicalCard) -> None:
    if card.status in {TechnicalCardStatus.CANCELLED, TechnicalCardStatus.COMPLETED}:
        raise TechnicalCardValidationError(
            "Cannot edit composition on a cancelled or completed card"
        )


def _validate_composition_payload(
    db: Session, lines: list[TechnicalCardCompositionLineWrite]
) -> None:
    sequences = [line.sequence for line in lines]
    if len(sequences) != len(set(sequences)):
        raise TechnicalCardValidationError("Composition line sequences must be unique")

    for line in lines:
        if line.line_kind == TechnicalCardCompositionLineKind.MATERIAL:
            if line.nomenclature_id is None:
                raise TechnicalCardValidationError(
                    "Material composition lines require nomenclature_id"
                )
            nomenclature = db.get(Nomenclature, line.nomenclature_id)
            if nomenclature is None:
                raise TechnicalCardValidationError(
                    f"Nomenclature {line.nomenclature_id} not found"
                )
            if nomenclature.nomenclature_type != NomenclatureType.MATERIAL:
                raise TechnicalCardValidationError(
                    "Material composition lines must reference MATERIAL nomenclature"
                )
            if not line.snapshot_name:
                raise TechnicalCardValidationError("Material snapshot_name is required")
        elif line.line_kind == TechnicalCardCompositionLineKind.PATTERN:
            if line.nomenclature_id is not None:
                raise TechnicalCardValidationError(
                    "Pattern composition lines must not reference nomenclature_id"
                )
        elif line.line_kind == TechnicalCardCompositionLineKind.NOTE:
            if line.nomenclature_id is not None:
                raise TechnicalCardValidationError(
                    "Note composition lines must not reference nomenclature_id"
                )
        else:
            raise TechnicalCardValidationError(f"Unsupported line_kind: {line.line_kind}")


def _clear_composition_lines(db: Session, card: TechnicalCard) -> None:
    for row in list(card.composition_lines):
        card.composition_lines.remove(row)
        db.delete(row)
    db.flush()


def _append_composition_lines(
    card: TechnicalCard, lines: list[TechnicalCardCompositionLineWrite]
) -> None:
    for line in sorted(lines, key=lambda row: row.sequence):
        card.composition_lines.append(
            TechnicalCardCompositionLine(
                sequence=line.sequence,
                line_kind=line.line_kind,
                nomenclature_id=line.nomenclature_id,
                snapshot_name=line.snapshot_name,
                quantity=line.quantity,
                unit=line.unit,
                notes=line.notes,
            )
        )


def replace_composition_lines(
    db: Session,
    card_id: int,
    lines: list[TechnicalCardCompositionLineWrite],
) -> TechnicalCard:
    card = get_technical_card(db, card_id)
    _assert_composition_editable(card)
    _validate_composition_payload(db, lines)
    _clear_composition_lines(db, card)
    _append_composition_lines(card, lines)
    db.commit()
    return get_technical_card(db, card_id)


def refresh_model_and_pattern_composition(db: Session, card_id: int) -> TechnicalCard:
    """Refresh model header snapshots and ensure a PATTERN line from patterns_path."""
    card = get_technical_card(db, card_id)
    _assert_composition_editable(card)

    model_id = card.product_model_id
    if model_id is None:
        item = db.get(SalesOrderItem, card.sales_order_item_id)
        if item is not None:
            model_id = item.product_model_id
    if model_id is None:
        raise TechnicalCardValidationError("Technical card has no product model to refresh")

    model = db.get(ProductModel, model_id)
    if model is None:
        raise TechnicalCardValidationError("Product model not found")

    card.product_model_id = model.id
    card.product_model_article = model.article
    card.product_model_name = model.name
    card.product_model_size_type = (
        model.size_type.value
        if hasattr(model.size_type, "value")
        else str(model.size_type)
    )

    # Drop existing pattern lines, keep materials/notes.
    for row in list(card.composition_lines):
        if row.line_kind == TechnicalCardCompositionLineKind.PATTERN:
            card.composition_lines.remove(row)
            db.delete(row)
    db.flush()

    if model.patterns_path:
        used = {row.sequence for row in card.composition_lines}
        sequence = 1
        while sequence in used:
            sequence += 1
        card.composition_lines.append(
            TechnicalCardCompositionLine(
                sequence=sequence,
                line_kind=TechnicalCardCompositionLineKind.PATTERN,
                snapshot_name=f"Лекала: {model.article}",
                notes=model.patterns_path,
            )
        )

    db.commit()
    return get_technical_card(db, card_id)


def apply_specification_version(
    db: Session,
    card_id: int,
    payload: TechnicalCardApplySpecification,
) -> TechnicalCard:
    """Copy approved Spec version snapshot onto the card (ADR-004 / ADR-016).

    Stage 7 catalog is not loaded here: approved lines must be provided explicitly.
    Empty lines are allowed (partial composition) but version stamp is required.
    """
    card = get_technical_card(db, card_id)
    _assert_composition_editable(card)
    _validate_composition_payload(db, payload.lines)

    card.specification_version_id = payload.specification_version_id
    card.specification_version_label = payload.specification_version_label
    _clear_composition_lines(db, card)
    _append_composition_lines(card, payload.lines)
    db.commit()
    return get_technical_card(db, card_id)


def _assert_unit_lines_editable(card: TechnicalCard) -> None:
    if card.status in {TechnicalCardStatus.CANCELLED, TechnicalCardStatus.COMPLETED}:
        raise TechnicalCardValidationError(
            "Cannot edit unit lines on a cancelled or completed card"
        )


def _order_item_for_card(db: Session, card: TechnicalCard) -> SalesOrderItem:
    item = db.get(SalesOrderItem, card.sales_order_item_id)
    if item is None:
        raise TechnicalCardValidationError("Order item not found for technical card")
    return item


def list_unit_lines(db: Session, card_id: int) -> list[TechnicalCardUnitLine]:
    card = get_technical_card(db, card_id)
    return sorted(card.unit_lines, key=lambda row: row.unit_index)


def _apply_unit_line_fields(line: TechnicalCardUnitLine, changes: dict) -> None:
    for field_name, value in changes.items():
        setattr(line, field_name, value)


def update_unit_line(
    db: Session,
    card_id: int,
    line_id: int,
    payload: TechnicalCardUnitLineUpdate,
) -> TechnicalCard:
    card = get_technical_card(db, card_id)
    _assert_unit_lines_editable(card)
    line = next((row for row in card.unit_lines if row.id == line_id), None)
    if line is None:
        raise TechnicalCardNotFoundError("Unit line not found")
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise TechnicalCardValidationError("No fields to update")
    _apply_unit_line_fields(line, changes)
    db.commit()
    return get_technical_card(db, card_id)


def _resolve_unit_line(
    card: TechnicalCard, item: TechnicalCardUnitLineBulkItem
) -> TechnicalCardUnitLine:
    if item.id is not None:
        line = next((row for row in card.unit_lines if row.id == item.id), None)
        if line is None:
            raise TechnicalCardNotFoundError(f"Unit line id={item.id} not found")
        if item.unit_index is not None and item.unit_index != line.unit_index:
            raise TechnicalCardValidationError(
                "unit_index does not match the targeted unit line id"
            )
        return line
    if item.unit_index is None:
        raise TechnicalCardValidationError("Each bulk line requires id or unit_index")
    line = next((row for row in card.unit_lines if row.unit_index == item.unit_index), None)
    if line is None:
        raise TechnicalCardNotFoundError(
            f"Unit line unit_index={item.unit_index} not found"
        )
    return line


def bulk_update_unit_lines(
    db: Session,
    card_id: int,
    items: list[TechnicalCardUnitLineBulkItem],
) -> TechnicalCard:
    card = get_technical_card(db, card_id)
    _assert_unit_lines_editable(card)
    for item in items:
        line = _resolve_unit_line(card, item)
        changes = item.model_dump(exclude_unset=True, exclude={"id", "unit_index"})
        if not changes:
            raise TechnicalCardValidationError(
                f"No fields to update for unit_index={line.unit_index}"
            )
        _apply_unit_line_fields(line, changes)
    db.commit()
    return get_technical_card(db, card_id)


def replace_unit_lines(
    db: Session,
    card_id: int,
    lines: list[TechnicalCardUnitLineWrite],
) -> TechnicalCard:
    """Replace characteristic fields for all unit rows; count must equal quantity."""
    card = get_technical_card(db, card_id)
    _assert_unit_lines_editable(card)
    item = _order_item_for_card(db, card)
    expected = unit_line_count_from_quantity(item.quantity)
    if len(lines) != expected:
        raise TechnicalCardValidationError(
            f"Unit line count must equal order quantity ({expected})"
        )
    indices = [line.unit_index for line in lines]
    if sorted(indices) != list(range(1, expected + 1)):
        raise TechnicalCardValidationError(
            f"unit_index values must be exactly 1..{expected}"
        )

    by_index = {line.unit_index: line for line in card.unit_lines}
    if len(by_index) != expected:
        # Auto-heal count from order qty, then apply payloads.
        sync_unit_lines(db, card, item)
        by_index = {line.unit_index: line for line in card.unit_lines}

    for payload in lines:
        target = by_index[payload.unit_index]
        target.size = payload.size
        target.personalization = payload.personalization
        target.print_number = payload.print_number
        target.color = payload.color
        target.notes = payload.notes
    card.quantity = item.quantity
    db.commit()
    return get_technical_card(db, card_id)


def reset_unit_lines_from_order_defaults(db: Session, card_id: int) -> TechnicalCard:
    """Re-apply order-item snapshot defaults to every unit line (per-row edits cleared)."""
    card = get_technical_card(db, card_id)
    _assert_unit_lines_editable(card)
    item = _order_item_for_card(db, card)
    sync_unit_lines(db, card, item)
    for line in card.unit_lines:
        line.size = item.size_range
        line.personalization = item.personalization
        line.color = item.color
        line.print_number = None
        line.notes = None
    db.commit()
    return get_technical_card(db, card_id)


def import_unit_lines(
    db: Session,
    card_id: int,
    items: list[TechnicalCardUnitLineBulkItem],
) -> TechnicalCard:
    """Import hook: patch rows by unit_index (or id); does not change row count."""
    return bulk_update_unit_lines(db, card_id, items)


def _assert_operation_lines_editable(card: TechnicalCard) -> None:
    if card.status in {TechnicalCardStatus.CANCELLED, TechnicalCardStatus.COMPLETED}:
        raise TechnicalCardValidationError(
            "Cannot edit operation volume lines on a cancelled or completed card"
        )


def _tech_operations_table_available(db: Session) -> bool:
    """Soft detect Stage 8.1.3 catalog without requiring the model to exist yet."""
    bind = db.get_bind()
    if bind is None:
        return False
    from sqlalchemy import inspect as sa_inspect

    return "tech_operations" in sa_inspect(bind).get_table_names()


def _load_tech_operation_row(db: Session, tech_operation_id: int) -> dict | None:
    if not _tech_operations_table_available(db):
        return None
    from sqlalchemy import text

    result = db.execute(
        text(
            "SELECT id, name, volume_unit FROM tech_operations "
            "WHERE id = :id AND is_active = true"
        ),
        {"id": tech_operation_id},
    ).mappings().first()
    return dict(result) if result is not None else None


def _validate_operation_lines_payload(
    db: Session, lines: list[TechnicalCardOperationLineWrite]
) -> None:
    sequences = [line.sequence for line in lines]
    if len(sequences) != len(set(sequences)):
        raise TechnicalCardValidationError("Operation line sequences must be unique")

    stage_orders = [line.stage_order for line in lines if line.stage_order is not None]
    if len(stage_orders) != len(set(stage_orders)):
        raise TechnicalCardValidationError(
            "stage_order values must be unique when set on operation lines"
        )

    catalog_available = _tech_operations_table_available(db)
    for line in lines:
        if line.volume_unit not in {
            TechOperationVolumeUnit.LINEAR_METERS,
            TechOperationVolumeUnit.PIECES,
        }:
            raise TechnicalCardValidationError(
                f"Unsupported volume_unit: {line.volume_unit}"
            )
        if line.tech_operation_id is None:
            continue
        if not catalog_available:
            # Soft id allowed as opaque snapshot until 8.1.3; no live unit check.
            continue
        catalog = _load_tech_operation_row(db, line.tech_operation_id)
        if catalog is None:
            raise TechnicalCardValidationError(
                f"TechOperation {line.tech_operation_id} not found or inactive"
            )
        catalog_unit = catalog["volume_unit"]
        line_unit = (
            line.volume_unit.value
            if isinstance(line.volume_unit, TechOperationVolumeUnit)
            else str(line.volume_unit)
        )
        if catalog_unit != line_unit:
            raise TechnicalCardValidationError(
                "volume_unit must match TechOperation catalog snapshot"
            )


def list_operation_lines(db: Session, card_id: int) -> list[TechnicalCardOperationLine]:
    card = get_technical_card(db, card_id)
    return sorted(card.operation_lines, key=lambda row: (row.sequence, row.id))


def _clear_operation_lines(db: Session, card: TechnicalCard) -> None:
    for row in list(card.operation_lines):
        card.operation_lines.remove(row)
        db.delete(row)
    db.flush()


def _append_operation_lines(
    card: TechnicalCard, lines: list[TechnicalCardOperationLineWrite]
) -> None:
    for line in sorted(lines, key=lambda row: row.sequence):
        card.operation_lines.append(
            TechnicalCardOperationLine(
                sequence=line.sequence,
                tech_operation_id=line.tech_operation_id,
                operation_name=line.operation_name,
                volume_unit=line.volume_unit,
                volume=line.volume,
                stage_order=line.stage_order,
                stage_label=line.stage_label,
            )
        )


def replace_operation_lines(
    db: Session,
    card_id: int,
    lines: list[TechnicalCardOperationLineWrite],
) -> TechnicalCard:
    card = get_technical_card(db, card_id)
    _assert_operation_lines_editable(card)
    if card.status != TechnicalCardStatus.DRAFT:
        raise TechnicalCardValidationError(
            "Full operation-line replace is allowed only while the card is draft; "
            "use volume patch to adjust volumes after generate"
        )
    _validate_operation_lines_payload(db, lines)
    _clear_operation_lines(db, card)
    _append_operation_lines(card, lines)
    db.commit()
    return get_technical_card(db, card_id)


def update_operation_line_volume(
    db: Session,
    card_id: int,
    line_id: int,
    *,
    volume: Decimal,
    operation_name: str | None = None,
) -> TechnicalCard:
    card = get_technical_card(db, card_id)
    _assert_operation_lines_editable(card)
    line = next((row for row in card.operation_lines if row.id == line_id), None)
    if line is None:
        raise TechnicalCardNotFoundError("Operation volume line not found")
    line.volume = volume
    if operation_name is not None:
        if card.status != TechnicalCardStatus.DRAFT:
            raise TechnicalCardValidationError(
                "operation_name can only be edited while the card is draft"
            )
        line.operation_name = operation_name
    db.commit()
    return get_technical_card(db, card_id)


def prefill_operation_lines_from_catalog(
    db: Session, card_id: int
) -> tuple[TechnicalCard, bool, bool, str]:
    """Prefill from TechOperation catalog when `8.1.3` table exists; else no-op (no demo)."""
    card = get_technical_card(db, card_id)
    _assert_operation_lines_editable(card)

    if card.operation_lines:
        return (
            card,
            False,
            _tech_operations_table_available(db),
            "Operation lines already present; prefill skipped",
        )

    if not _tech_operations_table_available(db):
        return (
            card,
            False,
            False,
            "TechOperation catalog not available yet (Stage 8.1.3); left empty",
        )

    from sqlalchemy import text

    rows = db.execute(
        text(
            "SELECT id, name, volume_unit FROM tech_operations "
            "WHERE is_active = true ORDER BY id"
        )
    ).mappings().all()
    if not rows:
        return (
            card,
            False,
            True,
            "TechOperation catalog is empty; left empty (no demo rows)",
        )

    payloads = [
        TechnicalCardOperationLineWrite(
            sequence=index,
            tech_operation_id=int(row["id"]),
            operation_name=str(row["name"]),
            volume_unit=TechOperationVolumeUnit(row["volume_unit"]),
            volume=Decimal("0"),
        )
        for index, row in enumerate(rows, start=1)
    ]
    _validate_operation_lines_payload(db, payloads)
    _append_operation_lines(card, payloads)
    db.commit()
    return (
        get_technical_card(db, card_id),
        True,
        True,
        f"Prefilled {len(payloads)} operation line(s) from TechOperation catalog",
    )
