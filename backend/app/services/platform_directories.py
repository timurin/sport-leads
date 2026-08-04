"""Platform directories registry + cities service (18.2)."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.platform_city import PlatformCity
from app.schemas.platform_directories import (
    PlatformCityCreate,
    PlatformCityRead,
    PlatformCityUpdate,
    PlatformDirectoryRegistryItem,
)

PLATFORM_DIRECTORY_REGISTRY: tuple[PlatformDirectoryRegistryItem, ...] = (
    PlatformDirectoryRegistryItem(
        code="cities",
        title="Города",
        description="География клиентов, заказов и подсказок",
        list_path="/settings/platform-directories/cities",
        api_prefix="/platform-directories/cities",
        status="live",
    ),
    PlatformDirectoryRegistryItem(
        code="contractors",
        title="Контрагенты",
        description="Планируется; CRM Client остаётся SoT до отдельного stage",
        list_path="/settings/catalogs/contractors",
        api_prefix="",
        status="planned",
    ),
)


class PlatformDirectoryError(RuntimeError):
    pass


class PlatformCityNotFoundError(PlatformDirectoryError):
    pass


class PlatformCityConflictError(PlatformDirectoryError):
    pass


class PlatformCityValidationError(PlatformDirectoryError):
    pass


def list_platform_directory_registry() -> list[PlatformDirectoryRegistryItem]:
    return list(PLATFORM_DIRECTORY_REGISTRY)


def _to_read(row: PlatformCity) -> PlatformCityRead:
    return PlatformCityRead.model_validate(row)


def _normalize_name(name: str) -> str:
    return " ".join(name.strip().split())


def list_platform_cities(
    db: Session,
    *,
    is_active: bool | None = None,
    q: str | None = None,
    limit: int = 200,
    offset: int = 0,
) -> list[PlatformCityRead]:
    stmt = select(PlatformCity)
    if is_active is not None:
        stmt = stmt.where(PlatformCity.is_active.is_(is_active))
    if q and q.strip():
        needle = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            func.lower(PlatformCity.name).like(needle)
            | func.lower(func.coalesce(PlatformCity.region, "")).like(needle)
        )
    stmt = (
        stmt.order_by(PlatformCity.sort_order.asc(), PlatformCity.name.asc())
        .offset(offset)
        .limit(limit)
    )
    rows = db.scalars(stmt).all()
    return [_to_read(row) for row in rows]


def get_platform_city(db: Session, city_id: int) -> PlatformCityRead:
    row = db.get(PlatformCity, city_id)
    if row is None:
        raise PlatformCityNotFoundError("Город не найден")
    return _to_read(row)


def _find_by_name(db: Session, name: str) -> PlatformCity | None:
    return db.scalar(
        select(PlatformCity).where(func.lower(PlatformCity.name) == name.lower())
    )


def create_platform_city(db: Session, payload: PlatformCityCreate) -> PlatformCityRead:
    name = _normalize_name(payload.name)
    if not name:
        raise PlatformCityValidationError("Укажите название города")
    if _find_by_name(db, name) is not None:
        raise PlatformCityConflictError("Город с таким названием уже существует")
    region = (payload.region or "").strip() or None
    row = PlatformCity(
        name=name,
        region=region,
        is_active=payload.is_active,
        sort_order=payload.sort_order,
    )
    db.add(row)
    try:
        db.commit()
        db.refresh(row)
    except IntegrityError as error:
        db.rollback()
        raise PlatformCityConflictError(
            "Город с таким названием уже существует"
        ) from error
    return _to_read(row)


def update_platform_city(
    db: Session,
    city_id: int,
    payload: PlatformCityUpdate,
) -> PlatformCityRead:
    row = db.get(PlatformCity, city_id)
    if row is None:
        raise PlatformCityNotFoundError("Город не найден")
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise PlatformCityValidationError("Нет полей для обновления")
    if "name" in changes and changes["name"] is not None:
        name = _normalize_name(changes["name"])
        if not name:
            raise PlatformCityValidationError("Укажите название города")
        existing = _find_by_name(db, name)
        if existing is not None and existing.id != city_id:
            raise PlatformCityConflictError("Город с таким названием уже существует")
        row.name = name
    if "region" in changes:
        region = changes["region"]
        row.region = (region or "").strip() or None
    if "is_active" in changes and changes["is_active"] is not None:
        row.is_active = bool(changes["is_active"])
    if "sort_order" in changes and changes["sort_order"] is not None:
        row.sort_order = int(changes["sort_order"])
    db.add(row)
    try:
        db.commit()
        db.refresh(row)
    except IntegrityError as error:
        db.rollback()
        raise PlatformCityConflictError(
            "Город с таким названием уже существует"
        ) from error
    return _to_read(row)


def delete_platform_city(db: Session, city_id: int) -> None:
    row = db.get(PlatformCity, city_id)
    if row is None:
        raise PlatformCityNotFoundError("Город не найден")
    db.delete(row)
    db.commit()
