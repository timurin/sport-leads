from decimal import Decimal

from sqlalchemy import create_engine, event, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.models.sales import Lead, LeadContact, LeadStatus, SalesUser
from scripts.seed_sales_dev import seed_dev_leads


def make_session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_sales_dev_seed_is_idempotent_and_populates_backend_leads() -> None:
    factory = make_session_factory()
    try:
        with factory() as db:
            assert seed_dev_leads(db) == 5
        with factory() as db:
            assert seed_dev_leads(db) == 5

        with factory() as db:
            assert db.scalar(select(func.count()).select_from(Lead)) == 5
            assert db.scalar(select(func.count()).select_from(SalesUser)) == 2
            assert db.scalar(select(func.count()).select_from(LeadContact)) == 3

            statuses = set(db.scalars(select(Lead.status)))
            assert statuses == {
                LeadStatus.NEW,
                LeadStatus.CONTACT,
                LeadStatus.QUALIFICATION,
                LeadStatus.PROPOSAL,
                LeadStatus.WAITING,
            }

            commercial_leads = list(
                db.scalars(
                    select(Lead).where(
                        Lead.estimated_amount.is_not(None),
                        Lead.estimated_quantity.is_not(None),
                        Lead.need_description.is_not(None),
                    )
                )
            )
            assert len(commercial_leads) >= 2
            assert commercial_leads[0].estimated_amount is not None
            assert commercial_leads[0].estimated_amount >= Decimal("0")

            leads_with_contacts = {
                lead_id
                for lead_id, in db.execute(
                    select(LeadContact.lead_id)
                    .where(LeadContact.is_primary.is_(True))
                    .group_by(LeadContact.lead_id)
                )
            }
            assert {1001, 1002}.issubset(leads_with_contacts)
    finally:
        Base.metadata.drop_all(factory.kw["bind"])
        factory.kw["bind"].dispose()
