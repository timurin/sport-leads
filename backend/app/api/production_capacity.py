from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.api.deps_auth import require_permission
from app.database.session import get_db
from app.schemas.production_capacity import (
    CapacityExceptionRead, CapacityExceptionUpdate, CapacityLoadRead, CapacityLoadRequest,
    CapacityResourceRead, CapacitySettingsRead, CapacitySettingsUpdate,
    CapacityResourceDetail, CapacityResourceWrite, CapacityResourceSummary,
)
from app.services import production_capacity as service
from app.services.production_calendar import CalendarError
from app.services.rbac import PERM_TECHNICAL_CARDS_CREATE

router = APIRouter(prefix="/capacity", tags=["Production capacity"])
write_access = require_permission(PERM_TECHNICAL_CARDS_CREATE)


@router.get("/resources", response_model=list[CapacityResourceSummary], operation_id="capacity_resources_list")
def list_resources(db: Session = Depends(get_db)):
    from app.services.capacity_resources import get_resources
    return get_resources(db, include_exceptions=False)


@router.get("/resources/{resource_key}", response_model=CapacityResourceDetail, operation_id="capacity_resource_read")
def read_resource(resource_key: str, db: Session = Depends(get_db)):
    from app.services.capacity_resources import get_resources
    rows = get_resources(db, [resource_key])
    if not rows:
        raise HTTPException(404, "Capacity resource not found")
    return rows[0]


@router.put("/resources/{resource_key}", response_model=CapacityResourceDetail,
            dependencies=[Depends(write_access)], operation_id="capacity_resource_save")
def save_resource(resource_key: str, payload: CapacityResourceWrite, db: Session = Depends(get_db)):
    from app.services.capacity_resources import save_resource as save
    try:
        return save(db, resource_key, payload)
    except CalendarError as error:
        raise HTTPException(error.status_code, str(error)) from error


@router.delete("/resources/{resource_key}", status_code=204, dependencies=[Depends(write_access)],
               operation_id="capacity_resource_delete")
def delete_resource(resource_key: str, db: Session = Depends(get_db)) -> Response:
    from app.services.capacity_resources import delete_resource as remove
    try:
        remove(db, resource_key)
    except CalendarError as error:
        raise HTTPException(error.status_code, str(error)) from error
    return Response(status_code=204)


@router.get("/settings", response_model=CapacitySettingsRead, operation_id="production_capacity_settings")
def read_settings(db: Session = Depends(get_db)) -> CapacitySettingsRead:
    return service.get_settings(db)


@router.put("/settings/{resource_key}", response_model=CapacityResourceRead,
            dependencies=[Depends(write_access)], operation_id="production_capacity_update")
def update_settings(resource_key: str, payload: CapacitySettingsUpdate, db: Session = Depends(get_db)) -> CapacityResourceRead:
    try:
        return service.save_settings(db, resource_key, payload)
    except CalendarError as error:
        raise HTTPException(error.status_code, str(error)) from error


@router.put("/settings/{resource_key}/exceptions/{day}", response_model=CapacityExceptionRead,
            dependencies=[Depends(write_access)], operation_id="production_capacity_exception_update")
@router.put("/resources/{resource_key}/exceptions/{day}", response_model=CapacityExceptionRead,
            dependencies=[Depends(write_access)], operation_id="capacity_resource_exception_update")
def update_exception(resource_key: str, day: date, payload: CapacityExceptionUpdate,
                     db: Session = Depends(get_db)) -> CapacityExceptionRead:
    try:
        return service.save_exception(db, resource_key, day, payload)
    except CalendarError as error:
        raise HTTPException(error.status_code, str(error)) from error


@router.delete("/settings/{resource_key}/exceptions/{day}", status_code=204,
               dependencies=[Depends(write_access)], operation_id="production_capacity_exception_delete")
@router.delete("/resources/{resource_key}/exceptions/{day}", status_code=204,
               dependencies=[Depends(write_access)], operation_id="capacity_resource_exception_delete")
def delete_exception(resource_key: str, day: date, db: Session = Depends(get_db)) -> Response:
    try:
        service.remove_exception(db, resource_key, day)
        return Response(status_code=204)
    except CalendarError as error:
        raise HTTPException(error.status_code, str(error)) from error


@router.post("/load-state", response_model=CapacityLoadRead, operation_id="production_capacity_load_state")
def read_load_state(payload: CapacityLoadRequest, db: Session = Depends(get_db)) -> CapacityLoadRead:
    try:
        return service.load_state(db, payload)
    except CalendarError as error:
        raise HTTPException(error.status_code, str(error)) from error
