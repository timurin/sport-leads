"""Auto-post finished-goods stock documents on FG stage complete (ADR-019 / 12.3.2)."""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.stock import StockDocument, StockDocumentStatus, StockDocumentType
from app.models.technical_card import TechnicalCard
from app.repositories import stock_documents as stock_repo
from app.schemas.stock import StockDocumentCreate, StockDocumentLineCreate
from app.services.stock_documents import (
    StockDocumentConflictError,
    StockDocumentValidationError,
    create_stock_document,
)
from app.services.technical_cards import TechnicalCardValidationError
from app.services.warehouses import WarehouseNotFoundError, get_default_warehouse

_FG_STAGE_TO_DOC_TYPE = {
    "ready_to_ship": StockDocumentType.FG_RECEIPT.value,
    "shipped": StockDocumentType.FG_ISSUE.value,
}


def compute_fg_receipt_qty(db: Session, card: TechnicalCard) -> Decimal:
    """receipt_qty = max(0, TC.quantity − Σ scrap on QC stage_results)."""
    # Lazy import avoids circular dependency with technical_card_stages.
    from app.services.technical_card_stages import resolve_production_stage_code

    base = Decimal(str(card.quantity or 0))
    scrap_total = Decimal("0")
    for stage in card.stage_results or []:
        code = resolve_production_stage_code(
            db, stage.production_stage_id, stage.stage_label
        )
        if code != "qc":
            continue
        if stage.scrap_qty is not None:
            scrap_total += Decimal(str(stage.scrap_qty))
    qty = base - scrap_total
    return qty if qty > 0 else Decimal("0")


def _absolute_receipt_qty(document: StockDocument) -> Decimal:
    total = Decimal("0")
    for line in document.ledger_lines or []:
        total += abs(Decimal(str(line.quantity)))
    return total


def _map_stock_error(error: Exception) -> TechnicalCardValidationError:
    return TechnicalCardValidationError(str(error))


def assert_fg_stage_rollback_allowed(
    db: Session, card: TechnicalCard, stage_code: str | None
) -> None:
    """Block rollback of FG stages when a posted/non-cancelled FG document exists."""
    if stage_code not in _FG_STAGE_TO_DOC_TYPE:
        return
    doc_type = _FG_STAGE_TO_DOC_TYPE[stage_code]
    existing = stock_repo.find_fg_document_for_card(
        db, technical_card_id=card.id, doc_type=doc_type
    )
    if existing is not None:
        raise TechnicalCardValidationError(
            "Нельзя откатить стадию ГП: уже есть складской документ "
            f"{existing.number} ({doc_type})"
        )


def post_fg_on_stage_complete(
    db: Session,
    card: TechnicalCard,
    stage_code: str | None,
    *,
    units: list | None = None,
) -> StockDocument | None:
    """Create+post fg_receipt / fg_issue without committing (caller owns transaction).

    Header-only cards (no unit lines) keep the legacy qty = TC.quantity − QC scrap
    and a single document. After Stage 25, unit lines arriving at an FG stage
    post only the unposted pieces (multiple documents allowed).
    """
    if stage_code not in _FG_STAGE_TO_DOC_TYPE:
        return None

    doc_type = _FG_STAGE_TO_DOC_TYPE[stage_code]
    posted_flag = (
        "fg_receipt_posted" if stage_code == "ready_to_ship" else "fg_issue_posted"
    )
    from app.services.tech_card_wip import live_unit_lines

    live = live_unit_lines(card)
    target_units = list(units) if units is not None else live
    unposted = [
        row for row in target_units if not bool(getattr(row, posted_flag, False))
    ]

    if live and not unposted:
        return stock_repo.find_fg_document_for_card(
            db, technical_card_id=card.id, doc_type=doc_type
        )

    if not live:
        existing = stock_repo.find_fg_document_for_card(
            db, technical_card_id=card.id, doc_type=doc_type
        )
        if existing is not None:
            return existing

    try:
        warehouse = get_default_warehouse(db)
    except WarehouseNotFoundError as error:
        raise _map_stock_error(error) from error
    if not warehouse.is_active:
        raise TechnicalCardValidationError("Склад по умолчанию неактивен")

    if stage_code == "ready_to_ship":
        if card.nomenclature_id is None:
            raise TechnicalCardValidationError(
                "Для прихода ГП у техкарты должна быть номенклатура"
            )
        if live:
            qty = Decimal(len(unposted))
        else:
            qty = compute_fg_receipt_qty(db, card)
        if qty <= 0:
            raise TechnicalCardValidationError(
                "Количество прихода ГП должно быть больше нуля "
                "(quantity − scrap ОТК)"
            )
        payload = StockDocumentCreate(
            doc_type=StockDocumentType.FG_RECEIPT.value,
            warehouse_id=warehouse.id,
            technical_card_id=card.id,
            sales_order_id=card.sales_order_id,
            notes=f"Автоприход ГП по ТК {card.number}",
            lines=[
                StockDocumentLineCreate(
                    nomenclature_id=card.nomenclature_id,
                    quantity=qty,
                )
            ],
            post=True,
        )
    else:
        receipt = stock_repo.find_fg_document_for_card(
            db,
            technical_card_id=card.id,
            doc_type=StockDocumentType.FG_RECEIPT.value,
        )
        if receipt is None or receipt.status != StockDocumentStatus.POSTED.value:
            raise TechnicalCardValidationError(
                "Перед списанием ГП требуется проведённый приход по этой техкарте"
            )
        if live:
            qty = Decimal(len(unposted))
        else:
            qty = _absolute_receipt_qty(receipt)
        if qty <= 0:
            raise TechnicalCardValidationError(
                "Количество списания ГП должно быть больше нуля"
            )
        nomenclature_id = receipt.ledger_lines[0].nomenclature_id
        payload = StockDocumentCreate(
            doc_type=StockDocumentType.FG_ISSUE.value,
            warehouse_id=receipt.warehouse_id,
            technical_card_id=card.id,
            sales_order_id=card.sales_order_id,
            notes=f"Автосписание ГП по ТК {card.number}",
            lines=[
                StockDocumentLineCreate(
                    nomenclature_id=nomenclature_id,
                    quantity=qty,
                )
            ],
            post=True,
        )

    try:
        document = create_stock_document(db, payload, commit=False)
    except (StockDocumentValidationError, StockDocumentConflictError) as error:
        raise _map_stock_error(error) from error
    for row in unposted:
        setattr(row, posted_flag, True)
    return document
