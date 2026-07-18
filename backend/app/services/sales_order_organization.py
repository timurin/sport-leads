from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.sales import Organization, SalesOrder


class SalesOrderOrganizationError(RuntimeError):
    pass


def update_sales_order_organization(
    db: Session,
    order_id: int,
    organization_id: int | None,
) -> SalesOrder:
    order = db.scalar(select(SalesOrder).where(SalesOrder.id == order_id).with_for_update())
    if order is None:
        raise SalesOrderOrganizationError("Order not found")
    if organization_id is not None:
        organization = db.scalar(
            select(Organization).where(
                Organization.id == organization_id,
                Organization.is_active.is_(True),
            )
        )
        if organization is None:
            raise SalesOrderOrganizationError("Active organization not found")
    order.organization_id = organization_id
    db.flush()
    return order
