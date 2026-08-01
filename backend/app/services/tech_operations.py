from decimal import Decimal

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.nomenclature import Nomenclature, NomenclatureType
from app.models.tech_operation import TechOperation
from app.repositories import tech_operations as repo
from app.schemas.tech_operation import (
    TechOperationCreate,
    TechOperationRead,
    TechOperationRequiredMaterialWrite,
    TechOperationUpdate,
)


class TechOperationNotFoundError(RuntimeError):
    pass


class TechOperationConflictError(RuntimeError):
    pass


class TechOperationValidationError(RuntimeError):
    pass


def _validate_required_materials(
    db: Session, items: list[TechOperationRequiredMaterialWrite]
) -> list[tuple[Nomenclature, Decimal]]:
    seen_ids: set[int] = set()
    resolved: list[tuple[Nomenclature, Decimal]] = []
    for item in items:
        if item.nomenclature_id in seen_ids:
            raise TechOperationValidationError("Материал не должен повторяться в одной операции")
        seen_ids.add(item.nomenclature_id)
        nomenclature = db.get(Nomenclature, item.nomenclature_id)
        if nomenclature is None:
            raise TechOperationValidationError("Материал не найден")
        if nomenclature.nomenclature_type != NomenclatureType.MATERIAL:
            raise TechOperationValidationError("В required materials допустимы только MATERIAL")
        resolved.append((nomenclature, Decimal(item.quantity)))
    return resolved


def _replace_required_materials(
    row: TechOperation,
    items: list[TechOperationRequiredMaterialWrite],
    *,
    validated: list[tuple[Nomenclature, Decimal]],
) -> None:
    by_id = {material.nomenclature_id: material for material in row.required_materials}
    keep_ids = {item.nomenclature_id for item in items}

    for material in list(row.required_materials):
        if material.nomenclature_id not in keep_ids:
            row.required_materials.remove(material)

    for nomenclature, quantity in validated:
        existing = by_id.get(nomenclature.id)
        if existing is None:
            row.required_materials.append(
                repo.build_required_material(
                    tech_operation=row,
                    nomenclature_id=nomenclature.id,
                    quantity=quantity,
                )
            )
            continue
        existing.quantity = quantity


def _to_read(row: TechOperation) -> TechOperationRead:
    return TechOperationRead.model_validate(
        {
            "id": row.id,
            "name": row.name,
            "code": row.code,
            "volume_unit": row.volume_unit,
            "production_stage_id": row.production_stage_id,
            "is_active": row.is_active,
            "sort_order": row.sort_order,
            "required_materials": [
                {
                    "id": material.id,
                    "tech_operation_id": material.tech_operation_id,
                    "nomenclature_id": material.nomenclature_id,
                    "nomenclature_name": getattr(material.nomenclature, "name", None),
                    "unit": getattr(material.nomenclature, "unit", None),
                    "quantity": material.quantity,
                    "created_at": material.created_at,
                    "updated_at": material.updated_at,
                }
                for material in row.required_materials
            ],
            "created_at": row.created_at,
            "updated_at": row.updated_at,
        }
    )


def list_tech_operations(
    db: Session,
    search: str | None = None,
    active_only: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> list[TechOperationRead]:
    return [
        _to_read(row)
        for row in repo.list_tech_operations(
            db,
            search=search,
            active_only=active_only,
            limit=limit,
            offset=offset,
        )
    ]


def get_tech_operation(db: Session, operation_id: int) -> TechOperationRead:
    row = repo.get_tech_operation(db, operation_id)
    if row is None:
        raise TechOperationNotFoundError("Тех операция не найдена")
    return _to_read(row)


def create_tech_operation(db: Session, payload: TechOperationCreate) -> TechOperationRead:
    if repo.get_tech_operation_by_name(db, payload.name) is not None:
        raise TechOperationConflictError("Тех операция с таким наименованием уже существует")
    if repo.get_tech_operation_by_code(db, payload.code) is not None:
        raise TechOperationConflictError("Тех операция с таким кодом уже существует")

    if payload.production_stage_id is not None:
        from app.repositories import production_stages as stages_repo

        if stages_repo.get_production_stage(db, payload.production_stage_id) is None:
            raise TechOperationValidationError("Этап производства не найден")

    validated_materials = _validate_required_materials(db, payload.required_materials)
    row = TechOperation(
        name=payload.name,
        code=payload.code,
        volume_unit=payload.volume_unit.value,
        production_stage_id=payload.production_stage_id,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
    )
    _replace_required_materials(
        row,
        payload.required_materials,
        validated=validated_materials,
    )
    try:
        repo.add_tech_operation(db, row)
        db.commit()
        db.refresh(row)
        return _to_read(repo.get_tech_operation(db, row.id) or row)
    except IntegrityError as error:
        db.rollback()
        raise TechOperationConflictError(
            "Тех операция с таким наименованием или кодом уже существует"
        ) from error


def update_tech_operation(
    db: Session,
    operation_id: int,
    payload: TechOperationUpdate,
) -> TechOperationRead:
    row = repo.get_tech_operation(db, operation_id)
    if row is None:
        raise TechOperationNotFoundError("Тех операция не найдена")
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise TechOperationValidationError("Нет полей для обновления")

    if "name" in changes:
        existing = repo.get_tech_operation_by_name(db, changes["name"])
        if existing is not None and existing.id != operation_id:
            raise TechOperationConflictError(
                "Тех операция с таким наименованием уже существует"
            )
    if "code" in changes:
        existing = repo.get_tech_operation_by_code(db, changes["code"])
        if existing is not None and existing.id != operation_id:
            raise TechOperationConflictError("Тех операция с таким кодом уже существует")
    if "volume_unit" in changes and changes["volume_unit"] is not None:
        unit = changes["volume_unit"]
        changes["volume_unit"] = unit.value if hasattr(unit, "value") else unit
    if "production_stage_id" in changes and changes["production_stage_id"] is not None:
        from app.repositories import production_stages as stages_repo

        if stages_repo.get_production_stage(db, changes["production_stage_id"]) is None:
            raise TechOperationValidationError("Этап производства не найден")
    validated_materials: list[tuple[Nomenclature, Decimal]] | None = None
    if "required_materials" in changes and changes["required_materials"] is not None:
        validated_materials = _validate_required_materials(db, payload.required_materials or [])

    repo.apply_tech_operation_updates(
        row, {key: value for key, value in changes.items() if key != "required_materials"}
    )
    if validated_materials is not None:
        _replace_required_materials(
            row,
            payload.required_materials or [],
            validated=validated_materials,
        )
    try:
        db.commit()
        db.refresh(row)
        return _to_read(repo.get_tech_operation(db, row.id) or row)
    except IntegrityError as error:
        db.rollback()
        raise TechOperationConflictError(
            "Тех операция с таким наименованием или кодом уже существует"
        ) from error


def delete_tech_operation(db: Session, operation_id: int) -> None:
    row = repo.get_tech_operation(db, operation_id)
    if row is None:
        raise TechOperationNotFoundError("Тех операция не найдена")
    try:
        repo.delete_tech_operation(db, row)
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise TechOperationConflictError(
            "Нельзя удалить тех операцию: она используется в маршрутах"
        ) from error
