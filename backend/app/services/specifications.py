"""Specification plan+fact report service (ADR-031 / Stage 7.2)."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.production_order import ProductionBatch, ProductionOrder
from app.models.sales import SalesOrder
from app.models.sewing_work_ledger import (
    SewingWorkKind,
    SewingWorkLedgerEntry,
    SewingWorkStatus,
)
from app.models.specification import (
    Specification,
    SpecificationMaterialLine,
    SpecificationOperationLine,
    SpecificationOperationSourceKind,
    SpecificationProductLine,
    SpecificationVersion,
    SpecificationVersionStatus,
)
from app.models.technical_card import (
    TechnicalCard,
    TechnicalCardCompositionLineKind,
    TechnicalCardOperationLine,
    TechnicalCardOperationLineSourceKind,
    TechnicalCardStageResult,
    TechnicalCardStageResultStatus,
    TechnicalCardStatus,
)
from app.schemas.specification import (
    SpecificationListItem,
    SpecificationMaterialLineRead,
    SpecificationOperationLineRead,
    SpecificationProductLineRead,
    SpecificationRead,
    SpecificationVersionRead,
    SpecificationVersionSummary,
)

_TERMINAL_CARD_STATUSES = {
    TechnicalCardStatus.COMPLETED.value,
    TechnicalCardStatus.CANCELLED.value,
}


class SpecificationNotFoundError(Exception):
    pass


class SpecificationValidationError(Exception):
    pass


class SpecificationConflictError(Exception):
    pass


def _now() -> datetime:
    return datetime.now(UTC)


def _as_status(value: object) -> str:
    return str(getattr(value, "value", value))


def _qty(value: Decimal | int | float | None) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(str(value))


def _current_version(spec: Specification) -> SpecificationVersion | None:
    if not spec.versions:
        return None
    drafts = [
        row
        for row in spec.versions
        if _as_status(row.status) == SpecificationVersionStatus.DRAFT.value
    ]
    if drafts:
        return max(drafts, key=lambda row: row.version_no)
    approved = [
        row
        for row in spec.versions
        if _as_status(row.status) == SpecificationVersionStatus.APPROVED.value
    ]
    if approved:
        return approved[0]
    return max(spec.versions, key=lambda row: row.version_no)


def _header_load_options():
    return (
        selectinload(Specification.versions).selectinload(
            SpecificationVersion.product_lines
        ),
        selectinload(Specification.versions).selectinload(
            SpecificationVersion.material_lines
        ),
        selectinload(Specification.versions).selectinload(
            SpecificationVersion.operation_lines
        ),
        selectinload(Specification.batch),
        selectinload(Specification.sales_order),
        selectinload(Specification.production_order),
    )


def _list_load_options():
    return (
        selectinload(Specification.versions),
        selectinload(Specification.batch),
        selectinload(Specification.sales_order),
        selectinload(Specification.production_order),
    )


def _to_list_item(spec: Specification) -> SpecificationListItem:
    current = _current_version(spec)
    return SpecificationListItem(
        id=spec.id,
        number=spec.number,
        production_batch_id=spec.production_batch_id,
        production_batch_number=spec.batch.number if spec.batch is not None else None,
        sales_order_id=spec.sales_order_id,
        sales_order_number=(
            spec.sales_order.number if spec.sales_order is not None else None
        ),
        production_order_id=spec.production_order_id,
        production_order_number=(
            spec.production_order.number if spec.production_order is not None else None
        ),
        current_version_no=current.version_no if current is not None else None,
        current_version_status=(
            _as_status(current.status) if current is not None else None
        ),
        created_at=spec.created_at,
        updated_at=spec.updated_at,
    )


def _to_version_summary(row: SpecificationVersion) -> SpecificationVersionSummary:
    return SpecificationVersionSummary.model_validate(row)


def _to_version_read(row: SpecificationVersion) -> SpecificationVersionRead:
    return SpecificationVersionRead(
        **_to_version_summary(row).model_dump(),
        product_lines=[
            SpecificationProductLineRead.model_validate(line)
            for line in row.product_lines
        ],
        material_lines=[
            SpecificationMaterialLineRead.model_validate(line)
            for line in row.material_lines
        ],
        operation_lines=[
            SpecificationOperationLineRead.model_validate(line)
            for line in row.operation_lines
        ],
    )


def _to_read(spec: Specification) -> SpecificationRead:
    current = _current_version(spec)
    item = _to_list_item(spec)
    return SpecificationRead(
        **item.model_dump(),
        notes=spec.notes,
        versions=[_to_version_summary(row) for row in spec.versions],
        current_version=_to_version_read(current) if current is not None else None,
    )


def _get_spec_or_raise(db: Session, specification_id: int) -> Specification:
    spec = db.scalar(
        select(Specification)
        .where(Specification.id == specification_id)
        .options(*_header_load_options())
    )
    if spec is None:
        raise SpecificationNotFoundError("Спецификация не найдена")
    return spec


def list_specifications(
    db: Session,
    *,
    production_batch_id: int | None = None,
    production_order_id: int | None = None,
    sales_order_id: int | None = None,
    status: str | None = None,
    search: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[SpecificationListItem]:
    statement: Select[tuple[Specification]] = select(Specification).options(
        *_list_load_options()
    )
    if production_batch_id is not None:
        statement = statement.where(
            Specification.production_batch_id == production_batch_id
        )
    if production_order_id is not None:
        statement = statement.where(
            Specification.production_order_id == production_order_id
        )
    if sales_order_id is not None:
        statement = statement.where(Specification.sales_order_id == sales_order_id)
    needle = (search or "").strip()
    if needle:
        pattern = f"%{needle.lower()}%"
        statement = (
            statement.join(Specification.batch)
            .join(Specification.sales_order)
            .join(Specification.production_order)
            .where(
                or_(
                    func.lower(Specification.number).like(pattern),
                    func.lower(ProductionBatch.number).like(pattern),
                    func.lower(SalesOrder.number).like(pattern),
                    func.lower(ProductionOrder.number).like(pattern),
                )
            )
        )
    rows = list(
        db.scalars(
            statement.order_by(Specification.updated_at.desc()).offset(offset).limit(
                limit
            )
        )
        .unique()
        .all()
    )
    items = [_to_list_item(row) for row in rows]
    if status:
        wanted = status.strip().lower()
        items = [
            item
            for item in items
            if (item.current_version_status or "").lower() == wanted
        ]
    return items


def get_specification(db: Session, specification_id: int) -> SpecificationRead:
    return _to_read(_get_spec_or_raise(db, specification_id))


def _load_batch(db: Session, batch_id: int) -> ProductionBatch:
    batch = db.scalar(
        select(ProductionBatch)
        .where(ProductionBatch.id == batch_id)
        .options(
            selectinload(ProductionBatch.card_links),
            selectinload(ProductionBatch.production_order),
            selectinload(ProductionBatch.specification).selectinload(
                Specification.versions
            ),
        )
    )
    if batch is None:
        raise SpecificationValidationError("Партия не найдена")
    return batch


def _linked_cards(db: Session, batch: ProductionBatch) -> list[TechnicalCard]:
    ids = [link.technical_card_id for link in batch.card_links]
    if not ids:
        return []
    return list(
        db.scalars(
            select(TechnicalCard)
            .where(TechnicalCard.id.in_(ids))
            .options(
                selectinload(TechnicalCard.composition_lines),
                selectinload(TechnicalCard.operation_lines),
                selectinload(TechnicalCard.stage_results),
            )
            .order_by(TechnicalCard.id)
        ).all()
    )


def _stage_for_operation(
    card: TechnicalCard,
    op_line: TechnicalCardOperationLine,
) -> TechnicalCardStageResult | None:
    for result in card.stage_results:
        if (
            op_line.production_stage_id is not None
            and result.production_stage_id == op_line.production_stage_id
        ):
            return result
        if (
            op_line.stage_order is not None
            and result.stage_order == op_line.stage_order
        ):
            return result
    return None


def _sewing_completed_qty(
    db: Session,
    card_ids: list[int],
) -> tuple[dict[tuple[int, int | None], Decimal], dict[int, Decimal]]:
    by_op: dict[tuple[int, int | None], Decimal] = {}
    by_line: dict[int, Decimal] = {}
    if not card_ids:
        return by_op, by_line
    rows = db.execute(
        select(
            SewingWorkLedgerEntry.technical_card_id,
            TechnicalCardOperationLine.sewing_operation_id,
            SewingWorkLedgerEntry.operation_line_id,
            SewingWorkLedgerEntry.qty,
        )
        .outerjoin(
            TechnicalCardOperationLine,
            TechnicalCardOperationLine.id == SewingWorkLedgerEntry.operation_line_id,
        )
        .where(
            SewingWorkLedgerEntry.technical_card_id.in_(card_ids),
            SewingWorkLedgerEntry.status == SewingWorkStatus.COMPLETED,
            SewingWorkLedgerEntry.kind == SewingWorkKind.OPERATION,
        )
    ).all()
    for card_id, sewing_op_id, op_line_id, qty in rows:
        amount = _qty(qty)
        key = (int(card_id), int(sewing_op_id) if sewing_op_id is not None else None)
        by_op[key] = by_op.get(key, Decimal("0")) + amount
        if op_line_id is not None:
            by_line[int(op_line_id)] = by_line.get(int(op_line_id), Decimal("0")) + amount
    return by_op, by_line


def _rebuild_draft_lines(
    db: Session,
    version: SpecificationVersion,
    cards: list[TechnicalCard],
) -> None:
    version.product_lines.clear()
    version.material_lines.clear()
    version.operation_lines.clear()
    db.flush()

    materials: dict[
        tuple[int | None, str | None, int | None], SpecificationMaterialLine
    ] = {}
    sewing_by_op, sewing_by_line = _sewing_completed_qty(
        db, [card.id for card in cards]
    )
    op_seq = 1
    for index, card in enumerate(cards, start=1):
        version.product_lines.append(
            SpecificationProductLine(
                sequence=index,
                technical_card_id=card.id,
                sales_order_item_id=card.sales_order_item_id,
                nomenclature_id=card.nomenclature_id,
                nomenclature_name=card.nomenclature_name,
                nomenclature_type=card.nomenclature_type,
                product_model_id=card.product_model_id,
                product_model_article=card.product_model_article,
                product_model_name=card.product_model_name,
                assembly_variant_id=card.assembly_variant_id,
                assembly_variant_name=card.assembly_variant_name,
                quantity=card.quantity,
            )
        )
        for line in card.composition_lines:
            if (
                _as_status(line.line_kind)
                != TechnicalCardCompositionLineKind.MATERIAL.value
            ):
                continue
            unit = (line.unit or "").strip() or None
            key = (line.nomenclature_id, unit, line.production_stage_id)
            current = materials.get(key)
            if current is None:
                current = SpecificationMaterialLine(
                    sequence=len(materials) + 1,
                    nomenclature_id=line.nomenclature_id,
                    snapshot_name=line.snapshot_name,
                    unit=unit,
                    production_stage_id=line.production_stage_id,
                    planned_qty=Decimal("0"),
                    fact_qty=Decimal("0"),
                )
                materials[key] = current
            current.planned_qty = _qty(current.planned_qty) + _qty(line.planned_qty)
            current.fact_qty = _qty(current.fact_qty) + _qty(line.fact_qty)
        for op_line in card.operation_lines:
            source = _as_status(op_line.source_kind)
            stage = _stage_for_operation(card, op_line)
            stage_done = (
                stage is not None
                and _as_status(stage.status)
                == TechnicalCardStageResultStatus.COMPLETED.value
            )
            planned = _qty(op_line.volume)
            if source == TechnicalCardOperationLineSourceKind.SEWING.value:
                fact = sewing_by_op.get(
                    (card.id, op_line.sewing_operation_id),
                    Decimal("0"),
                )
                if fact == 0:
                    fact = sewing_by_line.get(op_line.id, Decimal("0"))
            else:
                fact = planned if stage_done else Decimal("0")
            duration = (
                stage.duration_seconds if stage_done and stage is not None else None
            )
            performer = (
                stage.performer_name if stage_done and stage is not None else None
            )
            version.operation_lines.append(
                SpecificationOperationLine(
                    sequence=op_seq,
                    source_kind=(
                        SpecificationOperationSourceKind.SEWING
                        if source == SpecificationOperationSourceKind.SEWING.value
                        else SpecificationOperationSourceKind.ROUTING
                    ),
                    technical_card_id=card.id,
                    tech_operation_id=op_line.tech_operation_id,
                    sewing_operation_id=op_line.sewing_operation_id,
                    operation_name=op_line.operation_name,
                    volume_unit=_as_status(op_line.volume_unit),
                    planned_volume=planned,
                    fact_volume=fact,
                    duration_seconds=duration,
                    performer_name=performer,
                    production_stage_id=op_line.production_stage_id,
                    stage_label=op_line.stage_label
                    or (stage.stage_label if stage else None),
                )
            )
            op_seq += 1
    version.material_lines.extend(
        sorted(materials.values(), key=lambda row: row.sequence)
    )
    db.flush()


def _ensure_draft(
    db: Session,
    spec: Specification,
) -> SpecificationVersion:
    current = _current_version(spec)
    if (
        current is not None
        and _as_status(current.status) == SpecificationVersionStatus.DRAFT.value
    ):
        return current
    next_no = max((row.version_no for row in spec.versions), default=0) + 1
    draft = SpecificationVersion(
        specification_id=spec.id,
        version_no=next_no,
        status=SpecificationVersionStatus.DRAFT,
    )
    db.add(draft)
    spec.versions.append(draft)
    db.flush()
    return draft


def create_specification(db: Session, production_batch_id: int) -> SpecificationRead:
    batch = _load_batch(db, production_batch_id)
    cards = _linked_cards(db, batch)
    if not cards:
        raise SpecificationValidationError(
            "Нельзя создать спецификацию: у партии нет связанных техкарт"
        )
    spec = batch.specification
    created_header = spec is None
    if created_header:
        order = batch.production_order
        spec = Specification(
            production_batch_id=batch.id,
            number=f"{batch.number}-SPEC",
            sales_order_id=order.sales_order_id,
            production_order_id=order.id,
        )
        db.add(spec)
        db.flush()
        batch.specification = spec
    spec = _get_spec_or_raise(db, spec.id)
    current = _current_version(spec)
    if (
        current is not None
        and _as_status(current.status) == SpecificationVersionStatus.DRAFT.value
    ):
        _rebuild_draft_lines(db, current, cards)
    elif (
        current is not None
        and _as_status(current.status) == SpecificationVersionStatus.APPROVED.value
    ):
        pass
    else:
        draft = _ensure_draft(db, spec)
        _rebuild_draft_lines(db, draft, cards)
    spec_id = spec.id
    db.commit()
    return _to_read(_get_spec_or_raise(db, spec_id))


def refresh_specification_draft(
    db: Session, specification_id: int
) -> SpecificationRead:
    spec = _get_spec_or_raise(db, specification_id)
    current = _current_version(spec)
    if (
        current is None
        or _as_status(current.status) != SpecificationVersionStatus.DRAFT.value
    ):
        raise SpecificationValidationError("Обновить можно только черновик")
    batch = _load_batch(db, spec.production_batch_id)
    cards = _linked_cards(db, batch)
    if not cards:
        raise SpecificationValidationError("У партии нет связанных техкарт")
    _rebuild_draft_lines(db, current, cards)
    spec_id = spec.id
    db.commit()
    return _to_read(_get_spec_or_raise(db, spec_id))


def create_next_draft(db: Session, specification_id: int) -> SpecificationRead:
    spec = _get_spec_or_raise(db, specification_id)
    current = _current_version(spec)
    if (
        current is not None
        and _as_status(current.status) == SpecificationVersionStatus.DRAFT.value
    ):
        raise SpecificationConflictError(
            "Черновик уже есть — сначала утвердите или снимите его"
        )
    batch = _load_batch(db, spec.production_batch_id)
    cards = _linked_cards(db, batch)
    if not cards:
        raise SpecificationValidationError("У партии нет связанных техкарт")
    draft = _ensure_draft(db, spec)
    _rebuild_draft_lines(db, draft, cards)
    spec_id = spec.id
    db.commit()
    return _to_read(_get_spec_or_raise(db, spec_id))


def approve_specification(db: Session, specification_id: int) -> SpecificationRead:
    spec = _get_spec_or_raise(db, specification_id)
    current = _current_version(spec)
    if (
        current is None
        or _as_status(current.status) != SpecificationVersionStatus.DRAFT.value
    ):
        raise SpecificationValidationError("Утвердить можно только черновик")
    batch = _load_batch(db, spec.production_batch_id)
    cards = _linked_cards(db, batch)
    if not cards:
        raise SpecificationValidationError("У партии нет связанных техкарт")
    not_ready = [
        card.number
        for card in cards
        if _as_status(card.status) not in _TERMINAL_CARD_STATUSES
    ]
    if not_ready:
        raise SpecificationValidationError(
            "Нельзя утвердить: техкарты ещё не в терминальном статусе: "
            + ", ".join(not_ready)
        )
    for row in spec.versions:
        if (
            row.id != current.id
            and _as_status(row.status) == SpecificationVersionStatus.APPROVED.value
        ):
            row.status = SpecificationVersionStatus.SUPERSEDED
    current.status = SpecificationVersionStatus.APPROVED
    current.approved_at = _now()
    label = f"v{current.version_no}"
    for card in cards:
        card.specification_version_id = current.id
        card.specification_version_label = label
    spec_id = spec.id
    db.commit()
    return _to_read(_get_spec_or_raise(db, spec_id))


def cancel_specification_draft(
    db: Session, specification_id: int
) -> SpecificationRead:
    spec = _get_spec_or_raise(db, specification_id)
    current = _current_version(spec)
    if (
        current is None
        or _as_status(current.status) != SpecificationVersionStatus.DRAFT.value
    ):
        raise SpecificationValidationError("Снять можно только черновик")
    current.status = SpecificationVersionStatus.CANCELLED
    current.cancelled_at = _now()
    spec_id = spec.id
    db.commit()
    return _to_read(_get_spec_or_raise(db, spec_id))
