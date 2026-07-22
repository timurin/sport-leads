from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.nomenclature import Nomenclature, NomenclatureType
from app.models.product_model import (
    NomenclatureProductModel,
    ProductModel,
    ProductModelStatus,
)
from app.repositories import nomenclature_product_models as repo
from app.repositories import product_models as product_model_repo
from app.schemas.product_model import (
    NomenclatureProductModelCreate,
    NomenclatureProductModelRead,
    NomenclatureProductModelReorder,
)
from app.services.nomenclature import NomenclatureNotFoundError, get_nomenclature


class NomenclatureProductModelRuleError(RuntimeError):
    pass


class NomenclatureProductModelConflictError(RuntimeError):
    pass


class NomenclatureProductModelNotFoundError(RuntimeError):
    pass


def _to_read(
    link: NomenclatureProductModel,
    model: ProductModel,
) -> NomenclatureProductModelRead:
    return NomenclatureProductModelRead(
        id=link.id,
        nomenclature_id=link.nomenclature_id,
        product_model_id=link.product_model_id,
        sort_order=link.sort_order,
        created_at=link.created_at,
        updated_at=link.updated_at,
        article=model.article,
        name=model.name,
        size_type=model.size_type,
        status=model.status,
    )


def _require_product_nomenclature(item: Nomenclature) -> None:
    if item.nomenclature_type != NomenclatureType.PRODUCT:
        raise NomenclatureProductModelRuleError(
            "Список доступных моделей лекал допустим только для номенклатуры типа PRODUCT"
        )


def list_available_product_models(
    db: Session,
    nomenclature_id: int,
) -> list[NomenclatureProductModelRead]:
    item = get_nomenclature(db, nomenclature_id)
    _require_product_nomenclature(item)
    rows = repo.list_links_for_nomenclature(db, nomenclature_id)
    return [_to_read(link, model) for link, model in rows]


def add_available_product_model(
    db: Session,
    nomenclature_id: int,
    payload: NomenclatureProductModelCreate,
) -> NomenclatureProductModelRead:
    item = get_nomenclature(db, nomenclature_id)
    _require_product_nomenclature(item)

    model = product_model_repo.get_product_model(db, payload.product_model_id)
    if model is None:
        raise NomenclatureProductModelNotFoundError("Модель изделия не найдена")
    if model.status != ProductModelStatus.ACTIVE:
        raise NomenclatureProductModelRuleError(
            "В whitelist можно добавить только активную модель изделия"
        )

    if repo.get_link(db, nomenclature_id, payload.product_model_id) is not None:
        raise NomenclatureProductModelConflictError(
            "Модель уже есть в списке доступных для этой номенклатуры"
        )

    sort_order = (
        payload.sort_order
        if payload.sort_order is not None
        else repo.next_sort_order(db, nomenclature_id)
    )
    try:
        link = repo.add_link(
            db,
            nomenclature_id=nomenclature_id,
            product_model_id=payload.product_model_id,
            sort_order=sort_order,
        )
    except IntegrityError as error:
        db.rollback()
        raise NomenclatureProductModelConflictError(
            "Модель уже есть в списке доступных для этой номенклатуры"
        ) from error

    return _to_read(link, model)


def remove_available_product_model(
    db: Session,
    nomenclature_id: int,
    product_model_id: int,
) -> None:
    item = get_nomenclature(db, nomenclature_id)
    _require_product_nomenclature(item)
    link = repo.get_link(db, nomenclature_id, product_model_id)
    if link is None:
        raise NomenclatureProductModelNotFoundError(
            "Связь модели с номенклатурой не найдена"
        )
    repo.delete_link(db, link)


def reorder_available_product_models(
    db: Session,
    nomenclature_id: int,
    payload: NomenclatureProductModelReorder,
) -> list[NomenclatureProductModelRead]:
    item = get_nomenclature(db, nomenclature_id)
    _require_product_nomenclature(item)

    existing = repo.list_links_for_nomenclature(db, nomenclature_id)
    existing_ids = {link.product_model_id for link, _model in existing}
    ordered_ids = list(dict.fromkeys(payload.product_model_ids))
    if set(ordered_ids) != existing_ids:
        raise NomenclatureProductModelRuleError(
            "Список для сортировки должен совпадать с текущим whitelist"
        )

    repo.replace_sort_orders(db, nomenclature_id, ordered_ids)
    rows = repo.list_links_for_nomenclature(db, nomenclature_id)
    return [_to_read(link, model) for link, model in rows]


def is_model_allowed_for_nomenclature(
    db: Session,
    nomenclature_id: int,
    product_model_id: int,
) -> bool:
    """ADR-014 empty whitelist → any model optional; non-empty → must be listed."""
    item = get_nomenclature(db, nomenclature_id)
    if item.nomenclature_type != NomenclatureType.PRODUCT:
        return False
    links = repo.list_links_for_nomenclature(db, nomenclature_id)
    if not links:
        return True
    return any(link.product_model_id == product_model_id for link, _model in links)
