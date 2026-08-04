from datetime import datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.stock import StockDocument, StockDocumentStatus, StockLedgerLine


def get_document(db: Session, document_id: int) -> StockDocument | None:
    return db.scalars(
        select(StockDocument)
        .where(StockDocument.id == document_id)
        .options(selectinload(StockDocument.ledger_lines))
    ).first()


def get_document_by_number(db: Session, number: str) -> StockDocument | None:
    return db.scalars(
        select(StockDocument).where(StockDocument.number == number)
    ).first()


def find_fg_document_for_card(
    db: Session,
    *,
    technical_card_id: int,
    doc_type: str,
) -> StockDocument | None:
    """Latest non-cancelled FG document for a technical card (idempotency)."""
    return db.scalars(
        select(StockDocument)
        .where(
            StockDocument.technical_card_id == technical_card_id,
            StockDocument.doc_type == doc_type,
            StockDocument.status != StockDocumentStatus.CANCELLED.value,
        )
        .options(selectinload(StockDocument.ledger_lines))
        .order_by(StockDocument.id.desc())
    ).first()


def list_documents(
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
    statement = select(StockDocument).options(
        selectinload(StockDocument.ledger_lines)
    )
    if doc_type is not None:
        statement = statement.where(StockDocument.doc_type == doc_type)
    if status is not None:
        statement = statement.where(StockDocument.status == status)
    if warehouse_id is not None:
        statement = statement.where(StockDocument.warehouse_id == warehouse_id)
    if technical_card_id is not None:
        statement = statement.where(
            StockDocument.technical_card_id == technical_card_id
        )
    if sales_order_id is not None:
        statement = statement.where(StockDocument.sales_order_id == sales_order_id)
    statement = (
        statement.order_by(
            StockDocument.posted_at.desc().nulls_last(),
            StockDocument.id.desc(),
        )
        .offset(offset)
        .limit(limit)
    )
    return list(db.scalars(statement).all())


def next_document_number(db: Session) -> str:
    count = int(db.scalar(select(func.count()).select_from(StockDocument)) or 0)
    return f"STK-{count + 1:06d}"


def add_document(db: Session, document: StockDocument) -> StockDocument:
    db.add(document)
    db.flush()
    return document


def list_posted_ledger_quantities(
    db: Session,
    *,
    warehouse_id: int | None = None,
    nomenclature_ids: list[int] | None = None,
) -> list[tuple[int, int, Decimal]]:
    """Return (warehouse_id, nomenclature_id, quantity) for posted documents only."""
    statement = (
        select(
            StockLedgerLine.warehouse_id,
            StockLedgerLine.nomenclature_id,
            StockLedgerLine.quantity,
        )
        .join(StockDocument, StockDocument.id == StockLedgerLine.stock_document_id)
        .where(StockDocument.status == StockDocumentStatus.POSTED.value)
    )
    if warehouse_id is not None:
        statement = statement.where(StockLedgerLine.warehouse_id == warehouse_id)
    if nomenclature_ids is not None:
        statement = statement.where(
            StockLedgerLine.nomenclature_id.in_(nomenclature_ids)
        )
    return [
        (int(warehouse), int(nomenclature), Decimal(str(qty)))
        for warehouse, nomenclature, qty in db.execute(statement).all()
    ]


def mark_document_posted(
    document: StockDocument,
    *,
    posted_at: datetime,
) -> StockDocument:
    document.status = StockDocumentStatus.POSTED.value
    document.posted_at = posted_at
    for line in document.ledger_lines:
        line.posted_at = posted_at
    return document
