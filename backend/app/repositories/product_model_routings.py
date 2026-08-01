from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload

from app.models.product_model import ProductModelOperationNorm, ProductModelRoutingLink


def list_links(
    db: Session,
    product_model_id: int,
    *,
    active_only: bool = False,
) -> list[ProductModelRoutingLink]:
    statement = (
        select(ProductModelRoutingLink)
        .where(ProductModelRoutingLink.product_model_id == product_model_id)
        .options(selectinload(ProductModelRoutingLink.operation_norms))
        .order_by(ProductModelRoutingLink.sort_order, ProductModelRoutingLink.id)
        .execution_options(populate_existing=True)
    )
    if active_only:
        statement = statement.where(ProductModelRoutingLink.is_active.is_(True))
    return list(db.scalars(statement).unique().all())


def get_link(db: Session, link_id: int) -> ProductModelRoutingLink | None:
    return db.scalars(
        select(ProductModelRoutingLink)
        .where(ProductModelRoutingLink.id == link_id)
        .options(selectinload(ProductModelRoutingLink.operation_norms))
        .execution_options(populate_existing=True)
    ).first()


def get_link_by_template(
    db: Session,
    product_model_id: int,
    shop_routing_template_id: int,
) -> ProductModelRoutingLink | None:
    return db.scalars(
        select(ProductModelRoutingLink)
        .where(
            ProductModelRoutingLink.product_model_id == product_model_id,
            ProductModelRoutingLink.shop_routing_template_id == shop_routing_template_id,
        )
        .options(selectinload(ProductModelRoutingLink.operation_norms))
        .execution_options(populate_existing=True)
    ).first()


def list_template_ids(
    db: Session,
    product_model_id: int,
    *,
    active_only: bool = False,
) -> set[int]:
    statement = select(ProductModelRoutingLink.shop_routing_template_id).where(
        ProductModelRoutingLink.product_model_id == product_model_id
    )
    if active_only:
        statement = statement.where(ProductModelRoutingLink.is_active.is_(True))
    return set(db.scalars(statement).all())


def next_link_sort_order(db: Session, product_model_id: int) -> int:
    current = db.scalar(
        select(func.max(ProductModelRoutingLink.sort_order)).where(
            ProductModelRoutingLink.product_model_id == product_model_id
        )
    )
    return int(current or -1) + 1


def add_link(db: Session, row: ProductModelRoutingLink) -> ProductModelRoutingLink:
    db.add(row)
    db.flush()
    return row


def delete_link(db: Session, row: ProductModelRoutingLink) -> None:
    db.delete(row)
    db.flush()


def replace_link_sort_orders(
    db: Session,
    product_model_id: int,
    ordered_ids: list[int],
) -> None:
    rows = {
        row.id: row
        for row in db.scalars(
            select(ProductModelRoutingLink).where(
                ProductModelRoutingLink.product_model_id == product_model_id
            )
        ).all()
    }
    for index, link_id in enumerate(ordered_ids):
        rows[link_id].sort_order = index
    db.flush()


def list_norms(db: Session, link_id: int) -> list[ProductModelOperationNorm]:
    return list(
        db.scalars(
            select(ProductModelOperationNorm)
            .where(ProductModelOperationNorm.product_model_routing_link_id == link_id)
            .order_by(ProductModelOperationNorm.id)
        ).all()
    )


def add_norm(db: Session, row: ProductModelOperationNorm) -> ProductModelOperationNorm:
    db.add(row)
    db.flush()
    return row


def delete_norms_for_link(db: Session, link_id: int) -> None:
    db.execute(
        delete(ProductModelOperationNorm).where(
            ProductModelOperationNorm.product_model_routing_link_id == link_id
        )
    )
    db.flush()
