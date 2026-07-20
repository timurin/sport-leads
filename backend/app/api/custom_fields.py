from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.custom_fields import CustomFieldDataType
from app.schemas.custom_fields import CategoryFieldCreate, CategoryFieldRead, CategoryFieldUpdate, CustomFieldDefinitionCreate, CustomFieldDefinitionRead, CustomFieldDefinitionUpdate, CustomFieldOptionCreate, CustomFieldOptionRead, CustomFieldOptionUpdate, NomenclatureFieldAssignmentInput, NomenclatureFieldValueInput, NomenclatureFieldValueRead
from app.services.custom_fields import CustomFieldConflictError, CustomFieldNotFoundError, CustomFieldRuleError, _default_value, assign_field, assign_nomenclature_field, create_definition, create_option, effective_fields, get_definition, get_nomenclature_values, list_definitions, list_options, remove_field, remove_nomenclature_field, save_nomenclature_values, update_definition, update_field_assignment, update_option

router = APIRouter(prefix="/custom-fields", tags=["Nomenclature custom fields"])


@router.get("", response_model=list[CustomFieldDefinitionRead])
def read_definitions(search: str | None = Query(default=None, max_length=255), data_type: CustomFieldDataType | None = None, is_active: bool | None = None, db: Session = Depends(get_db)):
    return list_definitions(db, search, data_type, is_active)


@router.get("/{field_id}", response_model=CustomFieldDefinitionRead)
def read_definition(field_id: int, db: Session = Depends(get_db)):
    try:
        return get_definition(db, field_id)
    except CustomFieldNotFoundError as error:
        raise HTTPException(404, str(error)) from error


@router.post("", response_model=CustomFieldDefinitionRead, status_code=status.HTTP_201_CREATED)
def create_field(payload: CustomFieldDefinitionCreate, db: Session = Depends(get_db)):
    try:
        return create_definition(db, payload)
    except CustomFieldRuleError as error:
        raise HTTPException(422, str(error)) from error
    except CustomFieldConflictError as error:
        raise HTTPException(409, str(error)) from error


@router.patch("/{field_id}", response_model=CustomFieldDefinitionRead)
def patch_field(field_id: int, payload: CustomFieldDefinitionUpdate, db: Session = Depends(get_db)):
    try:
        return update_definition(db, field_id, payload)
    except CustomFieldNotFoundError as error:
        raise HTTPException(404, str(error)) from error
    except (CustomFieldRuleError, CustomFieldConflictError) as error:
        raise HTTPException(422, str(error)) from error


@router.get("/{field_id}/options", response_model=list[CustomFieldOptionRead])
def read_options(field_id: int, db: Session = Depends(get_db)):
    try:
        return list_options(db, field_id)
    except CustomFieldNotFoundError as error:
        raise HTTPException(404, str(error)) from error


@router.post("/{field_id}/options", response_model=CustomFieldOptionRead, status_code=status.HTTP_201_CREATED)
def add_option(field_id: int, payload: CustomFieldOptionCreate, db: Session = Depends(get_db)):
    try:
        return create_option(db, field_id, payload)
    except CustomFieldNotFoundError as error:
        raise HTTPException(404, str(error)) from error
    except (CustomFieldRuleError, CustomFieldConflictError) as error:
        raise HTTPException(422, str(error)) from error


@router.patch("/options/{option_id}", response_model=CustomFieldOptionRead)
def patch_option(option_id: int, payload: CustomFieldOptionUpdate, db: Session = Depends(get_db)):
    try:
        return update_option(db, option_id, payload)
    except CustomFieldNotFoundError as error:
        raise HTTPException(404, str(error)) from error


def _category_field_read(assignment, field, source_id: int, inherited: bool) -> CategoryFieldRead:
    return CategoryFieldRead(id=assignment.id, category_id=assignment.category_id, field_definition_id=assignment.field_definition_id, is_required=assignment.is_required, inherit=assignment.inherit, is_visible=assignment.is_visible, sort_order=assignment.sort_order, default_value=_default_value(assignment, field), source_category_id=source_id, inherited=inherited)


@router.get("/categories/{category_id}/fields", response_model=list[CategoryFieldRead])
def read_category_fields(category_id: int, db: Session = Depends(get_db)):
    try:
        return [_category_field_read(assignment, field, source_id, inherited) for assignment, field, source_id, inherited in effective_fields(db, category_id)]
    except CustomFieldNotFoundError as error:
        raise HTTPException(404, str(error)) from error


@router.post("/categories/{category_id}/fields", response_model=CategoryFieldRead, status_code=status.HTTP_201_CREATED)
def add_category_field(category_id: int, payload: CategoryFieldCreate, db: Session = Depends(get_db)):
    try:
        assignment = assign_field(db, category_id, payload)
        field = get_definition(db, assignment.field_definition_id)
        return _category_field_read(assignment, field, category_id, False)
    except CustomFieldNotFoundError as error:
        raise HTTPException(404, str(error)) from error
    except (CustomFieldRuleError, CustomFieldConflictError) as error:
        raise HTTPException(422, str(error)) from error


@router.patch("/categories/{category_id}/fields/{field_id}", response_model=CategoryFieldRead)
def patch_category_field(category_id: int, field_id: int, payload: CategoryFieldUpdate, db: Session = Depends(get_db)):
    try:
        assignment = update_field_assignment(db, category_id, field_id, payload)
        return _category_field_read(assignment, get_definition(db, field_id), category_id, False)
    except CustomFieldNotFoundError as error:
        raise HTTPException(404, str(error)) from error
    except CustomFieldRuleError as error:
        raise HTTPException(422, str(error)) from error


@router.delete("/categories/{category_id}/fields/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category_field(category_id: int, field_id: int, db: Session = Depends(get_db)) -> None:
    try:
        remove_field(db, category_id, field_id)
    except CustomFieldNotFoundError as error:
        raise HTTPException(404, str(error)) from error


def _value_read(assignment, field, row, source_id, inherited) -> NomenclatureFieldValueRead:
    from app.services.custom_fields import _stored_value
    return NomenclatureFieldValueRead(field_definition_id=field.id, code=field.code, name=field.name, data_type=field.data_type, value=_stored_value(row, field) if row is not None else _default_value(assignment, field), is_required=assignment.is_required, inherited=inherited, source_category_id=source_id)


@router.get("/nomenclatures/{nomenclature_id}/fields", response_model=list[NomenclatureFieldValueRead])
def read_nomenclature_fields(nomenclature_id: int, db: Session = Depends(get_db)):
    try:
        return [_value_read(*item) for item in get_nomenclature_values(db, nomenclature_id)]
    except CustomFieldNotFoundError as error:
        raise HTTPException(404, str(error)) from error


@router.post("/nomenclatures/{nomenclature_id}/fields", response_model=list[NomenclatureFieldValueRead], status_code=status.HTTP_201_CREATED)
def add_nomenclature_field(nomenclature_id: int, payload: NomenclatureFieldAssignmentInput, db: Session = Depends(get_db)):
    try:
        return [_value_read(*item) for item in assign_nomenclature_field(db, nomenclature_id, payload)]
    except CustomFieldNotFoundError as error:
        raise HTTPException(404, str(error)) from error
    except CustomFieldConflictError as error:
        raise HTTPException(409, str(error)) from error
    except CustomFieldRuleError as error:
        raise HTTPException(422, str(error)) from error


@router.delete("/nomenclatures/{nomenclature_id}/fields/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_nomenclature_field(nomenclature_id: int, field_id: int, db: Session = Depends(get_db)) -> None:
    try:
        remove_nomenclature_field(db, nomenclature_id, field_id)
    except CustomFieldNotFoundError as error:
        raise HTTPException(404, str(error)) from error
    except CustomFieldRuleError as error:
        raise HTTPException(422, str(error)) from error


@router.put("/nomenclatures/{nomenclature_id}/fields", response_model=list[NomenclatureFieldValueRead])
def put_nomenclature_fields(nomenclature_id: int, payload: list[NomenclatureFieldValueInput], db: Session = Depends(get_db)):
    try:
        return [_value_read(*item) for item in save_nomenclature_values(db, nomenclature_id, payload)]
    except CustomFieldNotFoundError as error:
        raise HTTPException(404, str(error)) from error
    except CustomFieldRuleError as error:
        raise HTTPException(422, str(error)) from error
