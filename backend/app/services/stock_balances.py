"""Stock balance projection for warehouse nomenclature list.

Roadmap: `12.1.2` (dimension), fill from posted ledger in `12.2.2`.
Bins / lots stay out of MVP (stub). Never invent demo quantities (ADR-012).
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable
from decimal import Decimal
from typing import NamedTuple

from sqlalchemy.orm import Session

from app.repositories import stock_documents as stock_repo
from app.repositories import warehouses as warehouse_repo
from app.schemas.stock import StockBalanceRead


class StockBalanceValidationError(RuntimeError):
    pass


class StockBalanceNotFoundError(RuntimeError):
    pass


class LedgerQuantityRow(NamedTuple):
    """Minimal ledger input for projection."""

    warehouse_id: int
    nomenclature_id: int
    quantity: Decimal


def balance_quantity_or_zero(quantity: Decimal | None) -> Decimal:
    return quantity if quantity is not None else Decimal("0")


def project_balances_from_ledger_rows(
    rows: Iterable[LedgerQuantityRow],
    *,
    warehouse_id: int | None = None,
    nomenclature_ids: list[int] | None = None,
) -> list[StockBalanceRead]:
    """Σ qty by warehouse×nomenclature, or by nomenclature when warehouse unset."""
    allowed: set[int] | None = None
    if nomenclature_ids is not None:
        if len(nomenclature_ids) == 0:
            return []
        allowed = set(nomenclature_ids)

    totals: dict[tuple[int | None, int], Decimal] = defaultdict(
        lambda: Decimal("0")
    )
    for row in rows:
        if warehouse_id is not None and row.warehouse_id != warehouse_id:
            continue
        if allowed is not None and row.nomenclature_id not in allowed:
            continue
        if warehouse_id is not None:
            key = (row.warehouse_id, row.nomenclature_id)
        else:
            key = (None, row.nomenclature_id)
        totals[key] += Decimal(str(row.quantity))

    result = [
        StockBalanceRead(
            warehouse_id=wh_id,
            nomenclature_id=nom_id,
            quantity=qty,
        )
        for (wh_id, nom_id), qty in totals.items()
        if qty != 0
    ]
    result.sort(
        key=lambda item: (
            item.warehouse_id is not None,
            item.warehouse_id or 0,
            item.nomenclature_id,
        )
    )
    return result


def list_stock_balances(
    db: Session,
    *,
    nomenclature_ids: list[int] | None = None,
    warehouse_id: int | None = None,
) -> list[StockBalanceRead]:
    """Return projected balances from posted StockLedgerLine rows."""
    if warehouse_id is not None:
        warehouse = warehouse_repo.get_warehouse(db, warehouse_id)
        if warehouse is None:
            raise StockBalanceNotFoundError("Склад не найден")
        if not warehouse.is_active:
            raise StockBalanceValidationError("Склад неактивен")

    if nomenclature_ids is not None and len(nomenclature_ids) == 0:
        return []

    raw = stock_repo.list_posted_ledger_quantities(
        db,
        warehouse_id=warehouse_id,
        nomenclature_ids=nomenclature_ids,
    )
    rows = [
        LedgerQuantityRow(warehouse_id=wh, nomenclature_id=nom, quantity=qty)
        for wh, nom, qty in raw
    ]
    return project_balances_from_ledger_rows(
        rows,
        warehouse_id=warehouse_id,
        nomenclature_ids=nomenclature_ids,
    )
