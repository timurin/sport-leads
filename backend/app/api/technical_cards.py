"""Technical cards API (Stage 9.2.1 generate + Stage 9.2.2 stage machine)."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.technical_card import TechnicalCard
from app.schemas.technical_card import (
    OrderManufacturingCompletenessRead,
    TechnicalCardApplyRoutingRequest,
    TechnicalCardApplySpecification,
    TechnicalCardCompositionFactQtyUpdate,
    TechnicalCardCompositionReplace,
    TechnicalCardGenerateRead,
    TechnicalCardGenerateRequest,
    TechnicalCardListRead,
    TechnicalCardMediaCreate,
    TechnicalCardMediaRead,
    TechnicalCardMediaUpdate,
    TechnicalCardOperationLineRead,
    TechnicalCardOperationLinesPrefillRead,
    TechnicalCardOperationLinesReplace,
    TechnicalCardOperationLineVolumeUpdate,
    TechnicalCardPreviewRead,
    TechnicalCardRead,
    TechnicalCardStageCompleteRequest,
    TechnicalCardStageFactRequest,
    TechnicalCardPlannedWorkCenterRequest,
    TechnicalCardStageStartRequest,
    TechnicalCardUnitLineRead,
    TechnicalCardUnitLinesBulkUpdate,
    TechnicalCardUnitLinesImport,
    TechnicalCardUnitLinesReplace,
    TechnicalCardUnitLineUpdate,
    TechnicalCardSettingsRead,
    TechnicalCardSettingsUpdate,
)
from app.services.order_manufacturing_completeness import (
    OrderManufacturingNotFoundError,
    compute_order_manufacturing_completeness,
)
from app.services.technical_card_settings import (
    get_technical_card_settings,
    update_technical_card_settings,
)
from app.services.technical_card_stages import (
    assign_planned_work_center,
    complete_stage,
    rollback_stage,
    rollback_stage_for_shop_kanban,
    start_stage,
    start_technical_card,
    update_stage_fact,
)
from app.services.technical_cards import (
    TechnicalCardConflictError,
    TechnicalCardNotFoundError,
    TechnicalCardValidationError,
    add_technical_card_media,
    apply_routing_template,
    apply_specification_version,
    bulk_update_unit_lines,
    cancel_draft_technical_card,
    delete_technical_card_media,
    generate_technical_cards,
    get_technical_card,
    get_technical_card_media,
    import_unit_lines,
    list_operation_lines,
    list_technical_card_media,
    list_technical_cards,
    list_technical_cards_for_order,
    list_unit_lines,
    prefill_operation_lines_from_catalog,
    preview_technical_cards,
    refresh_model_and_pattern_composition,
    replace_composition_lines,
    replace_operation_lines,
    replace_unit_lines,
    reset_unit_lines_from_order_defaults,
    delete_composition_line,
    set_composition_line_fact_qty,
    set_technical_card_media_primary,
    sync_technical_card_unit_lines,
    tech_card_media_content_url,
    technical_card_media_path,
    to_technical_card_read,
    update_operation_line_volume,
    update_unit_line,
)

router = APIRouter(tags=["Technical cards"])


def _http_error(error: Exception) -> HTTPException:
    if isinstance(error, (TechnicalCardNotFoundError, OrderManufacturingNotFoundError)):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error))
    if isinstance(error, TechnicalCardConflictError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error))
    if isinstance(error, TechnicalCardValidationError):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        )
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error))


def _card_read(db: Session, card: TechnicalCard) -> TechnicalCardRead:
    return to_technical_card_read(db, card)


def _media_read(item) -> TechnicalCardMediaRead:
    return TechnicalCardMediaRead(
        id=item.id,
        technical_card_id=item.technical_card_id,
        filename=item.filename,
        mime_type=item.mime_type,
        file_size=item.file_size,
        sort_order=item.sort_order,
        is_primary=item.is_primary,
        content_url=tech_card_media_content_url(item.technical_card_id, item.id),
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get(
    "/technical-card-settings",
    response_model=TechnicalCardSettingsRead,
    operation_id="get_technical_card_settings",
)
def read_technical_card_settings(db: Session = Depends(get_db)) -> TechnicalCardSettingsRead:
    return get_technical_card_settings(db)


@router.put(
    "/technical-card-settings",
    response_model=TechnicalCardSettingsRead,
    operation_id="update_technical_card_settings",
)
def update_technical_card_settings_endpoint(
    payload: TechnicalCardSettingsUpdate,
    db: Session = Depends(get_db),
) -> TechnicalCardSettingsRead:
    return update_technical_card_settings(db, payload)


@router.get(
    "/orders/{order_id}/technical-cards",
    response_model=list[TechnicalCardRead],
    operation_id="list_order_technical_cards",
)
def list_order_technical_cards(
    order_id: int, db: Session = Depends(get_db)
) -> list[TechnicalCardRead]:
    try:
        rows = list_technical_cards_for_order(db, order_id)
    except TechnicalCardNotFoundError as error:
        raise _http_error(error) from error
    return [_card_read(db, row) for row in rows]


@router.get(
    "/orders/{order_id}/manufacturing-completeness",
    response_model=OrderManufacturingCompletenessRead,
    operation_id="get_order_manufacturing_completeness",
)
def get_order_manufacturing_completeness(
    order_id: int, db: Session = Depends(get_db)
) -> OrderManufacturingCompletenessRead:
    try:
        result = compute_order_manufacturing_completeness(db, order_id)
    except OrderManufacturingNotFoundError as error:
        raise _http_error(error) from error
    return OrderManufacturingCompletenessRead(
        sales_order_id=result.sales_order_id,
        eligible_count=result.eligible_count,
        completed_count=result.completed_count,
        missing_count=result.missing_count,
        open_count=result.open_count,
        cancelled_count=result.cancelled_count,
        completeness_percent=result.completeness_percent,
        manufacturing_complete=result.manufacturing_complete,
        blocking_item_ids=result.blocking_item_ids,
    )


@router.post(
    "/orders/{order_id}/technical-cards/preview",
    response_model=TechnicalCardPreviewRead,
    operation_id="preview_order_technical_cards",
)
def preview_order_technical_cards(
    order_id: int, db: Session = Depends(get_db)
) -> TechnicalCardPreviewRead:
    try:
        return preview_technical_cards(db, order_id)
    except TechnicalCardNotFoundError as error:
        raise _http_error(error) from error


@router.post(
    "/orders/{order_id}/technical-cards/generate",
    response_model=TechnicalCardGenerateRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="generate_order_technical_cards",
)
def generate_order_technical_cards(
    order_id: int,
    payload: TechnicalCardGenerateRequest | None = None,
    db: Session = Depends(get_db),
) -> TechnicalCardGenerateRead:
    body = payload or TechnicalCardGenerateRequest()
    try:
        result = generate_technical_cards(
            db,
            order_id,
            sales_order_item_ids=body.sales_order_item_ids,
        )
    except (TechnicalCardNotFoundError, TechnicalCardValidationError) as error:
        raise _http_error(error) from error
    return TechnicalCardGenerateRead(
        sales_order_id=result.sales_order_id,
        created=[_card_read(db, row) for row in result.created],
        revived=[_card_read(db, row) for row in result.revived],
        skipped=result.skipped,
    )


@router.get(
    "/technical-cards",
    response_model=list[TechnicalCardListRead],
    operation_id="list_technical_cards",
)
def read_technical_cards(
    sales_order_id: int | None = Query(default=None, ge=1),
    status_filter: str | None = Query(default=None, alias="status", max_length=30),
    stage: str | None = Query(default=None, max_length=255),
    search: str | None = Query(default=None, max_length=255),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[TechnicalCardListRead]:
    rows = list_technical_cards(
        db,
        sales_order_id=sales_order_id,
        status=status_filter,
        stage=stage,
        search=search,
        limit=limit,
        offset=offset,
    )
    result: list[TechnicalCardListRead] = []
    for card, order_number in rows:
        read_card = _card_read(db, card)
        data = read_card.model_dump()
        data["order_number"] = order_number
        result.append(TechnicalCardListRead.model_validate(data))
    return result


@router.get(
    "/technical-cards/{card_id}",
    response_model=TechnicalCardRead,
    operation_id="get_technical_card",
)
def read_technical_card(card_id: int, db: Session = Depends(get_db)) -> TechnicalCardRead:
    try:
        return _card_read(db, get_technical_card(db, card_id))
    except TechnicalCardNotFoundError as error:
        raise _http_error(error) from error


@router.post(
    "/technical-cards/{card_id}/apply-routing",
    response_model=TechnicalCardRead,
    operation_id="apply_technical_card_routing",
)
def apply_routing_endpoint(
    card_id: int,
    payload: TechnicalCardApplyRoutingRequest,
    db: Session = Depends(get_db),
) -> TechnicalCardRead:
    try:
        return _card_read(
            db, apply_routing_template(db, card_id, payload.routing_template_id)
        )
    except (
        TechnicalCardNotFoundError,
        TechnicalCardConflictError,
        TechnicalCardValidationError,
    ) as error:
        raise _http_error(error) from error


@router.get(
    "/technical-cards/{card_id}/media",
    response_model=list[TechnicalCardMediaRead],
    operation_id="list_technical_card_media",
)
def list_media_endpoint(
    card_id: int, db: Session = Depends(get_db)
) -> list[TechnicalCardMediaRead]:
    try:
        return [_media_read(item) for item in list_technical_card_media(db, card_id)]
    except TechnicalCardNotFoundError as error:
        raise _http_error(error) from error


@router.post(
    "/technical-cards/{card_id}/media",
    response_model=TechnicalCardMediaRead,
    status_code=status.HTTP_201_CREATED,
    operation_id="add_technical_card_media",
)
def add_media_endpoint(
    card_id: int,
    payload: TechnicalCardMediaCreate,
    db: Session = Depends(get_db),
) -> TechnicalCardMediaRead:
    try:
        return _media_read(add_technical_card_media(db, card_id, payload))
    except (TechnicalCardNotFoundError, TechnicalCardValidationError) as error:
        raise _http_error(error) from error


@router.patch(
    "/technical-cards/{card_id}/media/{media_id}",
    response_model=TechnicalCardMediaRead,
    operation_id="update_technical_card_media",
)
def update_media_endpoint(
    card_id: int,
    media_id: int,
    payload: TechnicalCardMediaUpdate,
    db: Session = Depends(get_db),
) -> TechnicalCardMediaRead:
    try:
        if payload.is_primary is True:
            item = set_technical_card_media_primary(db, card_id, media_id)
        else:
            item = get_technical_card_media(db, card_id, media_id)
        return _media_read(item)
    except (TechnicalCardNotFoundError, TechnicalCardValidationError) as error:
        raise _http_error(error) from error


@router.delete(
    "/technical-cards/{card_id}/media/{media_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="delete_technical_card_media",
)
def delete_media_endpoint(
    card_id: int, media_id: int, db: Session = Depends(get_db)
) -> None:
    try:
        delete_technical_card_media(db, card_id, media_id)
    except (TechnicalCardNotFoundError, TechnicalCardValidationError) as error:
        raise _http_error(error) from error


@router.get(
    "/technical-cards/{card_id}/media/{media_id}/content",
    operation_id="get_technical_card_media_content",
)
def read_media_content_endpoint(
    card_id: int, media_id: int, db: Session = Depends(get_db)
):
    try:
        path, mime_type = technical_card_media_path(db, card_id, media_id)
    except TechnicalCardNotFoundError as error:
        raise _http_error(error) from error
    return FileResponse(path, media_type=mime_type)


@router.post(
    "/technical-cards/{card_id}/sync-unit-lines",
    response_model=TechnicalCardRead,
    operation_id="sync_technical_card_unit_lines",
)
def sync_unit_lines_endpoint(
    card_id: int, db: Session = Depends(get_db)
) -> TechnicalCardRead:
    try:
        return _card_read(db, sync_technical_card_unit_lines(db, card_id))
    except (
        TechnicalCardNotFoundError,
        TechnicalCardValidationError,
    ) as error:
        raise _http_error(error) from error


@router.post(
    "/technical-cards/{card_id}/cancel",
    response_model=TechnicalCardRead,
    operation_id="cancel_draft_technical_card",
)
def cancel_draft_endpoint(
    card_id: int, db: Session = Depends(get_db)
) -> TechnicalCardRead:
    try:
        return _card_read(db, cancel_draft_technical_card(db, card_id))
    except (
        TechnicalCardNotFoundError,
        TechnicalCardConflictError,
    ) as error:
        raise _http_error(error) from error


@router.post(
    "/technical-cards/{card_id}/start",
    response_model=TechnicalCardRead,
    operation_id="start_technical_card",
)
def start_technical_card_endpoint(
    card_id: int, db: Session = Depends(get_db)
) -> TechnicalCardRead:
    try:
        return _card_read(db, start_technical_card(db, card_id))
    except (
        TechnicalCardNotFoundError,
        TechnicalCardConflictError,
        TechnicalCardValidationError,
    ) as error:
        raise _http_error(error) from error


@router.post(
    "/technical-cards/{card_id}/stages/{stage_order}/start",
    response_model=TechnicalCardRead,
    operation_id="start_technical_card_stage",
)
def start_stage_endpoint(
    card_id: int,
    stage_order: int,
    payload: TechnicalCardStageStartRequest | None = None,
    db: Session = Depends(get_db),
) -> TechnicalCardRead:
    try:
        return _card_read(db, start_stage(db, card_id, stage_order, payload))
    except (
        TechnicalCardNotFoundError,
        TechnicalCardConflictError,
        TechnicalCardValidationError,
    ) as error:
        raise _http_error(error) from error


@router.post(
    "/technical-cards/{card_id}/stages/{stage_order}/complete",
    response_model=TechnicalCardRead,
    operation_id="complete_technical_card_stage",
)
def complete_stage_endpoint(
    card_id: int,
    stage_order: int,
    payload: TechnicalCardStageCompleteRequest | None = None,
    db: Session = Depends(get_db),
) -> TechnicalCardRead:
    try:
        return _card_read(db, complete_stage(db, card_id, stage_order, payload))
    except (
        TechnicalCardNotFoundError,
        TechnicalCardConflictError,
        TechnicalCardValidationError,
    ) as error:
        raise _http_error(error) from error


@router.post(
    "/technical-cards/{card_id}/stages/{stage_order}/rollback",
    response_model=TechnicalCardRead,
    operation_id="rollback_technical_card_stage",
)
def rollback_stage_endpoint(
    card_id: int,
    stage_order: int,
    db: Session = Depends(get_db),
) -> TechnicalCardRead:
    try:
        return _card_read(db, rollback_stage(db, card_id, stage_order))
    except (
        TechnicalCardNotFoundError,
        TechnicalCardConflictError,
        TechnicalCardValidationError,
    ) as error:
        raise _http_error(error) from error


@router.post(
    "/technical-cards/{card_id}/stages/{stage_order}/rollback-kanban",
    response_model=TechnicalCardRead,
    operation_id="rollback_technical_card_stage_kanban",
)
def rollback_stage_for_shop_kanban_endpoint(
    card_id: int,
    stage_order: int,
    db: Session = Depends(get_db),
) -> TechnicalCardRead:
    """Kanban rollback variant for shop testing.

    Allows rolling back even when later stages are `in_progress`.
    """
    try:
        return _card_read(
            db, rollback_stage_for_shop_kanban(db, card_id, stage_order)
        )
    except (
        TechnicalCardNotFoundError,
        TechnicalCardConflictError,
        TechnicalCardValidationError,
    ) as error:
        raise _http_error(error) from error


@router.patch(
    "/technical-cards/{card_id}/stages/{stage_order}/fact",
    response_model=TechnicalCardRead,
    operation_id="update_technical_card_stage_fact",
)
def update_stage_fact_endpoint(
    card_id: int,
    stage_order: int,
    payload: TechnicalCardStageFactRequest,
    db: Session = Depends(get_db),
) -> TechnicalCardRead:
    try:
        return _card_read(db, update_stage_fact(db, card_id, stage_order, payload))
    except (
        TechnicalCardNotFoundError,
        TechnicalCardConflictError,
        TechnicalCardValidationError,
    ) as error:
        raise _http_error(error) from error


@router.patch(
    "/technical-cards/{card_id}/stages/{stage_order}/planned-work-center",
    response_model=TechnicalCardRead,
    operation_id="assign_technical_card_planned_work_center",
)
def assign_planned_work_center_endpoint(
    card_id: int,
    stage_order: int,
    payload: TechnicalCardPlannedWorkCenterRequest,
    db: Session = Depends(get_db),
) -> TechnicalCardRead:
    try:
        return _card_read(
            db,
            assign_planned_work_center(
                db, card_id, stage_order, payload.work_center_id
            ),
        )
    except (
        TechnicalCardNotFoundError,
        TechnicalCardConflictError,
        TechnicalCardValidationError,
    ) as error:
        raise _http_error(error) from error


@router.put(
    "/technical-cards/{card_id}/composition",
    response_model=TechnicalCardRead,
    operation_id="replace_technical_card_composition",
)
def replace_composition_endpoint(
    card_id: int,
    payload: TechnicalCardCompositionReplace,
    db: Session = Depends(get_db),
) -> TechnicalCardRead:
    try:
        return _card_read(db, replace_composition_lines(db, card_id, payload.lines))
    except (
        TechnicalCardNotFoundError,
        TechnicalCardValidationError,
    ) as error:
        raise _http_error(error) from error


@router.patch(
    "/technical-cards/{card_id}/composition/{line_id}/fact-qty",
    response_model=TechnicalCardRead,
    operation_id="set_technical_card_composition_fact_qty",
)
def set_composition_fact_qty_endpoint(
    card_id: int,
    line_id: int,
    payload: TechnicalCardCompositionFactQtyUpdate,
    db: Session = Depends(get_db),
) -> TechnicalCardRead:
    """Shop-path fact write; manager composition replace does not accept fact_qty."""
    try:
        return _card_read(
            db,
            set_composition_line_fact_qty(
                db,
                card_id,
                line_id,
                payload.fact_qty,
                shop_stage_code=payload.shop_stage_code,
            ),
        )
    except (
        TechnicalCardNotFoundError,
        TechnicalCardValidationError,
    ) as error:
        raise _http_error(error) from error


@router.delete(
    "/technical-cards/{card_id}/composition/{line_id}",
    response_model=TechnicalCardRead,
    operation_id="delete_technical_card_composition_line",
)
def delete_composition_line_endpoint(
    card_id: int,
    line_id: int,
    shop_stage_code: str | None = None,
    db: Session = Depends(get_db),
) -> TechnicalCardRead:
    """Shop-path delete of one MATERIAL composition line (цех bind via query)."""
    try:
        return _card_read(
            db,
            delete_composition_line(
                db,
                card_id,
                line_id,
                shop_stage_code=shop_stage_code,
            ),
        )
    except (
        TechnicalCardNotFoundError,
        TechnicalCardValidationError,
    ) as error:
        raise _http_error(error) from error


@router.post(
    "/technical-cards/{card_id}/composition/refresh-model",
    response_model=TechnicalCardRead,
    operation_id="refresh_technical_card_model_composition",
)
def refresh_model_composition_endpoint(
    card_id: int, db: Session = Depends(get_db)
) -> TechnicalCardRead:
    try:
        return _card_read(db, refresh_model_and_pattern_composition(db, card_id))
    except (
        TechnicalCardNotFoundError,
        TechnicalCardValidationError,
    ) as error:
        raise _http_error(error) from error


@router.post(
    "/technical-cards/{card_id}/composition/apply-specification",
    response_model=TechnicalCardRead,
    operation_id="apply_technical_card_specification",
)
def apply_specification_endpoint(
    card_id: int,
    payload: TechnicalCardApplySpecification,
    db: Session = Depends(get_db),
) -> TechnicalCardRead:
    try:
        return _card_read(db, apply_specification_version(db, card_id, payload))
    except (
        TechnicalCardNotFoundError,
        TechnicalCardValidationError,
    ) as error:
        raise _http_error(error) from error


@router.get(
    "/technical-cards/{card_id}/unit-lines",
    response_model=list[TechnicalCardUnitLineRead],
    operation_id="list_technical_card_unit_lines",
)
def list_unit_lines_endpoint(
    card_id: int, db: Session = Depends(get_db)
) -> list[TechnicalCardUnitLineRead]:
    try:
        rows = list_unit_lines(db, card_id)
    except TechnicalCardNotFoundError as error:
        raise _http_error(error) from error
    return [TechnicalCardUnitLineRead.model_validate(row) for row in rows]


@router.patch(
    "/technical-cards/{card_id}/unit-lines/{line_id}",
    response_model=TechnicalCardRead,
    operation_id="update_technical_card_unit_line",
)
def update_unit_line_endpoint(
    card_id: int,
    line_id: int,
    payload: TechnicalCardUnitLineUpdate,
    db: Session = Depends(get_db),
) -> TechnicalCardRead:
    try:
        return _card_read(db, update_unit_line(db, card_id, line_id, payload))
    except (
        TechnicalCardNotFoundError,
        TechnicalCardValidationError,
    ) as error:
        raise _http_error(error) from error


@router.put(
    "/technical-cards/{card_id}/unit-lines",
    response_model=TechnicalCardRead,
    operation_id="replace_technical_card_unit_lines",
)
def replace_unit_lines_endpoint(
    card_id: int,
    payload: TechnicalCardUnitLinesReplace,
    db: Session = Depends(get_db),
) -> TechnicalCardRead:
    try:
        return _card_read(db, replace_unit_lines(db, card_id, payload.lines))
    except (
        TechnicalCardNotFoundError,
        TechnicalCardValidationError,
    ) as error:
        raise _http_error(error) from error


@router.post(
    "/technical-cards/{card_id}/unit-lines/bulk",
    response_model=TechnicalCardRead,
    operation_id="bulk_update_technical_card_unit_lines",
)
def bulk_update_unit_lines_endpoint(
    card_id: int,
    payload: TechnicalCardUnitLinesBulkUpdate,
    db: Session = Depends(get_db),
) -> TechnicalCardRead:
    try:
        return _card_read(db, bulk_update_unit_lines(db, card_id, payload.lines))
    except (
        TechnicalCardNotFoundError,
        TechnicalCardValidationError,
    ) as error:
        raise _http_error(error) from error


@router.post(
    "/technical-cards/{card_id}/unit-lines/import",
    response_model=TechnicalCardRead,
    operation_id="import_technical_card_unit_lines",
)
def import_unit_lines_endpoint(
    card_id: int,
    payload: TechnicalCardUnitLinesImport,
    db: Session = Depends(get_db),
) -> TechnicalCardRead:
    try:
        return _card_read(db, import_unit_lines(db, card_id, payload.lines))
    except (
        TechnicalCardNotFoundError,
        TechnicalCardValidationError,
    ) as error:
        raise _http_error(error) from error


@router.post(
    "/technical-cards/{card_id}/unit-lines/reset-defaults",
    response_model=TechnicalCardRead,
    operation_id="reset_technical_card_unit_line_defaults",
)
def reset_unit_line_defaults_endpoint(
    card_id: int, db: Session = Depends(get_db)
) -> TechnicalCardRead:
    try:
        return _card_read(db, reset_unit_lines_from_order_defaults(db, card_id))
    except (
        TechnicalCardNotFoundError,
        TechnicalCardValidationError,
    ) as error:
        raise _http_error(error) from error


@router.get(
    "/technical-cards/{card_id}/operation-lines",
    response_model=list[TechnicalCardOperationLineRead],
    operation_id="list_technical_card_operation_lines",
)
def list_operation_lines_endpoint(
    card_id: int, db: Session = Depends(get_db)
) -> list[TechnicalCardOperationLineRead]:
    try:
        rows = list_operation_lines(db, card_id)
    except TechnicalCardNotFoundError as error:
        raise _http_error(error) from error
    return [TechnicalCardOperationLineRead.model_validate(row) for row in rows]


@router.put(
    "/technical-cards/{card_id}/operation-lines",
    response_model=TechnicalCardRead,
    operation_id="replace_technical_card_operation_lines",
)
def replace_operation_lines_endpoint(
    card_id: int,
    payload: TechnicalCardOperationLinesReplace,
    db: Session = Depends(get_db),
) -> TechnicalCardRead:
    try:
        return _card_read(db, replace_operation_lines(db, card_id, payload.lines))
    except (
        TechnicalCardNotFoundError,
        TechnicalCardValidationError,
    ) as error:
        raise _http_error(error) from error


@router.patch(
    "/technical-cards/{card_id}/operation-lines/{line_id}",
    response_model=TechnicalCardRead,
    operation_id="update_technical_card_operation_line_volume",
)
def update_operation_line_volume_endpoint(
    card_id: int,
    line_id: int,
    payload: TechnicalCardOperationLineVolumeUpdate,
    db: Session = Depends(get_db),
) -> TechnicalCardRead:
    try:
        return _card_read(
            db,
            update_operation_line_volume(
                db,
                card_id,
                line_id,
                volume=payload.volume,
                operation_name=payload.operation_name,
                shop_stage_code=payload.shop_stage_code,
            ),
        )
    except (
        TechnicalCardNotFoundError,
        TechnicalCardValidationError,
    ) as error:
        raise _http_error(error) from error


@router.post(
    "/technical-cards/{card_id}/operation-lines/prefill",
    response_model=TechnicalCardOperationLinesPrefillRead,
    operation_id="prefill_technical_card_operation_lines",
)
def prefill_operation_lines_endpoint(
    card_id: int, db: Session = Depends(get_db)
) -> TechnicalCardOperationLinesPrefillRead:
    try:
        card, prefilled, catalog_available, message = prefill_operation_lines_from_catalog(
            db, card_id
        )
    except (
        TechnicalCardNotFoundError,
        TechnicalCardValidationError,
    ) as error:
        raise _http_error(error) from error
    return TechnicalCardOperationLinesPrefillRead(
        card=_card_read(db, card),
        prefilled=prefilled,
        catalog_available=catalog_available,
        message=message,
    )
