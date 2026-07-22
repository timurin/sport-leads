from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.product_model import AssemblyOperationLine, AssemblyVariant
from app.repositories import assembly_variants as repo
from app.schemas.product_model import (
    AssemblyOperationLineCreate,
    AssemblyOperationLineRead,
    AssemblyOperationLineReorder,
    AssemblyOperationLineUpdate,
    AssemblyVariantCreate,
    AssemblyVariantRead,
    AssemblyVariantReorder,
    AssemblyVariantUpdate,
)
from app.services.product_models import get_product_model


class AssemblyVariantNotFoundError(RuntimeError):
    pass


class AssemblyVariantConflictError(RuntimeError):
    pass


class AssemblyVariantValidationError(RuntimeError):
    pass


class AssemblyOperationLineNotFoundError(RuntimeError):
    pass


def _line_read(line: AssemblyOperationLine) -> AssemblyOperationLineRead:
    return AssemblyOperationLineRead.model_validate(line)


def _variant_read(variant: AssemblyVariant) -> AssemblyVariantRead:
    lines = sorted(variant.operation_lines, key=lambda row: (row.sequence, row.id))
    return AssemblyVariantRead(
        id=variant.id,
        product_model_id=variant.product_model_id,
        name=variant.name,
        is_active=variant.is_active,
        sort_order=variant.sort_order,
        total_cost=repo.variant_total_cost(variant),
        operation_lines=[_line_read(line) for line in lines],
        created_at=variant.created_at,
        updated_at=variant.updated_at,
    )


def _get_owned_variant(
    db: Session,
    product_model_id: int,
    variant_id: int,
) -> AssemblyVariant:
    get_product_model(db, product_model_id)
    variant = repo.get_variant(db, variant_id)
    if variant is None or variant.product_model_id != product_model_id:
        raise AssemblyVariantNotFoundError("Вариант сборки не найден")
    return variant


def _get_owned_line(
    db: Session,
    product_model_id: int,
    variant_id: int,
    line_id: int,
) -> tuple[AssemblyVariant, AssemblyOperationLine]:
    variant = _get_owned_variant(db, product_model_id, variant_id)
    line = repo.get_operation_line(db, line_id)
    if line is None or line.assembly_variant_id != variant.id:
        raise AssemblyOperationLineNotFoundError("Строка операции не найдена")
    return variant, line


def list_assembly_variants(
    db: Session,
    product_model_id: int,
    *,
    active_only: bool = False,
) -> list[AssemblyVariantRead]:
    get_product_model(db, product_model_id)
    variants = repo.list_variants(db, product_model_id, active_only=active_only)
    return [_variant_read(variant) for variant in variants]


def get_assembly_variant(
    db: Session,
    product_model_id: int,
    variant_id: int,
) -> AssemblyVariantRead:
    return _variant_read(_get_owned_variant(db, product_model_id, variant_id))


def create_assembly_variant(
    db: Session,
    product_model_id: int,
    payload: AssemblyVariantCreate,
) -> AssemblyVariantRead:
    get_product_model(db, product_model_id)
    if repo.get_variant_by_name(db, product_model_id, payload.name) is not None:
        raise AssemblyVariantConflictError(
            "Вариант сборки с таким названием уже есть у этой модели"
        )

    explicit_sequences = [
        line.sequence for line in payload.operation_lines if line.sequence is not None
    ]
    if len(explicit_sequences) != len(set(explicit_sequences)):
        raise AssemblyVariantValidationError(
            "Порядковые номера строк операций внутри варианта должны быть уникальны"
        )

    sort_order = (
        payload.sort_order
        if payload.sort_order is not None
        else repo.next_variant_sort_order(db, product_model_id)
    )
    variant = AssemblyVariant(
        product_model_id=product_model_id,
        name=payload.name,
        is_active=payload.is_active,
        sort_order=sort_order,
    )
    try:
        repo.add_variant(db, variant)
        for index, line_payload in enumerate(payload.operation_lines, start=1):
            sequence = line_payload.sequence if line_payload.sequence is not None else index
            line = AssemblyOperationLine(
                assembly_variant_id=variant.id,
                sequence=sequence,
                operation_name=line_payload.operation_name,
                cost=line_payload.cost,
            )
            repo.add_operation_line(db, line)
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise AssemblyVariantConflictError(
            "Вариант сборки с таким названием уже есть у этой модели"
            if "uq_assembly_variants_model_name" in str(error.orig)
            else "Конфликт уникальности строк операций варианта"
        ) from error

    refreshed = repo.get_variant(db, variant.id)
    assert refreshed is not None
    return _variant_read(refreshed)


def update_assembly_variant(
    db: Session,
    product_model_id: int,
    variant_id: int,
    payload: AssemblyVariantUpdate,
) -> AssemblyVariantRead:
    variant = _get_owned_variant(db, product_model_id, variant_id)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        return _variant_read(variant)

    if "name" in changes:
        existing = repo.get_variant_by_name(db, product_model_id, changes["name"])
        if existing is not None and existing.id != variant.id:
            raise AssemblyVariantConflictError(
                "Вариант сборки с таким названием уже есть у этой модели"
            )

    for field_name, value in changes.items():
        setattr(variant, field_name, value)

    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise AssemblyVariantConflictError(
            "Вариант сборки с таким названием уже есть у этой модели"
        ) from error

    refreshed = repo.get_variant(db, variant.id)
    assert refreshed is not None
    return _variant_read(refreshed)


def delete_assembly_variant(
    db: Session,
    product_model_id: int,
    variant_id: int,
) -> None:
    variant = _get_owned_variant(db, product_model_id, variant_id)
    repo.delete_variant(db, variant)


def reorder_assembly_variants(
    db: Session,
    product_model_id: int,
    payload: AssemblyVariantReorder,
) -> list[AssemblyVariantRead]:
    get_product_model(db, product_model_id)
    existing = repo.list_variants(db, product_model_id)
    existing_ids = {variant.id for variant in existing}
    ordered_ids = list(dict.fromkeys(payload.assembly_variant_ids))
    if set(ordered_ids) != existing_ids:
        raise AssemblyVariantValidationError(
            "Список для сортировки должен совпадать с текущими вариантами модели"
        )
    repo.replace_variant_sort_orders(db, product_model_id, ordered_ids)
    return list_assembly_variants(db, product_model_id)


def add_operation_line(
    db: Session,
    product_model_id: int,
    variant_id: int,
    payload: AssemblyOperationLineCreate,
) -> AssemblyVariantRead:
    variant = _get_owned_variant(db, product_model_id, variant_id)
    sequence = (
        payload.sequence
        if payload.sequence is not None
        else repo.next_line_sequence(db, variant.id)
    )
    line = AssemblyOperationLine(
        assembly_variant_id=variant.id,
        sequence=sequence,
        operation_name=payload.operation_name,
        cost=payload.cost,
    )
    try:
        repo.add_operation_line(db, line)
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise AssemblyVariantConflictError(
            "Строка операции с таким порядком уже есть в варианте"
        ) from error

    return get_assembly_variant(db, product_model_id, variant_id)


def update_operation_line(
    db: Session,
    product_model_id: int,
    variant_id: int,
    line_id: int,
    payload: AssemblyOperationLineUpdate,
) -> AssemblyVariantRead:
    _variant, line = _get_owned_line(db, product_model_id, variant_id, line_id)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        return get_assembly_variant(db, product_model_id, variant_id)

    for field_name, value in changes.items():
        setattr(line, field_name, value)

    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise AssemblyVariantConflictError(
            "Строка операции с таким порядком уже есть в варианте"
        ) from error

    return get_assembly_variant(db, product_model_id, variant_id)


def delete_operation_line(
    db: Session,
    product_model_id: int,
    variant_id: int,
    line_id: int,
) -> AssemblyVariantRead:
    _variant, line = _get_owned_line(db, product_model_id, variant_id, line_id)
    repo.delete_operation_line(db, line)
    return get_assembly_variant(db, product_model_id, variant_id)


def reorder_operation_lines(
    db: Session,
    product_model_id: int,
    variant_id: int,
    payload: AssemblyOperationLineReorder,
) -> AssemblyVariantRead:
    variant = _get_owned_variant(db, product_model_id, variant_id)
    existing_ids = {line.id for line in variant.operation_lines}
    ordered_ids = list(dict.fromkeys(payload.operation_line_ids))
    if set(ordered_ids) != existing_ids:
        raise AssemblyVariantValidationError(
            "Список для сортировки должен совпадать с текущими строками варианта"
        )
    repo.replace_line_sequences(db, variant.id, ordered_ids)
    return get_assembly_variant(db, product_model_id, variant_id)


def active_variant_count(db: Session, product_model_id: int) -> int:
    """Helper for ADR-014 order-item rules (`6.1.13`)."""
    return len(repo.list_variants(db, product_model_id, active_only=True))
