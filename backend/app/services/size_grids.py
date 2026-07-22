from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.size_grid import SizeGrid, SizeGridSizeType
from app.repositories import size_grids as repo
from app.schemas.size_grid import SizeGridListItem, SizeGridRead


class SizeGridNotFoundError(Exception):
    pass


def list_size_grids(
    db: Session,
    *,
    size_type: SizeGridSizeType | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[SizeGridListItem]:
    rows = repo.list_size_grids(db, size_type=size_type, limit=limit, offset=offset)
    return [
        SizeGridListItem(
            id=grid.id,
            name=grid.name,
            size_type=grid.size_type,
            source_note=grid.source_note,
            row_count=int(count or 0),
            created_at=grid.created_at,
            updated_at=grid.updated_at,
        )
        for grid, count in rows
    ]


def get_size_grid(db: Session, grid_id: int) -> SizeGridRead:
    grid = repo.get_size_grid(db, grid_id)
    if grid is None:
        raise SizeGridNotFoundError(f"Size grid {grid_id} not found")
    return SizeGridRead.model_validate(grid)
