"""Stock document post + ledger write services (`12.2.2` / ADR-019)."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.nomenclature import Nomenclature
from app.models.sales import SalesOrder
from app.models.stock import (
    StockDocument,
    StockDocumentStatus,
    StockDocumentType,
    StockLedgerLine,
)
from app.models.technical_card import TechnicalCard
from app.repositories import stock_documents as repo
from app.repositories import warehouses as warehouse_repo
from app.schemas.stock import (
    StockDocumentCreate,
    StockDocumentRead,
    StockInventoryLineRead,
    StockLedgerLineRead,
    StockTransferLineRead,
)


class StockDocumentNotFoundError(RuntimeError):
    pass


class StockDocumentConflictError(RuntimeError):
    pass


class StockDocumentValidationError(RuntimeError):
    pass


_RECEIPT_TYPES = frozenset(
    {
        StockDocumentType.RECEIPT.value,
        StockDocumentType.FG_RECEIPT.value,
    }
)
_ISSUE_TYPES = frozenset(
    {
        StockDocumentType.ISSUE.value,
        StockDocumentType.FG_ISSUE.value,
    }
)
_FG_TYPES = frozenset(
    {
        StockDocumentType.FG_RECEIPT.value,
        StockDocumentType.FG_ISSUE.value,
    }
)
_ALL_DOC_TYPES = _RECEIPT_TYPES | _ISSUE_TYPES
_LISTABLE_DOC_TYPES = _ALL_DOC_TYPES | {
    StockDocumentType.INVENTORY.value,
    StockDocumentType.TRANSFER.value,
}


def _now() -> datetime:
    return datetime.now(tz=UTC)


def get_stock_document(db: Session, document_id: int) -> StockDocument:
    row = repo.get_document(db, document_id)
    if row is None:
        raise StockDocumentNotFoundError("Складской документ не найден")
    return row


def list_stock_documents(
    db: Session,
    *,
    doc_type: str | None = None,
    status: str | None = None,
    warehouse_id: int | None = None,
    technical_card_id: int | None = None,
    sales_order_id: int | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[StockDocument]:
    if doc_type is not None and doc_type not in _LISTABLE_DOC_TYPES:
        raise StockDocumentValidationError("Недопустимый тип документа")
    if status is not None and status not in {
        StockDocumentStatus.DRAFT.value,
        StockDocumentStatus.POSTED.value,
        StockDocumentStatus.CANCELLED.value,
    }:
        raise StockDocumentValidationError("Недопустимый статус документа")
    if warehouse_id is not None:
        _validate_warehouse(db, warehouse_id)
    return repo.list_documents(
        db,
        doc_type=doc_type,
        status=status,
        warehouse_id=warehouse_id,
        technical_card_id=technical_card_id,
        sales_order_id=sales_order_id,
        limit=limit,
        offset=offset,
    )


def _signed_quantity(doc_type: str, absolute_qty: Decimal) -> Decimal:
    qty = Decimal(str(absolute_qty))
    if qty <= 0:
        raise StockDocumentValidationError("Количество должно быть больше нуля")
    if doc_type in _RECEIPT_TYPES:
        return qty
    if doc_type in _ISSUE_TYPES:
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


def _resolve_fg_links(
    db: Session, payload: StockDocumentCreate
) -> tuple[int | None, int | None]:
    technical_card_id = payload.technical_card_id
    sales_order_id = payload.sales_order_id
    if payload.doc_type not in _FG_TYPES:
        return technical_card_id, sales_order_id
    if technical_card_id is None:
        raise StockDocumentValidationError(
            "Для документов ГП требуется technical_card_id"
        )
    card = db.get(TechnicalCard, technical_card_id)
    if card is None:
        raise StockDocumentValidationError("Техкарта не найдена")
    if sales_order_id is None:
        sales_order_id = card.sales_order_id
    elif sales_order_id != card.sales_order_id:
        raise StockDocumentValidationError(
            "sales_order_id не совпадает с заказом техкарты"
        )
    if sales_order_id is not None and db.get(SalesOrder, sales_order_id) is None:
        raise StockDocumentValidationError("Заказ покупателя не найден")
    return technical_card_id, sales_order_id


def create_stock_document(
    db: Session,
    payload: StockDocumentCreate,
    *,
    commit: bool = True,
) -> StockDocument:
    _validate_warehouse(db, payload.warehouse_id)
    if payload.doc_type not in _ALL_DOC_TYPES:
        raise StockDocumentValidationError("Недопустимый тип документа")

    technical_card_id, sales_order_id = _resolve_fg_links(db, payload)

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
        technical_card_id=technical_card_id,
        sales_order_id=sales_order_id,
        notes=payload.notes,
    )
    for index, line in enumerate(payload.lines, start=1):
        document.ledger_lines.append(
            StockLedgerLine(
                line_no=index,
                warehouse_id=payload.warehouse_id,
                nomenclature_id=line.nomenclature_id,
                quantity=_signed_quantity(payload.doc_type, line.quantity),
                technical_card_id=technical_card_id,
                sales_order_id=sales_order_id,
            )
        )

    try:
        repo.add_document(db, document)
        if payload.post:
            repo.mark_document_posted(document, posted_at=_now())
        if commit:
            db.commit()
            db.refresh(document)
            return get_stock_document(db, document.id)
        db.flush()
        return document
    except IntegrityError as error:
        db.rollback()
        raise StockDocumentConflictError(
            "Не удалось сохранить складской документ"
        ) from error


def post_stock_document(db: Session, document_id: int) -> StockDocument:
    document = get_stock_document(db, document_id)
    if document.doc_type == StockDocumentType.INVENTORY.value:
        raise StockDocumentValidationError(
            "Инвентаризацию нужно проводить отдельной операцией"
        )
    if document.doc_type == StockDocumentType.TRANSFER.value:
        raise StockDocumentValidationError(
            "Перемещение нужно проводить отдельной операцией"
        )
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


def _nomenclature_names_by_ids(db: Session, ids: list[int]) -> dict[int, str]:
    unique = list(dict.fromkeys(ids))
    if not unique:
        return {}
    rows = db.execute(
        select(Nomenclature.id, Nomenclature.name).where(Nomenclature.id.in_(unique))
    ).all()
    return {int(row.id): str(row.name) for row in rows}


def to_stock_document_read(
    document: StockDocument,
    names: dict[int, str],
    *,
    include_inventory_lines: bool = False,
    include_transfer_lines: bool = False,
) -> StockDocumentRead:
    inventory_lines: list[StockInventoryLineRead] = []
    if include_inventory_lines:
        inventory_lines = [
            StockInventoryLineRead(
                id=line.id,
                sequence=line.sequence,
                nomenclature_id=line.nomenclature_id,
                nomenclature_name=names.get(line.nomenclature_id),
                book_qty=line.book_qty,
                counted_qty=line.counted_qty,
                delta=Decimal(str(line.counted_qty)) - Decimal(str(line.book_qty)),
            )
            for line in document.inventory_lines
        ]
    transfer_lines: list[StockTransferLineRead] = []
    if include_transfer_lines:
        transfer_lines = [
            StockTransferLineRead(
                id=line.id,
                sequence=line.sequence,
                nomenclature_id=line.nomenclature_id,
                nomenclature_name=names.get(line.nomenclature_id),
                quantity=line.quantity,
            )
            for line in document.transfer_lines
        ]
    return StockDocumentRead(
        id=document.id,
        number=document.number,
        doc_type=document.doc_type,
        status=document.status,
        warehouse_id=document.warehouse_id,
        destination_warehouse_id=document.destination_warehouse_id,
        posted_at=document.posted_at,
        technical_card_id=document.technical_card_id,
        sales_order_id=document.sales_order_id,
        notes=document.notes,
        created_at=document.created_at,
        updated_at=document.updated_at,
        ledger_lines=[
            StockLedgerLineRead(
                id=line.id,
                line_no=line.line_no,
                warehouse_id=line.warehouse_id,
                nomenclature_id=line.nomenclature_id,
                nomenclature_name=names.get(line.nomenclature_id),
                quantity=line.quantity,
                posted_at=line.posted_at,
                technical_card_id=line.technical_card_id,
                sales_order_id=line.sales_order_id,
            )
            for line in document.ledger_lines
        ],
        inventory_lines=inventory_lines,
        transfer_lines=transfer_lines,
    )


def serialize_stock_document(db: Session, document: StockDocument) -> StockDocumentRead:
    """Embed nomenclature display names — one batch lookup (`0.2.7`)."""
    ids = [line.nomenclature_id for line in document.ledger_lines]
    ids.extend(line.nomenclature_id for line in document.inventory_lines)
    ids.extend(line.nomenclature_id for line in document.transfer_lines)
    return to_stock_document_read(
        document,
        _nomenclature_names_by_ids(db, ids),
        include_inventory_lines=True,
        include_transfer_lines=True,
    )


def serialize_stock_documents(
    db: Session, documents: list[StockDocument]
) -> list[StockDocumentRead]:
    ids = [
        line.nomenclature_id
        for document in documents
        for line in document.ledger_lines
    ]
    names = _nomenclature_names_by_ids(db, ids)
    return [
        to_stock_document_read(
            document,
            names,
            include_inventory_lines=False,
            include_transfer_lines=False,
        )
        for document in documents
    ]
