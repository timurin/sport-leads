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
    return sum(
        (
            line.cost * Decimal(line.quantity_per_item)
            for line in variant.operation_lines
        ),
        Decimal("0"),
    )


def assembly_cost_ranges_by_model_ids(
    db: Session,
    model_ids: list[int],
) -> dict[int, tuple[Decimal, Decimal]]:
    """Min/max variant totals (Σ cost × qty) keyed by product_model_id."""
    if not model_ids:
        return {}
    unique_ids = list(dict.fromkeys(model_ids))
    line_total = AssemblyOperationLine.cost * AssemblyOperationLine.quantity_per_item
    variant_totals = (
        select(
            AssemblyVariant.product_model_id.label("product_model_id"),
            AssemblyVariant.id.label("variant_id"),
            func.coalesce(func.sum(line_total), 0).label("total_cost"),
        )
        .outerjoin(
            AssemblyOperationLine,
            AssemblyOperationLine.assembly_variant_id == AssemblyVariant.id,
        )
        .where(AssemblyVariant.product_model_id.in_(unique_ids))
        .group_by(AssemblyVariant.product_model_id, AssemblyVariant.id)
        .subquery()
    )
    statement = select(
        variant_totals.c.product_model_id,
        func.min(variant_totals.c.total_cost),
        func.max(variant_totals.c.total_cost),
    ).group_by(variant_totals.c.product_model_id)
    result: dict[int, tuple[Decimal, Decimal]] = {}
    for model_id, cost_min, cost_max in db.execute(statement).all():
        result[int(model_id)] = (Decimal(str(cost_min)), Decimal(str(cost_max)))
    return result
