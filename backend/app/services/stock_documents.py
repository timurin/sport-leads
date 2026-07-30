"""Stock document post + ledger write services (`12.2.2` / ADR-019)."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.nomenclature import Nomenclature
from app.models.stock import (
    StockDocument,
    StockDocumentStatus,
    StockDocumentType,
    StockLedgerLine,
)
from app.repositories import stock_documents as repo
from app.repositories import warehouses as warehouse_repo
from app.schemas.stock import StockDocumentCreate


class StockDocumentNotFoundError(RuntimeError):
    pass


class StockDocumentConflictError(RuntimeError):
    pass


class StockDocumentValidationError(RuntimeError):
    pass


def _now() -> datetime:
    return datetime.now(tz=UTC)


def get_stock_document(db: Session, document_id: int) -> StockDocument:
    row = repo.get_document(db, document_id)
    if row is None:
        raise StockDocumentNotFoundError("Складской документ не найден")
    return row


def _signed_quantity(doc_type: str, absolute_qty: Decimal) -> Decimal:
    qty = Decimal(str(absolute_qty))
    if qty <= 0:
        raise StockDocumentValidationError("Количество должно быть больше нуля")
    if doc_type == StockDocumentType.RECEIPT.value:
        return qty
    if doc_type == StockDocumentType.ISSUE.value:
        return -qty
    raise StockDocumentValidationError("Недопустимый тип документа")


def _validate_warehouse(db: Session, warehouse_id: int) -> None:
    warehouse = warehouse_repo.get_warehouse(db, warehouse_id)
    if warehouse is None:
        raise StockDocumentValidationError("Склад не найден")
    if not warehouse.is_active:
        raise StockDocumentValidationError("Склад неактивен")


def _validate_nomenclature(db: Session, nomenclature_id: int) -> None:
    row = db.get(Nomenclature, nomenclature_id)
    if row is None:
        raise StockDocumentValidationError("Номенклатура не найдена")
    if not row.is_active:
        raise StockDocumentValidationError("Номенклатура неактивна")


def create_stock_document(db: Session, payload: StockDocumentCreate) -> StockDocument:
    _validate_warehouse(db, payload.warehouse_id)
    if payload.doc_type not in {
        StockDocumentType.RECEIPT.value,
        StockDocumentType.ISSUE.value,
    }:
        raise StockDocumentValidationError("Недопустимый тип документа")

    seen_noms: set[int] = set()
    for line in payload.lines:
        if line.nomenclature_id in seen_noms:
            raise StockDocumentValidationError(
                "Дублирующаяся номенклатура в строках документа"
            )
        seen_noms.add(line.nomenclature_id)
        _validate_nomenclature(db, line.nomenclature_id)

    number = repo.next_document_number(db)
    if repo.get_document_by_number(db, number) is not None:
        raise StockDocumentConflictError("Номер складского документа уже занят")

    document = StockDocument(
        number=number,
        doc_type=payload.doc_type,
        status=StockDocumentStatus.DRAFT.value,
        warehouse_id=payload.warehouse_id,
        technical_card_id=payload.technical_card_id,
        sales_order_id=payload.sales_order_id,
        notes=payload.notes,
    )
    for index, line in enumerate(payload.lines, start=1):
        document.ledger_lines.append(
            StockLedgerLine(
                line_no=index,
                warehouse_id=payload.warehouse_id,
                nomenclature_id=line.nomenclature_id,
                quantity=_signed_quantity(payload.doc_type, line.quantity),
                technical_card_id=payload.technical_card_id,
                sales_order_id=payload.sales_order_id,
            )
        )

    try:
        repo.add_document(db, document)
        if payload.post:
            repo.mark_document_posted(document, posted_at=_now())
        db.commit()
        db.refresh(document)
        return get_stock_document(db, document.id)
    except IntegrityError as error:
        db.rollback()
        raise StockDocumentConflictError(
            "Не удалось сохранить складской документ"
        ) from error


def post_stock_document(db: Session, document_id: int) -> StockDocument:
    document = get_stock_document(db, document_id)
    if document.status == StockDocumentStatus.POSTED.value:
        raise StockDocumentValidationError("Документ уже проведён")
    if document.status == StockDocumentStatus.CANCELLED.value:
        raise StockDocumentValidationError("Нельзя провести отменённый документ")
    if not document.ledger_lines:
        raise StockDocumentValidationError("Документ без строк нельзя провести")

    _validate_warehouse(db, document.warehouse_id)
    repo.mark_document_posted(document, posted_at=_now())
    try:
        db.commit()
        db.refresh(document)
        return get_stock_document(db, document.id)
    except IntegrityError as error:
        db.rollback()
        raise StockDocumentConflictError(
            "Не удалось провести складской документ"
        ) from error
