from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.schemas.characteristics import (
    CategoryCharacteristicCreate, CategoryCharacteristicRead,
    CharacteristicDefinitionCreate, CharacteristicDefinitionRead, CharacteristicDefinitionUpdate,
    CharacteristicOptionCreate, CharacteristicOptionRead, CharacteristicOptionUpdate,
    NomenclatureCharacteristicCreate, NomenclatureCharacteristicRead,
    VariantCreate, VariantGenerateRequest, VariantRead, VariantUpdate,
)
from app.services.characteristics import (
    CharacteristicError, assign_category_characteristic, assign_nomenclature_characteristic,
    create_definition, create_option, create_variant, generate_variants,
    list_category_characteristics, list_definitions, list_nomenclature_characteristics,
    list_options, list_variants, update_definition, update_option, update_variant,
)

router = APIRouter(prefix="/characteristics", tags=["Characteristics"])


def _error(error: CharacteristicError) -> HTTPException:
    message = str(error)
    status = 404 if message.endswith("not found") or message == "Category not found" else 409
    return HTTPException(status_code=status, detail=message)


def _variant_read(row: tuple[object, list[object]]) -> dict[str, object]:
    variant, options = row
    return {
        "id": variant.id, "nomenclature_id": variant.nomenclature_id,
        "article": variant.article, "name": variant.name, "is_active": variant.is_active,
        "option_ids": [option.id for option in options], "options": options,
        "created_at": variant.created_at, "updated_at": variant.updated_at,
    }


@router.get("/definitions", response_model=list[CharacteristicDefinitionRead])
def get_definitions(db: Session = Depends(get_db)):
    return list_definitions(db)


@router.post("/definitions", response_model=CharacteristicDefinitionRead, status_code=201)
def post_definition(payload: CharacteristicDefinitionCreate, db: Session = Depends(get_db)):
    try: return create_definition(db, payload)
    except CharacteristicError as error: raise _error(error) from error


@router.patch("/definitions/{characteristic_id}", response_model=CharacteristicDefinitionRead)
def patch_definition(characteristic_id: int, payload: CharacteristicDefinitionUpdate, db: Session = Depends(get_db)):
    try: return update_definition(db, characteristic_id, payload)
    except CharacteristicError as error: raise _error(error) from error


@router.get("/definitions/{characteristic_id}/options", response_model=list[CharacteristicOptionRead])
def get_options(characteristic_id: int, db: Session = Depends(get_db)):
    try: return list_options(db, characteristic_id)
    except CharacteristicError as error: raise _error(error) from error


@router.post("/definitions/{characteristic_id}/options", response_model=CharacteristicOptionRead, status_code=201)
def post_option(characteristic_id: int, payload: CharacteristicOptionCreate, db: Session = Depends(get_db)):
    try: return create_option(db, characteristic_id, payload)
    except CharacteristicError as error: raise _error(error) from error


@router.patch("/options/{option_id}", response_model=CharacteristicOptionRead)
def patch_option(option_id: int, payload: CharacteristicOptionUpdate, db: Session = Depends(get_db)):
    try: return update_option(db, option_id, payload)
    except CharacteristicError as error: raise _error(error) from error


@router.get("/categories/{category_id}", response_model=list[CategoryCharacteristicRead])
def get_category_characteristics(category_id: int, db: Session = Depends(get_db)):
    try:
        return [{**row.__dict__, "source_category_id": source, "inherited": inherited} for row, source, inherited in list_category_characteristics(db, category_id)]
    except CharacteristicError as error: raise _error(error) from error


@router.post("/categories/{category_id}", response_model=CategoryCharacteristicRead, status_code=201)
def post_category_characteristic(category_id: int, payload: CategoryCharacteristicCreate, db: Session = Depends(get_db)):
    try:
        item = assign_category_characteristic(db, category_id, payload)
        return {**item.__dict__, "source_category_id": category_id, "inherited": False}
    except CharacteristicError as error: raise _error(error) from error


@router.get("/nomenclatures/{nomenclature_id}", response_model=list[NomenclatureCharacteristicRead])
def get_nomenclature_characteristics(nomenclature_id: int, db: Session = Depends(get_db)):
    try: return list_nomenclature_characteristics(db, nomenclature_id)
    except CharacteristicError as error: raise _error(error) from error


@router.post("/nomenclatures/{nomenclature_id}", response_model=NomenclatureCharacteristicRead, status_code=201)
def post_nomenclature_characteristic(nomenclature_id: int, payload: NomenclatureCharacteristicCreate, db: Session = Depends(get_db)):
    try: return assign_nomenclature_characteristic(db, nomenclature_id, payload)
    except CharacteristicError as error: raise _error(error) from error


@router.get("/nomenclatures/{nomenclature_id}/variants", response_model=list[VariantRead])
def get_variants(nomenclature_id: int, db: Session = Depends(get_db)):
    try: return [_variant_read(row) for row in list_variants(db, nomenclature_id)]
    except CharacteristicError as error: raise _error(error) from error


@router.post("/nomenclatures/{nomenclature_id}/variants", response_model=VariantRead, status_code=201)
def post_variant(nomenclature_id: int, payload: VariantCreate, db: Session = Depends(get_db)):
    try:
        variant = create_variant(db, nomenclature_id, payload)
        return _variant_read(next(row for row in list_variants(db, nomenclature_id) if row[0].id == variant.id))
    except CharacteristicError as error: raise _error(error) from error


@router.post("/nomenclatures/{nomenclature_id}/variants/generate", response_model=list[VariantRead])
def post_generate_variants(nomenclature_id: int, payload: VariantGenerateRequest, db: Session = Depends(get_db)):
    try:
        created = generate_variants(db, nomenclature_id, payload)
        created_ids = {variant.id for variant in created}
        return [_variant_read(row) for row in list_variants(db, nomenclature_id) if row[0].id in created_ids]
    except CharacteristicError as error: raise _error(error) from error


@router.patch("/variants/{variant_id}", response_model=VariantRead)
def patch_variant(variant_id: int, payload: VariantUpdate, db: Session = Depends(get_db)):
    try:
        variant = update_variant(db, variant_id, payload)
        return _variant_read(next(row for row in list_variants(db, variant.nomenclature_id) if row[0].id == variant.id))
    except CharacteristicError as error: raise _error(error) from error
