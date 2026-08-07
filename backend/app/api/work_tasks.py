"""WorkTask HTTP API (ADR-028 / Stage 23.2)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps_auth import get_current_platform_user
from app.database.session import get_db
from app.models.auth import PlatformUser
from app.schemas.work_tasks import (
    WorkTaskCreate,
    WorkTaskListItem,
    WorkTaskMessageRead,
    WorkTaskRead,
    WorkTaskUpdate,
)
from app.services import work_tasks as work_task_svc

router = APIRouter(prefix="/work-tasks", tags=["Work Tasks"])
embeds_router = APIRouter(tags=["Work Tasks"])


def _map_error(error: Exception) -> HTTPException:
    if isinstance(error, work_task_svc.WorkTaskNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))
    if isinstance(error, work_task_svc.WorkTaskValidationError):
        detail = str(error)
        code = (
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
            if "mime type" in detail.lower()
            else status.HTTP_400_BAD_REQUEST
        )
        return HTTPException(status_code=code, detail=detail)
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Work task error",
    )


@router.get(
    "",
    response_model=list[WorkTaskListItem],
    operation_id="list_work_tasks",
)
def list_work_tasks(
    status_filter: str | None = Query(default=None, alias="status"),
    production_stage_id: int | None = Query(default=None, ge=1),
    executor_platform_user_id: int | None = Query(default=None, ge=1),
    responsible_platform_user_id: int | None = Query(default=None, ge=1),
    lead_id: int | None = Query(default=None, ge=1),
    sales_order_id: int | None = Query(default=None, ge=1),
    production_order_id: int | None = Query(default=None, ge=1),
    anchor_type: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _user: PlatformUser = Depends(get_current_platform_user),
) -> list[WorkTaskListItem]:
    try:
        return work_task_svc.list_work_tasks(
            db,
            status=status_filter,
            production_stage_id=production_stage_id,
            executor_platform_user_id=executor_platform_user_id,
            responsible_platform_user_id=responsible_platform_user_id,
            lead_id=lead_id,
            sales_order_id=sales_order_id,
            production_order_id=production_order_id,
            anchor_type=anchor_type,
        )
    except work_task_svc.WorkTaskValidationError as error:
        raise _map_error(error) from error


@router.post(
    "",
    response_model=WorkTaskRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_work_task",
)
def create_work_task(
    payload: WorkTaskCreate,
    db: Session = Depends(get_db),
    _user: PlatformUser = Depends(get_current_platform_user),
) -> WorkTaskRead:
    try:
        return work_task_svc.create_work_task(db, payload)
    except (
        work_task_svc.WorkTaskNotFoundError,
        work_task_svc.WorkTaskValidationError,
    ) as error:
        raise _map_error(error) from error


@router.get(
    "/{task_id}",
    response_model=WorkTaskRead,
    operation_id="get_work_task",
)
def get_work_task(
    task_id: int,
    db: Session = Depends(get_db),
    _user: PlatformUser = Depends(get_current_platform_user),
) -> WorkTaskRead:
    try:
        return work_task_svc.get_work_task(db, task_id)
    except work_task_svc.WorkTaskNotFoundError as error:
        raise _map_error(error) from error


@router.patch(
    "/{task_id}",
    response_model=WorkTaskRead,
    operation_id="update_work_task",
)
def update_work_task(
    task_id: int,
    payload: WorkTaskUpdate,
    db: Session = Depends(get_db),
    _user: PlatformUser = Depends(get_current_platform_user),
) -> WorkTaskRead:
    try:
        return work_task_svc.update_work_task(db, task_id, payload)
    except (
        work_task_svc.WorkTaskNotFoundError,
        work_task_svc.WorkTaskValidationError,
    ) as error:
        raise _map_error(error) from error


@router.get(
    "/{task_id}/messages",
    response_model=list[WorkTaskMessageRead],
    operation_id="list_work_task_messages",
)
def list_work_task_messages(
    task_id: int,
    db: Session = Depends(get_db),
    _user: PlatformUser = Depends(get_current_platform_user),
) -> list[WorkTaskMessageRead]:
    try:
        return work_task_svc.list_work_task_messages(db, task_id)
    except work_task_svc.WorkTaskNotFoundError as error:
        raise _map_error(error) from error


@router.post(
    "/{task_id}/messages",
    response_model=WorkTaskMessageRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_work_task_message",
)
async def create_work_task_message(
    task_id: int,
    body: str = Form(default=""),
    file: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
    user: PlatformUser = Depends(get_current_platform_user),
) -> WorkTaskMessageRead:
    file_bytes: bytes | None = None
    filename: str | None = None
    content_type: str | None = None
    if file is not None and file.filename:
        file_bytes = await file.read()
        filename = file.filename
        content_type = file.content_type
    try:
        return work_task_svc.create_work_task_message(
            db,
            task_id,
            user,
            body=body,
            file_bytes=file_bytes,
            filename=filename,
            content_type=content_type,
        )
    except (
        work_task_svc.WorkTaskNotFoundError,
        work_task_svc.WorkTaskValidationError,
    ) as error:
        raise _map_error(error) from error


@router.get(
    "/{task_id}/attachments/{attachment_id}/file",
    operation_id="download_work_task_attachment",
)
def download_work_task_attachment(
    task_id: int,
    attachment_id: int,
    db: Session = Depends(get_db),
    _user: PlatformUser = Depends(get_current_platform_user),
) -> Response:
    try:
        data, mime_type, filename = work_task_svc.get_work_task_attachment_file(
            db, task_id, attachment_id
        )
    except (
        work_task_svc.WorkTaskNotFoundError,
        work_task_svc.WorkTaskValidationError,
    ) as error:
        raise _map_error(error) from error
    return Response(
        content=data,
        media_type=mime_type,
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
        },
    )


@embeds_router.get(
    "/leads/{lead_id}/work-tasks",
    response_model=list[WorkTaskListItem],
    operation_id="list_lead_work_tasks",
)
def list_lead_work_tasks(
    lead_id: int,
    db: Session = Depends(get_db),
    _user: PlatformUser = Depends(get_current_platform_user),
) -> list[WorkTaskListItem]:
    try:
        return work_task_svc.list_lead_work_tasks(db, lead_id)
    except work_task_svc.WorkTaskNotFoundError as error:
        raise _map_error(error) from error


@embeds_router.get(
    "/orders/{order_id}/work-tasks",
    response_model=list[WorkTaskListItem],
    operation_id="list_order_work_tasks",
)
def list_order_work_tasks(
    order_id: int,
    db: Session = Depends(get_db),
    _user: PlatformUser = Depends(get_current_platform_user),
) -> list[WorkTaskListItem]:
    try:
        return work_task_svc.list_order_work_tasks(db, order_id)
    except work_task_svc.WorkTaskNotFoundError as error:
        raise _map_error(error) from error


@embeds_router.get(
    "/production-orders/{production_order_id}/work-tasks",
    response_model=list[WorkTaskListItem],
    operation_id="list_production_order_work_tasks",
)
def list_production_order_work_tasks(
    production_order_id: int,
    db: Session = Depends(get_db),
    _user: PlatformUser = Depends(get_current_platform_user),
) -> list[WorkTaskListItem]:
    try:
        return work_task_svc.list_production_order_work_tasks(db, production_order_id)
    except work_task_svc.WorkTaskNotFoundError as error:
        raise _map_error(error) from error
