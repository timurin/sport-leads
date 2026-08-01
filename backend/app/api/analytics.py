from datetime import date

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.services.pattern_model_sales_analytics import list_pattern_model_sales

router = APIRouter(prefix="/analytics", tags=["Analytics"])


class PatternModelSalesRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    product_model_id: int | None = None
    product_model_article: str
    product_model_name: str | None = None
    order_count: int
    units_ordered: float
    units_manufactured: float
    order_amount: float
    sewing_cost_amount: float


class PatternModelSalesResponse(BaseModel):
    items: list[PatternModelSalesRow]
    date_from: date | None = None
    date_to: date | None = None
    limit: int


@router.get("/pattern-model-sales", response_model=PatternModelSalesResponse)
def get_pattern_model_sales(
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    article: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> PatternModelSalesResponse:
    rows = list_pattern_model_sales(
        db,
        date_from=date_from,
        date_to=date_to,
        article=article,
        limit=limit,
    )
    return PatternModelSalesResponse(
        items=[
            PatternModelSalesRow(
                product_model_id=row["product_model_id"],  # type: ignore[arg-type]
                product_model_article=str(row["product_model_article"]),
                product_model_name=row["product_model_name"],  # type: ignore[arg-type]
                order_count=int(row["order_count"]),
                units_ordered=float(row["units_ordered"]),
                units_manufactured=float(row["units_manufactured"]),
                order_amount=float(row["order_amount"]),
                sewing_cost_amount=float(row["sewing_cost_amount"]),
            )
            for row in rows
        ],
        date_from=date_from,
        date_to=date_to,
        limit=limit,
    )
