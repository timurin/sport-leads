from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.sewing_operation_template import (
    SewingOperationTemplateCreate,
    SewingOperationTemplateRead,
    SewingOperationTemplateReplaceLines,
    SewingOperationTemplateUpdate,
)
from app.services.sewing_operation_templates import (
    SewingOperationTemplateConflictError,
    SewingOperationTemplateNotFoundError,
    SewingOperationTemplateValidationError,
    create_sewing_operation_template,
    delete_sewing_operation_template,
    get_sewing_operation_template,
    list_sewing_operation_templates,
    replace_sewing_operation_template_lines,
    update_sewing_operation_template,
)

router = APIRouter(prefix="/sewing-operation-templates", tags=["Sewing operation templates"])


@router.get(
    "",
    response_model=list[SewingOperationTemplateRead],
    operation_id="list_sewing_operation_templates",
)
def read_templates(db: Session = Depends(get_db)) -> list:
    return list_sewing_operation_templates(db)


@router.post(
    "",
    response_model=SewingOperationTemplateRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_sewing_operation_template",
)
def create_template_endpoint(
    payload: SewingOperationTemplateCreate,
    db: Session = Depends(get_db),
) -> SewingOperationTemplateRead:
    try:
        return create_sewing_operation_template(db, payload)
    except SewingOperationTemplateConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except SewingOperationTemplateValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error


@router.get(
    "/{template_id}",
    response_model=SewingOperationTemplateRead,
    operation_id="get_sewing_operation_template",
)
def read_template(
    template_id: int,
    db: Session = Depends(get_db),
) -> SewingOperationTemplateRead:
    try:
        return get_sewing_operation_template(db, template_id)
    except SewingOperationTemplateNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.patch(
    "/{template_id}",
    response_model=SewingOperationTemplateRead,
    operation_id="update_sewing_operation_template",
)
def patch_template(
    template_id: int,
    payload: SewingOperationTemplateUpdate,
    db: Session = Depends(get_db),
) -> SewingOperationTemplateRead:
    try:
        return update_sewing_operation_template(db, template_id, payload)
    except SewingOperationTemplateNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except SewingOperationTemplateConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except SewingOperationTemplateValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error


@router.put(
    "/{template_id}/lines",
    response_model=SewingOperationTemplateRead,
    operation_id="replace_sewing_operation_template_lines",
)
def replace_template_lines(
    template_id: int,
    payload: SewingOperationTemplateReplaceLines,
    db: Session = Depends(get_db),
) -> SewingOperationTemplateRead:
    try:
        return replace_sewing_operation_template_lines(
            db, template_id, payload.sewing_operation_ids
        )
    except SewingOperationTemplateNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except SewingOperationTemplateValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error


@router.delete(
    "/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="delete_sewing_operation_template",
)
def remove_template(template_id: int, db: Session = Depends(get_db)) -> None:
    try:
        delete_sewing_operation_template(db, template_id)
    except SewingOperationTemplateNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
