"""26.1.1 — refuse deleting a sales-order line that still has a technical card."""

from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.nomenclature import Nomenclature, NomenclatureType
from app.models.sales import Lead, LeadTask, SalesOrderItem, SalesUser
from app.models.technical_card import TechnicalCard, TechnicalCardStatus


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


def test_delete_order_item_blocked_when_tech_card_exists() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            product = Nomenclature(
                name="Футболка PRO",
                category="Форма",
                nomenclature_type=NomenclatureType.PRODUCT,
                unit="шт",
                base_price=Decimal("1500.00"),
            )
            db.add(product)
            db.commit()
            product_id = product.id
        lead_id = _add_lead(factory)

        with TestClient(app) as client:
            order_id = client.post(
                f"/leads/{lead_id}/convert",
                json={"completed_by_id": 1},
            ).json()["order"]["id"]
            item = client.post(
                f"/orders/{order_id}/items",
                json={
                    "nomenclature_id": product_id,
                    "snapshot_name": "Футболка PRO",
                    "unit": "шт",
                    "quantity": "2",
                    "unit_price": "1500",
                },
            )
            assert item.status_code == 201, item.text
            item_id = item.json()["id"]

            generated = client.post(f"/orders/{order_id}/technical-cards/generate")
            assert generated.status_code == 201, generated.text
            card_number = generated.json()["created"][0]["number"]

            blocked = client.delete(f"/orders/{order_id}/items/{item_id}")
            assert blocked.status_code == 409, blocked.text
            detail = blocked.json()["detail"]
            assert card_number in detail
            assert "Черновик" in detail
            assert "не удалена" in detail.lower() or "не удалены" in detail.lower()
            assert "каскад" in detail.lower()

            with factory() as db:
                assert db.get(SalesOrderItem, item_id) is not None
                card = db.scalar(
                    select(TechnicalCard).where(TechnicalCard.sales_order_item_id == item_id)
                )
                assert card is not None
                assert card.status == TechnicalCardStatus.DRAFT
    finally:
        app.dependency_overrides.clear()


def test_delete_order_item_without_tech_card_still_succeeds() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        lead_id = _add_lead(factory)
        with TestClient(app) as client:
            order_id = client.post(
                f"/leads/{lead_id}/convert",
                json={"completed_by_id": 1},
            ).json()["order"]["id"]
            item = client.post(
                f"/orders/{order_id}/items",
                json={
                    "snapshot_name": "Ручная позиция",
                    "unit": "шт",
                    "quantity": "1",
                    "unit_price": "100",
                },
            )
            assert item.status_code == 201, item.text
            item_id = item.json()["id"]
            deleted = client.delete(f"/orders/{order_id}/items/{item_id}")
            assert deleted.status_code == 204, deleted.text
    finally:
        app.dependency_overrides.clear()
