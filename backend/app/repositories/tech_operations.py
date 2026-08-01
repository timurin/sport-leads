from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.tech_operation import TechOperation, TechOperationRequiredMaterial


def list_tech_operations(
    db: Session,
    *,
    search: str | None = None,
    active_only: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> list[TechOperation]:
    statement = select(TechOperation).options(
        selectinload(TechOperation.required_materials).selectinload(
            TechOperationRequiredMaterial.nomenclature
        )
    )
    if active_only:
        statement = statement.where(TechOperation.is_active.is_(True))
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        statement = statement.where(
            TechOperation.name.ilike(pattern) | TechOperation.code.ilike(pattern)
        )
    statement = statement.order_by(
        TechOperation.sort_order,
        func.lower(TechOperation.name),
        TechOperation.id,
    ).offset(offset).limit(limit)
    return list(db.scalars(statement).all())


def get_tech_operation(db: Session, operation_id: int) -> TechOperation | None:
    return db.scalar(
        select(TechOperation)
        .where(TechOperation.id == operation_id)
        .options(
            selectinload(TechOperation.required_materials).selectinload(
                TechOperationRequiredMaterial.nomenclature
            )
        )
    )


def get_tech_operation_by_name(db: Session, name: str) -> TechOperation | None:
    return db.scalars(select(TechOperation).where(TechOperation.name == name)).first()


def get_tech_operation_by_code(db: Session, code: str) -> TechOperation | None:
    return db.scalars(select(TechOperation).where(TechOperation.code == code)).first()


def add_tech_operation(db: Session, row: TechOperation) -> TechOperation:
    db.add(row)
    db.flush()
    return row


def apply_tech_operation_updates(row: TechOperation, changes: dict) -> TechOperation:
    for field_name, value in changes.items():
        setattr(row, field_name, value)
    return row


def build_required_material(
    *,
    tech_operation: TechOperation,
    nomenclature_id: int,
    quantity,
) -> TechOperationRequiredMaterial:
    return TechOperationRequiredMaterial(
        tech_operation=tech_operation,
        nomenclature_id=nomenclature_id,
        quantity=quantity,
    )


def delete_tech_operation(db: Session, row: TechOperation) -> None:
    db.delete(row)
    db.flush()
