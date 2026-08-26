from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps_auth import get_current_platform_user, require_permission
from app.database.session import get_db
from app.models.auth import PlatformUser
from app.schemas.lead_card_fields import (
    LeadCardFieldDefinitionCreate,
    LeadCardFieldDefinitionRead,
    LeadCardFieldValueRead,
    LeadCardFieldValueWrite,
)
from app.services import rbac as rbac_service
from app.services.lead_card_fields import (
    LeadCardFieldNotFoundError,
    LeadCardFieldValidationError,
    create_definition,
    delete_definition,
    list_definitions,
    list_lead_values,
    upsert_lead_values,
)

definitions_router = APIRouter(prefix="/lead-card-fields", tags=["Lead card fields"])
values_router = APIRouter(prefix="/leads", tags=["Lead card fields"])


def _http_error(error: Exception) -> HTTPException:
    if isinstance(error, LeadCardFieldNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))
    if isinstance(error, LeadCardFieldValidationError):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        )
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error))


@definitions_router.get(
    "",
    response_model=list[LeadCardFieldDefinitionRead],
    operation_id="list_lead_card_fields",
)
def list_lead_card_fields(
    db: Session = Depends(get_db),
) -> list[LeadCardFieldDefinitionRead]:
    return list_definitions(db)


@definitions_router.post(
    "",
    response_model=LeadCardFieldDefinitionRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_lead_card_field",
)
def create_lead_card_field(
    payload: LeadCardFieldDefinitionCreate,
    db: Session = Depends(get_db),
    _actor: PlatformUser = Depends(
        require_permission(rbac_service.PERM_LEADS_CARD_FIELDS_MANAGE)
    ),
) -> LeadCardFieldDefinitionRead:
    try:
        return create_definition(db, payload)
    except LeadCardFieldValidationError as error:
        raise _http_error(error) from error


@definitions_router.delete(
    "/{definition_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="delete_lead_card_field",
)
def delete_lead_card_field(
    definition_id: int,
    db: Session = Depends(get_db),
    _actor: PlatformUser = Depends(
        require_permission(rbac_service.PERM_LEADS_CARD_FIELDS_MANAGE)
    ),
) -> None:
    try:
        delete_definition(db, definition_id)
    except LeadCardFieldNotFoundError as error:
        raise _http_error(error) from error


@values_router.get(
    "/{lead_id}/card-field-values",
    response_model=list[LeadCardFieldValueRead],
    operation_id="list_lead_card_field_values",
)
def get_lead_card_field_values(
    lead_id: int,
    db: Session = Depends(get_db),
) -> list[LeadCardFieldValueRead]:
    try:
        return list_lead_values(db, lead_id)
    except LeadCardFieldNotFoundError as error:
        raise _http_error(error) from error


@values_router.put(
    "/{lead_id}/card-field-values",
    response_model=list[LeadCardFieldValueRead],
    operation_id="put_lead_card_field_values",
)
def put_lead_card_field_values(
    lead_id: int,
    payload: LeadCardFieldValueWrite,
    db: Session = Depends(get_db),
    _user: PlatformUser = Depends(get_current_platform_user),
) -> list[LeadCardFieldValueRead]:
    try:
        return upsert_lead_values(db, lead_id, payload.items)
    except (LeadCardFieldNotFoundError, LeadCardFieldValidationError) as error:
        raise _http_error(error) from error
