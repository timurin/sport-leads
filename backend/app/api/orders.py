from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.sales import Client, Lead, LeadEvent, Organization, SalesOrder, SalesOrderItem, SalesUser
from app.schemas.sales import (
    LeadEventRead,
    LeadRead,
    SalesInvoiceCreate,
    SalesInvoiceRead,
    SalesOrderRead,
    SalesOrderDesignApprovalUpdate,
    SalesOrderDiscountUpdate,
    SalesOrderMaterialReserveUpdate,
    SalesOrderOrganizationUpdate,
    SalesOrderPaymentUpdate,
    SalesOrderItemCreate,
    SalesOrderItemRead,
    SalesOrderItemUpdate,
    SalesOrderStatusUpdate,
    SalesQuotationRead,
)
from app.services.sales_order_status import (
    InvalidSalesOrderPaymentUpdate,
    InvalidSalesOrderStatusTransition,
    SalesOrderNotFoundError,
    update_sales_order_design_approval,
    update_sales_order_material_reserve,
    update_sales_order_payment,
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
    line_gross_amount,
    order_amount_net,
    order_items_subtotal,
    update_sales_order_discount,
    update_sales_order_item,
)
from app.services.sales_commercial_documents import (
    SalesCommercialDocumentError,
    create_invoice_from_order,
    create_quotation_from_order,
    get_invoice,
    get_quotation,
    list_invoices_for_order,
    list_quotations_for_order,
    serialize_invoice,
    serialize_quotation,
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
        "items_subtotal": order_items_subtotal(order),
        "amount_net": order_amount_net(order),
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
        "line_total": line_gross_amount(item),
        "variant_snapshots": [
            {
                column.name: getattr(snapshot, column.name)
                for column in snapshot.__table__.columns
                if column.name not in {"id", "order_item_id"}
            }
            for snapshot in item.variant_snapshots
        ],
        "assembly_operation_snapshots": [
            {
                column.name: getattr(snapshot, column.name)
                for column in snapshot.__table__.columns
                if column.name not in {"id", "order_item_id"}
            }
            for snapshot in item.assembly_operation_snapshots
        ],
    }


def _item_error_status(error: SalesOrderItemError) -> int:
    detail = str(error)
    if detail.endswith("not found") or detail in {"Order not found", "Order item not found"}:
        return 404
    return 400


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


@router.patch("/{order_id}/discount", response_model=SalesOrderRead)
def patch_order_discount(
    order_id: int,
    payload: SalesOrderDiscountUpdate,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    try:
        update_sales_order_discount(db, order_id, payload.discount_percent)
        db.commit()
    except SalesOrderItemError as error:
        db.rollback()
        raise HTTPException(status_code=_item_error_status(error), detail=str(error)) from error
    return get_order(order_id, db)


@router.patch("/{order_id}/design-approval", response_model=SalesOrderRead)
def patch_order_design_approval(
    order_id: int,
    payload: SalesOrderDesignApprovalUpdate,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    try:
        update_sales_order_design_approval(db, order_id, payload.design_approval_status)
        db.commit()
    except SalesOrderNotFoundError as error:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(error)) from error
    except InvalidSalesOrderStatusTransition as error:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(error)) from error
    return get_order(order_id, db)


@router.patch("/{order_id}/payment", response_model=SalesOrderRead)
def patch_order_payment(
    order_id: int,
    payload: SalesOrderPaymentUpdate,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    try:
        update_sales_order_payment(
            db,
            order_id,
            payment_status=payload.payment_status,
            paid_amount=payload.paid_amount,
        )
        db.commit()
    except SalesOrderNotFoundError as error:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(error)) from error
    except InvalidSalesOrderPaymentUpdate as error:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(error)) from error
    return get_order(order_id, db)


@router.patch("/{order_id}/material-reserve", response_model=SalesOrderRead)
def patch_order_material_reserve(
    order_id: int,
    payload: SalesOrderMaterialReserveUpdate,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    try:
        update_sales_order_material_reserve(
            db, order_id, payload.material_reserve_status
        )
        db.commit()
    except SalesOrderNotFoundError as error:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(error)) from error
    except InvalidSalesOrderStatusTransition as error:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(error)) from error
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
        raise HTTPException(status_code=_item_error_status(error), detail=str(error)) from error
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
        raise HTTPException(status_code=_item_error_status(error), detail=str(error)) from error
    return serialize_item(item)


@router.delete("/{order_id}/items/{item_id}", status_code=204)
def delete_order_item(order_id: int, item_id: int, db: Session = Depends(get_db)) -> None:
    try:
        delete_sales_order_item(db, order_id, item_id)
        db.commit()
    except SalesOrderItemError as error:
        db.rollback()
        raise HTTPException(status_code=_item_error_status(error), detail=str(error)) from error


def _commercial_error_status(error: SalesCommercialDocumentError) -> int:
    detail = str(error)
    if detail.endswith("not found"):
        return 404
    return 400


@router.get("/{order_id}/quotations", response_model=list[SalesQuotationRead])
def list_order_quotations(order_id: int, db: Session = Depends(get_db)) -> list[dict[str, object]]:
    try:
        rows = list_quotations_for_order(db, order_id)
    except SalesCommercialDocumentError as error:
        raise HTTPException(status_code=_commercial_error_status(error), detail=str(error)) from error
    return [serialize_quotation(row) for row in rows]


@router.post("/{order_id}/quotations", response_model=SalesQuotationRead, status_code=201)
def create_order_quotation(order_id: int, db: Session = Depends(get_db)) -> dict[str, object]:
    try:
        quotation = create_quotation_from_order(db, order_id)
        db.commit()
    except SalesCommercialDocumentError as error:
        db.rollback()
        raise HTTPException(status_code=_commercial_error_status(error), detail=str(error)) from error
    return serialize_quotation(get_quotation(db, order_id, quotation.id))


@router.get("/{order_id}/quotations/{quotation_id}", response_model=SalesQuotationRead)
def get_order_quotation(
    order_id: int, quotation_id: int, db: Session = Depends(get_db)
) -> dict[str, object]:
    try:
        quotation = get_quotation(db, order_id, quotation_id)
    except SalesCommercialDocumentError as error:
        raise HTTPException(status_code=_commercial_error_status(error), detail=str(error)) from error
    return serialize_quotation(quotation)


@router.get("/{order_id}/invoices", response_model=list[SalesInvoiceRead])
def list_order_invoices(order_id: int, db: Session = Depends(get_db)) -> list[dict[str, object]]:
    try:
        rows = list_invoices_for_order(db, order_id)
    except SalesCommercialDocumentError as error:
        raise HTTPException(status_code=_commercial_error_status(error), detail=str(error)) from error
    return [serialize_invoice(row) for row in rows]


@router.post("/{order_id}/invoices", response_model=SalesInvoiceRead, status_code=201)
def create_order_invoice(
    order_id: int,
    payload: SalesInvoiceCreate | None = None,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    body = payload or SalesInvoiceCreate()
    try:
        invoice = create_invoice_from_order(db, order_id, quotation_id=body.quotation_id)
        db.commit()
    except SalesCommercialDocumentError as error:
        db.rollback()
        raise HTTPException(status_code=_commercial_error_status(error), detail=str(error)) from error
    return serialize_invoice(get_invoice(db, order_id, invoice.id))


@router.get("/{order_id}/invoices/{invoice_id}", response_model=SalesInvoiceRead)
def get_order_invoice(
    order_id: int, invoice_id: int, db: Session = Depends(get_db)
) -> dict[str, object]:
    try:
        invoice = get_invoice(db, order_id, invoice_id)
    except SalesCommercialDocumentError as error:
        raise HTTPException(status_code=_commercial_error_status(error), detail=str(error)) from error
    return serialize_invoice(invoice)


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
