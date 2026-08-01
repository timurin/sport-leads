from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.shop_routing import (
    ShopRoutingTemplateCreate,
    ShopRoutingTemplateRead,
    ShopRoutingTemplateUpdate,
    WorkCenterCreate,
    WorkCenterRead,
    WorkCenterUpdate,
)
from app.services.shop_routings import (
    ShopRoutingConflictError,
    ShopRoutingNotFoundError,
    ShopRoutingValidationError,
    WorkCenterConflictError,
    WorkCenterNotFoundError,
    WorkCenterValidationError,
    create_routing_template,
    create_work_center,
    delete_routing_template,
    delete_work_center,
    get_routing_template,
    get_work_center,
    list_routing_templates,
    list_work_centers,
    update_routing_template,
    update_work_center,
)

work_centers_router = APIRouter(prefix="/work-centers", tags=["Work centers"])
routings_router = APIRouter(prefix="/shop-routings", tags=["Shop routings"])


@work_centers_router.get(
    "",
    response_model=list[WorkCenterRead],
    operation_id="list_work_centers",
)
def read_work_centers(
    search: str | None = Query(default=None, max_length=255),
    active_only: bool = Query(default=False),
    production_stage_id: int | None = Query(default=None, ge=1),
    production_stage_code: str | None = Query(default=None, max_length=64),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list:
    return list_work_centers(
        db,
        search=search,
        active_only=active_only,
        production_stage_id=production_stage_id,
        production_stage_code=production_stage_code,
        limit=limit,
        offset=offset,
    )


@work_centers_router.post(
    "",
    response_model=WorkCenterRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_work_center",
)
def create_work_center_endpoint(
    payload: WorkCenterCreate,
    db: Session = Depends(get_db),
) -> WorkCenterRead:
    try:
        return create_work_center(db, payload)
    except WorkCenterConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@work_centers_router.get(
    "/{work_center_id}",
    response_model=WorkCenterRead,
    operation_id="get_work_center",
)
def read_work_center(
    work_center_id: int,
    db: Session = Depends(get_db),
) -> WorkCenterRead:
    try:
        return get_work_center(db, work_center_id)
    except WorkCenterNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@work_centers_router.patch(
    "/{work_center_id}",
    response_model=WorkCenterRead,
    operation_id="update_work_center",
)
def patch_work_center(
    work_center_id: int,
    payload: WorkCenterUpdate,
    db: Session = Depends(get_db),
) -> WorkCenterRead:
    try:
        return update_work_center(db, work_center_id, payload)
    except WorkCenterNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except WorkCenterConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except WorkCenterValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error


@work_centers_router.delete(
    "/{work_center_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="delete_work_center",
)
def remove_work_center(
    work_center_id: int,
    db: Session = Depends(get_db),
) -> None:
    try:
        delete_work_center(db, work_center_id)
    except WorkCenterNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@routings_router.get(
    "",
    response_model=list[ShopRoutingTemplateRead],
    operation_id="list_shop_routings",
)
def read_shop_routings(
    search: str | None = Query(default=None, max_length=255),
    active_only: bool = Query(default=False),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list:
    return list_routing_templates(
        db, search=search, active_only=active_only, limit=limit, offset=offset
    )


@routings_router.post(
    "",
    response_model=ShopRoutingTemplateRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_shop_routing",
)
def create_shop_routing_endpoint(
    payload: ShopRoutingTemplateCreate,
    db: Session = Depends(get_db),
) -> ShopRoutingTemplateRead:
    try:
        return create_routing_template(db, payload)
    except ShopRoutingConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except ShopRoutingValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error


@routings_router.get(
    "/{template_id}",
    response_model=ShopRoutingTemplateRead,
    operation_id="get_shop_routing",
)
def read_shop_routing(
    template_id: int,
    db: Session = Depends(get_db),
) -> ShopRoutingTemplateRead:
    try:
        return get_routing_template(db, template_id)
    except ShopRoutingNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@routings_router.patch(
    "/{template_id}",
    response_model=ShopRoutingTemplateRead,
    operation_id="update_shop_routing",
)
def patch_shop_routing(
    template_id: int,
    payload: ShopRoutingTemplateUpdate,
    db: Session = Depends(get_db),
) -> ShopRoutingTemplateRead:
    try:
        return update_routing_template(db, template_id, payload)
    except ShopRoutingNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ShopRoutingConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except ShopRoutingValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error


@routings_router.delete(
    "/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="delete_shop_routing",
)
def remove_shop_routing(
    template_id: int,
    db: Session = Depends(get_db),
) -> None:
    try:
        delete_routing_template(db, template_id)
    except ShopRoutingNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
