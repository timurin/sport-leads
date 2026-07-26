"""Stock balance projection for warehouse nomenclature list (`4.6.5` / `4.10.6`).

Until movement/ledger tables ship (`4.6.5.2`), list endpoints return no rows —
the UI shows zero, never invented demo quantities (ADR-012).
"""

from decimal import Decimal

from sqlalchemy.orm import Session

from app.schemas.stock import StockBalanceRead


def list_stock_balances(
    db: Session,
    *,
    nomenclature_ids: list[int] | None = None,
) -> list[StockBalanceRead]:
    """Return projected balances. Empty until the register posts movements."""
    _ = db  # reserved for ledger query in 4.6.5.3
    if nomenclature_ids is not None and len(nomenclature_ids) == 0:
        return []
    return []


def balance_quantity_or_zero(quantity: Decimal | None) -> Decimal:
    return quantity if quantity is not None else Decimal("0")
