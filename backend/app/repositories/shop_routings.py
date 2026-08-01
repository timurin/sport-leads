from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.shop_routing import ShopRoutingStageLine, ShopRoutingTemplate, WorkCenter


def list_work_centers(
    db: Session,
    *,
    search: str | None = None,
    active_only: bool = False,
    production_stage_id: int | None = None,
    production_stage_code: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[WorkCenter]:
    statement = select(WorkCenter)
    if active_only:
        statement = statement.where(WorkCenter.is_active.is_(True))
    if production_stage_id is not None:
        statement = statement.where(WorkCenter.production_stage_id == production_stage_id)
    if production_stage_code and production_stage_code.strip():
        from app.models.production_stage import ProductionStage

        code = production_stage_code.strip().lower()
        statement = statement.join(
            ProductionStage,
            ProductionStage.id == WorkCenter.production_stage_id,
        ).where(func.lower(ProductionStage.code) == code)
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        statement = statement.where(
            WorkCenter.name.ilike(pattern) | WorkCenter.code.ilike(pattern)
        )
    statement = statement.order_by(
        func.lower(WorkCenter.name),
        WorkCenter.id,
    ).offset(offset).limit(limit)
    return list(db.scalars(statement).all())


def get_work_center(db: Session, work_center_id: int) -> WorkCenter | None:
    return db.get(WorkCenter, work_center_id)


def get_work_center_by_name(db: Session, name: str) -> WorkCenter | None:
    return db.scalars(select(WorkCenter).where(WorkCenter.name == name)).first()


def get_work_center_by_code(db: Session, code: str) -> WorkCenter | None:
    return db.scalars(select(WorkCenter).where(WorkCenter.code == code)).first()


def add_work_center(db: Session, row: WorkCenter) -> WorkCenter:
    db.add(row)
    db.flush()
    return row


def apply_work_center_updates(row: WorkCenter, changes: dict) -> WorkCenter:
    for field_name, value in changes.items():
        setattr(row, field_name, value)
    return row


def delete_work_center(db: Session, row: WorkCenter) -> None:
    db.delete(row)
    db.flush()


def list_routing_templates(
    db: Session,
    *,
    search: str | None = None,
    active_only: bool = False,
    limit: int = 100,
    offset: int = 0,
) -> list[ShopRoutingTemplate]:
    statement = select(ShopRoutingTemplate).options(
        selectinload(ShopRoutingTemplate.stage_lines)
    )
    if active_only:
        statement = statement.where(ShopRoutingTemplate.is_active.is_(True))
    if search and search.strip():
        pattern = f"%{search.strip().lower()}%"
        statement = statement.where(
            func.lower(ShopRoutingTemplate.name).like(pattern)
            | func.lower(func.coalesce(ShopRoutingTemplate.code, "")).like(pattern)
        )
    statement = statement.order_by(
        func.lower(ShopRoutingTemplate.name),
        ShopRoutingTemplate.id,
    ).offset(offset).limit(limit)
    return list(db.scalars(statement).unique().all())


def get_routing_template(
    db: Session, template_id: int
) -> ShopRoutingTemplate | None:
    return db.scalars(
        select(ShopRoutingTemplate)
        .where(ShopRoutingTemplate.id == template_id)
        .options(selectinload(ShopRoutingTemplate.stage_lines))
    ).first()


def get_routing_template_by_name(
    db: Session, name: str
) -> ShopRoutingTemplate | None:
    return db.scalars(
        select(ShopRoutingTemplate).where(ShopRoutingTemplate.name == name)
    ).first()


def get_routing_template_by_code(
    db: Session, code: str
) -> ShopRoutingTemplate | None:
    return db.scalars(
        select(ShopRoutingTemplate).where(ShopRoutingTemplate.code == code)
    ).first()


def add_routing_template(
    db: Session, row: ShopRoutingTemplate
) -> ShopRoutingTemplate:
    db.add(row)
    db.flush()
    return row


def replace_stage_lines(
    db: Session,
    template: ShopRoutingTemplate,
    lines: list[ShopRoutingStageLine],
) -> None:
    # Clear via ORM collection so identity-map / selectinload stay consistent.
    template.stage_lines.clear()
    db.flush()
    for line in lines:
        template.stage_lines.append(line)
    db.flush()


def delete_routing_template(db: Session, row: ShopRoutingTemplate) -> None:
    db.delete(row)
    db.flush()
