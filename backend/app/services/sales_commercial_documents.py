"""Create sales quotations / invoices from order snapshots (3.3.3)."""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.sales import SalesOrder, SalesOrderItem
from app.models.sales_commercial import (
    CommercialDocumentStatus,
    SalesInvoice,
    SalesInvoiceItem,
    SalesQuotation,
    SalesQuotationItem,
)
from app.services.sales_order_items import line_gross_amount, order_amount_net


class SalesCommercialDocumentError(Exception):
    pass


def _money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"))


def _get_order(db: Session, order_id: int) -> SalesOrder:
    order = db.scalar(
        select(SalesOrder)
        .where(SalesOrder.id == order_id)
        .options(selectinload(SalesOrder.items))
    )
    if order is None:
        raise SalesCommercialDocumentError("Order not found")
    return order


def _next_doc_number(db: Session, *, prefix: str, model: type, order_id: int) -> str:
    count = db.scalar(
        select(func.count()).select_from(model).where(model.sales_order_id == order_id)
    )
    seq = int(count or 0) + 1
    return f"{prefix}-{order_id}-{seq:03d}"


def _line_snapshot_fields(item: SalesOrderItem) -> dict[str, object]:
    return {
        "source_order_item_id": item.id,
        "position": item.position,
        "snapshot_name": item.snapshot_name,
        "unit": item.unit,
        "quantity": item.quantity,
        "unit_price": item.unit_price,
        "discount_percent": item.discount_percent,
        "discount_amount": item.discount_amount or Decimal("0.00"),
        "line_amount": item.line_amount,
        "vat_rate_id": item.vat_rate_id,
        "vat_rate_percent": item.vat_rate_percent,
        "price_includes_vat": bool(item.price_includes_vat),
        "vat_amount": item.vat_amount or Decimal("0.00"),
        "line_total": line_gross_amount(item),
    }


def _header_totals(order: SalesOrder) -> dict[str, Decimal | None | str]:
    amount = order.amount or Decimal("0.00")
    return {
        "currency_code": (order.currency_code or "RUB").upper(),
        "discount_percent": order.discount_percent,
        "discount_amount": order.discount_amount or Decimal("0.00"),
        "vat_amount": order.vat_amount or Decimal("0.00"),
        "amount": _money(amount),
        "amount_net": order_amount_net(order),
    }


def create_quotation_from_order(db: Session, order_id: int) -> SalesQuotation:
    order = _get_order(db, order_id)
    if not order.items:
        raise SalesCommercialDocumentError("Order has no items to snapshot")

    totals = _header_totals(order)
    quotation = SalesQuotation(
        number=_next_doc_number(db, prefix="КП", model=SalesQuotation, order_id=order.id),
        sales_order_id=order.id,
        status=CommercialDocumentStatus.DRAFT,
        **totals,
    )
    db.add(quotation)
    db.flush()
    for item in order.items:
        db.add(SalesQuotationItem(quotation_id=quotation.id, **_line_snapshot_fields(item)))
    db.flush()
    return quotation


def list_quotations_for_order(db: Session, order_id: int) -> list[SalesQuotation]:
    _get_order(db, order_id)
    return list(
        db.scalars(
            select(SalesQuotation)
            .where(SalesQuotation.sales_order_id == order_id)
            .options(selectinload(SalesQuotation.items))
            .order_by(SalesQuotation.created_at.desc(), SalesQuotation.id.desc())
        ).all()
    )


def get_quotation(db: Session, order_id: int, quotation_id: int) -> SalesQuotation:
    quotation = db.scalar(
        select(SalesQuotation)
        .where(
            SalesQuotation.id == quotation_id,
            SalesQuotation.sales_order_id == order_id,
        )
        .options(selectinload(SalesQuotation.items))
    )
    if quotation is None:
        raise SalesCommercialDocumentError("Quotation not found")
    return quotation


def create_invoice_from_order(
    db: Session,
    order_id: int,
    *,
    quotation_id: int | None = None,
) -> SalesInvoice:
    order = _get_order(db, order_id)
    if not order.items:
        raise SalesCommercialDocumentError("Order has no items to snapshot")

    quotation: SalesQuotation | None = None
    if quotation_id is not None:
        quotation = get_quotation(db, order_id, quotation_id)

    if quotation is not None:
        invoice = SalesInvoice(
            number=_next_doc_number(db, prefix="СЧ", model=SalesInvoice, order_id=order.id),
            sales_order_id=order.id,
            quotation_id=quotation.id,
            status=CommercialDocumentStatus.DRAFT,
            currency_code=quotation.currency_code,
            discount_percent=quotation.discount_percent,
            discount_amount=quotation.discount_amount,
            vat_amount=quotation.vat_amount,
            amount=quotation.amount,
            amount_net=quotation.amount_net,
        )
        db.add(invoice)
        db.flush()
        for item in quotation.items:
            db.add(
                SalesInvoiceItem(
                    invoice_id=invoice.id,
                    source_order_item_id=item.source_order_item_id,
                    position=item.position,
                    snapshot_name=item.snapshot_name,
                    unit=item.unit,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    discount_percent=item.discount_percent,
                    discount_amount=item.discount_amount,
                    line_amount=item.line_amount,
                    vat_rate_id=item.vat_rate_id,
                    vat_rate_percent=item.vat_rate_percent,
                    price_includes_vat=item.price_includes_vat,
                    vat_amount=item.vat_amount,
                    line_total=item.line_total,
                )
            )
        db.flush()
        return invoice

    totals = _header_totals(order)
    invoice = SalesInvoice(
        number=_next_doc_number(db, prefix="СЧ", model=SalesInvoice, order_id=order.id),
        sales_order_id=order.id,
        quotation_id=None,
        status=CommercialDocumentStatus.DRAFT,
        **totals,
    )
    db.add(invoice)
    db.flush()
    for item in order.items:
        db.add(SalesInvoiceItem(invoice_id=invoice.id, **_line_snapshot_fields(item)))
    db.flush()
    return invoice


def list_invoices_for_order(db: Session, order_id: int) -> list[SalesInvoice]:
    _get_order(db, order_id)
    return list(
        db.scalars(
            select(SalesInvoice)
            .where(SalesInvoice.sales_order_id == order_id)
            .options(selectinload(SalesInvoice.items))
            .order_by(SalesInvoice.created_at.desc(), SalesInvoice.id.desc())
        ).all()
    )


def get_invoice(db: Session, order_id: int, invoice_id: int) -> SalesInvoice:
    invoice = db.scalar(
        select(SalesInvoice)
        .where(
            SalesInvoice.id == invoice_id,
            SalesInvoice.sales_order_id == order_id,
        )
        .options(selectinload(SalesInvoice.items))
    )
    if invoice is None:
        raise SalesCommercialDocumentError("Invoice not found")
    return invoice


def serialize_quotation(quotation: SalesQuotation) -> dict[str, object]:
    return {
        **{column.name: getattr(quotation, column.name) for column in SalesQuotation.__table__.columns},
        "items": [
            {column.name: getattr(item, column.name) for column in SalesQuotationItem.__table__.columns}
            for item in quotation.items
        ],
    }


def serialize_invoice(invoice: SalesInvoice) -> dict[str, object]:
    return {
        **{column.name: getattr(invoice, column.name) for column in SalesInvoice.__table__.columns},
        "items": [
            {column.name: getattr(item, column.name) for column in SalesInvoiceItem.__table__.columns}
            for item in invoice.items
        ],
    }
