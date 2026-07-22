from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.product_model import ProductModel, ProductModelSizeType, ProductModelStatus


def list_product_models(
    db: Session,
    *,
    search: str | None = None,
    status: ProductModelStatus | None = None,
    size_type: ProductModelSizeType | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[ProductModel]:
    statement = select(ProductModel)
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        statement = statement.where(
            or_(
                ProductModel.article.ilike(pattern),
                ProductModel.name.ilike(pattern),
            )
        )
    if status is not None:
        statement = statement.where(ProductModel.status == status)
    if size_type is not None:
        statement = statement.where(ProductModel.size_type == size_type)
    statement = statement.order_by(
        func.lower(ProductModel.article),
        ProductModel.id,
    ).offset(offset).limit(limit)
    return list(db.scalars(statement).all())


def get_product_model(db: Session, model_id: int) -> ProductModel | None:
    return db.get(ProductModel, model_id)


def get_product_model_by_article(db: Session, article: str) -> ProductModel | None:
    return db.scalars(
        select(ProductModel).where(ProductModel.article == article)
    ).first()


def add_product_model(db: Session, row: ProductModel) -> ProductModel:
    db.add(row)
    db.flush()
    return row
