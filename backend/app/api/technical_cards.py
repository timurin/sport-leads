"""Technical cards API (Stage 9.2.1 generate + Stage 9.2.2 stage machine)."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.technical_card import (
    OrderManufacturingCompletenessRead,
    TechnicalCardApplySpecification,
    TechnicalCardCompositionReplace,
    TechnicalCardGenerateRead,
    TechnicalCardGenerateRequest,
    TechnicalCardListRead,
    TechnicalCardOperationLineRead,
    TechnicalCardOperationLinesPrefillRead,
    TechnicalCardOperationLinesReplace,
    TechnicalCardOperationLineVolumeUpdate,
    TechnicalCardPreviewRead,
    TechnicalCardRead,
    TechnicalCardStageCompleteRequest,
    TechnicalCardStageStartRequest,
    TechnicalCardUnitLineRead,
    TechnicalCardUnitLinesBulkUpdate,
    TechnicalCardUnitLinesImport,
    TechnicalCardUnitLinesReplace,
    TechnicalCardUnitLineUpdate,
)
from app.services.order_manufacturing_completeness import (
    OrderManufacturingNotFoundError,
    compute_order_manufacturing_completeness,
)
from app.services.technical_card_stages import (
    complete_stage,
    rollback_stage,
    start_stage,
    start_technical_card,
)
from app.services.technical_cards import (
    TechnicalCardConflictError,
    TechnicalCardNotFoundError,
    TechnicalCardValidationError,
    apply_specification_version,
    bulk_update_unit_lines,
    cancel_draft_technical_card,
    generate_technical_cards,
    get_technical_card,
    import_unit_lines,
    list_operation_lines,
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
    sync_technical_card_unit_lines,
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
    return [TechnicalCardRead.model_validate(row) for row in rows]


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
        created=[TechnicalCardRead.model_validate(row) for row in result.created],
        revived=[TechnicalCardRead.model_validate(row) for row in result.revived],
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
        item = TechnicalCardListRead.model_validate(card)
        item.order_number = order_number
        result.append(item)
    return result


@router.get(
    "/technical-cards/{card_id}",
    response_model=TechnicalCardRead,
    operation_id="get_technical_card",
)
def read_technical_card(card_id: int, db: Session = Depends(get_db)) -> TechnicalCardRead:
    try:
        return TechnicalCardRead.model_validate(get_technical_card(db, card_id))
    except TechnicalCardNotFoundError as error:
        raise _http_error(error) from error


@router.post(
    "/technical-cards/{card_id}/sync-unit-lines",
    response_model=TechnicalCardRead,
    operation_id="sync_technical_card_unit_lines",
)
def sync_unit_lines_endpoint(
    card_id: int, db: Session = Depends(get_db)
) -> TechnicalCardRead:
    try:
        return TechnicalCardRead.model_validate(
            sync_technical_card_unit_lines(db, card_id)
        )
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
        return TechnicalCardRead.model_validate(
            cancel_draft_technical_card(db, card_id)
        )
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
        return TechnicalCardRead.model_validate(start_technical_card(db, card_id))
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
        return TechnicalCardRead.model_validate(
            start_stage(db, card_id, stage_order, payload)
        )
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
        return TechnicalCardRead.model_validate(
            complete_stage(db, card_id, stage_order, payload)
        )
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
        return TechnicalCardRead.model_validate(
            rollback_stage(db, card_id, stage_order)
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
        return TechnicalCardRead.model_validate(
            replace_composition_lines(db, card_id, payload.lines)
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
        return TechnicalCardRead.model_validate(
            refresh_model_and_pattern_composition(db, card_id)
        )
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
        return TechnicalCardRead.model_validate(
            apply_specification_version(db, card_id, payload)
        )
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
        return TechnicalCardRead.model_validate(
            update_unit_line(db, card_id, line_id, payload)
        )
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
        return TechnicalCardRead.model_validate(
            replace_unit_lines(db, card_id, payload.lines)
        )
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
        return TechnicalCardRead.model_validate(
            bulk_update_unit_lines(db, card_id, payload.lines)
        )
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
        return TechnicalCardRead.model_validate(
            import_unit_lines(db, card_id, payload.lines)
        )
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
        return TechnicalCardRead.model_validate(
            reset_unit_lines_from_order_defaults(db, card_id)
        )
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
        return TechnicalCardRead.model_validate(
            replace_operation_lines(db, card_id, payload.lines)
        )
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
        return TechnicalCardRead.model_validate(
            update_operation_line_volume(
                db,
                card_id,
                line_id,
                volume=payload.volume,
                operation_name=payload.operation_name,
            )
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
        card=TechnicalCardRead.model_validate(card),
        prefilled=prefilled,
        catalog_available=catalog_available,
        message=message,
    )
