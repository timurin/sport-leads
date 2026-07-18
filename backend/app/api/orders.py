from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.sales import Client, Lead, LeadEvent, Organization, SalesOrder, SalesOrderItem, SalesUser
from app.schemas.sales import (
    LeadEventRead,
    LeadRead,
    SalesOrderRead,
    SalesOrderOrganizationUpdate,
    SalesOrderItemCreate,
    SalesOrderItemRead,
    SalesOrderItemUpdate,
    SalesOrderStatusUpdate,
)
from app.services.sales_order_status import (
    InvalidSalesOrderStatusTransition,
    SalesOrderNotFoundError,
    update_sales_order_status,
)
from app.services.sales_order_organization import (
    SalesOrderOrganizationError,
    update_sales_order_organization,
)
from app.services.sales_order_items import (
    SalesOrderItemError,
    calculate_sales_order_item_totals,
    create_sales_order_item,
    delete_sales_order_item,
    update_sales_order_item,
)


router = APIRouter(prefix="/orders", tags=["Sales orders"])


def serialize_order(
    order: SalesOrder,
    client: Client,
    responsible: SalesUser | None,
    organization: Organization | None,
) -> dict[str, object]:
    return {
        **{column.name: getattr(order, column.name) for column in SalesOrder.__table__.columns},
        "client_name": client.company_name or client.contact_name,
        "responsible_name": responsible.name if responsible else None,
        "organization_name": organization.name if organization else None,
        "items": [serialize_item(item) for item in order.items],
    }


def serialize_item(item: SalesOrderItem) -> dict[str, object]:
    gross_amount, _, _ = calculate_sales_order_item_totals(
        item.quantity, item.unit_price, item.discount_percent
    )
    return {
        **{column.name: getattr(item, column.name) for column in SalesOrderItem.__table__.columns},
        "gross_amount": gross_amount,
    }


@router.get("", response_model=list[SalesOrderRead])
def list_orders(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    rows = db.execute(
        select(SalesOrder, Client, SalesUser, Organization)
        .join(Client, Client.id == SalesOrder.client_id)
        .outerjoin(SalesUser, SalesUser.id == SalesOrder.responsible_id)
        .outerjoin(Organization, Organization.id == SalesOrder.organization_id)
        .order_by(SalesOrder.created_at.desc(), SalesOrder.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return [
        serialize_order(order, client, responsible, organization)
        for order, client, responsible, organization in rows
    ]


@router.get("/{order_id}", response_model=SalesOrderRead)
def get_order(order_id: int, db: Session = Depends(get_db)) -> dict[str, object]:
    row = db.execute(
        select(SalesOrder, Client, SalesUser, Organization)
        .join(Client, Client.id == SalesOrder.client_id)
        .outerjoin(SalesUser, SalesUser.id == SalesOrder.responsible_id)
        .outerjoin(Organization, Organization.id == SalesOrder.organization_id)
        .where(SalesOrder.id == order_id)
    ).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Order not found")
    order, client, responsible, organization = row
    return serialize_order(order, client, responsible, organization)


@router.patch("/{order_id}/organization", response_model=SalesOrderRead)
def update_order_organization(
    order_id: int,
    payload: SalesOrderOrganizationUpdate,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    try:
        update_sales_order_organization(db, order_id, payload.organization_id)
    except SalesOrderOrganizationError as error:
        status_code = 404 if str(error) in {"Order not found", "Active organization not found"} else 400
        raise HTTPException(status_code=status_code, detail=str(error)) from error
    db.commit()
    return get_order(order_id, db)


@router.get("/{order_id}/items", response_model=list[SalesOrderItemRead])
def list_order_items(order_id: int, db: Session = Depends(get_db)) -> list[dict[str, object]]:
    if db.get(SalesOrder, order_id) is None:
        raise HTTPException(status_code=404, detail="Order not found")
    items = list(
        db.scalars(
            select(SalesOrderItem)
            .where(SalesOrderItem.order_id == order_id)
            .order_by(SalesOrderItem.position, SalesOrderItem.id)
        ).all()
    )
    return [serialize_item(item) for item in items]


@router.post("/{order_id}/items", response_model=SalesOrderItemRead, status_code=201)
def create_order_item(
    order_id: int,
    payload: SalesOrderItemCreate,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    try:
        item = create_sales_order_item(db, order_id, payload)
        db.commit()
    except SalesOrderItemError as error:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(error)) from error
    return serialize_item(item)


@router.patch("/{order_id}/items/{item_id}", response_model=SalesOrderItemRead)
def update_order_item(
    order_id: int,
    item_id: int,
    payload: SalesOrderItemUpdate,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    try:
        item = update_sales_order_item(db, order_id, item_id, payload)
        db.commit()
    except SalesOrderItemError as error:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(error)) from error
    return serialize_item(item)


@router.delete("/{order_id}/items/{item_id}", status_code=204)
def delete_order_item(order_id: int, item_id: int, db: Session = Depends(get_db)) -> None:
    try:
        delete_sales_order_item(db, order_id, item_id)
        db.commit()
    except SalesOrderItemError as error:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.patch("/{order_id}/status", response_model=SalesOrderRead)
def update_order_status(
    order_id: int,
    payload: SalesOrderStatusUpdate,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    try:
        update_sales_order_status(db, order_id, payload.status)
    except SalesOrderNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except InvalidSalesOrderStatusTransition as error:
        raise HTTPException(status_code=409, detail=str(error)) from error

    db.commit()
    return get_order(order_id, db)


@router.get("/{order_id}/source-lead", response_model=LeadRead)
def get_order_source_lead(order_id: int, db: Session = Depends(get_db)) -> Lead:
    order = db.get(SalesOrder, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    lead = db.get(Lead, order.lead_id)
    if lead is None:
        raise HTTPException(status_code=404, detail="Source lead not found")
    return lead


@router.get("/{order_id}/history", response_model=list[LeadEventRead])
def get_order_history(order_id: int, db: Session = Depends(get_db)) -> list[LeadEvent]:
    order = db.get(SalesOrder, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return list(
        db.scalars(
            select(LeadEvent)
            .where(or_(LeadEvent.order_id == order.id, LeadEvent.lead_id == order.lead_id))
            .order_by(LeadEvent.created_at, LeadEvent.id)
        ).all()
    )
