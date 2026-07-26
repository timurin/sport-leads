from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.sales import Lead, LeadTask, SalesUser
from app.models.vat_rate import VatRate


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        db.add(SalesUser(id=1, name="Test user"))
        db.commit()
    return factory


def _seed_vat_rates(db: Session) -> dict[str, int]:
    rows = [
        VatRate(name="0%", rate_percent=Decimal("0.00"), is_active=True, sort_order=10),
        VatRate(name="5%", rate_percent=Decimal("5.00"), is_active=True, sort_order=20),
        VatRate(name="22%", rate_percent=Decimal("22.00"), is_active=True, sort_order=30),
    ]
    db.add_all(rows)
    db.commit()
    return {row.name: row.id for row in rows}


def _add_lead(session_factory: sessionmaker[Session]) -> int:
    with session_factory() as db:
        lead = Lead(
            contact_name="Иван Петров",
            company_name="СК Олимп",
            phone="+79990000000",
            email="sales@example.com",
            city="Казань",
            source="website",
            responsible_id=1,
            sport="Футбол",
            product_category="Форма",
            need_description="Форма для команды",
            estimated_quantity=25,
            estimated_amount=Decimal("250000"),
        )
        db.add(lead)
        db.flush()
        db.add(LeadTask(lead_id=lead.id, title="Позвонить клиенту"))
        db.commit()
        return lead.id


def test_vat_rates_list_and_order_item_link() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            rate_ids = _seed_vat_rates(db)
        lead_id = _add_lead(factory)

        with TestClient(app) as client:
            listed = client.get("/vat-rates")
            assert listed.status_code == 200
            percents = sorted(Decimal(row["rate_percent"]) for row in listed.json())
            assert percents == [Decimal("0.00"), Decimal("5.00"), Decimal("22.00")]

            order_id = client.post(
                f"/leads/{lead_id}/convert",
                json={"completed_by_id": 1},
            ).json()["order"]["id"]

            created = client.post(
                f"/orders/{order_id}/items",
                json={
                    "snapshot_name": "Пошив изделия",
                    "unit": "шт",
                    "quantity": "2",
                    "unit_price": "1000",
                    "vat_rate_id": rate_ids["5%"],
                },
            )
            assert created.status_code == 201, created.text
            body = created.json()
            assert body["vat_rate_id"] == rate_ids["5%"]
            assert body["vat_rate_percent"] == "5.00"

            updated = client.patch(
                f"/orders/{order_id}/items/{body['id']}",
                json={"vat_rate_id": rate_ids["22%"]},
            )
            assert updated.status_code == 200
            assert updated.json()["vat_rate_percent"] == "22.00"

            missing = client.post(
                f"/orders/{order_id}/items",
                json={
                    "snapshot_name": "Без ставки",
                    "unit": "шт",
                    "quantity": "1",
                    "unit_price": "10",
                    "vat_rate_id": 999999,
                },
            )
            assert missing.status_code == 404

        with factory() as db:
            assert db.scalar(select(VatRate).where(VatRate.name == "5%")) is not None
    finally:
        app.dependency_overrides.clear()
