from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.product_model import AssemblyOperationLine, AssemblyVariant


def list_variants(
    db: Session,
    product_model_id: int,
    *,
    active_only: bool = False,
) -> list[AssemblyVariant]:
    statement = (
        select(AssemblyVariant)
        .where(AssemblyVariant.product_model_id == product_model_id)
        .options(selectinload(AssemblyVariant.operation_lines))
        .order_by(AssemblyVariant.sort_order, AssemblyVariant.id)
        .execution_options(populate_existing=True)
    )
    if active_only:
        statement = statement.where(AssemblyVariant.is_active.is_(True))
    return list(db.scalars(statement).unique().all())


def get_variant(db: Session, variant_id: int) -> AssemblyVariant | None:
    return db.scalars(
        select(AssemblyVariant)
        .where(AssemblyVariant.id == variant_id)
        .options(selectinload(AssemblyVariant.operation_lines))
        .execution_options(populate_existing=True)
    ).first()


def get_variant_by_name(
    db: Session,
    product_model_id: int,
    name: str,
) -> AssemblyVariant | None:
    return db.scalars(
        select(AssemblyVariant).where(
            AssemblyVariant.product_model_id == product_model_id,
            AssemblyVariant.name == name,
        )
    ).first()


def next_variant_sort_order(db: Session, product_model_id: int) -> int:
    current = db.scalar(
        select(func.max(AssemblyVariant.sort_order)).where(
            AssemblyVariant.product_model_id == product_model_id
        )
    )
    return int(current or -1) + 1


def add_variant(db: Session, row: AssemblyVariant) -> AssemblyVariant:
    db.add(row)
    db.flush()
    return row


def delete_variant(db: Session, row: AssemblyVariant) -> None:
    db.delete(row)
    db.commit()


def replace_variant_sort_orders(
    db: Session,
    product_model_id: int,
    ordered_ids: list[int],
) -> None:
    rows = {
        row.id: row
        for row in db.scalars(
            select(AssemblyVariant).where(AssemblyVariant.product_model_id == product_model_id)
        ).all()
    }
    for index, variant_id in enumerate(ordered_ids):
        rows[variant_id].sort_order = index
    db.commit()


def next_line_sequence(db: Session, assembly_variant_id: int) -> int:
    current = db.scalar(
        select(func.max(AssemblyOperationLine.sequence)).where(
            AssemblyOperationLine.assembly_variant_id == assembly_variant_id
        )
    )
    return int(current or 0) + 1


def get_operation_line(db: Session, line_id: int) -> AssemblyOperationLine | None:
    return db.get(AssemblyOperationLine, line_id)


def add_operation_line(db: Session, row: AssemblyOperationLine) -> AssemblyOperationLine:
    db.add(row)
    db.flush()
    return row


def delete_operation_line(db: Session, row: AssemblyOperationLine) -> None:
    db.delete(row)
    db.commit()


def replace_line_sequences(
    db: Session,
    assembly_variant_id: int,
    ordered_ids: list[int],
) -> None:
    rows = {
        row.id: row
        for row in db.scalars(
            select(AssemblyOperationLine).where(
                AssemblyOperationLine.assembly_variant_id == assembly_variant_id
            )
        ).all()
    }
    # Two-phase assign to avoid unique (variant, sequence) collisions while reordering.
    for offset, line_id in enumerate(ordered_ids):
        rows[line_id].sequence = 10_000 + offset
    db.flush()
    for index, line_id in enumerate(ordered_ids, start=1):
        rows[line_id].sequence = index
    db.commit()


def variant_total_cost(variant: AssemblyVariant) -> Decimal:
    return sum((line.cost for line in variant.operation_lines), Decimal("0"))
