"""Sewing cabinet HTTP API (ADR-029 / 24.2.2)."""

from __future__ import annotations

from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps_auth import get_current_platform_user
from app.database.session import get_db
from app.models.auth import PlatformUser
from app.schemas.sewing_cabinet import (
    SewingCabinetRead,
    SewingQueueCardRead,
    SewingSewerListItem,
    SewingWorkEntryRead,
    SewingWorkTakeRequest,
)
from app.services.sewing_cabinet import (
    SewingCabinetConflictError,
    SewingCabinetError,
    SewingCabinetForbiddenError,
    SewingCabinetNotFoundError,
    SewingCabinetValidationError,
    complete_work,
    ensure_cabinet_access,
    get_cabinet,
    list_sewers,
    list_sewing_queue,
    release_work,
    take_work,
    user_can_write_cabinet,
)

router = APIRouter(prefix="/sewing-cabinet", tags=["Sewing cabinet"])

PeriodPreset = Literal["day", "week", "month", "custom"]


def _http_error(error: Exception) -> HTTPException:
    if isinstance(error, SewingCabinetNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))
    if isinstance(error, SewingCabinetForbiddenError):
        return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(error))
    if isinstance(error, SewingCabinetConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))
    if isinstance(error, SewingCabinetValidationError):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error)
        )
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error))


@router.get(
    "",
    response_model=SewingCabinetRead,
    operation_id="get_own_sewing_cabinet",
)
def get_own_sewing_cabinet(
    period: PeriodPreset = Query(default="day"),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: Session = Depends(get_db),
    user: PlatformUser = Depends(get_current_platform_user),
) -> SewingCabinetRead:
    try:
        return get_cabinet(
            db,
            user,
            user.id,
            preset=period,
            date_from=date_from,
            date_to=date_to,
            include_queue=True,
        )
    except SewingCabinetError as error:
        raise _http_error(error) from error


@router.get(
    "/queue",
    response_model=list[SewingQueueCardRead],
    operation_id="list_sewing_cabinet_queue",
)
def get_sewing_cabinet_queue(
    db: Session = Depends(get_db),
    user: PlatformUser = Depends(get_current_platform_user),
) -> list[SewingQueueCardRead]:
    try:
        ensure_cabinet_access(user)
    except SewingCabinetForbiddenError as error:
        raise _http_error(error) from error
    return list_sewing_queue(db)


@router.get(
    "/sewers",
    response_model=list[SewingSewerListItem],
    operation_id="list_sewing_cabinet_sewers",
)
def get_sewing_cabinet_sewers(
    period: PeriodPreset = Query(default="day"),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: Session = Depends(get_db),
    user: PlatformUser = Depends(get_current_platform_user),
) -> list[SewingSewerListItem]:
    try:
        return list_sewers(
            db, user, preset=period, date_from=date_from, date_to=date_to
        )
    except SewingCabinetError as error:
        raise _http_error(error) from error


@router.get(
    "/users/{platform_user_id}",
    response_model=SewingCabinetRead,
    operation_id="get_sewing_cabinet_for_user",
)
def get_sewing_cabinet_for_user(
    platform_user_id: int,
    period: PeriodPreset = Query(default="day"),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: Session = Depends(get_db),
    user: PlatformUser = Depends(get_current_platform_user),
) -> SewingCabinetRead:
    try:
        return get_cabinet(
            db,
            user,
            platform_user_id,
            preset=period,
            date_from=date_from,
            date_to=date_to,
            include_queue=platform_user_id == user.id,
        )
    except SewingCabinetError as error:
        raise _http_error(error) from error


@router.post(
    "/take",
    response_model=SewingWorkEntryRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="take_sewing_work",
)
def post_sewing_work_take(
    payload: SewingWorkTakeRequest,
    db: Session = Depends(get_db),
    user: PlatformUser = Depends(get_current_platform_user),
) -> SewingWorkEntryRead:
    if not user_can_write_cabinet(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав: sewing_cabinet.write",
        )
    try:
        item = take_work(db, user, payload)
    except SewingCabinetError as error:
        raise _http_error(error) from error
    db.commit()
    return item


@router.post(
    "/entries/{entry_id}/complete",
    response_model=SewingWorkEntryRead,
    operation_id="complete_sewing_work",
)
def post_sewing_work_complete(
    entry_id: int,
    db: Session = Depends(get_db),
    user: PlatformUser = Depends(get_current_platform_user),
) -> SewingWorkEntryRead:
    try:
        item = complete_work(db, user, entry_id)
    except SewingCabinetError as error:
        raise _http_error(error) from error
    db.commit()
    return item


@router.post(
    "/entries/{entry_id}/release",
    response_model=SewingWorkEntryRead,
    operation_id="release_sewing_work",
)
def post_sewing_work_release(
    entry_id: int,
    db: Session = Depends(get_db),
    user: PlatformUser = Depends(get_current_platform_user),
) -> SewingWorkEntryRead:
    try:
        item = release_work(db, user, entry_id)
    except SewingCabinetError as error:
        raise _http_error(error) from error
    db.commit()
    return item
