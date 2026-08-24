"""Client list/detail reads for Stage 2.2.1 / 2.2.2 workspace + create for 0.4 UX."""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.sales import (
    Client,
    ClientBankAccount,
    ClientFolder,
    Organization,
    SalesOrder,
    SalesUser,
)
from app.schemas.client_requisites import ClientBankAccountRead, ClientUpdate
from app.schemas.sales import (
    ClientCreate,
    ClientDetailRead,
    ClientListItem,
    ClientOrderSummary,
)


class ClientCreateError(RuntimeError):
    pass


class ClientNotFoundError(RuntimeError):
    pass


class ClientFolderAssignError(RuntimeError):
    pass


class ClientUpdateError(RuntimeError):
    pass


def _orders_agg_subquery():
    return (
        select(
            SalesOrder.client_id.label("client_id"),
            func.count(SalesOrder.id).label("orders_count"),
            func.coalesce(func.sum(SalesOrder.amount), 0).label("sales_amount"),
            func.max(SalesOrder.sport).label("primary_sport"),
        )
        .group_by(SalesOrder.client_id)
        .subquery()
    )


def _last_order_organization_ids(
    db: Session,
    client_ids: list[int],
) -> dict[int, int]:
    if not client_ids:
        return {}
    ranked = (
        select(
            SalesOrder.client_id.label("client_id"),
            SalesOrder.organization_id.label("organization_id"),
            func.row_number()
            .over(
                partition_by=SalesOrder.client_id,
                order_by=(SalesOrder.created_at.desc(), SalesOrder.id.desc()),
            )
            .label("rn"),
        )
        .where(
            SalesOrder.client_id.in_(client_ids),
            SalesOrder.organization_id.is_not(None),
        )
        .subquery()
    )
    rows = db.execute(
        select(ranked.c.client_id, ranked.c.organization_id).where(ranked.c.rn == 1)
    ).all()
    return {int(client_id): int(org_id) for client_id, org_id in rows}


def _organization_ids_by_name(
    db: Session,
    names: list[str],
) -> dict[str, int]:
    cleaned = sorted({name.strip() for name in names if name and name.strip()})
    if not cleaned:
        return {}
    rows = db.execute(
        select(Organization.id, Organization.name).where(
            Organization.name.in_(cleaned),
            Organization.is_active.is_(True),
        )
    ).all()
    return {str(name): int(org_id) for org_id, name in rows}


def _default_organization_id(
    *,
    organization_id: int | None,
    client_id: int,
    company_name: str | None,
    last_order_orgs: dict[int, int],
    orgs_by_name: dict[str, int],
) -> int | None:
    if organization_id is not None:
        return organization_id
    if client_id in last_order_orgs:
        return last_order_orgs[client_id]
    name = (company_name or "").strip()
    if name and name in orgs_by_name:
        return orgs_by_name[name]
    return None


def _find_or_create_organization_by_name(
    db: Session,
    name: str,
) -> Organization:
    organization = db.scalar(
        select(Organization).where(Organization.name == name).limit(1)
    )
    if organization is None:
        organization = Organization(name=name, is_active=True)
        db.add(organization)
        db.flush()
    return organization


def _to_list_item(
    client: Client,
    responsible_name: str | None,
    organization_name: str | None,
    orders_count: object,
    sales_amount: object,
    primary_sport: str | None,
    *,
    default_organization_id: int | None,
    folder_name: str | None = None,
) -> ClientListItem:
    amount = sales_amount if isinstance(sales_amount, Decimal) else Decimal(str(sales_amount or 0))
    return ClientListItem(
        id=client.id,
        company_name=client.company_name,
        contact_name=client.contact_name,
        phone=client.phone,
        email=str(client.email) if client.email is not None else None,
        city=client.city,
        responsible_id=client.responsible_id,
        responsible_name=responsible_name,
        organization_id=client.organization_id,
        organization_name=organization_name,
        default_organization_id=default_organization_id,
        orders_count=int(orders_count or 0),
        sales_amount=amount,
        primary_sport=primary_sport,
        folder_id=client.folder_id,
        folder_name=folder_name,
        created_at=client.created_at,
        updated_at=client.updated_at,
    )


def list_clients(
    db: Session,
    *,
    q: str | None = None,
    responsible_id: int | None = None,
    folder_id: int | None = None,
    limit: int = 500,
    offset: int = 0,
) -> list[ClientListItem]:
    orders_agg = _orders_agg_subquery()

    statement = (
        select(
            Client,
            SalesUser.name.label("responsible_name"),
            Organization.name.label("organization_name"),
            ClientFolder.name.label("folder_name"),
            func.coalesce(orders_agg.c.orders_count, 0).label("orders_count"),
            func.coalesce(orders_agg.c.sales_amount, 0).label("sales_amount"),
            orders_agg.c.primary_sport,
        )
        .outerjoin(SalesUser, SalesUser.id == Client.responsible_id)
        .outerjoin(Organization, Organization.id == Client.organization_id)
        .outerjoin(ClientFolder, ClientFolder.id == Client.folder_id)
        .outerjoin(orders_agg, orders_agg.c.client_id == Client.id)
        .order_by(
            func.coalesce(Client.company_name, Client.contact_name),
            Client.contact_name,
            Client.id,
        )
        .offset(offset)
        .limit(limit)
    )

    if responsible_id is not None:
        statement = statement.where(Client.responsible_id == responsible_id)

    if folder_id is not None:
        statement = statement.where(Client.folder_id == folder_id)

    if q:
        needle = f"%{q.strip()}%"
        statement = statement.where(
            or_(
                Client.company_name.ilike(needle),
                Client.contact_name.ilike(needle),
                Client.phone.ilike(needle),
                Client.email.ilike(needle),
                Client.city.ilike(needle),
            )
        )

    rows = db.execute(statement).all()
    clients = [row[0] for row in rows]
    last_order_orgs = _last_order_organization_ids(
        db,
        [client.id for client in clients if client.organization_id is None],
    )
    orgs_by_name = _organization_ids_by_name(
        db,
        [
            client.company_name or ""
            for client in clients
            if client.organization_id is None and client.id not in last_order_orgs
        ],
    )
    return [
        _to_list_item(
            client,
            responsible_name,
            organization_name,
            orders_count,
            sales_amount,
            primary_sport,
            default_organization_id=_default_organization_id(
                organization_id=client.organization_id,
                client_id=client.id,
                company_name=client.company_name,
                last_order_orgs=last_order_orgs,
                orgs_by_name=orgs_by_name,
            ),
            folder_name=folder_name,
        )
        for (
            client,
            responsible_name,
            organization_name,
            folder_name,
            orders_count,
            sales_amount,
            primary_sport,
        ) in rows
    ]


def get_client(db: Session, client_id: int) -> ClientDetailRead | None:
    orders_agg = _orders_agg_subquery()
    row = db.execute(
        select(
            Client,
            SalesUser.name.label("responsible_name"),
            Organization.name.label("organization_name"),
            ClientFolder.name.label("folder_name"),
            func.coalesce(orders_agg.c.orders_count, 0).label("orders_count"),
            func.coalesce(orders_agg.c.sales_amount, 0).label("sales_amount"),
            orders_agg.c.primary_sport,
        )
        .outerjoin(SalesUser, SalesUser.id == Client.responsible_id)
        .outerjoin(Organization, Organization.id == Client.organization_id)
        .outerjoin(ClientFolder, ClientFolder.id == Client.folder_id)
        .outerjoin(orders_agg, orders_agg.c.client_id == Client.id)
        .where(Client.id == client_id)
    ).one_or_none()
    if row is None:
        return None

    (
        client,
        responsible_name,
        organization_name,
        folder_name,
        orders_count,
        sales_amount,
        primary_sport,
    ) = row
    last_order_orgs = _last_order_organization_ids(
        db,
        [client.id] if client.organization_id is None else [],
    )
    orgs_by_name = _organization_ids_by_name(
        db,
        [client.company_name or ""]
        if client.organization_id is None and client.id not in last_order_orgs
        else [],
    )
    base = _to_list_item(
        client,
        responsible_name,
        organization_name,
        orders_count,
        sales_amount,
        primary_sport,
        default_organization_id=_default_organization_id(
            organization_id=client.organization_id,
            client_id=client.id,
            company_name=client.company_name,
            last_order_orgs=last_order_orgs,
            orgs_by_name=orgs_by_name,
        ),
        folder_name=folder_name,
    )

    orders = db.scalars(
        select(SalesOrder)
        .where(SalesOrder.client_id == client_id)
        .order_by(SalesOrder.created_at.desc(), SalesOrder.id.desc())
        .limit(20)
    ).all()
    recent_orders = [
        ClientOrderSummary(
            id=order.id,
            number=order.number,
            title=order.title,
            status=order.status,
            amount=order.amount,
            sport=order.sport,
            created_at=order.created_at,
        )
        for order in orders
    ]
    accounts = db.scalars(
        select(ClientBankAccount)
        .where(ClientBankAccount.client_id == client_id)
        .order_by(
            ClientBankAccount.is_primary.desc(),
            ClientBankAccount.sort_order,
            ClientBankAccount.id,
        )
    ).all()
    return ClientDetailRead(
        **base.model_dump(),
        inn=client.inn,
        kpp=client.kpp,
        ogrn=client.ogrn,
        legal_address=client.legal_address,
        actual_address=client.actual_address,
        bank_accounts=[ClientBankAccountRead.model_validate(row) for row in accounts],
        recent_orders=recent_orders,
    )


def create_client(db: Session, payload: ClientCreate) -> Client:
    organization_id: int | None
    if payload.organization_id is not None:
        organization = db.get(Organization, payload.organization_id)
        if organization is None:
            raise ClientCreateError("Organization not found")
        organization_id = organization.id
    else:
        tax_id = payload.tax_id
        # Do not infer org from company_name — only explicit organization fields create/link org.
        org_name = payload.organization_name
        ogrn = payload.ogrn
        organization_id = None

        if tax_id:
            by_tax = db.scalar(
                select(Organization).where(Organization.tax_id == tax_id).limit(1)
            )
            if by_tax is not None:
                if org_name and by_tax.name != org_name:
                    by_tax.name = org_name
                if ogrn and not by_tax.ogrn:
                    by_tax.ogrn = ogrn
                db.flush()
                organization_id = by_tax.id

        if organization_id is None and org_name:
            organization = db.scalar(
                select(Organization).where(Organization.name == org_name).limit(1)
            )
            if organization is None:
                organization = Organization(
                    name=org_name,
                    tax_id=tax_id,
                    ogrn=ogrn,
                    is_active=True,
                )
                db.add(organization)
                db.flush()
            else:
                if tax_id and organization.tax_id is None:
                    organization.tax_id = tax_id
                if ogrn and organization.ogrn is None:
                    organization.ogrn = ogrn
                db.flush()
            organization_id = organization.id
        elif organization_id is None and (tax_id or ogrn):
            raise ClientCreateError("Organization name is required when INN/OGRN is set")

    if payload.responsible_id is not None:
        if db.get(SalesUser, payload.responsible_id) is None:
            raise ClientCreateError("Responsible user not found")

    if payload.folder_id is not None and db.get(ClientFolder, payload.folder_id) is None:
        raise ClientCreateError("Client folder not found")

    client = Client(
        contact_name=payload.contact_name,
        company_name=payload.company_name,
        phone=payload.phone,
        email=str(payload.email) if payload.email is not None else None,
        city=payload.city,
        responsible_id=payload.responsible_id,
        organization_id=organization_id,
        folder_id=payload.folder_id,
    )
    db.add(client)
    db.flush()
    return client


def update_client(db: Session, client_id: int, payload: ClientUpdate) -> ClientDetailRead:
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise ClientUpdateError("Нет полей для обновления")
    client = db.get(Client, client_id)
    if client is None:
        raise ClientNotFoundError("Client not found")
    if "folder_id" in changes:
        folder_id = changes["folder_id"]
        if folder_id is not None and db.get(ClientFolder, folder_id) is None:
            raise ClientFolderAssignError("Client folder not found")
    for field_name, value in changes.items():
        setattr(client, field_name, value)
    db.commit()
    detail = get_client(db, client_id)
    if detail is None:
        raise ClientNotFoundError("Client not found")
    return detail


def assign_client_folder(
    db: Session, client_id: int, folder_id: int | None
) -> ClientDetailRead:
    return update_client(db, client_id, ClientUpdate(folder_id=folder_id))
