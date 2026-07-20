from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.nomenclature import Nomenclature
from app.schemas.nomenclature import NomenclatureCategoryCreate, NomenclatureCategoryRead, NomenclatureCategoryUpdate, NomenclatureCreate, NomenclatureRead, NomenclatureUpdate, UnitOfMeasureCreate, UnitOfMeasureRead, UnitOfMeasureUpdate
from app.services.nomenclature import (
    NomenclatureArticleConflictError,
    NomenclatureCategoryConflictError,
    NomenclatureCategoryNotFoundError,
    NomenclatureCategoryRuleError,
    NomenclatureNotFoundError,
    create_category,
    create_nomenclature,
    get_category,
    get_nomenclature,
    list_categories,
    list_nomenclature,
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


router = APIRouter(prefix="/nomenclatures", tags=["Nomenclature"])


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
) -> list[Nomenclature]:
    return list_nomenclature(db, search, is_active, limit, offset)


@router.get("/{nomenclature_id}", response_model=NomenclatureRead)
def read_one_nomenclature(nomenclature_id: int, db: Session = Depends(get_db)) -> Nomenclature:
    try:
        return get_nomenclature(db, nomenclature_id)
    except NomenclatureNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post("", response_model=NomenclatureRead, status_code=status.HTTP_201_CREATED)
def create_one_nomenclature(payload: NomenclatureCreate, db: Session = Depends(get_db)) -> Nomenclature:
    try:
        return create_nomenclature(db, payload)
    except NomenclatureArticleConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except (NomenclatureCategoryNotFoundError, NomenclatureCategoryRuleError, UnitOfMeasureNotFoundError, UnitOfMeasureRuleError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.patch("/{nomenclature_id}", response_model=NomenclatureRead)
def update_one_nomenclature(nomenclature_id: int, payload: NomenclatureUpdate, db: Session = Depends(get_db)) -> Nomenclature:
    try:
        return update_nomenclature(db, nomenclature_id, payload)
    except NomenclatureNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except NomenclatureArticleConflictError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except (NomenclatureCategoryNotFoundError, NomenclatureCategoryRuleError, UnitOfMeasureNotFoundError, UnitOfMeasureRuleError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
