"""Production stages API (Stage 8.3)."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.production_stage import (
    ProductionStageCreate,
    ProductionStageRead,
    ProductionStageUpdate,
)
from app.services.production_stages import (
    ProductionStageConflictError,
    ProductionStageNotFoundError,
    ProductionStageValidationError,
    create_production_stage,
    delete_production_stage,
    get_production_stage,
    list_production_stages,
    update_production_stage,
)

router = APIRouter(prefix="/production-stages", tags=["Production stages"])


@router.get(
    "",
    response_model=list[ProductionStageRead],
    operation_id="list_production_stages",
)
def read_production_stages(
    search: str | None = Query(default=None, max_length=255),
    active_only: bool = Query(default=False),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list:
    return list_production_stages(
        db, search=search, active_only=active_only, limit=limit, offset=offset
    )


@router.post(
    "",
    response_model=ProductionStageRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_production_stage",
)
def create_production_stage_endpoint(
    payload: ProductionStageCreate,
    db: Session = Depends(get_db),
) -> ProductionStageRead:
    try:
        return create_production_stage(db, payload)
    except ProductionStageConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.get(
    "/{stage_id}",
    response_model=ProductionStageRead,
    operation_id="get_production_stage",
)
def read_production_stage(
    stage_id: int,
    db: Session = Depends(get_db),
) -> ProductionStageRead:
    try:
        return get_production_stage(db, stage_id)
    except ProductionStageNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.patch(
    "/{stage_id}",
    response_model=ProductionStageRead,
    operation_id="update_production_stage",
)
def patch_production_stage(
    stage_id: int,
    payload: ProductionStageUpdate,
    db: Session = Depends(get_db),
) -> ProductionStageRead:
    try:
        return update_production_stage(db, stage_id, payload)
    except ProductionStageNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ProductionStageConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except ProductionStageValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error


@router.delete(
    "/{stage_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="delete_production_stage",
)
def remove_production_stage(stage_id: int, db: Session = Depends(get_db)) -> None:
    try:
        delete_production_stage(db, stage_id)
    except ProductionStageNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ProductionStageConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
