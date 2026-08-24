from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.sewing_operation import (
    SewingOperationCreate,
    SewingOperationFolderCreate,
    SewingOperationFolderRead,
    SewingOperationFolderUpdate,
    SewingOperationImportResult,
    SewingOperationRead,
    SewingOperationSiblingMove,
    SewingOperationUpdate,
)
from app.services.sewing_operation_export import (
    SewingOperationExportError,
    build_sewing_operation_import_template,
    export_sewing_operations_file,
)
from app.services.sewing_operation_import import (
    SewingOperationImportError,
    import_sewing_operations_from_bytes,
)
from app.services.sewing_operations import (
    SewingOperationConflictError,
    SewingOperationFolderConflictError,
    SewingOperationFolderNotFoundError,
    SewingOperationFolderValidationError,
    SewingOperationNotFoundError,
    SewingOperationValidationError,
    create_sewing_operation,
    create_sewing_operation_folder,
    delete_sewing_operation,
    delete_sewing_operation_folder,
    get_sewing_operation,
    get_sewing_operation_folder,
    list_sewing_operation_folders,
    list_sewing_operations,
    move_sewing_operation_folder_sibling,
    move_sewing_operation_sibling,
    update_sewing_operation,
    update_sewing_operation_folder,
)

router = APIRouter(prefix="/sewing-operations", tags=["Sewing operations"])
folders_router = APIRouter(prefix="/sewing-operation-folders", tags=["Sewing operations"])

@router.get(
    "",
    response_model=list[SewingOperationRead],
    operation_id="list_sewing_operations",
)
def read_sewing_operations(
    search: str | None = Query(default=None, max_length=255),
    folder_id: int | None = Query(default=None, ge=1),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list:
    return list_sewing_operations(
        db, search=search, folder_id=folder_id, limit=limit, offset=offset
    )


_MAX_IMPORT_BYTES = 5 * 1024 * 1024


@router.get(
    "/export",
    operation_id="export_sewing_operations",
    response_class=Response,
)
def export_sewing_operations(
    file_format: str = Query(default="csv", alias="format", pattern="^(csv|xlsx)$"),
    search: str | None = Query(default=None, max_length=255),
    db: Session = Depends(get_db),
) -> Response:
    """Filter-aware catalog export; columns match import template (`4.5.4`)."""
    try:
        payload, filename, media_type = export_sewing_operations_file(
            db,
            file_format=file_format,  # type: ignore[arg-type]
            search=search,
        )
    except (SewingOperationExportError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return Response(
        content=payload,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/import-template",
    operation_id="download_sewing_operation_import_template",
    response_class=Response,
)
def download_sewing_operation_import_template(
    file_format: str = Query(default="csv", alias="format", pattern="^(csv|xlsx)$"),
) -> Response:
    try:
        payload, filename, media_type = build_sewing_operation_import_template(
            file_format=file_format,  # type: ignore[arg-type]
        )
    except SewingOperationExportError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return Response(
        content=payload,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post(
    "/import",
    response_model=SewingOperationImportResult,
    operation_id="import_sewing_operations",
)
async def import_sewing_operations(
    file: UploadFile = File(...),
    dry_run: bool = Query(default=True),
    sheet_name: str | None = Query(default=None, max_length=120),
    db: Session = Depends(get_db),
) -> SewingOperationImportResult:
    data = await file.read()
    if len(data) > _MAX_IMPORT_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Import file exceeds 5 MB limit",
        )
    try:
        return import_sewing_operations_from_bytes(
            db,
            data,
            filename=file.filename,
            content_type=file.content_type,
            sheet_name=sheet_name,
            dry_run=dry_run,
        )
    except SewingOperationImportError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error


@router.post(
    "",
    response_model=SewingOperationRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_sewing_operation",
)
def create_sewing_operation_endpoint(
    payload: SewingOperationCreate,
    db: Session = Depends(get_db),
) -> SewingOperationRead:
    try:
        return create_sewing_operation(db, payload)
    except SewingOperationConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except SewingOperationValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error


@router.get(
    "/{operation_id}",
    response_model=SewingOperationRead,
    operation_id="get_sewing_operation",
)
def read_sewing_operation(
    operation_id: int,
    db: Session = Depends(get_db),
) -> SewingOperationRead:
    try:
        return get_sewing_operation(db, operation_id)
    except SewingOperationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.patch(
    "/{operation_id}",
    response_model=SewingOperationRead,
    operation_id="update_sewing_operation",
)
def patch_sewing_operation(
    operation_id: int,
    payload: SewingOperationUpdate,
    db: Session = Depends(get_db),
) -> SewingOperationRead:
    try:
        return update_sewing_operation(db, operation_id, payload)
    except SewingOperationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except SewingOperationConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except SewingOperationValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error


@router.post(
    "/{operation_id}/move-sibling",
    response_model=SewingOperationRead,
    operation_id="move_sewing_operation_sibling",
)
def move_sewing_operation_sibling_endpoint(
    operation_id: int,
    payload: SewingOperationSiblingMove,
    db: Session = Depends(get_db),
) -> SewingOperationRead:
    try:
        return move_sewing_operation_sibling(db, operation_id, payload.direction)
    except SewingOperationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.delete(
    "/{operation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="delete_sewing_operation",
)
def remove_sewing_operation(
    operation_id: int,
    db: Session = Depends(get_db),
) -> None:
    try:
        delete_sewing_operation(db, operation_id)
    except SewingOperationNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@folders_router.get(
    "",
    response_model=list[SewingOperationFolderRead],
    operation_id="list_sewing_operation_folders",
)
def read_sewing_operation_folders(db: Session = Depends(get_db)) -> list:
    return list_sewing_operation_folders(db)


@folders_router.post(
    "",
    response_model=SewingOperationFolderRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_sewing_operation_folder",
)
def create_sewing_operation_folder_endpoint(
    payload: SewingOperationFolderCreate,
    db: Session = Depends(get_db),
) -> SewingOperationFolderRead:
    try:
        return create_sewing_operation_folder(db, payload)
    except SewingOperationFolderConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except SewingOperationFolderValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error
    except SewingOperationFolderNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@folders_router.get(
    "/{folder_id}",
    response_model=SewingOperationFolderRead,
    operation_id="get_sewing_operation_folder",
)
def read_sewing_operation_folder(
    folder_id: int,
    db: Session = Depends(get_db),
) -> SewingOperationFolderRead:
    try:
        return get_sewing_operation_folder(db, folder_id)
    except SewingOperationFolderNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@folders_router.patch(
    "/{folder_id}",
    response_model=SewingOperationFolderRead,
    operation_id="update_sewing_operation_folder",
)
def patch_sewing_operation_folder(
    folder_id: int,
    payload: SewingOperationFolderUpdate,
    db: Session = Depends(get_db),
) -> SewingOperationFolderRead:
    try:
        return update_sewing_operation_folder(db, folder_id, payload)
    except SewingOperationFolderNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except SewingOperationFolderConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except SewingOperationFolderValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error


@folders_router.post(
    "/{folder_id}/move-sibling",
    response_model=SewingOperationFolderRead,
    operation_id="move_sewing_operation_folder_sibling",
)
def move_sewing_operation_folder_sibling_endpoint(
    folder_id: int,
    payload: SewingOperationSiblingMove,
    db: Session = Depends(get_db),
) -> SewingOperationFolderRead:
    try:
        return move_sewing_operation_folder_sibling(db, folder_id, payload.direction)
    except SewingOperationFolderNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@folders_router.delete(
    "/{folder_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="delete_sewing_operation_folder",
)
def remove_sewing_operation_folder(
    folder_id: int,
    db: Session = Depends(get_db),
) -> None:
    try:
        delete_sewing_operation_folder(db, folder_id)
    except SewingOperationFolderNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except SewingOperationFolderValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error
