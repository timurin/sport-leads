from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.size_grid import SizeGridSizeType
from app.schemas.size_grid import SizeGridListItem, SizeGridRead
from app.services.size_grids import SizeGridNotFoundError, get_size_grid, list_size_grids

router = APIRouter(prefix="/size-grids", tags=["Size grids"])


@router.get(
    "",
    response_model=list[SizeGridListItem],
    operation_id="list_size_grids",
)
def read_size_grids(
    size_type: SizeGridSizeType | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[SizeGridListItem]:
    return list_size_grids(db, size_type=size_type, limit=limit, offset=offset)


@router.get(
    "/{grid_id}",
    response_model=SizeGridRead,
    operation_id="get_size_grid",
)
def read_size_grid(
    grid_id: int,
    db: Session = Depends(get_db),
) -> SizeGridRead:
    try:
        return get_size_grid(db, grid_id)
    except SizeGridNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
