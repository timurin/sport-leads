from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.import_run import ImportRun
from app.schemas.import_run import ImportRunRead
from app.services.import_service import (
    ImportRunNotFoundError,
    ImportService,
    SourceInactiveError,
    SourceNotFoundError,
)


router = APIRouter(
    prefix="/imports",
    tags=["Imports"],
)


@router.post(
    "/sources/{source_id}/run",
    response_model=ImportRunRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="run_source_import",
)
def run_source_import(
    source_id: int,
    db: Session = Depends(get_db),
) -> ImportRun:
    service = ImportService(db)

    try:
        return service.run_source(
            source_id=source_id,
            trigger_type="manual",
        )

    except SourceNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error

    except SourceInactiveError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error


@router.post(
    "/run-active",
    response_model=list[ImportRunRead],
    operation_id="run_all_active_imports",
)
def run_all_active_imports(
    db: Session = Depends(get_db),
) -> list[ImportRun]:
    return ImportService(db).run_all_active(
        trigger_type="manual_all",
    )


@router.get(
    "/runs",
    response_model=list[ImportRunRead],
    operation_id="list_import_runs",
)
def list_import_runs(
    source_id: int | None = Query(
        default=None,
        ge=1,
    ),
    limit: int = Query(
        default=100,
        ge=1,
        le=500,
    ),
    offset: int = Query(
        default=0,
        ge=0,
    ),
    db: Session = Depends(get_db),
) -> list[ImportRun]:
    return ImportService(db).list_runs(
        source_id=source_id,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/runs/{import_run_id}",
    response_model=ImportRunRead,
    operation_id="get_import_run",
)
def get_import_run(
    import_run_id: int,
    db: Session = Depends(get_db),
) -> ImportRun:
    try:
        return ImportService(db).get_run(
            import_run_id
        )

    except ImportRunNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error