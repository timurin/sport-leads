from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.stock import StockBalanceRead
from app.services.stock_balances import list_stock_balances

router = APIRouter(prefix="/stock", tags=["Stock"])


@router.get(
    "/balances",
    response_model=list[StockBalanceRead],
    operation_id="list_stock_balances",
)
def read_stock_balances(
    nomenclature_id: list[int] | None = Query(
        default=None,
        description="Optional filter: only these nomenclature ids",
    ),
    db: Session = Depends(get_db),
) -> list[StockBalanceRead]:
    """Projected balances by nomenclature. Empty until register posts (`4.6.5`)."""
    return list_stock_balances(db, nomenclature_ids=nomenclature_id)
