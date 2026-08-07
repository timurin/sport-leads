from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.nomenclature import (
    NomenclatureCategoryCreate,
    NomenclatureCategoryRead,
    NomenclatureCategoryUpdate,
    NomenclatureCreate,
    NomenclatureHistoryRead,
    NomenclatureImportResult,
    NomenclatureListExtrasRead,
    NomenclatureRead,
    NomenclatureUpdate,
    UnitOfMeasureCreate,
    UnitOfMeasureRead,
    UnitOfMeasureUpdate,
)
from app.schemas.product_model import (
    NomenclatureProductModelCreate,
    NomenclatureProductModelRead,
    NomenclatureProductModelReorder,
)
from app.services.nomenclature import (
    NomenclatureConflictError,
    NomenclatureCategoryConflictError,
    NomenclatureCategoryNotFoundError,
    NomenclatureCategoryRuleError,
    NomenclatureNotFoundError,
    NomenclatureRuleError,
    copy_nomenclature,
    create_category,
    create_nomenclature,
    get_category,
    get_nomenclature,
    get_nomenclature_history,
    list_categories,
    list_nomenclature,
    to_nomenclature_read,
    update_category,
    update_nomenclature,
    create_unit,
    get_unit,
    list_units,
    update_unit,
    UnitOfMeasureConflictError,
    UnitOfMeasureNotFoundError,
    UnitOfMeasureRuleError,
)
from app.services.nomenclature_import import (
    NomenclatureImportError,
    import_nomenclatures_from_bytes,
)
from app.services.nomenclature_export import (
    NomenclatureExportError,
    build_nomenclature_import_template,
    export_nomenclatures_file,
)
from app.services.nomenclature_product_models import (
    NomenclatureProductModelConflictError,
    NomenclatureProductModelNotFoundError,
    NomenclatureProductModelRuleError,
    add_available_product_model,
    list_available_product_models,
    remove_available_product_model,
    reorder_available_product_models,
)


router = APIRouter(prefix="/nomenclatures", tags=["Nomenclature"])

_MAX_IMPORT_BYTES = 5 * 1024 * 1024


@router.get("/units-of-measure", response_model=list[UnitOfMeasureRead])
def read_units(search: str | None = Query(default=None, max_length=255), unit_category: str | None = None, is_active: bool | None = None, db: Session = Depends(get_db)) -> list:
    return list_units(db, search, unit_category, is_active)


@router.get("/units-of-measure/{unit_id}", response_model=UnitOfMeasureRead)
def read_one_unit(unit_id: int, db: Session = Depends(get_db)):
    try:
        return get_unit(db, unit_id)
    except UnitOfMeasureNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post("/units-of-measure", response_model=UnitOfMeasureRead, status_code=status.HTTP_201_CREATED)
def create_one_unit(payload: UnitOfMeasureCreate, db: Session = Depends(get_db)):
    try:
        return create_unit(db, payload)
    except UnitOfMeasureConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.patch("/units-of-measure/{unit_id}", response_model=UnitOfMeasureRead)
def update_one_unit(unit_id: int, payload: UnitOfMeasureUpdate, db: Session = Depends(get_db)):
    try:
        return update_unit(db, unit_id, payload)
    except UnitOfMeasureNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except UnitOfMeasureRuleError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except UnitOfMeasureConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.get("/categories", response_model=list[NomenclatureCategoryRead])
def read_categories(is_active: bool | None = None, db: Session = Depends(get_db)) -> list:
    return list_categories(db, is_active)


@router.get("/categories/{category_id}", response_model=NomenclatureCategoryRead)
def read_one_category(category_id: int, db: Session = Depends(get_db)):
    try:
        return get_category(db, category_id)
    except NomenclatureCategoryNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post("/categories", response_model=NomenclatureCategoryRead, status_code=status.HTTP_201_CREATED)
def create_one_category(payload: NomenclatureCategoryCreate, db: Session = Depends(get_db)):
    try:
        return create_category(db, payload)
    except NomenclatureCategoryNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except NomenclatureCategoryRuleError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except NomenclatureCategoryConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.patch("/categories/{category_id}", response_model=NomenclatureCategoryRead)
def update_one_category(category_id: int, payload: NomenclatureCategoryUpdate, db: Session = Depends(get_db)):
    try:
        return update_category(db, category_id, payload)
    except NomenclatureCategoryNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except NomenclatureCategoryRuleError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except NomenclatureCategoryConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.get("", response_model=list[NomenclatureRead])
def read_nomenclature(
    search: str | None = Query(default=None, max_length=255),
    is_active: bool | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[NomenclatureRead]:
    return [to_nomenclature_read(row) for row in list_nomenclature(db, search, is_active, limit, offset)]


@router.get(
    "/export",
    operation_id="export_nomenclatures",
    response_class=Response,
)
def export_nomenclatures(
    file_format: str = Query(default="csv", alias="format", pattern="^(csv|xlsx)$"),
    search: str | None = Query(default=None, max_length=255),
    is_active: bool | None = Query(
        default=None,
        description="Omit for all; true/false to filter active flag",
    ),
    nomenclature_type: str | None = Query(default=None, max_length=20),
    db: Session = Depends(get_db),
) -> Response:
    """Filter-aware catalog export; columns match import template (`4.5.2`)."""
    try:
        payload, filename, media_type = export_nomenclatures_file(
            db,
            file_format=file_format,  # type: ignore[arg-type]
            search=search,
            is_active=is_active,
            nomenclature_type=nomenclature_type,
        )
    except NomenclatureExportError as error:
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
    operation_id="download_nomenclature_import_template",
    response_class=Response,
)
def download_nomenclature_import_template(
    file_format: str = Query(default="csv", alias="format", pattern="^(csv|xlsx)$"),
) -> Response:
    """Import template with the same columns as export (+ sample rows)."""
    try:
        payload, filename, media_type = build_nomenclature_import_template(
            file_format=file_format,  # type: ignore[arg-type]
        )
    except NomenclatureExportError as error:
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
    response_model=NomenclatureImportResult,
    operation_id="import_nomenclatures",
)
async def import_nomenclatures(
    file: UploadFile = File(...),
    dry_run: bool = Query(
        default=True,
        description="When true, validate only; when false, commit if can_commit",
    ),
    sheet_name: str | None = Query(default=None, max_length=120),
    db: Session = Depends(get_db),
) -> NomenclatureImportResult:
    """Import nomenclature master rows from CSV/XLSX (ADR-020 catalog I/O)."""
    data = await file.read()
    if len(data) > _MAX_IMPORT_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Import file exceeds 5 MB limit",
        )
    try:
        return import_nomenclatures_from_bytes(
            db,
            data,
            filename=file.filename,
            content_type=file.content_type,
            sheet_name=sheet_name,
            dry_run=dry_run,
        )
    except NomenclatureImportError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error


@router.get(
    "/list-extras",
    response_model=NomenclatureListExtrasRead,
    operation_id="get_nomenclature_list_extras",
)
def read_nomenclature_list_extras(
    nomenclature_id: list[int] | None = Query(
        default=None,
        description="Nomenclature ids to enrich (covers + characteristic values)",
    ),
    db: Session = Depends(get_db),
) -> NomenclatureListExtrasRead:
    """Batch covers + values for list pages — kills FE 2N HTTP (`0.2.3.2`)."""
    from app.schemas.characteristics import NomenclatureCharacteristicValueRead
    from app.services.characteristics import get_nomenclature_values, value_read_payload
    from app.services.media import primary_cover_urls_by_nomenclature_ids

    ids = list(dict.fromkeys(nomenclature_id or []))
    covers_raw = primary_cover_urls_by_nomenclature_ids(db, ids)
    covers = {str(key): value for key, value in covers_raw.items()}
    values: dict[str, list[NomenclatureCharacteristicValueRead]] = {}
    for item_id in ids:
        try:
            rows = get_nomenclature_values(db, item_id)
        except Exception:
            values[str(item_id)] = []
            continue
        values[str(item_id)] = [
            NomenclatureCharacteristicValueRead.model_validate(
                value_read_payload(assignment, definition, row, source_id, inherited)
            )
            for assignment, definition, row, source_id, inherited in rows
        ]
    return NomenclatureListExtrasRead(covers=covers, values=values)


@router.get("/{nomenclature_id}", response_model=NomenclatureRead)
def read_one_nomenclature(nomenclature_id: int, db: Session = Depends(get_db)) -> NomenclatureRead:
    try:
        return to_nomenclature_read(get_nomenclature(db, nomenclature_id))
    except NomenclatureNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get(
    "/{nomenclature_id}/history",
    response_model=list[NomenclatureHistoryRead],
    operation_id="list_nomenclature_history",
)
def read_nomenclature_history(
    nomenclature_id: int, db: Session = Depends(get_db)
) -> list[NomenclatureHistoryRead]:
    try:
        return get_nomenclature_history(db, nomenclature_id)
    except NomenclatureNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post("", response_model=NomenclatureRead, status_code=status.HTTP_201_CREATED)
def create_one_nomenclature(payload: NomenclatureCreate, db: Session = Depends(get_db)) -> NomenclatureRead:
    try:
        return to_nomenclature_read(create_nomenclature(db, payload))
    except NomenclatureConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except (
        NomenclatureCategoryNotFoundError,
        NomenclatureCategoryRuleError,
        NomenclatureRuleError,
        UnitOfMeasureNotFoundError,
        UnitOfMeasureRuleError,
    ) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post(
    "/{nomenclature_id}/copy",
    response_model=NomenclatureRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="copy_nomenclature",
)
def copy_one_nomenclature(nomenclature_id: int, db: Session = Depends(get_db)) -> NomenclatureRead:
    try:
        return to_nomenclature_read(copy_nomenclature(db, nomenclature_id))
    except NomenclatureNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except NomenclatureConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except (
        NomenclatureCategoryNotFoundError,
        NomenclatureCategoryRuleError,
        NomenclatureRuleError,
        UnitOfMeasureNotFoundError,
        UnitOfMeasureRuleError,
    ) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.patch("/{nomenclature_id}", response_model=NomenclatureRead)
def update_one_nomenclature(nomenclature_id: int, payload: NomenclatureUpdate, db: Session = Depends(get_db)) -> NomenclatureRead:
    try:
        return to_nomenclature_read(update_nomenclature(db, nomenclature_id, payload))
    except NomenclatureNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except NomenclatureConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except (
        NomenclatureCategoryNotFoundError,
        NomenclatureCategoryRuleError,
        NomenclatureRuleError,
        UnitOfMeasureNotFoundError,
        UnitOfMeasureRuleError,
    ) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get(
    "/{nomenclature_id}/available-models",
    response_model=list[NomenclatureProductModelRead],
    operation_id="list_nomenclature_available_models",
)
def read_available_models(nomenclature_id: int, db: Session = Depends(get_db)):
    try:
        return list_available_product_models(db, nomenclature_id)
    except NomenclatureNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except NomenclatureProductModelRuleError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post(
    "/{nomenclature_id}/available-models",
    response_model=NomenclatureProductModelRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="add_nomenclature_available_model",
)
def create_available_model(
    nomenclature_id: int,
    payload: NomenclatureProductModelCreate,
    db: Session = Depends(get_db),
):
    try:
        return add_available_product_model(db, nomenclature_id, payload)
    except NomenclatureNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except NomenclatureProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except NomenclatureProductModelConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except NomenclatureProductModelRuleError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.put(
    "/{nomenclature_id}/available-models/order",
    response_model=list[NomenclatureProductModelRead],
    operation_id="reorder_nomenclature_available_models",
)
def reorder_available_models(
    nomenclature_id: int,
    payload: NomenclatureProductModelReorder,
    db: Session = Depends(get_db),
):
    try:
        return reorder_available_product_models(db, nomenclature_id, payload)
    except NomenclatureNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except NomenclatureProductModelRuleError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.delete(
    "/{nomenclature_id}/available-models/{product_model_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="remove_nomenclature_available_model",
)
def delete_available_model(
    nomenclature_id: int,
    product_model_id: int,
    db: Session = Depends(get_db),
):
    try:
        remove_available_product_model(db, nomenclature_id, product_model_id)
    except NomenclatureNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except NomenclatureProductModelNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except NomenclatureProductModelRuleError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
