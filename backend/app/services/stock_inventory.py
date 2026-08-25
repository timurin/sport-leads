"""Inventory recount service: book snapshot, counted qty, signed delta post (`12.4.1.3`)."""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.stock import (
    StockDocument,
    StockDocumentStatus,
    StockDocumentType,
    StockInventoryLine,
    StockLedgerLine,
)
from app.repositories import stock_documents as repo
from app.services.stock_balances import list_stock_balances
from app.services.stock_documents import (
    StockDocumentConflictError,
    StockDocumentValidationError,
    _now,
    _validate_nomenclature,
    _validate_warehouse,
    get_stock_document,
)


def _posted_qty(db: Session, warehouse_id: int, nomenclature_id: int) -> Decimal:
    rows = repo.list_posted_ledger_quantities(
        db,
        warehouse_id=warehouse_id,
        nomenclature_ids=[nomenclature_id],
    )
    total = Decimal("0")
    for _warehouse, _nomenclature, quantity in rows:
        total += Decimal(str(quantity))
    return total


def _require_draft_inventory(document: StockDocument) -> None:
    if document.doc_type != StockDocumentType.INVENTORY.value:
        raise StockDocumentValidationError("Документ не является инвентаризацией")
    if document.status == StockDocumentStatus.POSTED.value:
        raise StockDocumentValidationError("Проведённый документ нельзя изменять")
    if document.status == StockDocumentStatus.CANCELLED.value:
        raise StockDocumentValidationError("Отменённый документ нельзя изменять")
    if document.status != StockDocumentStatus.DRAFT.value:
        raise StockDocumentValidationError("Инвентаризация должна быть черновиком")


def _persist(db: Session, document_id: int, *, commit: bool) -> StockDocument:
    if commit:
        db.commit()
        return get_stock_document(db, document_id)
    db.flush()
    return get_stock_document(db, document_id)


def _next_sequence(document: StockDocument) -> int:
    if not document.inventory_lines:
        return 1
    return max(line.sequence for line in document.inventory_lines) + 1


def create_inventory_document(
    db: Session,
    *,
    warehouse_id: int,
    notes: str | None = None,
    commit: bool = True,
) -> StockDocument:
    _validate_warehouse(db, warehouse_id)
    number = repo.next_document_number(db)
    if repo.get_document_by_number(db, number) is not None:
        raise StockDocumentConflictError("Номер складского документа уже занят")
    document = StockDocument(
        number=number,
        doc_type=StockDocumentType.INVENTORY.value,
        status=StockDocumentStatus.DRAFT.value,
        warehouse_id=warehouse_id,
        notes=notes,
    )
    try:
        repo.add_document(db, document)
        db.flush()
        return _persist(db, document.id, commit=commit)
    except IntegrityError as error:
        db.rollback()
        raise StockDocumentConflictError(
            "Не удалось сохранить складской документ"
        ) from error


def fill_inventory_from_balances(
    db: Session, document_id: int, *, commit: bool = True
) -> StockDocument:
    document = get_stock_document(db, document_id)
    _require_draft_inventory(document)
    _validate_warehouse(db, document.warehouse_id)
    existing = {line.nomenclature_id for line in document.inventory_lines}
    balances = list_stock_balances(db, warehouse_id=document.warehouse_id)
    sequence = _next_sequence(document)
    for balance in balances:
        if balance.nomenclature_id in existing:
            continue
        qty = Decimal(str(balance.quantity))
        document.inventory_lines.append(
            StockInventoryLine(
                sequence=sequence,
                nomenclature_id=balance.nomenclature_id,
                book_qty=qty,
                counted_qty=qty,
            )
        )
        existing.add(balance.nomenclature_id)
        sequence += 1
    return _persist(db, document.id, commit=commit)


def set_inventory_counted(
    db: Session,
    document_id: int,
    nomenclature_id: int,
    *,
    counted_qty: Decimal,
    commit: bool = True,
) -> StockDocument:
    document = get_stock_document(db, document_id)
    _require_draft_inventory(document)
    counted = Decimal(str(counted_qty))
    if counted < 0:
        raise StockDocumentValidationError(
            "Фактическое количество не может быть отрицательным"
        )
    _validate_nomenclature(db, nomenclature_id)
    for line in document.inventory_lines:
        if line.nomenclature_id == nomenclature_id:
            line.counted_qty = counted
            return _persist(db, document.id, commit=commit)
    document.inventory_lines.append(
        StockInventoryLine(
            sequence=_next_sequence(document),
            nomenclature_id=nomenclature_id,
            book_qty=_posted_qty(db, document.warehouse_id, nomenclature_id),
            counted_qty=counted,
        )
    )
    return _persist(db, document.id, commit=commit)


def refresh_inventory_book(
    db: Session, document_id: int, *, commit: bool = True
) -> StockDocument:
    document = get_stock_document(db, document_id)
    _require_draft_inventory(document)
    for line in document.inventory_lines:
        line.book_qty = _posted_qty(db, document.warehouse_id, line.nomenclature_id)
    return _persist(db, document.id, commit=commit)


def post_inventory_document(
    db: Session, document_id: int, *, commit: bool = True
) -> StockDocument:
    document = get_stock_document(db, document_id)
    _require_draft_inventory(document)
    _validate_warehouse(db, document.warehouse_id)
    line_no = 1
    for recount in document.inventory_lines:
        delta = Decimal(str(recount.counted_qty)) - Decimal(str(recount.book_qty))
        if delta == 0:
            continue
        document.ledger_lines.append(
            StockLedgerLine(
                line_no=line_no,
                warehouse_id=document.warehouse_id,
                nomenclature_id=recount.nomenclature_id,
                quantity=delta,
            )
        )
        line_no += 1
    try:
        repo.mark_document_posted(document, posted_at=_now())
        return _persist(db, document.id, commit=commit)
    except IntegrityError as error:
        db.rollback()
        raise StockDocumentConflictError(
            "Не удалось провести складской документ"
        ) from error
