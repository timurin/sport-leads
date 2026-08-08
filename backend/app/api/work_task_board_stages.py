"""Work-task board stages HTTP API (Stage 23.8)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps_auth import get_current_platform_user
from app.database.session import get_db
from app.models.auth import PlatformUser
from app.schemas.work_tasks import (
    WorkTaskBoardStageCreate,
    WorkTaskBoardStageRead,
    WorkTaskBoardStageUpdate,
)
from app.services import work_task_board_stages as board_svc

router = APIRouter(prefix="/work-task-board-stages", tags=["Work Task Board Stages"])


def _map_error(error: Exception) -> HTTPException:
    if isinstance(error, board_svc.BoardStageNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))
    if isinstance(error, board_svc.BoardStageValidationError):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        )
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Board stage error",
    )


@router.get(
    "",
    response_model=list[WorkTaskBoardStageRead],
    operation_id="list_work_task_board_stages",
)
def list_work_task_board_stages(
    active_only: bool = Query(default=True),
    db: Session = Depends(get_db),
    _user: PlatformUser = Depends(get_current_platform_user),
) -> list[WorkTaskBoardStageRead]:
    return board_svc.list_board_stages(db, active_only=active_only)


@router.post(
    "",
    response_model=WorkTaskBoardStageRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_work_task_board_stage",
)
def create_work_task_board_stage(
    payload: WorkTaskBoardStageCreate,
    db: Session = Depends(get_db),
    _user: PlatformUser = Depends(get_current_platform_user),
) -> WorkTaskBoardStageRead:
    try:
        return board_svc.create_board_stage(db, payload)
    except (
        board_svc.BoardStageNotFoundError,
        board_svc.BoardStageValidationError,
    ) as error:
        raise _map_error(error) from error


@router.patch(
    "/{stage_id}",
    response_model=WorkTaskBoardStageRead,
    operation_id="update_work_task_board_stage",
)
def update_work_task_board_stage(
    stage_id: int,
    payload: WorkTaskBoardStageUpdate,
    db: Session = Depends(get_db),
    _user: PlatformUser = Depends(get_current_platform_user),
) -> WorkTaskBoardStageRead:
    try:
        return board_svc.update_board_stage(db, stage_id, payload)
    except (
        board_svc.BoardStageNotFoundError,
        board_svc.BoardStageValidationError,
    ) as error:
        raise _map_error(error) from error


@router.delete(
    "/{stage_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="delete_work_task_board_stage",
)
def delete_work_task_board_stage(
    stage_id: int,
    db: Session = Depends(get_db),
    _user: PlatformUser = Depends(get_current_platform_user),
) -> Response:
    try:
        board_svc.delete_board_stage(db, stage_id)
    except (
        board_svc.BoardStageNotFoundError,
        board_svc.BoardStageValidationError,
    ) as error:
        raise _map_error(error) from error
    return Response(status_code=status.HTTP_204_NO_CONTENT)
