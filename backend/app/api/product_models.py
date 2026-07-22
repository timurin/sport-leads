from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.product_model import ProductModelMedia, ProductModelSizeType, ProductModelStatus
from app.schemas.product_model import (
    ProductModelCoverUpload,
    ProductModelCreate,
    ProductModelHistoryRead,
    ProductModelMediaCreate,
    ProductModelMediaRead,
    ProductModelMediaUpdate,
    ProductModelRead,
    ProductModelUpdate,
    ProductModelVersionCreate,
    ProductModelVersionRead,
)
from app.services.product_models import (
    ProductModelArticleConflictError,
    ProductModelNotFoundError,
    ProductModelValidationError,
    ProductModelVersionNotFoundError,
    activate_product_model,
    add_product_model_media,
    archive_product_model,
    archive_product_model_version,
    copy_product_model,
    create_product_model,
    create_product_model_version,
    delete_product_model_cover,
    delete_product_model_media,
    get_product_model,
    get_product_model_media,
    get_product_model_version,
    list_product_model_history,
    list_product_model_media,
    list_product_model_versions,
    list_product_models,
    media_content_url,
    product_model_cover_path,
    product_model_media_path,
    publish_product_model_version,
    set_product_model_media_primary,
    update_product_model,
    upload_product_model_cover,
)

router = APIRouter(prefix="/product-models", tags=["Product models"])


def _media_read(item: ProductModelMedia) -> ProductModelMediaRead:
    return ProductModelMediaRead(
        id=item.id,
        product_model_id=item.product_model_id,
        filename=item.filename,
        mime_type=item.mime_type,
        file_size=item.file_size,
        sort_order=item.sort_order,
        is_primary=item.is_primary,
        created_at=item.created_at,
        updated_at=item.updated_at,
        content_url=media_content_url(item.product_model_id, item.id),
    )


@router.get("", response_model=list[ProductModelRead], operation_id="list_product_models")
def read_product_models(
    search: str | None = Query(default=None, max_length=255),
    status_filter: ProductModelStatus | None = Query(default=None, alias="status"),
    size_type: ProductModelSizeType | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list:
    return list_product_models(
        db,
        search=search,
        status=status_filter,
        size_type=size_type,
        limit=limit,
        offset=offset,
    )


@router.get("/{model_id}", response_model=ProductModelRead, operation_id="get_product_model")
def read_one_product_model(model_id: int, db: Session = Depends(get_db)):
    try:
        return get_product_model(db, model_id)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post(
    "",
    response_model=ProductModelRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_product_model",
)
def create_one_product_model(payload: ProductModelCreate, db: Session = Depends(get_db)):
    try:
        return create_product_model(db, payload)
    except ProductModelArticleConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.patch(
    "/{model_id}",
    response_model=ProductModelRead,
    operation_id="update_product_model",
)
def update_one_product_model(
    model_id: int,
    payload: ProductModelUpdate,
    db: Session = Depends(get_db),
):
    try:
        return update_product_model(db, model_id, payload)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ProductModelArticleConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except ProductModelValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post(
    "/{model_id}/activate",
    response_model=ProductModelRead,
    operation_id="activate_product_model",
)
def activate_one_product_model(model_id: int, db: Session = Depends(get_db)):
    try:
        return activate_product_model(db, model_id)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ProductModelValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post(
    "/{model_id}/archive",
    response_model=ProductModelRead,
    operation_id="archive_product_model",
)
def archive_one_product_model(model_id: int, db: Session = Depends(get_db)):
    try:
        return archive_product_model(db, model_id)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ProductModelValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post(
    "/{model_id}/copy",
    response_model=ProductModelRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="copy_product_model",
)
def copy_one_product_model(model_id: int, db: Session = Depends(get_db)):
    try:
        return copy_product_model(db, model_id)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ProductModelArticleConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.post(
    "/{model_id}/cover",
    response_model=ProductModelRead,
    operation_id="upload_product_model_cover",
)
def upload_one_product_model_cover(
    model_id: int,
    payload: ProductModelCoverUpload,
    db: Session = Depends(get_db),
):
    try:
        return upload_product_model_cover(db, model_id, payload)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ProductModelValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.delete(
    "/{model_id}/cover",
    response_model=ProductModelRead,
    operation_id="delete_product_model_cover",
)
def delete_one_product_model_cover(model_id: int, db: Session = Depends(get_db)):
    try:
        return delete_product_model_cover(db, model_id)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ProductModelValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get(
    "/{model_id}/cover/content",
    operation_id="get_product_model_cover_content",
)
def read_product_model_cover_content(model_id: int, db: Session = Depends(get_db)):
    try:
        path, mime_type = product_model_cover_path(db, model_id)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return FileResponse(path, media_type=mime_type)


@router.get(
    "/{model_id}/media",
    response_model=list[ProductModelMediaRead],
    operation_id="list_product_model_media",
)
def read_product_model_media(model_id: int, db: Session = Depends(get_db)):
    try:
        return [_media_read(item) for item in list_product_model_media(db, model_id)]
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post(
    "/{model_id}/media",
    response_model=ProductModelMediaRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="add_product_model_media",
)
def create_product_model_media_item(
    model_id: int,
    payload: ProductModelMediaCreate,
    db: Session = Depends(get_db),
):
    try:
        return _media_read(add_product_model_media(db, model_id, payload))
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ProductModelValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.patch(
    "/{model_id}/media/{media_id}",
    response_model=ProductModelMediaRead,
    operation_id="update_product_model_media",
)
def patch_product_model_media_item(
    model_id: int,
    media_id: int,
    payload: ProductModelMediaUpdate,
    db: Session = Depends(get_db),
):
    try:
        if payload.is_primary is True:
            item = set_product_model_media_primary(db, model_id, media_id)
        else:
            item = get_product_model_media(db, model_id, media_id)
        return _media_read(item)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ProductModelValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.delete(
    "/{model_id}/media/{media_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="delete_product_model_media",
)
def remove_product_model_media_item(
    model_id: int,
    media_id: int,
    db: Session = Depends(get_db),
) -> None:
    try:
        delete_product_model_media(db, model_id, media_id)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ProductModelValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get(
    "/{model_id}/media/{media_id}/content",
    operation_id="get_product_model_media_content",
)
def read_product_model_media_content(
    model_id: int,
    media_id: int,
    db: Session = Depends(get_db),
):
    try:
        path, mime_type = product_model_media_path(db, model_id, media_id)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return FileResponse(path, media_type=mime_type)


@router.get(
    "/{model_id}/history",
    response_model=list[ProductModelHistoryRead],
    operation_id="list_product_model_history",
)
def read_product_model_history(model_id: int, db: Session = Depends(get_db)):
    try:
        return list_product_model_history(db, model_id)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get(
    "/{model_id}/versions",
    response_model=list[ProductModelVersionRead],
    operation_id="list_product_model_versions",
)
def read_product_model_versions(model_id: int, db: Session = Depends(get_db)):
    try:
        return list_product_model_versions(db, model_id)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get(
    "/{model_id}/versions/{version_id}",
    response_model=ProductModelVersionRead,
    operation_id="get_product_model_version",
)
def read_one_product_model_version(model_id: int, version_id: int, db: Session = Depends(get_db)):
    try:
        return get_product_model_version(db, model_id, version_id)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ProductModelVersionNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post(
    "/{model_id}/versions",
    response_model=ProductModelVersionRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_product_model_version",
)
def create_one_product_model_version(
    model_id: int,
    payload: ProductModelVersionCreate,
    db: Session = Depends(get_db),
):
    try:
        return create_product_model_version(db, model_id, payload)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ProductModelVersionNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post(
    "/{model_id}/versions/{version_id}/publish",
    response_model=ProductModelVersionRead,
    operation_id="publish_product_model_version",
)
def publish_one_product_model_version(
    model_id: int,
    version_id: int,
    db: Session = Depends(get_db),
):
    try:
        return publish_product_model_version(db, model_id, version_id)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ProductModelVersionNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ProductModelValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post(
    "/{model_id}/versions/{version_id}/archive",
    response_model=ProductModelVersionRead,
    operation_id="archive_product_model_version",
)
def archive_one_product_model_version(
    model_id: int,
    version_id: int,
    db: Session = Depends(get_db),
):
    try:
        return archive_product_model_version(db, model_id, version_id)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ProductModelVersionNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
