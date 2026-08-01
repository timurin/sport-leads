"""Pattern-model sales rollup for dashboard analytics (`1.1.5`)."""

from __future__ import annotations

from datetime import date, datetime, time, timezone
from decimal import Decimal

from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from app.models.sales import SalesOrder, SalesOrderItem, SalesOrderStatus

_MANUFACTURED_STATUSES = (
    SalesOrderStatus.READY,
    SalesOrderStatus.SHIPPED,
    SalesOrderStatus.COMPLETED,
)


def _as_utc_start(value: date) -> datetime:
    return datetime.combine(value, time.min, tzinfo=timezone.utc)


def _as_utc_end(value: date) -> datetime:
    return datetime.combine(value, time.max, tzinfo=timezone.utc)


def list_pattern_model_sales(
    db: Session,
    *,
    date_from: date | None = None,
    date_to: date | None = None,
    article: str | None = None,
    limit: int = 20,
) -> list[dict[str, object]]:
    limit = max(1, min(limit, 100))
    qty = SalesOrderItem.quantity
    unit_sewing = func.coalesce(SalesOrderItem.assembly_variant_total_cost, 0)
    manufactured_qty = case(
        (SalesOrder.status.in_(_MANUFACTURED_STATUSES), qty),
        else_=0,
    )

    statement = (
        select(
            SalesOrderItem.product_model_id,
            SalesOrderItem.product_model_article,
            SalesOrderItem.product_model_name,
            func.count(func.distinct(SalesOrderItem.order_id)).label("order_count"),
            func.coalesce(func.sum(qty), 0).label("units_ordered"),
            func.coalesce(func.sum(manufactured_qty), 0).label("units_manufactured"),
            func.coalesce(func.sum(SalesOrderItem.line_amount), 0).label("order_amount"),
            func.coalesce(func.sum(unit_sewing * qty), 0).label("sewing_cost_amount"),
        )
        .join(SalesOrder, SalesOrder.id == SalesOrderItem.order_id)
        .where(SalesOrder.status != SalesOrderStatus.CANCELLED)
        .where(
            or_(
                SalesOrderItem.product_model_id.is_not(None),
                SalesOrderItem.product_model_article.is_not(None),
            )
        )
        .group_by(
            SalesOrderItem.product_model_id,
            SalesOrderItem.product_model_article,
            SalesOrderItem.product_model_name,
        )
        .order_by(func.coalesce(func.sum(SalesOrderItem.line_amount), 0).desc())
        .limit(limit)
    )

    if date_from is not None:
        statement = statement.where(SalesOrder.created_at >= _as_utc_start(date_from))
    if date_to is not None:
        statement = statement.where(SalesOrder.created_at <= _as_utc_end(date_to))
    if article:
        needle = article.strip()
        if needle:
            statement = statement.where(
                func.lower(SalesOrderItem.product_model_article).like(
                    f"%{needle.casefold()}%"
                )
            )

    rows = db.execute(statement).all()
    return [
        {
            "product_model_id": row.product_model_id,
            "product_model_article": row.product_model_article or "—",
            "product_model_name": row.product_model_name,
            "order_count": int(row.order_count or 0),
            "units_ordered": _dec(row.units_ordered),
            "units_manufactured": _dec(row.units_manufactured),
            "order_amount": _dec(row.order_amount),
            "sewing_cost_amount": _dec(row.sewing_cost_amount),
        }
        for row in rows
    ]


def _dec(value: object) -> Decimal:
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value or 0))
