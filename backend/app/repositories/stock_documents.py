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
