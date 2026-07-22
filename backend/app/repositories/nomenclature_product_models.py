from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.product_model import NomenclatureProductModel, ProductModel


def list_links_for_nomenclature(
    db: Session,
    nomenclature_id: int,
) -> list[tuple[NomenclatureProductModel, ProductModel]]:
    statement = (
        select(NomenclatureProductModel, ProductModel)
        .join(
            ProductModel,
            ProductModel.id == NomenclatureProductModel.product_model_id,
        )
        .where(NomenclatureProductModel.nomenclature_id == nomenclature_id)
        .order_by(
            NomenclatureProductModel.sort_order,
            NomenclatureProductModel.id,
        )
    )
    return list(db.execute(statement).all())


def get_link(
    db: Session,
    nomenclature_id: int,
    product_model_id: int,
) -> NomenclatureProductModel | None:
    return db.scalars(
        select(NomenclatureProductModel).where(
            NomenclatureProductModel.nomenclature_id == nomenclature_id,
            NomenclatureProductModel.product_model_id == product_model_id,
        )
    ).first()


def get_link_by_id(
    db: Session,
    link_id: int,
) -> NomenclatureProductModel | None:
    return db.get(NomenclatureProductModel, link_id)


def next_sort_order(db: Session, nomenclature_id: int) -> int:
    current = db.scalar(
        select(func.max(NomenclatureProductModel.sort_order)).where(
            NomenclatureProductModel.nomenclature_id == nomenclature_id
        )
    )
    return 0 if current is None else int(current) + 1


def add_link(
    db: Session,
    *,
    nomenclature_id: int,
    product_model_id: int,
    sort_order: int,
) -> NomenclatureProductModel:
    row = NomenclatureProductModel(
        nomenclature_id=nomenclature_id,
        product_model_id=product_model_id,
        sort_order=sort_order,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def delete_link(db: Session, row: NomenclatureProductModel) -> None:
    db.delete(row)
    db.commit()


def replace_sort_orders(
    db: Session,
    nomenclature_id: int,
    ordered_model_ids: list[int],
) -> list[NomenclatureProductModel]:
    links = list(
        db.scalars(
            select(NomenclatureProductModel).where(
                NomenclatureProductModel.nomenclature_id == nomenclature_id
            )
        ).all()
    )
    by_model = {link.product_model_id: link for link in links}
    for index, model_id in enumerate(ordered_model_ids):
        link = by_model.get(model_id)
        if link is None:
            continue
        link.sort_order = index
    db.commit()
    for link in links:
        db.refresh(link)
    return sorted(links, key=lambda item: (item.sort_order, item.id))
