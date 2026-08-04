"""Product-model folder hierarchy (6.1.18) — mirrors sewing_operation folders (6.3.11)."""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.product_model import ProductModelFolder
from app.repositories import product_models as repo
from app.repositories import sewing_operation_templates as templates_repo
from app.schemas.product_model import (
    ProductModelFolderCreate,
    ProductModelFolderRead,
    ProductModelFolderUpdate,
)

if TYPE_CHECKING:
    from app.models.product_model import ProductModel


class ProductModelFolderNotFoundError(RuntimeError):
    pass


class ProductModelFolderConflictError(RuntimeError):
    pass


class ProductModelFolderValidationError(RuntimeError):
    pass


def to_product_model_folder_read(
    db: Session, row: ProductModelFolder
) -> ProductModelFolderRead:
    template_name = None
    if row.default_sewing_operation_template_id is not None:
        template = templates_repo.get_template(
            db, row.default_sewing_operation_template_id
        )
        template_name = template.name if template is not None else None
    return ProductModelFolderRead.model_validate(row).model_copy(
        update={"default_sewing_operation_template_name": template_name}
    )


def list_product_model_folders(db: Session) -> list[ProductModelFolderRead]:
    return [
        to_product_model_folder_read(db, row)
        for row in repo.list_product_model_folders(db)
    ]


def get_product_model_folder(db: Session, folder_id: int) -> ProductModelFolder:
    row = repo.get_product_model_folder(db, folder_id)
    if row is None:
        raise ProductModelFolderNotFoundError("Папка моделей изделий не найдена")
    return row


def get_product_model_folder_read(
    db: Session, folder_id: int
) -> ProductModelFolderRead:
    return to_product_model_folder_read(db, get_product_model_folder(db, folder_id))


def _validate_folder_parent(
    db: Session, folder_id: int | None, parent_id: int | None
) -> None:
    if parent_id is None:
        return
    if folder_id is not None and folder_id == parent_id:
        raise ProductModelFolderValidationError(
            "Папка не может быть родителем самой себя"
        )
    current = get_product_model_folder(db, parent_id)
    seen: set[int] = set()
    while current is not None:
        if folder_id is not None and current.id == folder_id:
            raise ProductModelFolderValidationError(
                "Нельзя сделать потомка родителем (цикл)"
            )
        if current.id in seen:
            raise ProductModelFolderValidationError("Обнаружен цикл в иерархии папок")
        seen.add(current.id)
        if current.parent_id is None:
            break
        current = get_product_model_folder(db, current.parent_id)


def _validate_default_template(db: Session, template_id: int | None) -> None:
    if template_id is None:
        return
    if templates_repo.get_template(db, template_id) is None:
        raise ProductModelFolderValidationError("Шаблон операций пошива не найден")


def _assert_unique_sibling_folder_name(
    db: Session,
    *,
    parent_id: int | None,
    name: str,
    exclude_id: int | None = None,
) -> None:
    existing = repo.find_sibling_folder_by_name(
        db, parent_id=parent_id, name=name, exclude_id=exclude_id
    )
    if existing is not None:
        raise ProductModelFolderConflictError(
            "Папка с таким именем уже есть на этом уровне"
        )


def create_product_model_folder(
    db: Session, payload: ProductModelFolderCreate
) -> ProductModelFolderRead:
    _validate_folder_parent(db, None, payload.parent_id)
    _assert_unique_sibling_folder_name(
        db, parent_id=payload.parent_id, name=payload.name
    )
    _validate_default_template(db, payload.default_sewing_operation_template_id)
    fields_set = getattr(payload, "model_fields_set", set())
    sort_order = (
        payload.sort_order
        if "sort_order" in fields_set
        else repo.next_folder_sort_order(db, payload.parent_id)
    )
    row = ProductModelFolder(
        name=payload.name,
        parent_id=payload.parent_id,
        sort_order=sort_order,
        default_sewing_operation_template_id=payload.default_sewing_operation_template_id,
    )
    try:
        repo.add_product_model_folder(db, row)
        db.commit()
        return get_product_model_folder_read(db, row.id)
    except IntegrityError as error:
        db.rollback()
        raise ProductModelFolderConflictError(
            "Папка с таким именем уже есть на этом уровне"
        ) from error


def update_product_model_folder(
    db: Session,
    folder_id: int,
    payload: ProductModelFolderUpdate,
) -> ProductModelFolderRead:
    row = get_product_model_folder(db, folder_id)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise ProductModelFolderValidationError("Нет полей для обновления")

    next_parent = changes.get("parent_id", row.parent_id)
    next_name = changes.get("name", row.name)
    if "parent_id" in changes:
        _validate_folder_parent(db, folder_id, changes["parent_id"])
        if changes["parent_id"] != row.parent_id and "sort_order" not in changes:
            changes["sort_order"] = repo.next_folder_sort_order(db, changes["parent_id"])

    if "default_sewing_operation_template_id" in changes:
        _validate_default_template(
            db, changes["default_sewing_operation_template_id"]
        )

    _assert_unique_sibling_folder_name(
        db,
        parent_id=next_parent,
        name=next_name,
        exclude_id=folder_id,
    )

    for field_name, value in changes.items():
        setattr(row, field_name, value)
    try:
        db.commit()
        return get_product_model_folder_read(db, folder_id)
    except IntegrityError as error:
        db.rollback()
        raise ProductModelFolderConflictError(
            "Папка с таким именем уже есть на этом уровне"
        ) from error


def delete_product_model_folder(db: Session, folder_id: int) -> None:
    row = get_product_model_folder(db, folder_id)
    if repo.count_folder_children(db, folder_id) > 0:
        raise ProductModelFolderValidationError(
            "Нельзя удалить папку, пока в ней есть вложенные папки или модели"
        )
    repo.delete_product_model_folder(db, row)
    db.commit()


def move_product_model_folder_sibling(
    db: Session, folder_id: int, direction: str
) -> ProductModelFolderRead:
    row = get_product_model_folder(db, folder_id)
    siblings = repo.list_sibling_folders(db, row.parent_id)
    index = next((i for i, item in enumerate(siblings) if item.id == row.id), None)
    if index is None:
        raise ProductModelFolderNotFoundError("Папка моделей изделий не найдена")
    target = index - 1 if direction == "up" else index + 1
    if target < 0 or target >= len(siblings):
        return to_product_model_folder_read(db, row)
    other = siblings[target]
    row.sort_order, other.sort_order = other.sort_order, row.sort_order
    db.commit()
    return get_product_model_folder_read(db, folder_id)


def move_product_model_sibling(
    db: Session, model_id: int, direction: str
) -> ProductModel:
    from app.services.product_models import (
        ProductModelNotFoundError,
        get_product_model,
    )

    row = get_product_model(db, model_id)
    siblings = repo.list_sibling_models(db, row.folder_id)
    index = next((i for i, item in enumerate(siblings) if item.id == row.id), None)
    if index is None:
        raise ProductModelNotFoundError("Модель изделия не найдена")
    target = index - 1 if direction == "up" else index + 1
    if target < 0 or target >= len(siblings):
        return row
    other = siblings[target]
    row.sort_order, other.sort_order = other.sort_order, row.sort_order
    db.commit()
    return get_product_model(db, model_id)
