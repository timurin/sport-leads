"""ProductionStage service (Stage 8.3)."""

from __future__ import annotations

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.production_stage import ProductionStage
from app.repositories import production_stages as repo
from app.schemas.production_stage import ProductionStageCreate, ProductionStageUpdate


class ProductionStageNotFoundError(RuntimeError):
    pass


class ProductionStageConflictError(RuntimeError):
    pass


class ProductionStageValidationError(RuntimeError):
    pass


def list_production_stages(
    db: Session,
    search: str | None = None,
    active_only: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> list[ProductionStage]:
    return repo.list_production_stages(
        db, search=search, active_only=active_only, limit=limit, offset=offset
    )


def get_production_stage(db: Session, stage_id: int) -> ProductionStage:
    row = repo.get_production_stage(db, stage_id)
    if row is None:
        raise ProductionStageNotFoundError("Этап производства не найден")
    return row


def create_production_stage(
    db: Session, payload: ProductionStageCreate
) -> ProductionStage:
    if repo.get_production_stage_by_name(db, payload.name) is not None:
        raise ProductionStageConflictError("Этап с таким наименованием уже существует")
    if repo.get_production_stage_by_code(db, payload.code) is not None:
        raise ProductionStageConflictError("Этап с таким кодом уже существует")
    row = ProductionStage(
        name=payload.name,
        code=payload.code,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
    )
    try:
        repo.add_production_stage(db, row)
        db.commit()
        db.refresh(row)
        return row
    except IntegrityError as error:
        db.rollback()
        raise ProductionStageConflictError(
            "Этап с таким наименованием или кодом уже существует"
        ) from error


def update_production_stage(
    db: Session, stage_id: int, payload: ProductionStageUpdate
) -> ProductionStage:
    row = get_production_stage(db, stage_id)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise ProductionStageValidationError("Нет полей для обновления")
    if "name" in changes:
        existing = repo.get_production_stage_by_name(db, changes["name"])
        if existing is not None and existing.id != stage_id:
            raise ProductionStageConflictError(
                "Этап с таким наименованием уже существует"
            )
    if "code" in changes:
        existing = repo.get_production_stage_by_code(db, changes["code"])
        if existing is not None and existing.id != stage_id:
            raise ProductionStageConflictError("Этап с таким кодом уже существует")
    repo.apply_production_stage_updates(row, changes)
    try:
        db.commit()
        db.refresh(row)
        return row
    except IntegrityError as error:
        db.rollback()
        raise ProductionStageConflictError(
            "Этап с таким наименованием или кодом уже существует"
        ) from error


def delete_production_stage(db: Session, stage_id: int) -> None:
    row = get_production_stage(db, stage_id)
    try:
        repo.delete_production_stage(db, row)
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise ProductionStageConflictError(
            "Нельзя удалить этап: есть связанные маршруты или операции"
        ) from error
