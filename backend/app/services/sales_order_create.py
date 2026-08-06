"""Create SalesOrder without Lead (v1.00 / 0.4.2, SL-ORDER-WITHOUT-LEAD-v1)."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.sales import Client, Organization, SalesOrder, SalesUser


class SalesOrderCreateError(RuntimeError):
    pass


class SalesOrderNumberConflictError(SalesOrderCreateError):
    pass


class SalesOrderCreateValidationError(SalesOrderCreateError):
    pass


def _normalize_freeform_number(raw: str | None) -> str | None:
    if raw is None:
        return None
    value = raw.strip()
    if not value:
        return None
    if len(value) > 50:
        raise SalesOrderCreateValidationError(
            "Order number must be at most 50 characters"
        )
    return value


def _assert_number_available(db: Session, number: str) -> None:
    existing = db.scalar(select(SalesOrder.id).where(SalesOrder.number == number))
    if existing is not None:
        raise SalesOrderNumberConflictError(f"Order number already exists: {number}")


def create_sales_order(
    db: Session,
    *,
    client_id: int,
    organization_id: int | None,
    responsible_id: int,
    title: str,
    number: str | None = None,
    description: str | None = None,
    product_category: str | None = None,
    sport: str | None = None,
    quantity: int | None = None,
    amount: Decimal | None = None,
    desired_date: date | None = None,
    source: str | None = None,
    currency_code: str = "RUB",
) -> SalesOrder:
    """Create an order with lead_id=NULL. Does not create TechnicalCard (ADR-016)."""
    title_clean = title.strip()
    if not title_clean:
        raise SalesOrderCreateValidationError("Title is required")

    client = db.get(Client, client_id)
    if client is None:
        raise SalesOrderCreateValidationError("Client not found")
    organization: Organization | None = None
    if organization_id is not None:
        organization = db.get(Organization, organization_id)
        if organization is None:
            raise SalesOrderCreateValidationError("Organization not found")
    responsible = db.get(SalesUser, responsible_id)
    if responsible is None:
        raise SalesOrderCreateValidationError("Responsible user not found")

    freeform = _normalize_freeform_number(number)
    if freeform is not None:
        _assert_number_available(db, freeform)

    currency = (currency_code or "RUB").strip().upper() or "RUB"
    if len(currency) != 3:
        raise SalesOrderCreateValidationError("currency_code must be ISO-4217 (3 letters)")

    order = SalesOrder(
        number=freeform if freeform is not None else f"PENDING-{uuid4().hex}",
        lead_id=None,
        client_id=client.id,
        organization_id=organization.id if organization is not None else None,
        responsible_id=responsible.id,
        title=title_clean,
        description=description,
        product_category=product_category,
        sport=sport,
        quantity=quantity,
        amount=amount,
        currency_code=currency,
        desired_date=desired_date,
        source=source,
    )
    db.add(order)
    db.flush()
    if freeform is None:
        order.number = f"SO-{datetime.now(timezone.utc):%Y}-{order.id:06d}"
        db.flush()
    return order
