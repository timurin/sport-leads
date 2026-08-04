from __future__ import annotations

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.auth import PlatformUser
from app.models.size_grid import SizeGrid, SizeGridRow, SizeGridSizeType
from app.repositories import size_grids as repo
from app.schemas.size_grid import (
    SizeGridCreate,
    SizeGridListItem,
    SizeGridRead,
    SizeGridRowUpdate,
    SizeGridRowWrite,
    SizeGridUpdate,
)
from app.services import audit as audit_service


class SizeGridNotFoundError(Exception):
    pass


class SizeGridConflictError(Exception):
    pass


class SizeGridValidationError(Exception):
    pass


def list_size_grids(
    db: Session,
    *,
    size_type: SizeGridSizeType | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[SizeGridListItem]:
    rows = repo.list_size_grids(db, size_type=size_type, limit=limit, offset=offset)
    return [
        SizeGridListItem(
            id=grid.id,
            name=grid.name,
            size_type=grid.size_type,
            source_note=grid.source_note,
            row_count=int(count or 0),
            created_at=grid.created_at,
            updated_at=grid.updated_at,
        )
        for grid, count in rows
    ]


def get_size_grid(db: Session, grid_id: int) -> SizeGridRead:
    grid = repo.get_size_grid(db, grid_id)
    if grid is None:
        raise SizeGridNotFoundError(f"Size grid {grid_id} not found")
    return SizeGridRead.model_validate(grid)


def _row_from_write(
    payload: SizeGridRowWrite, *, size_grid_id: int | None = None
) -> SizeGridRow:
    row = SizeGridRow(
        sort_order=payload.sort_order,
        ru_size=payload.ru_size,
        int_label=payload.int_label,
        chest=payload.chest,
        waist=payload.waist,
        hip=payload.hip,
        height_s=payload.height_s,
        height_n=payload.height_n,
        height_t=payload.height_t,
    )
    if size_grid_id is not None:
        row.size_grid_id = size_grid_id
    return row


def create_size_grid(
    db: Session,
    payload: SizeGridCreate,
    *,
    actor: PlatformUser | None = None,
) -> SizeGridRead:
    if repo.get_size_grid_by_name(db, payload.name) is not None:
        raise SizeGridConflictError("Размерная сетка с таким наименованием уже существует")

    grid = SizeGrid(
        name=payload.name,
        size_type=payload.size_type,
        source_note=payload.source_note,
        rows=[_row_from_write(row) for row in payload.rows],
    )
    try:
        repo.add_size_grid(db, grid)
        db.flush()
        if actor is not None:
            audit_service.append_audit_event(
                db,
                actor=actor,
                action=audit_service.ACTION_SIZE_GRID_CREATE,
                entity_type="size_grid",
                entity_id=grid.id,
                payload={"name": grid.name, "size_type": str(grid.size_type)},
            )
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise SizeGridConflictError("Не удалось создать размерную сетку") from error

    db.expire_all()
    return get_size_grid(db, grid.id)


def update_size_grid(
    db: Session,
    grid_id: int,
    payload: SizeGridUpdate,
    *,
    actor: PlatformUser | None = None,
) -> SizeGridRead:
    grid = repo.get_size_grid(db, grid_id)
    if grid is None:
        raise SizeGridNotFoundError(f"Size grid {grid_id} not found")

    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise SizeGridValidationError("Нет полей для обновления")

    if "name" in changes:
        existing = repo.get_size_grid_by_name(db, changes["name"])
        if existing is not None and existing.id != grid_id:
            raise SizeGridConflictError(
                "Размерная сетка с таким наименованием уже существует"
            )
        grid.name = changes["name"]

    if "source_note" in changes:
        grid.source_note = changes["source_note"]

    try:
        if actor is not None:
            audit_service.append_audit_event(
                db,
                actor=actor,
                action=audit_service.ACTION_SIZE_GRID_UPDATE,
                entity_type="size_grid",
                entity_id=grid_id,
                payload={"fields": sorted(changes.keys())},
            )
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise SizeGridConflictError("Не удалось обновить размерную сетку") from error

    db.expire_all()
    return get_size_grid(db, grid_id)


def delete_size_grid(
    db: Session,
    grid_id: int,
    *,
    actor: PlatformUser | None = None,
) -> None:
    grid = repo.get_size_grid(db, grid_id)
    if grid is None:
        raise SizeGridNotFoundError(f"Size grid {grid_id} not found")
    linked = repo.count_product_models_for_grid(db, grid_id)
    if linked > 0:
        raise SizeGridConflictError(
            "Нельзя удалить сетку: она привязана к моделям изделий"
        )
    try:
        if actor is not None:
            audit_service.append_audit_event(
                db,
                actor=actor,
                action=audit_service.ACTION_SIZE_GRID_DELETE,
                entity_type="size_grid",
                entity_id=grid_id,
                payload={"name": grid.name},
            )
        repo.delete_size_grid(db, grid)
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise SizeGridConflictError("Нельзя удалить размерную сетку") from error


def create_size_grid_row(
    db: Session,
    grid_id: int,
    payload: SizeGridRowWrite,
    *,
    actor: PlatformUser | None = None,
) -> SizeGridRead:
    grid = repo.get_size_grid(db, grid_id)
    if grid is None:
        raise SizeGridNotFoundError(f"Size grid {grid_id} not found")
    row = _row_from_write(payload, size_grid_id=grid_id)
    try:
        repo.add_size_grid_row(db, row)
        db.flush()
        if actor is not None:
            audit_service.append_audit_event(
                db,
                actor=actor,
                action=audit_service.ACTION_SIZE_GRID_ROW_CREATE,
                entity_type="size_grid_row",
                entity_id=row.id,
                payload={
                    "size_grid_id": grid_id,
                    "ru_size": row.ru_size,
                    "int_label": row.int_label,
                },
            )
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise SizeGridConflictError(
            "Строка с такой парой RU/INT уже есть в этой сетке"
        ) from error
    db.expire_all()
    return get_size_grid(db, grid_id)


def update_size_grid_row(
    db: Session,
    grid_id: int,
    row_id: int,
    payload: SizeGridRowUpdate,
    *,
    actor: PlatformUser | None = None,
) -> SizeGridRead:
    grid = repo.get_size_grid(db, grid_id)
    if grid is None:
        raise SizeGridNotFoundError(f"Size grid {grid_id} not found")
    row = repo.get_size_grid_row(db, row_id)
    if row is None or row.size_grid_id != grid_id:
        raise SizeGridNotFoundError(f"Size grid row {row_id} not found")

    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise SizeGridValidationError("Нет полей для обновления")

    for key, value in changes.items():
        setattr(row, key, value)

    try:
        if actor is not None:
            audit_service.append_audit_event(
                db,
                actor=actor,
                action=audit_service.ACTION_SIZE_GRID_ROW_UPDATE,
                entity_type="size_grid_row",
                entity_id=row_id,
                payload={
                    "size_grid_id": grid_id,
                    "fields": sorted(changes.keys()),
                },
            )
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise SizeGridConflictError(
            "Строка с такой парой RU/INT уже есть в этой сетке"
        ) from error
    db.expire_all()
    return get_size_grid(db, grid_id)


def delete_size_grid_row(
    db: Session,
    grid_id: int,
    row_id: int,
    *,
    actor: PlatformUser | None = None,
) -> SizeGridRead:
    grid = repo.get_size_grid(db, grid_id)
    if grid is None:
        raise SizeGridNotFoundError(f"Size grid {grid_id} not found")
    row = repo.get_size_grid_row(db, row_id)
    if row is None or row.size_grid_id != grid_id:
        raise SizeGridNotFoundError(f"Size grid row {row_id} not found")
    if actor is not None:
        audit_service.append_audit_event(
            db,
            actor=actor,
            action=audit_service.ACTION_SIZE_GRID_ROW_DELETE,
            entity_type="size_grid_row",
            entity_id=row_id,
            payload={"size_grid_id": grid_id},
        )
    repo.delete_size_grid_row(db, row)
    db.commit()
    db.expire_all()
    return get_size_grid(db, grid_id)
