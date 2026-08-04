"""DesignProject / DesignVersion service (ADR-021 / 10.1.1.3)."""

from __future__ import annotations

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.design_project import (
    DesignProject,
    DesignProjectStatus,
    DesignVersion,
    DesignVersionStatus,
)
from app.models.sales import SalesOrder, SalesOrderItem
from app.models.technical_card import TechnicalCard
from app.repositories import design_projects as repo
from app.schemas.design_project import (
    DesignProjectCreate,
    DesignProjectListItem,
    DesignProjectRead,
    DesignProjectUpdate,
    DesignVersionCreate,
    DesignVersionRead,
)

_PROJECT_STATUSES = frozenset(s.value for s in DesignProjectStatus)
_PROJECT_STATUS_TRANSITIONS: dict[str, frozenset[str]] = {
    DesignProjectStatus.DRAFT.value: frozenset(
        {
            DesignProjectStatus.IN_PROGRESS.value,
            DesignProjectStatus.READY.value,
            DesignProjectStatus.ARCHIVED.value,
        }
    ),
    DesignProjectStatus.IN_PROGRESS.value: frozenset(
        {
            DesignProjectStatus.READY.value,
            DesignProjectStatus.ARCHIVED.value,
            DesignProjectStatus.DRAFT.value,
        }
    ),
    DesignProjectStatus.READY.value: frozenset(
        {
            DesignProjectStatus.IN_PROGRESS.value,
            DesignProjectStatus.ARCHIVED.value,
        }
    ),
    DesignProjectStatus.ARCHIVED.value: frozenset(),
}


class DesignProjectNotFoundError(RuntimeError):
    pass


class DesignVersionNotFoundError(RuntimeError):
    pass


class DesignProjectConflictError(RuntimeError):
    pass


class DesignProjectValidationError(RuntimeError):
    pass


def _project_number(sales_order_number: str, project_seq: int) -> str:
    return f"DP-{sales_order_number}-{project_seq}"


def _version_label(version_no: int) -> str:
    return f"v{version_no}"


def _version_read(version: DesignVersion) -> DesignVersionRead:
    return DesignVersionRead(
        id=version.id,
        design_project_id=version.design_project_id,
        version_no=version.version_no,
        label=version.label,
        status=version.status,
        notes=version.notes,
        sales_order_item_id=version.sales_order_item_id,
        technical_card_id=version.technical_card_id,
        created_at=version.created_at,
        updated_at=version.updated_at,
    )


def _project_read(
    project: DesignProject, sales_order_number: str | None = None
) -> DesignProjectRead:
    if sales_order_number is None and project.sales_order is not None:
        sales_order_number = project.sales_order.number
    versions = sorted(project.versions, key=lambda row: row.version_no)
    return DesignProjectRead(
        id=project.id,
        sales_order_id=project.sales_order_id,
        sales_order_number=sales_order_number,
        number=project.number,
        project_seq=project.project_seq,
        status=project.status,
        title=project.title,
        notes=project.notes,
        versions=[_version_read(version) for version in versions],
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


def list_design_projects(
    db: Session,
    *,
    sales_order_id: int | None = None,
    status: str | None = None,
    search: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[DesignProjectListItem]:
    rows = repo.list_design_projects(
        db,
        sales_order_id=sales_order_id,
        status=status,
        search=search,
        limit=limit,
        offset=offset,
    )
    return [
        DesignProjectListItem(
            id=project.id,
            sales_order_id=project.sales_order_id,
            sales_order_number=sales_order_number,
            number=project.number,
            project_seq=project.project_seq,
            status=project.status,
            title=project.title,
            notes=project.notes,
            version_count=int(version_count or 0),
            current_version_no=int(current_version_no)
            if current_version_no is not None
            else None,
            created_at=project.created_at,
            updated_at=project.updated_at,
        )
        for project, sales_order_number, version_count, current_version_no in rows
    ]


def get_design_project(db: Session, project_id: int) -> DesignProjectRead:
    project = repo.get_design_project(db, project_id)
    if project is None:
        raise DesignProjectNotFoundError("Дизайн-проект не найден")
    sales_order = db.get(SalesOrder, project.sales_order_id)
    return _project_read(project, sales_order.number if sales_order else None)


def create_design_project(
    db: Session, payload: DesignProjectCreate
) -> DesignProjectRead:
    sales_order = db.get(SalesOrder, payload.sales_order_id)
    if sales_order is None:
        raise DesignProjectValidationError("Заказ покупателя не найден")

    project_seq = repo.next_project_seq(db, sales_order.id)
    row = DesignProject(
        sales_order_id=sales_order.id,
        number=_project_number(sales_order.number, project_seq),
        project_seq=project_seq,
        status=DesignProjectStatus.DRAFT.value,
        title=payload.title,
        notes=payload.notes,
    )
    try:
        db.add(row)
        db.commit()
        db.refresh(row)
    except IntegrityError as error:
        db.rollback()
        raise DesignProjectConflictError(
            "Не удалось создать дизайн-проект (конфликт номера/порядка)"
        ) from error
    return get_design_project(db, row.id)


def update_design_project(
    db: Session, project_id: int, payload: DesignProjectUpdate
) -> DesignProjectRead:
    project = repo.get_design_project(db, project_id)
    if project is None:
        raise DesignProjectNotFoundError("Дизайн-проект не найден")

    data = payload.model_dump(exclude_unset=True)
    if "status" in data and data["status"] is not None:
        new_status = data["status"]
        if new_status not in _PROJECT_STATUSES:
            raise DesignProjectValidationError(
                f"Недопустимый статус проекта: {new_status}"
            )
        if new_status != project.status:
            allowed = _PROJECT_STATUS_TRANSITIONS.get(project.status, frozenset())
            if new_status not in allowed:
                raise DesignProjectValidationError(
                    f"Переход статуса {project.status} → {new_status} запрещён"
                )
            project.status = new_status

    if "title" in data:
        project.title = data["title"]
    if "notes" in data:
        project.notes = data["notes"]

    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise DesignProjectConflictError(
            "Не удалось обновить дизайн-проект"
        ) from error
    return get_design_project(db, project_id)


def list_design_versions(
    db: Session, project_id: int
) -> list[DesignVersionRead]:
    project = repo.get_design_project(db, project_id)
    if project is None:
        raise DesignProjectNotFoundError("Дизайн-проект не найден")
    return [_version_read(v) for v in repo.list_versions_for_project(db, project_id)]


def _validate_optional_links(
    db: Session,
    *,
    sales_order_id: int,
    sales_order_item_id: int | None,
    technical_card_id: int | None,
) -> None:
    if sales_order_item_id is not None:
        item = db.get(SalesOrderItem, sales_order_item_id)
        if item is None:
            raise DesignProjectValidationError("Позиция заказа не найдена")
        if item.order_id != sales_order_id:
            raise DesignProjectValidationError(
                "Позиция заказа не принадлежит заказу дизайн-проекта"
            )
    if technical_card_id is not None:
        card = db.get(TechnicalCard, technical_card_id)
        if card is None:
            raise DesignProjectValidationError("Техкарта не найдена")
        if card.sales_order_id != sales_order_id:
            raise DesignProjectValidationError(
                "Техкарта не принадлежит заказу дизайн-проекта"
            )


def _supersede_current(db: Session, design_project_id: int) -> None:
    current = repo.get_current_version(db, design_project_id)
    if current is not None:
        current.status = DesignVersionStatus.SUPERSEDED.value


def create_design_version(
    db: Session, project_id: int, payload: DesignVersionCreate
) -> DesignVersionRead:
    project = repo.get_design_project(db, project_id)
    if project is None:
        raise DesignProjectNotFoundError("Дизайн-проект не найден")
    if project.status == DesignProjectStatus.ARCHIVED.value:
        raise DesignProjectValidationError(
            "Нельзя создавать версии в archived-проекте"
        )

    _validate_optional_links(
        db,
        sales_order_id=project.sales_order_id,
        sales_order_item_id=payload.sales_order_item_id,
        technical_card_id=payload.technical_card_id,
    )

    version_no = repo.next_version_no(db, project.id)
    status = (
        DesignVersionStatus.CURRENT.value
        if payload.make_current
        else DesignVersionStatus.DRAFT.value
    )
    if payload.make_current:
        _supersede_current(db, project.id)

    row = DesignVersion(
        design_project_id=project.id,
        version_no=version_no,
        label=_version_label(version_no),
        status=status,
        notes=payload.notes,
        sales_order_item_id=payload.sales_order_item_id,
        technical_card_id=payload.technical_card_id,
    )
    if project.status == DesignProjectStatus.DRAFT.value:
        project.status = DesignProjectStatus.IN_PROGRESS.value

    try:
        db.add(row)
        db.commit()
        db.refresh(row)
    except IntegrityError as error:
        db.rollback()
        raise DesignProjectConflictError(
            "Не удалось создать версию дизайна (конфликт номера/current)"
        ) from error
    return _version_read(row)


def set_design_version_current(
    db: Session, project_id: int, version_id: int
) -> DesignVersionRead:
    project = repo.get_design_project(db, project_id)
    if project is None:
        raise DesignProjectNotFoundError("Дизайн-проект не найден")
    if project.status == DesignProjectStatus.ARCHIVED.value:
        raise DesignProjectValidationError(
            "Нельзя менять current в archived-проекте"
        )

    version = repo.get_design_version(db, version_id)
    if version is None or version.design_project_id != project_id:
        raise DesignVersionNotFoundError("Версия дизайна не найдена")

    if version.status == DesignVersionStatus.CURRENT.value:
        return _version_read(version)

    _supersede_current(db, project.id)
    version.status = DesignVersionStatus.CURRENT.value

    try:
        db.commit()
        db.refresh(version)
    except IntegrityError as error:
        db.rollback()
        raise DesignProjectConflictError(
            "Не удалось назначить current-версию"
        ) from error
    return _version_read(version)
