from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.characteristics import (
    CategoryCharacteristicCreate,
    CategoryCharacteristicRead,
    CategoryCharacteristicUpdate,
    CharacteristicDefinitionCreate,
    CharacteristicDefinitionRead,
    CharacteristicDefinitionUpdate,
    CharacteristicOptionCreate,
    CharacteristicOptionRead,
    CharacteristicOptionUpdate,
    NomenclatureCharacteristicAssignmentInput,
    NomenclatureCharacteristicCreate,
    NomenclatureCharacteristicRead,
    NomenclatureCharacteristicValueInput,
    NomenclatureCharacteristicValueRead,
    VariantCreate,
    VariantGenerateRequest,
    VariantRead,
    VariantUpdate,
)
from app.services.characteristics import (
    CharacteristicConflictError,
    CharacteristicError,
    CharacteristicNotFoundError,
    CharacteristicRuleError,
    assign_category_characteristic,
    assign_nomenclature_characteristic,
    assign_nomenclature_value,
    can_delete_definition,
    can_delete_option,
    create_definition,
    create_option,
    create_variant,
    delete_definition,
    delete_option,
    generate_variants,
    get_nomenclature_values,
    list_category_characteristics,
    list_definitions,
    list_nomenclature_characteristics,
    list_options,
    list_used_value_labels,
    list_variants,
    remove_category_characteristic,
    remove_nomenclature_value,
    save_nomenclature_values,
    update_category_characteristic,
    update_definition,
    update_option,
    update_variant,
    value_read_payload,
    _default_value,
    _definition,
)

router = APIRouter(prefix="/characteristics", tags=["Characteristics"])


def _error(error: CharacteristicError) -> HTTPException:
    if isinstance(error, CharacteristicNotFoundError) or str(error).endswith("not found") or str(error) == "Category not found":
        return HTTPException(status_code=404, detail=str(error))
    if isinstance(error, CharacteristicConflictError):
        return HTTPException(status_code=409, detail=str(error))
    if isinstance(error, CharacteristicRuleError) or "required" in str(error) or "available only" in str(error) or "не соответствует" in str(error):
        return HTTPException(status_code=422, detail=str(error))
    return HTTPException(status_code=422, detail=str(error))


def _definition_read(db: Session, item) -> CharacteristicDefinitionRead:
    return CharacteristicDefinitionRead.model_validate(
        {
            **{c.name: getattr(item, c.name) for c in item.__table__.columns},
            "can_delete": can_delete_definition(db, item.id),
        }
    )


def _option_read(db: Session, item) -> CharacteristicOptionRead:
    return CharacteristicOptionRead.model_validate(
        {
            **{c.name: getattr(item, c.name) for c in item.__table__.columns},
            "can_delete": can_delete_option(db, item.id),
        }
    )


def _variant_read(row: tuple[object, list[object]]) -> dict[str, object]:
    variant, options = row
    return {
        "id": variant.id,
        "nomenclature_id": variant.nomenclature_id,
        "article": variant.article,
        "name": variant.name,
        "is_active": variant.is_active,
        "option_ids": [option.id for option in options],
        "options": options,
        "created_at": variant.created_at,
        "updated_at": variant.updated_at,
    }


@router.get("/definitions", response_model=list[CharacteristicDefinitionRead])
def get_definitions(
    search: str | None = Query(default=None, max_length=255),
    kind: str | None = None,
    is_active: bool | None = None,
    db: Session = Depends(get_db),
):
    return [_definition_read(db, item) for item in list_definitions(db, search=search, kind=kind, is_active=is_active)]


@router.post("/definitions", response_model=CharacteristicDefinitionRead, status_code=201)
def post_definition(payload: CharacteristicDefinitionCreate, db: Session = Depends(get_db)):
    try:
        return _definition_read(db, create_definition(db, payload))
    except CharacteristicError as error:
        raise _error(error) from error


@router.get("/definitions/{characteristic_id}", response_model=CharacteristicDefinitionRead)
def get_definition(characteristic_id: int, db: Session = Depends(get_db)):
    try:
        return _definition_read(db, _definition(db, characteristic_id))
    except CharacteristicError as error:
        raise _error(error) from error


@router.patch("/definitions/{characteristic_id}", response_model=CharacteristicDefinitionRead)
def patch_definition(
    characteristic_id: int,
    payload: CharacteristicDefinitionUpdate,
    db: Session = Depends(get_db),
):
    try:
        return _definition_read(db, update_definition(db, characteristic_id, payload))
    except CharacteristicError as error:
        raise _error(error) from error


@router.delete("/definitions/{characteristic_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_definition(characteristic_id: int, db: Session = Depends(get_db)):
    try:
        delete_definition(db, characteristic_id)
    except CharacteristicError as error:
        raise _error(error) from error


@router.get("/definitions/{characteristic_id}/options", response_model=list[CharacteristicOptionRead])
def get_options(characteristic_id: int, db: Session = Depends(get_db)):
    try:
        return [_option_read(db, item) for item in list_options(db, characteristic_id)]
    except CharacteristicError as error:
        raise _error(error) from error


@router.get(
    "/definitions/{characteristic_id}/used-values",
    response_model=list[str],
)
def get_used_values(characteristic_id: int, db: Session = Depends(get_db)):
    try:
        return list_used_value_labels(db, characteristic_id)
    except CharacteristicError as error:
        raise _error(error) from error


@router.post(
    "/definitions/{characteristic_id}/options",
    response_model=CharacteristicOptionRead,
    status_code=201,
)
def post_option(
    characteristic_id: int,
    payload: CharacteristicOptionCreate,
    db: Session = Depends(get_db),
):
    try:
        return _option_read(db, create_option(db, characteristic_id, payload))
    except CharacteristicError as error:
        raise _error(error) from error


@router.patch("/options/{option_id}", response_model=CharacteristicOptionRead)
def patch_option(option_id: int, payload: CharacteristicOptionUpdate, db: Session = Depends(get_db)):
    try:
        return _option_read(db, update_option(db, option_id, payload))
    except CharacteristicError as error:
        raise _error(error) from error


@router.delete("/options/{option_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_option(option_id: int, db: Session = Depends(get_db)):
    try:
        delete_option(db, option_id)
    except CharacteristicError as error:
        raise _error(error) from error


@router.get("/categories/{category_id}", response_model=list[CategoryCharacteristicRead])
def get_category_characteristics(category_id: int, db: Session = Depends(get_db)):
    try:
        result = []
        for row, source, inherited in list_category_characteristics(db, category_id):
            definition = _definition(db, row.characteristic_id)
            result.append(
                CategoryCharacteristicRead(
                    id=row.id,
                    category_id=row.category_id,
                    characteristic_id=row.characteristic_id,
                    is_required=row.is_required,
                    inherit=row.inherit,
                    is_visible=row.is_visible,
                    sort_order=row.sort_order,
                    default_value=_default_value(row, definition),
                    created_at=row.created_at,
                    updated_at=row.updated_at,
                    inherited=inherited,
                    source_category_id=source,
                )
            )
        return result
    except CharacteristicError as error:
        raise _error(error) from error


@router.post("/categories/{category_id}", response_model=CategoryCharacteristicRead, status_code=201)
def post_category_characteristic(
    category_id: int,
    payload: CategoryCharacteristicCreate,
    db: Session = Depends(get_db),
):
    try:
        item = assign_category_characteristic(db, category_id, payload)
        definition = _definition(db, item.characteristic_id)
        return CategoryCharacteristicRead(
            id=item.id,
            category_id=item.category_id,
            characteristic_id=item.characteristic_id,
            is_required=item.is_required,
            inherit=item.inherit,
            is_visible=item.is_visible,
            sort_order=item.sort_order,
            default_value=_default_value(item, definition),
            created_at=item.created_at,
            updated_at=item.updated_at,
            inherited=False,
            source_category_id=category_id,
        )
    except CharacteristicError as error:
        raise _error(error) from error


@router.patch(
    "/categories/{category_id}/{characteristic_id}",
    response_model=CategoryCharacteristicRead,
)
def patch_category_characteristic(
    category_id: int,
    characteristic_id: int,
    payload: CategoryCharacteristicUpdate,
    db: Session = Depends(get_db),
):
    try:
        item = update_category_characteristic(db, category_id, characteristic_id, payload)
        definition = _definition(db, item.characteristic_id)
        return CategoryCharacteristicRead(
            id=item.id,
            category_id=item.category_id,
            characteristic_id=item.characteristic_id,
            is_required=item.is_required,
            inherit=item.inherit,
            is_visible=item.is_visible,
            sort_order=item.sort_order,
            default_value=_default_value(item, definition),
            created_at=item.created_at,
            updated_at=item.updated_at,
            inherited=False,
            source_category_id=category_id,
        )
    except CharacteristicError as error:
        raise _error(error) from error


@router.delete(
    "/categories/{category_id}/{characteristic_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_category_characteristic_route(
    category_id: int, characteristic_id: int, db: Session = Depends(get_db)
):
    try:
        remove_category_characteristic(db, category_id, characteristic_id)
    except CharacteristicError as error:
        raise _error(error) from error


@router.get(
    "/nomenclatures/{nomenclature_id}/values",
    response_model=list[NomenclatureCharacteristicValueRead],
)
def get_values(nomenclature_id: int, db: Session = Depends(get_db)):
    try:
        return [
            NomenclatureCharacteristicValueRead.model_validate(
                value_read_payload(assignment, definition, row, source_id, inherited)
            )
            for assignment, definition, row, source_id, inherited in get_nomenclature_values(
                db, nomenclature_id
            )
        ]
    except CharacteristicError as error:
        raise _error(error) from error


@router.put(
    "/nomenclatures/{nomenclature_id}/values",
    response_model=list[NomenclatureCharacteristicValueRead],
)
def put_values(
    nomenclature_id: int,
    payload: list[NomenclatureCharacteristicValueInput],
    db: Session = Depends(get_db),
):
    try:
        return [
            NomenclatureCharacteristicValueRead.model_validate(
                value_read_payload(assignment, definition, row, source_id, inherited)
            )
            for assignment, definition, row, source_id, inherited in save_nomenclature_values(
                db, nomenclature_id, payload
            )
        ]
    except CharacteristicError as error:
        raise _error(error) from error


@router.post(
    "/nomenclatures/{nomenclature_id}/values",
    response_model=list[NomenclatureCharacteristicValueRead],
    status_code=201,
)
def post_value(
    nomenclature_id: int,
    payload: NomenclatureCharacteristicAssignmentInput,
    db: Session = Depends(get_db),
):
    try:
        return [
            NomenclatureCharacteristicValueRead.model_validate(
                value_read_payload(assignment, definition, row, source_id, inherited)
            )
            for assignment, definition, row, source_id, inherited in assign_nomenclature_value(
                db, nomenclature_id, payload
            )
        ]
    except CharacteristicError as error:
        raise _error(error) from error


@router.delete(
    "/nomenclatures/{nomenclature_id}/values/{characteristic_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_value(
    nomenclature_id: int, characteristic_id: int, db: Session = Depends(get_db)
):
    try:
        remove_nomenclature_value(db, nomenclature_id, characteristic_id)
    except CharacteristicError as error:
        raise _error(error) from error


@router.get(
    "/nomenclatures/{nomenclature_id}",
    response_model=list[NomenclatureCharacteristicRead],
)
def get_nomenclature_characteristics(nomenclature_id: int, db: Session = Depends(get_db)):
    try:
        return list_nomenclature_characteristics(db, nomenclature_id)
    except CharacteristicError as error:
        raise _error(error) from error


@router.post(
    "/nomenclatures/{nomenclature_id}",
    response_model=NomenclatureCharacteristicRead,
    status_code=201,
)
def post_nomenclature_characteristic(
    nomenclature_id: int,
    payload: NomenclatureCharacteristicCreate,
    db: Session = Depends(get_db),
):
    try:
        return assign_nomenclature_characteristic(db, nomenclature_id, payload)
    except CharacteristicError as error:
        raise _error(error) from error


@router.get("/nomenclatures/{nomenclature_id}/variants", response_model=list[VariantRead])
def get_variants(nomenclature_id: int, db: Session = Depends(get_db)):
    try:
        return [_variant_read(row) for row in list_variants(db, nomenclature_id)]
    except CharacteristicError as error:
        raise _error(error) from error


@router.post(
    "/nomenclatures/{nomenclature_id}/variants",
    response_model=VariantRead,
    status_code=201,
)
def post_variant(
    nomenclature_id: int, payload: VariantCreate, db: Session = Depends(get_db)
):
    try:
        variant = create_variant(db, nomenclature_id, payload)
        return _variant_read(
            next(row for row in list_variants(db, nomenclature_id) if row[0].id == variant.id)
        )
    except CharacteristicError as error:
        raise _error(error) from error


@router.post(
    "/nomenclatures/{nomenclature_id}/variants/generate",
    response_model=list[VariantRead],
)
def post_generate_variants(
    nomenclature_id: int,
    payload: VariantGenerateRequest,
    db: Session = Depends(get_db),
):
    try:
        created = generate_variants(db, nomenclature_id, payload)
        created_ids = {variant.id for variant in created}
        return [
            _variant_read(row)
            for row in list_variants(db, nomenclature_id)
            if row[0].id in created_ids
        ]
    except CharacteristicError as error:
        raise _error(error) from error


@router.patch("/variants/{variant_id}", response_model=VariantRead)
def patch_variant(variant_id: int, payload: VariantUpdate, db: Session = Depends(get_db)):
    try:
        variant = update_variant(db, variant_id, payload)
        return _variant_read(
            next(
                row
                for row in list_variants(db, variant.nomenclature_id)
                if row[0].id == variant.id
            )
        )
    except CharacteristicError as error:
        raise _error(error) from error
