"""Platform system settings HTTP API (18.1.2)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps_auth import get_current_platform_user, require_permission
from app.database.session import get_db
from app.models.auth import PlatformUser
from app.schemas.platform_system_settings import (
    PlatformBrandRead,
    PlatformSystemSettingsRead,
    PlatformSystemSettingsUpdate,
)
from app.services import rbac as rbac_service
from app.services.platform_system_settings import (
    PlatformSystemSettingsNotFoundError,
    PlatformSystemSettingsValidationError,
    clear_platform_logo,
    ensure_platform_system_settings,
    get_platform_brand,
    get_platform_system_settings,
    logo_file_path,
    update_platform_system_settings,
    upload_platform_logo,
)

router = APIRouter(prefix="/platform-system-settings", tags=["Platform system settings"])


@router.get(
    "",
    response_model=PlatformSystemSettingsRead,
    operation_id="get_platform_system_settings",
)
def read_platform_system_settings(
    db: Session = Depends(get_db),
    _: PlatformUser = Depends(get_current_platform_user),
) -> PlatformSystemSettingsRead:
    return get_platform_system_settings(db)


@router.get(
    "/brand",
    response_model=PlatformBrandRead,
    operation_id="get_platform_brand",
)
def read_platform_brand(
    db: Session = Depends(get_db),
    _: PlatformUser = Depends(get_current_platform_user),
) -> PlatformBrandRead:
    return get_platform_brand(db)


@router.put(
    "",
    response_model=PlatformSystemSettingsRead,
    operation_id="update_platform_system_settings",
)
def put_platform_system_settings(
    payload: PlatformSystemSettingsUpdate,
    db: Session = Depends(get_db),
    _: PlatformUser = Depends(
        require_permission(rbac_service.PERM_SYSTEM_SETTINGS_WRITE)
    ),
) -> PlatformSystemSettingsRead:
    return update_platform_system_settings(db, payload)


@router.post(
    "/logo",
    response_model=PlatformSystemSettingsRead,
    operation_id="upload_platform_system_logo",
)
async def post_platform_system_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: PlatformUser = Depends(
        require_permission(rbac_service.PERM_SYSTEM_SETTINGS_WRITE)
    ),
) -> PlatformSystemSettingsRead:
    content = await file.read()
    mime = (file.content_type or "").split(";")[0].strip().lower()
    try:
        return upload_platform_logo(
            db,
            filename=file.filename or "logo.png",
            mime_type=mime,
            content=content,
        )
    except PlatformSystemSettingsValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error


@router.delete(
    "/logo",
    response_model=PlatformSystemSettingsRead,
    operation_id="delete_platform_system_logo",
)
def delete_platform_system_logo(
    db: Session = Depends(get_db),
    _: PlatformUser = Depends(
        require_permission(rbac_service.PERM_SYSTEM_SETTINGS_WRITE)
    ),
) -> PlatformSystemSettingsRead:
    return clear_platform_logo(db)


@router.get(
    "/logo/content",
    operation_id="get_platform_system_logo_content",
)
def get_platform_system_logo_content(
    db: Session = Depends(get_db),
) -> FileResponse:
    row = ensure_platform_system_settings(db)
    try:
        path = logo_file_path(row)
    except PlatformSystemSettingsNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(error),
        ) from error
    except PlatformSystemSettingsValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error
    return FileResponse(
        path,
        media_type=row.logo_mime_type or "application/octet-stream",
        filename=row.logo_original_filename or path.name,
    )
