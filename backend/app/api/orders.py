from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.sales import Client, Lead, LeadEvent, SalesOrder, SalesUser
from app.schemas.sales import LeadEventRead, LeadRead, SalesOrderRead


router = APIRouter(prefix="/orders", tags=["Sales orders"])


@router.get("", response_model=list[SalesOrderRead])
def list_orders(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    rows = db.execute(
        select(SalesOrder, Client, SalesUser)
        .join(Client, Client.id == SalesOrder.client_id)
        .outerjoin(SalesUser, SalesUser.id == SalesOrder.responsible_id)
        .order_by(SalesOrder.created_at.desc(), SalesOrder.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return [
        {
            **{column.name: getattr(order, column.name) for column in SalesOrder.__table__.columns},
            "client_name": client.company_name or client.contact_name,
            "responsible_name": responsible.name if responsible else None,
        }
        for order, client, responsible in rows
    ]


@router.get("/{order_id}", response_model=SalesOrderRead)
def get_order(order_id: int, db: Session = Depends(get_db)) -> SalesOrder:
    order = db.get(SalesOrder, order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


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
