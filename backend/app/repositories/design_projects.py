"""DesignProject / DesignVersion repository (ADR-021 / 10.1.1.3)."""

from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.design_project import DesignProject, DesignVersion, DesignVersionStatus
from app.models.sales import SalesOrder


def list_design_projects(
    db: Session,
    *,
    sales_order_id: int | None = None,
    status: str | None = None,
    search: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[tuple[DesignProject, str | None, int, int | None]]:
    version_count = (
        select(func.count(DesignVersion.id))
        .where(DesignVersion.design_project_id == DesignProject.id)
        .correlate(DesignProject)
        .scalar_subquery()
    )
    current_version_no = (
        select(DesignVersion.version_no)
        .where(
            DesignVersion.design_project_id == DesignProject.id,
            DesignVersion.status == DesignVersionStatus.CURRENT.value,
        )
        .correlate(DesignProject)
        .limit(1)
        .scalar_subquery()
    )
    statement = (
        select(DesignProject, SalesOrder.number, version_count, current_version_no)
        .outerjoin(SalesOrder, SalesOrder.id == DesignProject.sales_order_id)
    )
    if sales_order_id is not None:
        statement = statement.where(DesignProject.sales_order_id == sales_order_id)
    if status and status.strip():
        statement = statement.where(DesignProject.status == status.strip())
    if search and search.strip():
        pattern = f"%{search.strip().lower()}%"
        statement = statement.where(
            or_(
                func.lower(DesignProject.number).like(pattern),
                func.lower(SalesOrder.number).like(pattern),
                func.lower(func.coalesce(DesignProject.title, "")).like(pattern),
            )
        )
    statement = (
        statement.order_by(DesignProject.id.desc()).limit(limit).offset(offset)
    )
    return list(db.execute(statement).all())


def get_design_project(db: Session, project_id: int) -> DesignProject | None:
    return db.scalar(
        select(DesignProject)
        .where(DesignProject.id == project_id)
        .options(selectinload(DesignProject.versions))
    )


def get_design_version(db: Session, version_id: int) -> DesignVersion | None:
    return db.get(DesignVersion, version_id)


def next_project_seq(db: Session, sales_order_id: int) -> int:
    current = db.scalar(
        select(func.max(DesignProject.project_seq)).where(
            DesignProject.sales_order_id == sales_order_id
        )
    )
    return int(current or 0) + 1


def next_version_no(db: Session, design_project_id: int) -> int:
    current = db.scalar(
        select(func.max(DesignVersion.version_no)).where(
            DesignVersion.design_project_id == design_project_id
        )
    )
    return int(current or 0) + 1


def get_current_version(
    db: Session, design_project_id: int
) -> DesignVersion | None:
    return db.scalar(
        select(DesignVersion).where(
            DesignVersion.design_project_id == design_project_id,
            DesignVersion.status == DesignVersionStatus.CURRENT.value,
        )
    )


def list_versions_for_project(
    db: Session, design_project_id: int
) -> list[DesignVersion]:
    return list(
        db.scalars(
            select(DesignVersion)
            .where(DesignVersion.design_project_id == design_project_id)
            .order_by(DesignVersion.version_no.asc())
        ).all()
    )
