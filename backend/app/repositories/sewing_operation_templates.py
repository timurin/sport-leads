from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.sewing_operation_template import (
    SewingOperationTemplate,
    SewingOperationTemplateLine,
)


def _with_lines():
    return selectinload(SewingOperationTemplate.lines).selectinload(
        SewingOperationTemplateLine.sewing_operation
    )


def list_templates(db: Session) -> list[SewingOperationTemplate]:
    statement = (
        select(SewingOperationTemplate)
        .options(_with_lines())
        .order_by(func.lower(SewingOperationTemplate.name), SewingOperationTemplate.id)
    )
    return list(db.scalars(statement).all())


def get_template(db: Session, template_id: int) -> SewingOperationTemplate | None:
    return db.scalars(
        select(SewingOperationTemplate)
        .options(_with_lines())
        .where(SewingOperationTemplate.id == template_id)
    ).first()


def get_template_by_name(
    db: Session, name: str, *, exclude_id: int | None = None
) -> SewingOperationTemplate | None:
    rows = list(db.scalars(select(SewingOperationTemplate)).all())
    needle = name.casefold()
    for row in rows:
        if exclude_id is not None and row.id == exclude_id:
            continue
        if row.name.casefold() == needle:
            return row
    return None


def add_template(db: Session, row: SewingOperationTemplate) -> SewingOperationTemplate:
    db.add(row)
    db.flush()
    return row


def delete_template(db: Session, row: SewingOperationTemplate) -> None:
    db.delete(row)
    db.flush()


def clear_template_lines(db: Session, template: SewingOperationTemplate) -> None:
    template.lines.clear()
    db.flush()


def add_template_line(
    db: Session, line: SewingOperationTemplateLine
) -> SewingOperationTemplateLine:
    db.add(line)
    db.flush()
    return line
