"""Print-form registry API (Stage 18.3.3)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps_auth import get_current_platform_user, require_permission
from app.database.session import get_db
from app.models.auth import PlatformUser
from app.schemas.print_forms import (
    PrintFormCreate,
    PrintFormGenerateRequest,
    PrintFormPreviewRequest,
    PrintFormRead,
    PrintFormRenderRead,
    PrintFormUpdate,
    PrintFormVersionCreate,
    PrintFormVersionPublishRequest,
    PrintFormVersionRead,
    PrintFormVersionUpdate,
)
from app.services import rbac as rbac_service
from app.services.print_forms import (
    PrintFormConflictError,
    PrintFormNotFoundError,
    PrintFormValidationError,
    activate_print_form,
    archive_print_form,
    create_print_form,
    create_print_form_version,
    generate_print_form,
    get_print_form,
    list_print_forms,
    preview_print_form,
    publish_print_form_version,
    update_print_form,
    update_print_form_version,
)

router = APIRouter(prefix="/print-forms", tags=["Print forms"])


@router.get("", response_model=list[PrintFormRead], operation_id="list_print_forms")
def read_print_forms(
    binding_type: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    q: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: PlatformUser = Depends(get_current_platform_user),
) -> list[PrintFormRead]:
    try:
        return list_print_forms(
            db,
            binding_type=binding_type,
            status=status_filter,
            q=q,
            limit=limit,
            offset=offset,
        )
    except PrintFormValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error


@router.post(
    "",
    response_model=PrintFormRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_print_form",
)
def create_print_form_endpoint(
    payload: PrintFormCreate,
    db: Session = Depends(get_db),
    _: PlatformUser = Depends(
        require_permission(rbac_service.PERM_PRINT_FORMS_WRITE)
    ),
) -> PrintFormRead:
    try:
        return create_print_form(db, payload)
    except PrintFormConflictError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error
    except PrintFormValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error


@router.get(
    "/{print_form_id}",
    response_model=PrintFormRead,
    operation_id="get_print_form",
)
def read_print_form(
    print_form_id: int,
    db: Session = Depends(get_db),
    _: PlatformUser = Depends(get_current_platform_user),
) -> PrintFormRead:
    try:
        return get_print_form(db, print_form_id)
    except PrintFormNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error


@router.patch(
    "/{print_form_id}",
    response_model=PrintFormRead,
    operation_id="update_print_form",
)
def patch_print_form(
    print_form_id: int,
    payload: PrintFormUpdate,
    db: Session = Depends(get_db),
    _: PlatformUser = Depends(
        require_permission(rbac_service.PERM_PRINT_FORMS_WRITE)
    ),
) -> PrintFormRead:
    try:
        return update_print_form(db, print_form_id, payload)
    except PrintFormNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except PrintFormConflictError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error
    except PrintFormValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error


@router.post(
    "/{print_form_id}/activate",
    response_model=PrintFormRead,
    operation_id="activate_print_form",
)
def activate_print_form_endpoint(
    print_form_id: int,
    db: Session = Depends(get_db),
    _: PlatformUser = Depends(
        require_permission(rbac_service.PERM_PRINT_FORMS_WRITE)
    ),
) -> PrintFormRead:
    try:
        return activate_print_form(db, print_form_id)
    except PrintFormNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except PrintFormValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error


@router.post(
    "/{print_form_id}/archive",
    response_model=PrintFormRead,
    operation_id="archive_print_form",
)
def archive_print_form_endpoint(
    print_form_id: int,
    db: Session = Depends(get_db),
    _: PlatformUser = Depends(
        require_permission(rbac_service.PERM_PRINT_FORMS_WRITE)
    ),
) -> PrintFormRead:
    try:
        return archive_print_form(db, print_form_id)
    except PrintFormNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error


@router.post(
    "/{print_form_id}/versions",
    response_model=PrintFormVersionRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_print_form_version",
)
def create_print_form_version_endpoint(
    print_form_id: int,
    payload: PrintFormVersionCreate,
    db: Session = Depends(get_db),
    _: PlatformUser = Depends(
        require_permission(rbac_service.PERM_PRINT_FORMS_WRITE)
    ),
) -> PrintFormVersionRead:
    try:
        return create_print_form_version(db, print_form_id, payload)
    except PrintFormNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except PrintFormConflictError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error
    except PrintFormValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error


@router.patch(
    "/{print_form_id}/versions/{version_id}",
    response_model=PrintFormVersionRead,
    operation_id="update_print_form_version",
)
def patch_print_form_version(
    print_form_id: int,
    version_id: int,
    payload: PrintFormVersionUpdate,
    db: Session = Depends(get_db),
    _: PlatformUser = Depends(
        require_permission(rbac_service.PERM_PRINT_FORMS_WRITE)
    ),
) -> PrintFormVersionRead:
    try:
        return update_print_form_version(db, print_form_id, version_id, payload)
    except PrintFormNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except PrintFormValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error


@router.post(
    "/{print_form_id}/versions/{version_id}/publish",
    response_model=PrintFormVersionRead,
    operation_id="publish_print_form_version",
)
def publish_print_form_version_endpoint(
    print_form_id: int,
    version_id: int,
    payload: PrintFormVersionPublishRequest,
    db: Session = Depends(get_db),
    _: PlatformUser = Depends(
        require_permission(rbac_service.PERM_PRINT_FORMS_WRITE)
    ),
) -> PrintFormVersionRead:
    try:
        return publish_print_form_version(db, print_form_id, version_id, payload)
    except PrintFormNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except PrintFormValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error


@router.post(
    "/{print_form_id}/preview",
    response_model=PrintFormRenderRead,
    operation_id="preview_print_form",
)
def preview_print_form_endpoint(
    print_form_id: int,
    payload: PrintFormPreviewRequest,
    db: Session = Depends(get_db),
    _: PlatformUser = Depends(get_current_platform_user),
) -> PrintFormRenderRead:
    try:
        return preview_print_form(db, print_form_id, payload)
    except PrintFormNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except PrintFormValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error


@router.post(
    "/generate",
    response_model=PrintFormRenderRead,
    operation_id="generate_print_form",
)
def generate_print_form_endpoint(
    payload: PrintFormGenerateRequest,
    db: Session = Depends(get_db),
    _: PlatformUser = Depends(get_current_platform_user),
) -> PrintFormRenderRead:
    try:
        return generate_print_form(db, payload)
    except PrintFormNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except PrintFormValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
