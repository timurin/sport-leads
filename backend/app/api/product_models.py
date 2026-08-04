from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.product_model import ProductModelMedia, ProductModelSizeType, ProductModelStatus
from app.schemas.product_model import (
    AssemblyOperationLineCreate,
    AssemblyOperationLineReorder,
    AssemblyOperationLineUpdate,
    AssemblyVariantAddSewingOperations,
    AssemblyVariantApplySewingTemplate,
    AssemblyVariantCreate,
    AssemblyVariantRead,
    AssemblyVariantReorder,
    AssemblyVariantUpdate,
    ProductModelCoverUpload,
    ProductModelCreate,
    ProductModelFolderCreate,
    ProductModelFolderRead,
    ProductModelFolderUpdate,
    ProductModelHistoryRead,
    ProductModelImportResult,
    ProductModelMediaCreate,
    ProductModelMediaRead,
    ProductModelMediaUpdate,
    ProductModelOperationNormReplace,
    ProductModelRead,
    ProductModelRoutingLinkCreate,
    ProductModelRoutingLinkRead,
    ProductModelRoutingLinkReorder,
    ProductModelRoutingLinkUpdate,
    ProductModelSiblingMove,
    ProductModelUpdate,
    ProductModelVersionCreate,
    ProductModelVersionRead,
)
from app.repositories import assembly_variants as assembly_variants_repo
from app.services.assembly_variants import (
    AssemblyOperationLineNotFoundError,
    AssemblyVariantConflictError,
    AssemblyVariantNotFoundError,
    AssemblyVariantValidationError,
    add_operation_line,
    add_sewing_operations_to_variant,
    apply_sewing_operation_template_to_variant,
    copy_assembly_variant,
    create_assembly_variant,
    delete_assembly_variant,
    delete_operation_line,
    get_assembly_variant,
    list_assembly_variants,
    reorder_assembly_variants,
    reorder_operation_lines,
    update_assembly_variant,
    update_operation_line,
)
from app.services.product_model_routings import (
    ProductModelRoutingConflictError,
    ProductModelRoutingNotFoundError,
    ProductModelRoutingValidationError,
    create_routing_link,
    delete_routing_link,
    get_routing_link,
    list_routing_links,
    reorder_routing_links,
    replace_routing_link_norms,
    update_routing_link,
)
from app.services.product_model_folders import (
    ProductModelFolderConflictError,
    ProductModelFolderNotFoundError,
    ProductModelFolderValidationError,
    create_product_model_folder,
    delete_product_model_folder,
    get_product_model_folder_read,
    list_product_model_folders,
    move_product_model_folder_sibling,
    move_product_model_sibling,
    update_product_model_folder,
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
    revert_product_model_to_draft,
    set_product_model_media_primary,
    update_product_model,
    upload_product_model_cover,
)
from app.services.product_model_export import (
    ProductModelExportError,
    build_product_model_import_template,
    export_product_models_file,
)
from app.services.product_model_import import (
    ProductModelImportError,
    import_product_models_from_bytes,
)
from app.services.product_model_operations_journal import (
    product_model_has_journal_operations,
)
from app.models.product_model import ProductModel

router = APIRouter(prefix="/product-models", tags=["Product models"])
folders_router = APIRouter(prefix="/product-model-folders", tags=["Product models"])

_MAX_IMPORT_BYTES = 5 * 1024 * 1024


def _model_read(
    db: Session,
    row: ProductModel,
    *,
    assembly_cost_min: object | None = None,
    assembly_cost_max: object | None = None,
) -> ProductModelRead:
    product_type_name = None
    if row.product_type_id is not None:
        linked = row.product_type
        product_type_name = linked.name if linked is not None else None
    return ProductModelRead.model_validate(row).model_copy(
        update={
            "has_journal_operations": product_model_has_journal_operations(db, row.id),
            "product_type_name": product_type_name,
            "assembly_cost_min": assembly_cost_min,
            "assembly_cost_max": assembly_cost_max,
        }
    )


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
    product_type_id: int | None = None,
    folder_id: int | None = Query(default=None, ge=1),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[ProductModelRead]:
    rows = list_product_models(
        db,
        search=search,
        status=status_filter,
        size_type=size_type,
        product_type_id=product_type_id,
        folder_id=folder_id,
        limit=limit,
        offset=offset,
    )
    cost_ranges = assembly_variants_repo.assembly_cost_ranges_by_model_ids(
        db, [row.id for row in rows]
    )
    result: list[ProductModelRead] = []
    for row in rows:
        cost_range = cost_ranges.get(row.id)
        result.append(
            _model_read(
                db,
                row,
                assembly_cost_min=None if cost_range is None else cost_range[0],
                assembly_cost_max=None if cost_range is None else cost_range[1],
            )
        )
    return result


@router.get(
    "/export",
    operation_id="export_product_models",
    response_class=Response,
)
def export_product_models(
    file_format: str = Query(default="csv", alias="format", pattern="^(csv|xlsx)$"),
    search: str | None = Query(default=None, max_length=255),
    status_filter: ProductModelStatus | None = Query(default=None, alias="status"),
    size_type: ProductModelSizeType | None = None,
    product_type_id: int | None = None,
    db: Session = Depends(get_db),
) -> Response:
    """Filter-aware catalog export; columns match import template (`4.5.3`)."""
    try:
        payload, filename, media_type = export_product_models_file(
            db,
            file_format=file_format,  # type: ignore[arg-type]
            search=search,
            status=status_filter,
            size_type=size_type,
            product_type_id=product_type_id,
        )
    except (ProductModelExportError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return Response(
        content=payload,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/import-template",
    operation_id="download_product_model_import_template",
    response_class=Response,
)
def download_product_model_import_template(
    file_format: str = Query(default="csv", alias="format", pattern="^(csv|xlsx)$"),
) -> Response:
    try:
        payload, filename, media_type = build_product_model_import_template(
            file_format=file_format,  # type: ignore[arg-type]
        )
    except ProductModelExportError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return Response(
        content=payload,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post(
    "/import",
    response_model=ProductModelImportResult,
    operation_id="import_product_models",
)
async def import_product_models(
    file: UploadFile = File(...),
    dry_run: bool = Query(default=True),
    sheet_name: str | None = Query(default=None, max_length=120),
    db: Session = Depends(get_db),
) -> ProductModelImportResult:
    data = await file.read()
    if len(data) > _MAX_IMPORT_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Import file exceeds 5 MB limit",
        )
    try:
        return import_product_models_from_bytes(
            db,
            data,
            filename=file.filename,
            content_type=file.content_type,
            sheet_name=sheet_name,
            dry_run=dry_run,
        )
    except ProductModelImportError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error


@router.get("/{model_id}", response_model=ProductModelRead, operation_id="get_product_model")
def read_one_product_model(model_id: int, db: Session = Depends(get_db)):
    try:
        return _model_read(db, get_product_model(db, model_id))
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
        return _model_read(db, create_product_model(db, payload))
    except ProductModelArticleConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except ProductModelValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


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
        return _model_read(db, update_product_model(db, model_id, payload))
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ProductModelArticleConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except ProductModelValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post(
    "/{model_id}/move-sibling",
    response_model=ProductModelRead,
    operation_id="move_product_model_sibling",
)
def move_one_product_model_sibling(
    model_id: int,
    payload: ProductModelSiblingMove,
    db: Session = Depends(get_db),
):
    try:
        return _model_read(db, move_product_model_sibling(db, model_id, payload.direction))
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post(
    "/{model_id}/activate",
    response_model=ProductModelRead,
    operation_id="activate_product_model",
)
def activate_one_product_model(model_id: int, db: Session = Depends(get_db)):
    try:
        return _model_read(db, activate_product_model(db, model_id))
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
        return _model_read(db, archive_product_model(db, model_id))
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ProductModelValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post(
    "/{model_id}/draft",
    response_model=ProductModelRead,
    operation_id="revert_product_model_to_draft",
)
def draft_one_product_model(model_id: int, db: Session = Depends(get_db)):
    try:
        return _model_read(db, revert_product_model_to_draft(db, model_id))
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
        return _model_read(db, copy_product_model(db, model_id))
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
        return _model_read(db, upload_product_model_cover(db, model_id, payload))
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
        return _model_read(db, delete_product_model_cover(db, model_id))
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


@router.get(
    "/{model_id}/assembly-variants",
    response_model=list[AssemblyVariantRead],
    operation_id="list_product_model_assembly_variants",
)
def read_assembly_variants(
    model_id: int,
    active_only: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    try:
        return list_assembly_variants(db, model_id, active_only=active_only)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get(
    "/{model_id}/assembly-variants/{variant_id}",
    response_model=AssemblyVariantRead,
    operation_id="get_product_model_assembly_variant",
)
def read_one_assembly_variant(
    model_id: int,
    variant_id: int,
    db: Session = Depends(get_db),
):
    try:
        return get_assembly_variant(db, model_id, variant_id)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except AssemblyVariantNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post(
    "/{model_id}/assembly-variants",
    response_model=AssemblyVariantRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_product_model_assembly_variant",
)
def create_one_assembly_variant(
    model_id: int,
    payload: AssemblyVariantCreate,
    db: Session = Depends(get_db),
):
    try:
        return create_assembly_variant(db, model_id, payload)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except AssemblyVariantConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except AssemblyVariantValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.patch(
    "/{model_id}/assembly-variants/{variant_id}",
    response_model=AssemblyVariantRead,
    operation_id="update_product_model_assembly_variant",
)
def update_one_assembly_variant(
    model_id: int,
    variant_id: int,
    payload: AssemblyVariantUpdate,
    db: Session = Depends(get_db),
):
    try:
        return update_assembly_variant(db, model_id, variant_id, payload)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except AssemblyVariantNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except AssemblyVariantConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.delete(
    "/{model_id}/assembly-variants/{variant_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="delete_product_model_assembly_variant",
)
def remove_one_assembly_variant(
    model_id: int,
    variant_id: int,
    db: Session = Depends(get_db),
) -> None:
    try:
        delete_assembly_variant(db, model_id, variant_id)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except AssemblyVariantNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post(
    "/{model_id}/assembly-variants/{variant_id}/copy",
    response_model=AssemblyVariantRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="copy_product_model_assembly_variant",
)
def copy_one_assembly_variant(
    model_id: int,
    variant_id: int,
    db: Session = Depends(get_db),
):
    try:
        return copy_assembly_variant(db, model_id, variant_id)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except AssemblyVariantNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except AssemblyVariantConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.post(
    "/{model_id}/assembly-variants/reorder",
    response_model=list[AssemblyVariantRead],
    operation_id="reorder_product_model_assembly_variants",
)
def reorder_model_assembly_variants(
    model_id: int,
    payload: AssemblyVariantReorder,
    db: Session = Depends(get_db),
):
    try:
        return reorder_assembly_variants(db, model_id, payload)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except AssemblyVariantValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post(
    "/{model_id}/assembly-variants/{variant_id}/operation-lines",
    response_model=AssemblyVariantRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="add_assembly_variant_operation_line",
)
def create_operation_line(
    model_id: int,
    variant_id: int,
    payload: AssemblyOperationLineCreate,
    db: Session = Depends(get_db),
):
    try:
        return add_operation_line(db, model_id, variant_id, payload)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except AssemblyVariantNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except AssemblyVariantConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.post(
    "/{model_id}/assembly-variants/{variant_id}/sewing-operations",
    response_model=AssemblyVariantRead,
    operation_id="add_assembly_variant_sewing_operations",
)
def attach_sewing_operations(
    model_id: int,
    variant_id: int,
    payload: AssemblyVariantAddSewingOperations,
    db: Session = Depends(get_db),
):
    try:
        return add_sewing_operations_to_variant(db, model_id, variant_id, payload)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except AssemblyVariantNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except AssemblyVariantValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except AssemblyVariantConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.post(
    "/{model_id}/assembly-variants/{variant_id}/apply-sewing-template",
    response_model=AssemblyVariantRead,
    operation_id="apply_sewing_operation_template_to_assembly_variant",
)
def apply_sewing_template(
    model_id: int,
    variant_id: int,
    payload: AssemblyVariantApplySewingTemplate,
    db: Session = Depends(get_db),
):
    try:
        return apply_sewing_operation_template_to_variant(
            db,
            model_id,
            variant_id,
            template_id=payload.template_id,
            mode=payload.mode,
        )
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except AssemblyVariantNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except AssemblyVariantValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except AssemblyVariantConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.patch(
    "/{model_id}/assembly-variants/{variant_id}/operation-lines/{line_id}",
    response_model=AssemblyVariantRead,
    operation_id="update_assembly_variant_operation_line",
)
def patch_operation_line(
    model_id: int,
    variant_id: int,
    line_id: int,
    payload: AssemblyOperationLineUpdate,
    db: Session = Depends(get_db),
):
    try:
        return update_operation_line(db, model_id, variant_id, line_id, payload)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except AssemblyVariantNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except AssemblyOperationLineNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except AssemblyVariantConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.delete(
    "/{model_id}/assembly-variants/{variant_id}/operation-lines/{line_id}",
    response_model=AssemblyVariantRead,
    operation_id="delete_assembly_variant_operation_line",
)
def remove_operation_line(
    model_id: int,
    variant_id: int,
    line_id: int,
    db: Session = Depends(get_db),
):
    try:
        return delete_operation_line(db, model_id, variant_id, line_id)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except AssemblyVariantNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except AssemblyOperationLineNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post(
    "/{model_id}/assembly-variants/{variant_id}/operation-lines/reorder",
    response_model=AssemblyVariantRead,
    operation_id="reorder_assembly_variant_operation_lines",
)
def reorder_variant_operation_lines(
    model_id: int,
    variant_id: int,
    payload: AssemblyOperationLineReorder,
    db: Session = Depends(get_db),
):
    try:
        return reorder_operation_lines(db, model_id, variant_id, payload)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except AssemblyVariantNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except AssemblyVariantValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get(
    "/{model_id}/routings",
    response_model=list[ProductModelRoutingLinkRead],
    operation_id="list_product_model_routings",
)
def read_routing_links(
    model_id: int,
    active_only: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    try:
        return list_routing_links(db, model_id, active_only=active_only)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get(
    "/{model_id}/routings/{link_id}",
    response_model=ProductModelRoutingLinkRead,
    operation_id="get_product_model_routing",
)
def read_one_routing_link(
    model_id: int,
    link_id: int,
    db: Session = Depends(get_db),
):
    try:
        return get_routing_link(db, model_id, link_id)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ProductModelRoutingNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post(
    "/{model_id}/routings",
    response_model=ProductModelRoutingLinkRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_product_model_routing",
)
def create_one_routing_link(
    model_id: int,
    payload: ProductModelRoutingLinkCreate,
    db: Session = Depends(get_db),
):
    try:
        return create_routing_link(db, model_id, payload)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ProductModelRoutingConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except ProductModelRoutingValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.patch(
    "/{model_id}/routings/{link_id}",
    response_model=ProductModelRoutingLinkRead,
    operation_id="update_product_model_routing",
)
def update_one_routing_link(
    model_id: int,
    link_id: int,
    payload: ProductModelRoutingLinkUpdate,
    db: Session = Depends(get_db),
):
    try:
        return update_routing_link(db, model_id, link_id, payload)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ProductModelRoutingNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.delete(
    "/{model_id}/routings/{link_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="delete_product_model_routing",
)
def remove_one_routing_link(
    model_id: int,
    link_id: int,
    db: Session = Depends(get_db),
) -> None:
    try:
        delete_routing_link(db, model_id, link_id)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ProductModelRoutingNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post(
    "/{model_id}/routings/reorder",
    response_model=list[ProductModelRoutingLinkRead],
    operation_id="reorder_product_model_routings",
)
def reorder_model_routing_links(
    model_id: int,
    payload: ProductModelRoutingLinkReorder,
    db: Session = Depends(get_db),
):
    try:
        return reorder_routing_links(db, model_id, payload)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ProductModelRoutingValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.put(
    "/{model_id}/routings/{link_id}/norms",
    response_model=ProductModelRoutingLinkRead,
    operation_id="replace_product_model_routing_norms",
)
def replace_one_routing_link_norms(
    model_id: int,
    link_id: int,
    payload: ProductModelOperationNormReplace,
    db: Session = Depends(get_db),
):
    try:
        return replace_routing_link_norms(db, model_id, link_id, payload)
    except ProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ProductModelRoutingNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ProductModelRoutingConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except ProductModelRoutingValidationError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@folders_router.get(
    "",
    response_model=list[ProductModelFolderRead],
    operation_id="list_product_model_folders",
)
def read_product_model_folders(db: Session = Depends(get_db)) -> list:
    return list_product_model_folders(db)


@folders_router.post(
    "",
    response_model=ProductModelFolderRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="create_product_model_folder",
)
def create_product_model_folder_endpoint(
    payload: ProductModelFolderCreate,
    db: Session = Depends(get_db),
) -> ProductModelFolderRead:
    try:
        return create_product_model_folder(db, payload)
    except ProductModelFolderConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except ProductModelFolderValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error
    except ProductModelFolderNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@folders_router.get(
    "/{folder_id}",
    response_model=ProductModelFolderRead,
    operation_id="get_product_model_folder",
)
def read_product_model_folder(
    folder_id: int,
    db: Session = Depends(get_db),
) -> ProductModelFolderRead:
    try:
        return get_product_model_folder_read(db, folder_id)
    except ProductModelFolderNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@folders_router.patch(
    "/{folder_id}",
    response_model=ProductModelFolderRead,
    operation_id="update_product_model_folder",
)
def patch_product_model_folder(
    folder_id: int,
    payload: ProductModelFolderUpdate,
    db: Session = Depends(get_db),
) -> ProductModelFolderRead:
    try:
        return update_product_model_folder(db, folder_id, payload)
    except ProductModelFolderNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ProductModelFolderConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except ProductModelFolderValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error


@folders_router.post(
    "/{folder_id}/move-sibling",
    response_model=ProductModelFolderRead,
    operation_id="move_product_model_folder_sibling",
)
def move_product_model_folder_sibling_endpoint(
    folder_id: int,
    payload: ProductModelSiblingMove,
    db: Session = Depends(get_db),
) -> ProductModelFolderRead:
    try:
        return move_product_model_folder_sibling(db, folder_id, payload.direction)
    except ProductModelFolderNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@folders_router.delete(
    "/{folder_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="delete_product_model_folder",
)
def remove_product_model_folder(
    folder_id: int,
    db: Session = Depends(get_db),
) -> None:
    try:
        delete_product_model_folder(db, folder_id)
    except ProductModelFolderNotFoundError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ProductModelFolderValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error
