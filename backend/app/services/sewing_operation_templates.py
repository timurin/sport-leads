from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.sewing_operation_template import (
    SewingOperationTemplate,
    SewingOperationTemplateLine,
)
from app.repositories import sewing_operation_templates as repo
from app.repositories import sewing_operations as ops_repo
from app.schemas.sewing_operation_template import (
    SewingOperationTemplateCreate,
    SewingOperationTemplateLineRead,
    SewingOperationTemplateRead,
    SewingOperationTemplateUpdate,
)


class SewingOperationTemplateNotFoundError(RuntimeError):
    pass


class SewingOperationTemplateConflictError(RuntimeError):
    pass


class SewingOperationTemplateValidationError(RuntimeError):
    pass


def _to_read(row: SewingOperationTemplate) -> SewingOperationTemplateRead:
    lines: list[SewingOperationTemplateLineRead] = []
    for line in sorted(row.lines, key=lambda item: (item.sequence, item.id)):
        op = line.sewing_operation
        lines.append(
            SewingOperationTemplateLineRead(
                id=line.id,
                sewing_operation_id=line.sewing_operation_id,
                sequence=line.sequence,
                operation_name=op.name if op is not None else None,
                description=op.description if op is not None else None,
            )
        )
    return SewingOperationTemplateRead(
        id=row.id,
        name=row.name,
        lines=lines,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def list_sewing_operation_templates(db: Session) -> list[SewingOperationTemplateRead]:
    return [_to_read(row) for row in repo.list_templates(db)]


def get_sewing_operation_template(
    db: Session, template_id: int
) -> SewingOperationTemplateRead:
    row = repo.get_template(db, template_id)
    if row is None:
        raise SewingOperationTemplateNotFoundError("Шаблон операций пошива не найден")
    return _to_read(row)


def _resolve_operation_ids(db: Session, operation_ids: list[int]) -> list[int]:
    if not operation_ids:
        return []
    if len(operation_ids) != len(set(operation_ids)):
        raise SewingOperationTemplateValidationError(
            "В шаблоне нельзя повторять одну и ту же операцию"
        )
    rows = ops_repo.get_sewing_operations_by_ids(db, operation_ids)
    by_id = {row.id: row for row in rows}
    missing = [item_id for item_id in operation_ids if item_id not in by_id]
    if missing:
        raise SewingOperationTemplateValidationError(
            "Операции пошива не найдены: "
            + ", ".join(str(item_id) for item_id in missing)
        )
    return operation_ids


def _replace_lines(
    db: Session, template: SewingOperationTemplate, operation_ids: list[int]
) -> None:
    ordered_ids = _resolve_operation_ids(db, operation_ids)
    # Detach existing lines explicitly (SQLite/StaticPool friendly).
    for existing in list(template.lines):
        db.delete(existing)
    db.flush()
    template.lines = [
        SewingOperationTemplateLine(
            sewing_operation_id=operation_id,
            sequence=index,
        )
        for index, operation_id in enumerate(ordered_ids, start=1)
    ]
    db.flush()


def create_sewing_operation_template(
    db: Session, payload: SewingOperationTemplateCreate
) -> SewingOperationTemplateRead:
    if repo.get_template_by_name(db, payload.name) is not None:
        raise SewingOperationTemplateConflictError(
            "Шаблон с таким наименованием уже существует"
        )
    row = SewingOperationTemplate(name=payload.name)
    try:
        repo.add_template(db, row)
        _replace_lines(db, row, payload.sewing_operation_ids)
        db.commit()
        return get_sewing_operation_template(db, row.id)
    except IntegrityError as error:
        db.rollback()
        raise SewingOperationTemplateConflictError(
            "Шаблон с таким наименованием уже существует"
        ) from error


def update_sewing_operation_template(
    db: Session,
    template_id: int,
    payload: SewingOperationTemplateUpdate,
) -> SewingOperationTemplateRead:
    row = repo.get_template(db, template_id)
    if row is None:
        raise SewingOperationTemplateNotFoundError("Шаблон операций пошива не найден")
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise SewingOperationTemplateValidationError("Нет полей для обновления")

    if "name" in changes and changes["name"] is not None:
        existing = repo.get_template_by_name(
            db, changes["name"], exclude_id=template_id
        )
        if existing is not None:
            raise SewingOperationTemplateConflictError(
                "Шаблон с таким наименованием уже существует"
            )
        row.name = changes["name"]

    if "sewing_operation_ids" in changes and changes["sewing_operation_ids"] is not None:
        _replace_lines(db, row, changes["sewing_operation_ids"])

    try:
        db.commit()
        return get_sewing_operation_template(db, template_id)
    except IntegrityError as error:
        db.rollback()
        raise SewingOperationTemplateConflictError(
            "Шаблон с таким наименованием уже существует"
        ) from error


def replace_sewing_operation_template_lines(
    db: Session, template_id: int, sewing_operation_ids: list[int]
) -> SewingOperationTemplateRead:
    row = repo.get_template(db, template_id)
    if row is None:
        raise SewingOperationTemplateNotFoundError("Шаблон операций пошива не найден")
    _replace_lines(db, row, sewing_operation_ids)
    db.commit()
    return get_sewing_operation_template(db, template_id)


def delete_sewing_operation_template(db: Session, template_id: int) -> None:
    row = repo.get_template(db, template_id)
    if row is None:
        raise SewingOperationTemplateNotFoundError("Шаблон операций пошива не найден")
    repo.delete_template(db, row)
    db.commit()
