"""Design projects / versions API (Stage 10.1.1.3 / ADR-021 + 10.1.2.3)."""

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.design_project import (
    DesignProjectCreate,
    DesignProjectListItem,
    DesignProjectRead,
    DesignProjectUpdate,
    DesignVersionAssetCreate,
    DesignVersionAssetRead,
    DesignVersionAssetUpdate,
    DesignVersionCommentCreate,
    DesignVersionCommentRead,
    DesignVersionCreate,
    DesignVersionRead,
)
from app.services.design_projects import (
    DesignProjectConflictError,
    DesignProjectNotFoundError,
    DesignProjectValidationError,
    DesignVersionNotFoundError,
    create_design_project,
    create_design_version,
    get_design_project,
    list_design_projects,
    list_design_versions,
    set_design_version_current,
    update_design_project,
)
from app.services.design_version_assets import (
    create_design_version_asset,
    create_design_version_comment,
    delete_design_version_asset,
    delete_design_version_comment,
    design_version_asset_path,
    list_design_version_assets,
    list_design_version_comments,
    update_design_version_asset,
)

router = APIRouter(prefix="/design-projects", tags=["Design projects"])


def _http_error(error: Exception) -> HTTPException:
    if isinstance(error, (DesignProjectNotFoundError, DesignVersionNotFoundError)):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))
    if isinstance(error, DesignProjectConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))
    if isinstance(error, DesignProjectValidationError):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        )
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error)
    )


@router.get(
    "",
    response_model=list[DesignProjectListItem],
    operation_id="list_design_projects",
)
def read_design_projects(
    sales_order_id: int | None = Query(default=None, gt=0),
    status_filter: str | None = Query(default=None, alias="status", max_length=20),
    search: str | None = Query(default=None, max_length=255),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[DesignProjectListItem]:
    return list_design_projects(
        db,
        sales_order_id=sales_order_id,
        status=status_filter,
        search=search,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=DesignProjectRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_design_project",
)
def create_design_project_endpoint(
    payload: DesignProjectCreate,
    db: Session = Depends(get_db),
) -> DesignProjectRead:
    try:
        return create_design_project(db, payload)
    except (
        DesignProjectNotFoundError,
        DesignProjectConflictError,
        DesignProjectValidationError,
    ) as error:
        raise _http_error(error) from error


@router.get(
    "/{project_id}",
    response_model=DesignProjectRead,
    operation_id="get_design_project",
)
def read_design_project(
    project_id: int,
    db: Session = Depends(get_db),
) -> DesignProjectRead:
    try:
        return get_design_project(db, project_id)
    except DesignProjectNotFoundError as error:
        raise _http_error(error) from error


@router.patch(
    "/{project_id}",
    response_model=DesignProjectRead,
    operation_id="update_design_project",
)
def patch_design_project(
    project_id: int,
    payload: DesignProjectUpdate,
    db: Session = Depends(get_db),
) -> DesignProjectRead:
    try:
        return update_design_project(db, project_id, payload)
    except (
        DesignProjectNotFoundError,
        DesignProjectConflictError,
        DesignProjectValidationError,
    ) as error:
        raise _http_error(error) from error


@router.get(
    "/{project_id}/versions",
    response_model=list[DesignVersionRead],
    operation_id="list_design_versions",
)
def read_design_versions(
    project_id: int,
    db: Session = Depends(get_db),
) -> list[DesignVersionRead]:
    try:
        return list_design_versions(db, project_id)
    except DesignProjectNotFoundError as error:
        raise _http_error(error) from error


@router.post(
    "/{project_id}/versions",
    response_model=DesignVersionRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_design_version",
)
def create_design_version_endpoint(
    project_id: int,
    payload: DesignVersionCreate,
    db: Session = Depends(get_db),
) -> DesignVersionRead:
    try:
        return create_design_version(db, project_id, payload)
    except (
        DesignProjectNotFoundError,
        DesignProjectConflictError,
        DesignProjectValidationError,
    ) as error:
        raise _http_error(error) from error


@router.post(
    "/{project_id}/versions/{version_id}/set-current",
    response_model=DesignVersionRead,
    operation_id="set_design_version_current",
)
def set_current_design_version(
    project_id: int,
    version_id: int,
    db: Session = Depends(get_db),
) -> DesignVersionRead:
    try:
        return set_design_version_current(db, project_id, version_id)
    except (
        DesignProjectNotFoundError,
        DesignVersionNotFoundError,
        DesignProjectConflictError,
        DesignProjectValidationError,
    ) as error:
        raise _http_error(error) from error


@router.get(
    "/{project_id}/versions/{version_id}/assets",
    response_model=list[DesignVersionAssetRead],
    operation_id="list_design_version_assets",
)
def read_design_version_assets(
    project_id: int,
    version_id: int,
    db: Session = Depends(get_db),
) -> list[DesignVersionAssetRead]:
    try:
        return list_design_version_assets(db, project_id, version_id)
    except (DesignProjectNotFoundError, DesignVersionNotFoundError) as error:
        raise _http_error(error) from error


@router.post(
    "/{project_id}/versions/{version_id}/assets",
    response_model=DesignVersionAssetRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_design_version_asset",
)
def create_design_version_asset_endpoint(
    project_id: int,
    version_id: int,
    payload: DesignVersionAssetCreate,
    db: Session = Depends(get_db),
) -> DesignVersionAssetRead:
    try:
        return create_design_version_asset(db, project_id, version_id, payload)
    except (
        DesignProjectNotFoundError,
        DesignVersionNotFoundError,
        DesignProjectConflictError,
        DesignProjectValidationError,
    ) as error:
        raise _http_error(error) from error


@router.patch(
    "/{project_id}/versions/{version_id}/assets/{asset_id}",
    response_model=DesignVersionAssetRead,
    operation_id="update_design_version_asset",
)
def patch_design_version_asset(
    project_id: int,
    version_id: int,
    asset_id: int,
    payload: DesignVersionAssetUpdate,
    db: Session = Depends(get_db),
) -> DesignVersionAssetRead:
    try:
        return update_design_version_asset(
            db, project_id, version_id, asset_id, payload
        )
    except (
        DesignProjectNotFoundError,
        DesignVersionNotFoundError,
        DesignProjectConflictError,
        DesignProjectValidationError,
    ) as error:
        raise _http_error(error) from error


@router.delete(
    "/{project_id}/versions/{version_id}/assets/{asset_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="delete_design_version_asset",
)
def remove_design_version_asset(
    project_id: int,
    version_id: int,
    asset_id: int,
    db: Session = Depends(get_db),
) -> Response:
    try:
        delete_design_version_asset(db, project_id, version_id, asset_id)
    except (
        DesignProjectNotFoundError,
        DesignVersionNotFoundError,
        DesignProjectValidationError,
    ) as error:
        raise _http_error(error) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{project_id}/versions/{version_id}/assets/{asset_id}/content",
    operation_id="get_design_version_asset_content",
)
def read_design_version_asset_content(
    project_id: int,
    version_id: int,
    asset_id: int,
    db: Session = Depends(get_db),
) -> FileResponse:
    try:
        path, mime_type, filename = design_version_asset_path(
            db, project_id, version_id, asset_id
        )
    except (DesignProjectNotFoundError, DesignVersionNotFoundError) as error:
        raise _http_error(error) from error
    return FileResponse(path, media_type=mime_type, filename=filename)


@router.get(
    "/{project_id}/versions/{version_id}/comments",
    response_model=list[DesignVersionCommentRead],
    operation_id="list_design_version_comments",
)
def read_design_version_comments(
    project_id: int,
    version_id: int,
    db: Session = Depends(get_db),
) -> list[DesignVersionCommentRead]:
    try:
        return list_design_version_comments(db, project_id, version_id)
    except (DesignProjectNotFoundError, DesignVersionNotFoundError) as error:
        raise _http_error(error) from error


@router.post(
    "/{project_id}/versions/{version_id}/comments",
    response_model=DesignVersionCommentRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_design_version_comment",
)
def create_design_version_comment_endpoint(
    project_id: int,
    version_id: int,
    payload: DesignVersionCommentCreate,
    db: Session = Depends(get_db),
) -> DesignVersionCommentRead:
    try:
        return create_design_version_comment(db, project_id, version_id, payload)
    except (
        DesignProjectNotFoundError,
        DesignVersionNotFoundError,
        DesignProjectValidationError,
    ) as error:
        raise _http_error(error) from error


@router.delete(
    "/{project_id}/versions/{version_id}/comments/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="delete_design_version_comment",
)
def remove_design_version_comment(
    project_id: int,
    version_id: int,
    comment_id: int,
    db: Session = Depends(get_db),
) -> Response:
    try:
        delete_design_version_comment(db, project_id, version_id, comment_id)
    except (
        DesignProjectNotFoundError,
        DesignVersionNotFoundError,
        DesignProjectValidationError,
    ) as error:
        raise _http_error(error) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)
