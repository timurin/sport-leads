from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.models.product_model import (
    ProductModel,
    ProductModelFolder,
    ProductModelHistoryEntry,
    ProductModelMedia,
    ProductModelSizeType,
    ProductModelStatus,
    ProductModelVersion,
    ProductModelVersionState,
)


def list_product_models(
    db: Session,
    *,
    search: str | None = None,
    status: ProductModelStatus | None = None,
    size_type: ProductModelSizeType | None = None,
    product_type_id: int | None = None,
    folder_id: int | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[ProductModel]:
    statement = select(ProductModel).options(joinedload(ProductModel.product_type))
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
    if product_type_id is not None:
        statement = statement.where(ProductModel.product_type_id == product_type_id)
    if folder_id is not None:
        statement = statement.where(ProductModel.folder_id == folder_id)
    statement = statement.order_by(
        ProductModel.sort_order,
        func.lower(ProductModel.article),
        ProductModel.id,
    ).offset(offset).limit(limit)
    return list(db.scalars(statement).unique().all())


def get_product_model(db: Session, model_id: int) -> ProductModel | None:
    return db.get(ProductModel, model_id)


def get_product_model_by_article(db: Session, article: str) -> ProductModel | None:
    return db.scalars(
        select(ProductModel).where(ProductModel.article == article)
    ).first()


def next_model_sort_order(db: Session, folder_id: int | None) -> int:
    statement = select(func.coalesce(func.max(ProductModel.sort_order), -1) + 1)
    if folder_id is None:
        statement = statement.where(ProductModel.folder_id.is_(None))
    else:
        statement = statement.where(ProductModel.folder_id == folder_id)
    return int(db.scalar(statement) or 0)


def add_product_model(db: Session, row: ProductModel) -> ProductModel:
    db.add(row)
    db.flush()
    return row


def apply_product_model_updates(row: ProductModel, changes: dict) -> ProductModel:
    for field_name, value in changes.items():
        setattr(row, field_name, value)
    return row


def list_product_model_folders(db: Session) -> list[ProductModelFolder]:
    statement = select(ProductModelFolder).order_by(
        ProductModelFolder.sort_order,
        func.lower(ProductModelFolder.name),
        ProductModelFolder.id,
    )
    return list(db.scalars(statement).all())


def get_product_model_folder(db: Session, folder_id: int) -> ProductModelFolder | None:
    return db.get(ProductModelFolder, folder_id)


def find_sibling_folder_by_name(
    db: Session,
    *,
    parent_id: int | None,
    name: str,
    exclude_id: int | None = None,
) -> ProductModelFolder | None:
    siblings = list_sibling_folders(db, parent_id)
    needle = name.casefold()
    for sibling in siblings:
        if exclude_id is not None and sibling.id == exclude_id:
            continue
        if sibling.name.casefold() == needle:
            return sibling
    return None


def next_folder_sort_order(db: Session, parent_id: int | None) -> int:
    statement = select(func.coalesce(func.max(ProductModelFolder.sort_order), -1) + 1)
    if parent_id is None:
        statement = statement.where(ProductModelFolder.parent_id.is_(None))
    else:
        statement = statement.where(ProductModelFolder.parent_id == parent_id)
    return int(db.scalar(statement) or 0)


def count_folder_children(db: Session, folder_id: int) -> int:
    folders = db.scalar(
        select(func.count())
        .select_from(ProductModelFolder)
        .where(ProductModelFolder.parent_id == folder_id)
    )
    models = db.scalar(
        select(func.count())
        .select_from(ProductModel)
        .where(ProductModel.folder_id == folder_id)
    )
    return int(folders or 0) + int(models or 0)


def add_product_model_folder(db: Session, row: ProductModelFolder) -> ProductModelFolder:
    db.add(row)
    db.flush()
    return row


def delete_product_model_folder(db: Session, row: ProductModelFolder) -> None:
    db.delete(row)
    db.flush()


def list_sibling_folders(
    db: Session, parent_id: int | None
) -> list[ProductModelFolder]:
    statement = select(ProductModelFolder)
    if parent_id is None:
        statement = statement.where(ProductModelFolder.parent_id.is_(None))
    else:
        statement = statement.where(ProductModelFolder.parent_id == parent_id)
    statement = statement.order_by(
        ProductModelFolder.sort_order,
        func.lower(ProductModelFolder.name),
        ProductModelFolder.id,
    )
    return list(db.scalars(statement).all())


def list_sibling_models(db: Session, folder_id: int | None) -> list[ProductModel]:
    statement = select(ProductModel)
    if folder_id is None:
        statement = statement.where(ProductModel.folder_id.is_(None))
    else:
        statement = statement.where(ProductModel.folder_id == folder_id)
    statement = statement.order_by(
        ProductModel.sort_order,
        func.lower(ProductModel.article),
        ProductModel.id,
    )
    return list(db.scalars(statement).all())


def list_product_model_versions(db: Session, product_model_id: int) -> list[ProductModelVersion]:
    statement = (
        select(ProductModelVersion)
        .where(ProductModelVersion.product_model_id == product_model_id)
        .order_by(ProductModelVersion.version_number.desc(), ProductModelVersion.id.desc())
    )
    return list(db.scalars(statement).all())


def get_product_model_version(db: Session, version_id: int) -> ProductModelVersion | None:
    return db.get(ProductModelVersion, version_id)


def get_published_version(db: Session, product_model_id: int) -> ProductModelVersion | None:
    return db.scalars(
        select(ProductModelVersion).where(
            ProductModelVersion.product_model_id == product_model_id,
            ProductModelVersion.state == ProductModelVersionState.PUBLISHED,
        )
    ).first()


def next_version_number(db: Session, product_model_id: int) -> int:
    current = db.scalar(
        select(func.max(ProductModelVersion.version_number)).where(
            ProductModelVersion.product_model_id == product_model_id
        )
    )
    return int(current or 0) + 1


def add_product_model_version(db: Session, row: ProductModelVersion) -> ProductModelVersion:
    db.add(row)
    db.flush()
    return row


def list_product_model_media(db: Session, product_model_id: int) -> list[ProductModelMedia]:
    statement = (
        select(ProductModelMedia)
        .where(ProductModelMedia.product_model_id == product_model_id)
        .order_by(ProductModelMedia.sort_order, ProductModelMedia.id)
    )
    return list(db.scalars(statement).all())


def get_product_model_media(db: Session, media_id: int) -> ProductModelMedia | None:
    return db.get(ProductModelMedia, media_id)


def get_primary_media(db: Session, product_model_id: int) -> ProductModelMedia | None:
    return db.scalars(
        select(ProductModelMedia).where(
            ProductModelMedia.product_model_id == product_model_id,
            ProductModelMedia.is_primary.is_(True),
        )
    ).first()


def next_media_sort_order(db: Session, product_model_id: int) -> int:
    current = db.scalar(
        select(func.max(ProductModelMedia.sort_order)).where(
            ProductModelMedia.product_model_id == product_model_id
        )
    )
    return int(current or -1) + 1


def add_product_model_media(db: Session, row: ProductModelMedia) -> ProductModelMedia:
    db.add(row)
    db.flush()
    return row


def list_product_model_history(
    db: Session, product_model_id: int
) -> list[ProductModelHistoryEntry]:
    statement = (
        select(ProductModelHistoryEntry)
        .where(ProductModelHistoryEntry.product_model_id == product_model_id)
        .order_by(
            ProductModelHistoryEntry.created_at.desc(),
            ProductModelHistoryEntry.id.desc(),
        )
    )
    return list(db.scalars(statement).all())


def count_product_model_history(db: Session, product_model_id: int) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(ProductModelHistoryEntry)
            .where(ProductModelHistoryEntry.product_model_id == product_model_id)
        )
        or 0
    )


def oldest_product_model_history(
    db: Session, product_model_id: int
) -> ProductModelHistoryEntry | None:
    return db.scalars(
        select(ProductModelHistoryEntry)
        .where(ProductModelHistoryEntry.product_model_id == product_model_id)
        .order_by(
            ProductModelHistoryEntry.created_at.asc(),
            ProductModelHistoryEntry.id.asc(),
        )
        .limit(1)
    ).first()
