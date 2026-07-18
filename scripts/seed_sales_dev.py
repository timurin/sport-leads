from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKEND_ROOT = PROJECT_ROOT / "backend"

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.database.session import SessionLocal
from app.models.sales import (
    Lead,
    LeadContact,
    LeadContactChannel,
    LeadCustomerType,
    LeadStatus,
    SalesUser,
)


@dataclass(frozen=True)
class SeedContact:
    name: str
    position: str | None
    phone: str | None
    email: str | None
    preferred_channel: LeadContactChannel
    is_primary: bool


@dataclass(frozen=True)
class SeedLead:
    id: int
    status: LeadStatus
    contact_name: str
    company_name: str
    customer_type: LeadCustomerType
    tax_id: str | None
    website: str | None
    phone: str | None
    email: str | None
    city: str
    region: str
    address: str | None
    customer_comment: str | None
    source: str
    responsible_id: int
    sport: str
    product_category: str
    need_description: str | None
    estimated_quantity: int | None
    estimated_amount: Decimal | None
    desired_date: date | None
    contacts: tuple[SeedContact, ...] = ()


DEV_USERS: tuple[SalesUser, ...] = (
    SalesUser(id=101, name="Dev Sales Manager A", is_active=True),
    SalesUser(id=102, name="Dev Sales Manager B", is_active=True),
)

DEV_LEADS: tuple[SeedLead, ...] = (
    SeedLead(
        id=1001,
        status=LeadStatus.NEW,
        contact_name="Ivan Petrov",
        company_name="Dev FC Olimp",
        customer_type=LeadCustomerType.COMPANY,
        tax_id="1655000000",
        website="olimp-dev.example.test",
        phone="+79001001001",
        email="ivan.petrov@example.test",
        city="Kazan",
        region="Tatarstan",
        address="Central street, 1",
        customer_comment="Needs a football kit estimate.",
        source="website",
        responsible_id=101,
        sport="Football",
        product_category="Team uniform",
        need_description="Home and away kits for a youth team.",
        estimated_quantity=28,
        estimated_amount=Decimal("280000.00"),
        desired_date=date(2026, 9, 15),
        contacts=(
            SeedContact(
                name="Ivan Petrov",
                position="Director",
                phone="+79001001001",
                email="ivan.petrov@example.test",
                preferred_channel=LeadContactChannel.EMAIL,
                is_primary=True,
            ),
            SeedContact(
                name="Anna Petrova",
                position="Purchasing",
                phone="+79001001002",
                email="anna.petrova@example.test",
                preferred_channel=LeadContactChannel.PHONE,
                is_primary=False,
            ),
        ),
    ),
    SeedLead(
        id=1002,
        status=LeadStatus.CONTACT,
        contact_name="Olga Smirnova",
        company_name="Dev VC Vector",
        customer_type=LeadCustomerType.COMPANY,
        tax_id="6311000000",
        website="vector-dev.example.test",
        phone="+79001002001",
        email="olga.smirnova@example.test",
        city="Samara",
        region="Samara region",
        address="Sport avenue, 8",
        customer_comment="Compares delivery timing and fabrics.",
        source="referral",
        responsible_id=102,
        sport="Volleyball",
        product_category="Game uniform",
        need_description="Two sets for the adult team.",
        estimated_quantity=36,
        estimated_amount=Decimal("315000.50"),
        desired_date=date(2026, 10, 1),
        contacts=(
            SeedContact(
                name="Olga Smirnova",
                position="Team manager",
                phone="+79001002001",
                email="olga.smirnova@example.test",
                preferred_channel=LeadContactChannel.TELEGRAM,
                is_primary=True,
            ),
        ),
    ),
    SeedLead(
        id=1003,
        status=LeadStatus.QUALIFICATION,
        contact_name="Pavel Egorov",
        company_name="Dev School Yunost",
        customer_type=LeadCustomerType.COMPANY,
        tax_id=None,
        website=None,
        phone="+79001003001",
        email=None,
        city="Perm",
        region="Perm krai",
        address=None,
        customer_comment=None,
        source="cold_call",
        responsible_id=101,
        sport="Athletics",
        product_category="Training apparel",
        need_description=None,
        estimated_quantity=None,
        estimated_amount=None,
        desired_date=None,
    ),
    SeedLead(
        id=1004,
        status=LeadStatus.PROPOSAL,
        contact_name="Daria Gromova",
        company_name="Dev Fitness Vysota",
        customer_type=LeadCustomerType.COMPANY,
        tax_id=None,
        website=None,
        phone="+79001004001",
        email="daria.gromova@example.test",
        city="Ufa",
        region="Bashkortostan",
        address=None,
        customer_comment=None,
        source="vk",
        responsible_id=102,
        sport="Fitness",
        product_category="Corporate merch",
        need_description="Caps and shirts for club staff.",
        estimated_quantity=50,
        estimated_amount=Decimal("170000.00"),
        desired_date=date(2026, 8, 30),
    ),
    SeedLead(
        id=1005,
        status=LeadStatus.WAITING,
        contact_name="Roman Zuev",
        company_name="Dev Volga Cup",
        customer_type=LeadCustomerType.COMPANY,
        tax_id=None,
        website="volgacup-dev.example.test",
        phone="+79001005001",
        email="roman.zuev@example.test",
        city="Saratov",
        region="Saratov region",
        address=None,
        customer_comment="Waiting for event budget approval.",
        source="event",
        responsible_id=101,
        sport="Mini-football",
        product_category="Tournament apparel",
        need_description="Participant shirts for a weekend tournament.",
        estimated_quantity=120,
        estimated_amount=Decimal("260000.00"),
        desired_date=date(2026, 11, 5),
    ),
)


def _copy_user(seed_user: SalesUser) -> dict[str, object]:
    return {
        "id": seed_user.id,
        "name": seed_user.name,
        "is_active": seed_user.is_active,
    }


def _upsert_user(db: Session, seed_user: SalesUser) -> None:
    existing = db.get(SalesUser, seed_user.id)
    values = _copy_user(seed_user)
    if existing is None:
        db.add(SalesUser(**values))
        return
    existing.name = seed_user.name
    existing.is_active = seed_user.is_active


def _upsert_lead(db: Session, seed_lead: SeedLead) -> Lead:
    existing = db.get(Lead, seed_lead.id)
    values = {
        "id": seed_lead.id,
        "status": seed_lead.status,
        "result": None,
        "customer_type": seed_lead.customer_type,
        "company_name": seed_lead.company_name,
        "tax_id": seed_lead.tax_id,
        "website": seed_lead.website,
        "contact_name": seed_lead.contact_name,
        "phone": seed_lead.phone,
        "email": seed_lead.email,
        "city": seed_lead.city,
        "region": seed_lead.region,
        "address": seed_lead.address,
        "customer_comment": seed_lead.customer_comment,
        "source": seed_lead.source,
        "responsible_id": seed_lead.responsible_id,
        "sport": seed_lead.sport,
        "product_category": seed_lead.product_category,
        "need_description": seed_lead.need_description,
        "estimated_quantity": seed_lead.estimated_quantity,
        "estimated_amount": seed_lead.estimated_amount,
        "desired_date": seed_lead.desired_date,
        "completed_at": None,
        "completed_by_id": None,
        "converted_order_id": None,
        "rejection_reason_id": None,
        "rejection_comment": None,
    }
    if existing is None:
        lead = Lead(**values)
        db.add(lead)
        return lead
    for key, value in values.items():
        if key != "id":
            setattr(existing, key, value)
    return existing


def _upsert_contacts(db: Session, lead: Lead, seed_contacts: tuple[SeedContact, ...]) -> None:
    if not seed_contacts:
        return

    existing_by_name = {
        contact.name: contact
        for contact in db.scalars(select(LeadContact).where(LeadContact.lead_id == lead.id))
    }

    primary_seed = next((contact for contact in seed_contacts if contact.is_primary), seed_contacts[0])
    for contact in existing_by_name.values():
        contact.is_primary = False

    for seed_contact in seed_contacts:
        contact = existing_by_name.get(seed_contact.name)
        if contact is None:
            contact = LeadContact(lead_id=lead.id, name=seed_contact.name)
            db.add(contact)
        contact.position = seed_contact.position
        contact.phone = seed_contact.phone
        contact.email = seed_contact.email
        contact.preferred_channel = seed_contact.preferred_channel
        contact.is_primary = seed_contact.name == primary_seed.name

    lead.contact_name = primary_seed.name
    lead.phone = primary_seed.phone
    lead.email = primary_seed.email


def _sync_postgresql_sequence(db: Session, table_name: str, column_name: str = "id") -> None:
    if db.bind is None or db.bind.dialect.name != "postgresql":
        return
    db.execute(
        text(
            "SELECT setval("
            "pg_get_serial_sequence(:table_name, :column_name), "
            f"COALESCE((SELECT MAX({column_name}) FROM {table_name}), 1), "
            "true)"
        ),
        {"table_name": table_name, "column_name": column_name},
    )


def seed_dev_leads(db: Session) -> int:
    for seed_user in DEV_USERS:
        _upsert_user(db, seed_user)
    db.flush()

    for seed_lead in DEV_LEADS:
        lead = _upsert_lead(db, seed_lead)
        db.flush()
        _upsert_contacts(db, lead, seed_lead.contacts)

    _sync_postgresql_sequence(db, "sales_users")
    _sync_postgresql_sequence(db, "leads")
    _sync_postgresql_sequence(db, "lead_contacts")
    db.commit()
    return len(DEV_LEADS)


def ensure_seed_allowed() -> None:
    environment = os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "development")).lower()
    if environment in {"prod", "production"}:
        raise RuntimeError("Development seed is disabled in production environment.")
    if os.getenv("SPORT_LEADS_ALLOW_DEV_SEED") != "1":
        raise RuntimeError(
            "Set SPORT_LEADS_ALLOW_DEV_SEED=1 to run the explicit development seed."
        )


def main() -> int:
    ensure_seed_allowed()
    with SessionLocal() as db:
        count = seed_dev_leads(db)
    print(f"Seeded {count} development leads.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
