from decimal import Decimal

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.product_model import (
    ProductModel,
    ProductModelOperationNorm,
    ProductModelRoutingLink,
)
from app.repositories import product_model_routings as repo
from app.repositories import production_stages as stages_repo
from app.repositories import shop_routings as shop_routings_repo
from app.repositories import tech_operations as tech_ops_repo
from app.schemas.product_model import (
    ProductModelOperationNormCreate,
    ProductModelOperationNormRead,
    ProductModelOperationNormReplace,
    ProductModelRoutingLinkCreate,
    ProductModelRoutingLinkRead,
    ProductModelRoutingLinkReorder,
    ProductModelRoutingLinkUpdate,
)
from app.services.product_models import get_product_model


class ProductModelRoutingNotFoundError(RuntimeError):
    pass


class ProductModelRoutingConflictError(RuntimeError):
    pass


class ProductModelRoutingValidationError(RuntimeError):
    pass


def _norm_read(row: ProductModelOperationNorm) -> ProductModelOperationNormRead:
    return ProductModelOperationNormRead(
        id=row.id,
        product_model_routing_link_id=row.product_model_routing_link_id,
        production_stage_id=row.production_stage_id,
        tech_operation_id=row.tech_operation_id,
        norm_qty_per_item=row.norm_qty_per_item,
        unit=row.unit,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _link_read_with_name(
    link: ProductModelRoutingLink,
    *,
    template_name: str | None,
) -> ProductModelRoutingLinkRead:
    norms = sorted(link.operation_norms, key=lambda row: row.id)
    return ProductModelRoutingLinkRead(
        id=link.id,
        product_model_id=link.product_model_id,
        shop_routing_template_id=link.shop_routing_template_id,
        shop_routing_template_name=template_name,
        is_active=link.is_active,
        sort_order=link.sort_order,
        operation_norms=[_norm_read(row) for row in norms],
        created_at=link.created_at,
        updated_at=link.updated_at,
    )


def _template_name(db: Session, template_id: int) -> str | None:
    template = shop_routings_repo.get_routing_template(db, template_id)
    return template.name if template is not None else None


def _link_to_read(db: Session, link: ProductModelRoutingLink) -> ProductModelRoutingLinkRead:
    return _link_read_with_name(
        link, template_name=_template_name(db, link.shop_routing_template_id)
    )

def _get_owned_link(
    db: Session,
    product_model_id: int,
    link_id: int,
) -> ProductModelRoutingLink:
    get_product_model(db, product_model_id)
    link = repo.get_link(db, link_id)
    if link is None or link.product_model_id != product_model_id:
        raise ProductModelRoutingNotFoundError("Связь маршрута модели не найдена")
    return link


def _resolve_norm_binding(
    db: Session,
    payload: ProductModelOperationNormCreate,
) -> tuple[int, int | None, str]:
    stage_id = payload.production_stage_id
    op_id = payload.tech_operation_id
    unit = payload.unit.strip()
    if not unit:
        raise ProductModelRoutingValidationError("Единица нормы обязательна")

    if stage_id is None and op_id is None:
        raise ProductModelRoutingValidationError(
            "Укажите production_stage_id и/или tech_operation_id"
        )

    if op_id is not None:
        tech_op = tech_ops_repo.get_tech_operation(db, op_id)
        if tech_op is None:
            raise ProductModelRoutingValidationError("Технологическая операция не найдена")
        if not tech_op.is_active:
            raise ProductModelRoutingValidationError(
                "Нельзя назначить неактивную технологическую операцию"
            )
        if stage_id is None:
            stage_id = tech_op.production_stage_id
        elif (
            tech_op.production_stage_id is not None
            and tech_op.production_stage_id != stage_id
        ):
            raise ProductModelRoutingValidationError(
                "Технологическая операция принадлежит другому цеху"
            )
        op_unit = (
            tech_op.volume_unit.value
            if hasattr(tech_op.volume_unit, "value")
            else str(tech_op.volume_unit)
        )
        if unit != op_unit:
            raise ProductModelRoutingValidationError(
                f"Единица нормы должна совпадать с единицей операции ({op_unit})"
            )

    if stage_id is None:
        raise ProductModelRoutingValidationError(
            "Не удалось определить production_stage_id (укажите цех или операцию с цехом)"
        )

    stage = stages_repo.get_production_stage(db, stage_id)
    if stage is None:
        raise ProductModelRoutingValidationError("Цех (этап производства) не найден")
    if not stage.is_active:
        raise ProductModelRoutingValidationError("Нельзя назначить неактивный цех")

    return stage_id, op_id, unit


def _append_norms(
    db: Session,
    link: ProductModelRoutingLink,
    payloads: list[ProductModelOperationNormCreate],
) -> None:
    seen: set[tuple[int, int | None]] = set()
    for payload in payloads:
        stage_id, op_id, unit = _resolve_norm_binding(db, payload)
        key = (stage_id, op_id)
        if key in seen:
            raise ProductModelRoutingValidationError(
                "Дублируется привязка нормы (цех / операция) внутри одного маршрута"
            )
        seen.add(key)
        qty = Decimal(payload.norm_qty_per_item)
        if qty < 0:
            raise ProductModelRoutingValidationError("norm_qty_per_item не может быть отрицательным")
        repo.add_norm(
            db,
            ProductModelOperationNorm(
                product_model_routing_link_id=link.id,
                production_stage_id=stage_id,
                tech_operation_id=op_id,
                norm_qty_per_item=qty,
                unit=unit,
            ),
        )


def sync_default_routing_after_whitelist_change(db: Session, model: ProductModel) -> None:
    """Clear default when whitelist non-empty and default is not among linked templates."""
    template_ids = repo.list_template_ids(db, model.id, active_only=False)
    if not template_ids:
        return
    default_id = model.default_routing_template_id
    if default_id is not None and default_id not in template_ids:
        model.default_routing_template_id = None


def assert_default_routing_in_whitelist(
    db: Session,
    product_model_id: int,
    default_routing_template_id: int | None,
) -> None:
    """Reject default not ∈ whitelist when whitelist is non-empty."""
    if default_routing_template_id is None:
        return
    template_ids = repo.list_template_ids(db, product_model_id, active_only=False)
    if not template_ids:
        return
    if default_routing_template_id not in template_ids:
        raise ProductModelRoutingValidationError(
            "Маршрут по умолчанию должен входить в whitelist маршрутов модели"
        )


def list_routing_links(
    db: Session,
    product_model_id: int,
    *,
    active_only: bool = False,
) -> list[ProductModelRoutingLinkRead]:
    get_product_model(db, product_model_id)
    links = repo.list_links(db, product_model_id, active_only=active_only)
    return [_link_to_read(db, link) for link in links]


def get_routing_link(
    db: Session,
    product_model_id: int,
    link_id: int,
) -> ProductModelRoutingLinkRead:
    return _link_to_read(db, _get_owned_link(db, product_model_id, link_id))


def create_routing_link(
    db: Session,
    product_model_id: int,
    payload: ProductModelRoutingLinkCreate,
) -> ProductModelRoutingLinkRead:
    model = get_product_model(db, product_model_id)
    template = shop_routings_repo.get_routing_template(db, payload.shop_routing_template_id)
    if template is None:
        raise ProductModelRoutingValidationError("Маршрут не найден")
    if not template.is_active:
        raise ProductModelRoutingValidationError("Нельзя добавить неактивный маршрут")
    if repo.get_link_by_template(db, product_model_id, payload.shop_routing_template_id) is not None:
        raise ProductModelRoutingConflictError(
            "Этот маршрут уже есть в whitelist модели"
        )

    sort_order = (
        payload.sort_order
        if payload.sort_order is not None
        else repo.next_link_sort_order(db, product_model_id)
    )
    link = ProductModelRoutingLink(
        product_model_id=product_model_id,
        shop_routing_template_id=payload.shop_routing_template_id,
        is_active=payload.is_active,
        sort_order=sort_order,
    )
    try:
        repo.add_link(db, link)
        if payload.norms:
            _append_norms(db, link, payload.norms)
        sync_default_routing_after_whitelist_change(db, model)
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise ProductModelRoutingConflictError(
            "Этот маршрут уже есть в whitelist модели"
        ) from error
    db.refresh(link)
    link = repo.get_link(db, link.id) or link
    return _link_to_read(db, link)


def update_routing_link(
    db: Session,
    product_model_id: int,
    link_id: int,
    payload: ProductModelRoutingLinkUpdate,
) -> ProductModelRoutingLinkRead:
    model = get_product_model(db, product_model_id)
    link = _get_owned_link(db, product_model_id, link_id)
    changes = payload.model_dump(exclude_unset=True)
    if "is_active" in changes:
        link.is_active = changes["is_active"]
    if "sort_order" in changes:
        link.sort_order = changes["sort_order"]
    sync_default_routing_after_whitelist_change(db, model)
    db.commit()
    db.refresh(link)
    link = repo.get_link(db, link.id) or link
    return _link_to_read(db, link)


def delete_routing_link(
    db: Session,
    product_model_id: int,
    link_id: int,
) -> None:
    model = get_product_model(db, product_model_id)
    link = _get_owned_link(db, product_model_id, link_id)
    repo.delete_link(db, link)
    sync_default_routing_after_whitelist_change(db, model)
    db.commit()


def reorder_routing_links(
    db: Session,
    product_model_id: int,
    payload: ProductModelRoutingLinkReorder,
) -> list[ProductModelRoutingLinkRead]:
    get_product_model(db, product_model_id)
    existing = repo.list_links(db, product_model_id, active_only=False)
    existing_ids = {row.id for row in existing}
    ordered_ids = list(dict.fromkeys(payload.routing_link_ids))
    if set(ordered_ids) != existing_ids:
        raise ProductModelRoutingValidationError(
            "Список для сортировки должен содержать все связи маршрутов модели"
        )
    repo.replace_link_sort_orders(db, product_model_id, ordered_ids)
    db.commit()
    return list_routing_links(db, product_model_id, active_only=False)


def replace_routing_link_norms(
    db: Session,
    product_model_id: int,
    link_id: int,
    payload: ProductModelOperationNormReplace,
) -> ProductModelRoutingLinkRead:
    link = _get_owned_link(db, product_model_id, link_id)
    try:
        repo.delete_norms_for_link(db, link.id)
        if payload.norms:
            _append_norms(db, link, payload.norms)
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise ProductModelRoutingConflictError(
            "Конфликт уникальности норм (цех / операция)"
        ) from error
    link = repo.get_link(db, link.id) or link
    return _link_to_read(db, link)
