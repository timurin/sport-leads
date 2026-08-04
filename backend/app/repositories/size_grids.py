from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.product_model import ProductModel
from app.models.size_grid import SizeGrid, SizeGridRow, SizeGridSizeType


def list_size_grids(
    db: Session,
    *,
    size_type: SizeGridSizeType | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[tuple[SizeGrid, int]]:
    row_count = func.count(SizeGridRow.id)
    stmt = (
        select(SizeGrid, row_count)
        .outerjoin(SizeGridRow, SizeGridRow.size_grid_id == SizeGrid.id)
        .group_by(SizeGrid.id)
        .order_by(SizeGrid.name.asc())
        .limit(limit)
        .offset(offset)
    )
    if size_type is not None:
        stmt = stmt.where(SizeGrid.size_type == size_type)
    return list(db.execute(stmt).all())


def get_size_grid(db: Session, grid_id: int) -> SizeGrid | None:
    return (
        db.query(SizeGrid)
        .options(selectinload(SizeGrid.rows))
        .filter(SizeGrid.id == grid_id)
        .one_or_none()
    )


def get_size_grid_by_name(db: Session, name: str) -> SizeGrid | None:
    return db.scalars(select(SizeGrid).where(SizeGrid.name == name)).first()


def get_size_grid_row(db: Session, row_id: int) -> SizeGridRow | None:
    return db.get(SizeGridRow, row_id)


def add_size_grid(db: Session, grid: SizeGrid) -> SizeGrid:
    db.add(grid)
    db.flush()
    return grid


def delete_size_grid(db: Session, grid: SizeGrid) -> None:
    db.delete(grid)
    db.flush()


def count_product_models_for_grid(db: Session, grid_id: int) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(ProductModel)
            .where(ProductModel.size_grid_id == grid_id)
        )
        or 0
    )


def add_size_grid_row(db: Session, row: SizeGridRow) -> SizeGridRow:
    db.add(row)
    db.flush()
    return row


def delete_size_grid_row(db: Session, row: SizeGridRow) -> None:
    db.delete(row)
    db.flush()
