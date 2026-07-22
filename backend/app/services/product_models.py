from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.product_model import ProductModel, ProductModelSizeType, ProductModelStatus
from app.repositories import product_models as repo
from app.schemas.product_model import ProductModelCreate


class ProductModelNotFoundError(RuntimeError):
    pass


class ProductModelArticleConflictError(RuntimeError):
    pass


def list_product_models(
    db: Session,
    search: str | None = None,
    status: ProductModelStatus | None = None,
    size_type: ProductModelSizeType | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[ProductModel]:
    return repo.list_product_models(
        db,
        search=search,
        status=status,
        size_type=size_type,
        limit=limit,
        offset=offset,
    )


def get_product_model(db: Session, model_id: int) -> ProductModel:
    row = repo.get_product_model(db, model_id)
    if row is None:
        raise ProductModelNotFoundError("Модель изделия не найдена")
    return row


def create_product_model(db: Session, payload: ProductModelCreate) -> ProductModel:
    # Domain default: new models start as draft unless explicitly set on create.
    status = payload.status or ProductModelStatus.DRAFT
    if repo.get_product_model_by_article(db, payload.article) is not None:
        raise ProductModelArticleConflictError("Модель с таким артикулом уже существует")

    row = ProductModel(
        article=payload.article,
        name=payload.name,
        size_type=payload.size_type,
        description=payload.description,
        status=status,
    )
    try:
        repo.add_product_model(db, row)
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise ProductModelArticleConflictError("Модель с таким артикулом уже существует") from error
    db.refresh(row)
    return row
