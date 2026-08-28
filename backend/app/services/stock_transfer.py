"""Warehouse transfer service: draft lines + paired ledger post (`12.5.1.3`)."""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.stock import (
    StockDocument,
    StockDocumentStatus,
    StockDocumentType,
    StockLedgerLine,
    StockTransferLine,
)
from app.repositories import stock_documents as repo
from app.services.stock_documents import (
    StockDocumentConflictError,
    StockDocumentValidationError,
    _now,
    _validate_nomenclature,
    _validate_warehouse,
    get_stock_document,
)


def _require_draft_transfer(document: StockDocument) -> None:
    if document.doc_type != StockDocumentType.TRANSFER.value:
        raise StockDocumentValidationError("Документ не является перемещением")
    if document.status == StockDocumentStatus.POSTED.value:
        raise StockDocumentValidationError("Проведённый документ нельзя изменять")
    if document.status == StockDocumentStatus.CANCELLED.value:
        raise StockDocumentValidationError("Отменённый документ нельзя изменять")
    if document.status != StockDocumentStatus.DRAFT.value:
        raise StockDocumentValidationError("Перемещение должно быть черновиком")


def _persist(db: Session, document_id: int, *, commit: bool) -> StockDocument:
    if commit:
        db.commit()
        return get_stock_document(db, document_id)
    db.flush()
    return get_stock_document(db, document_id)


def _next_sequence(document: StockDocument) -> int:
    if not document.transfer_lines:
        return 1
    return max(line.sequence for line in document.transfer_lines) + 1


def _validate_warehouses(db: Session, source_id: int, dest_id: int) -> None:
    if source_id == dest_id:
        raise StockDocumentValidationError(
            "Склад-получатель должен отличаться от склада-источника"
        )
    _validate_warehouse(db, source_id)
    _validate_warehouse(db, dest_id)


def create_transfer_document(
    db: Session,
    *,
    warehouse_id: int,
    destination_warehouse_id: int,
    notes: str | None = None,
    lines: list[tuple[int, Decimal]] | None = None,
    commit: bool = True,
) -> StockDocument:
    _validate_warehouses(db, warehouse_id, destination_warehouse_id)
    seen: set[int] = set()
    prepared: list[tuple[int, Decimal]] = []
    for nomenclature_id, quantity in lines or []:
        qty = Decimal(str(quantity))
        if qty <= 0:
            raise StockDocumentValidationError("Количество должно быть больше нуля")
        if nomenclature_id in seen:
            raise StockDocumentValidationError(
                "Дублирующаяся номенклатура в строках документа"
            )
        seen.add(nomenclature_id)
        _validate_nomenclature(db, nomenclature_id)
        prepared.append((nomenclature_id, qty))

    number = repo.next_document_number(db)
    if repo.get_document_by_number(db, number) is not None:
        raise StockDocumentConflictError("Номер складского документа уже занят")
    document = StockDocument(
        number=number,
        doc_type=StockDocumentType.TRANSFER.value,
        status=StockDocumentStatus.DRAFT.value,
        warehouse_id=warehouse_id,
        destination_warehouse_id=destination_warehouse_id,
        notes=notes,
    )
    for index, (nomenclature_id, qty) in enumerate(prepared, start=1):
        document.transfer_lines.append(
            StockTransferLine(
                sequence=index,
                nomenclature_id=nomenclature_id,
                quantity=qty,
            )
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


def set_transfer_line(
    db: Session,
    document_id: int,
    nomenclature_id: int,
    *,
    quantity: Decimal,
    commit: bool = True,
) -> StockDocument:
    document = get_stock_document(db, document_id)
    _require_draft_transfer(document)
    qty = Decimal(str(quantity))
    if qty <= 0:
        raise StockDocumentValidationError("Количество должно быть больше нуля")
    _validate_nomenclature(db, nomenclature_id)
    for line in document.transfer_lines:
        if line.nomenclature_id == nomenclature_id:
            line.quantity = qty
            return _persist(db, document.id, commit=commit)
    document.transfer_lines.append(
        StockTransferLine(
            sequence=_next_sequence(document),
            nomenclature_id=nomenclature_id,
            quantity=qty,
        )
    )
    return _persist(db, document.id, commit=commit)


def remove_transfer_line(
    db: Session,
    document_id: int,
    nomenclature_id: int,
    *,
    commit: bool = True,
) -> StockDocument:
    document = get_stock_document(db, document_id)
    _require_draft_transfer(document)
    remaining = [
        line
        for line in document.transfer_lines
        if line.nomenclature_id != nomenclature_id
    ]
    if len(remaining) == len(document.transfer_lines):
        raise StockDocumentValidationError("Строка перемещения не найдена")
    for line in list(document.transfer_lines):
        if line.nomenclature_id == nomenclature_id:
            document.transfer_lines.remove(line)
            break
    return _persist(db, document.id, commit=commit)


def post_transfer_document(
    db: Session, document_id: int, *, commit: bool = True
) -> StockDocument:
    document = get_stock_document(db, document_id)
    _require_draft_transfer(document)
    dest_id = document.destination_warehouse_id
    if dest_id is None:
        raise StockDocumentValidationError("У перемещения не задан склад-получатель")
    _validate_warehouses(db, document.warehouse_id, dest_id)
    if not document.transfer_lines:
        raise StockDocumentValidationError("Документ без строк нельзя провести")
    line_no = 1
    for move in document.transfer_lines:
        qty = Decimal(str(move.quantity))
        document.ledger_lines.append(
            StockLedgerLine(
                line_no=line_no,
                warehouse_id=document.warehouse_id,
                nomenclature_id=move.nomenclature_id,
                quantity=-qty,
            )
        )
        line_no += 1
        document.ledger_lines.append(
            StockLedgerLine(
                line_no=line_no,
                warehouse_id=dest_id,
                nomenclature_id=move.nomenclature_id,
                quantity=qty,
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
