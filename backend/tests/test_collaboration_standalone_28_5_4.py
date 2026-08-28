"""Stage 28.5.4 — collaboration on standalone tech card (contour B)."""

from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.characteristics import NomenclatureVariant  # noqa: F401
from app.models.media import NomenclatureMedia  # noqa: F401
from app.models.nomenclature import Nomenclature, NomenclatureHistoryEntry, NomenclatureType  # noqa: F401
from app.models.sales import (
    Client,
    Lead,
    LeadTask,
    SalesOrder,
    SalesOrderItem,
    SalesOrderStatus,
    SalesUser,
)
from app.models.technical_card import TechnicalCard, TechnicalCardStatus
from tests.auth_test_helpers import ensure_user_with_role, login_client


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_standalone_tech_card_collaboration_messages_and_mentions() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            ensure_user_with_role(db, login="alice", role_code="admin")
            ensure_user_with_role(
                db, login="bob", display_name="Bob Ops", role_code="shop_operator"
            )
            db.add(SalesUser(id=1, name="Test"))
            db.flush()
            nomenclature = Nomenclature(
                name="Футболка PRO",
                category="Форма",
                nomenclature_type=NomenclatureType.PRODUCT,
                unit="шт",
                base_price=Decimal("1500.00"),
            )
            db.add(nomenclature)
            db.commit()
            nomenclature_id = nomenclature.id

        with TestClient(app) as client:
            created_card = client.post(
                "/technical-cards/standalone",
                json={
                    "nomenclature_id": nomenclature_id,
                    "order_number": "1310",
                    "tech_cards_planned_count": 5,
                    "desired_date": "2026-09-15",
                    "quantity": 1,
                },
            )
            assert created_card.status_code == 201, created_card.text
            card_id = created_card.json()["id"]
            group_id = created_card.json()["order_group_id"]

            assert (
                client.get(
                    f"/technical-cards/{card_id}/collaboration/messages"
                ).status_code
                == 401
            )

            login_client(client, login="alice")
            listed = client.get(
                f"/technical-cards/{card_id}/collaboration/messages"
            )
            assert listed.status_code == 200, listed.text
            assert listed.json() == []

            created = client.post(
                f"/technical-cards/{card_id}/collaboration/messages",
                json={"body": "Нужна правка @bob по макету"},
            )
            assert created.status_code == 201, created.text
            body = created.json()
            assert body["sales_order_id"] is None
            assert body["lead_id"] is None
            assert body["order_group_id"] == group_id
            assert body["technical_card_id"] == card_id
            assert body["mentions"][0]["mentioned_login_snapshot"] == "bob"

            listed = client.get(
                f"/technical-cards/{card_id}/collaboration/messages"
            )
            assert listed.status_code == 200
            assert len(listed.json()) == 1

            client.post("/auth/logout")
            login_client(client, login="bob")
            inbox = client.get("/collaboration/notifications")
            assert inbox.status_code == 200, inbox.text
            items = inbox.json()["items"]
            assert any(row["order_group_id"] == group_id for row in items)
            assert any(
                row["technical_card_id"] == card_id
                and "/production/tech-cards/" in row["deep_link"]
                for row in items
            )
    finally:
        app.dependency_overrides.clear()


def test_contour_a_card_rejects_standalone_collaboration() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            ensure_user_with_role(db, login="alice", role_code="admin")
            db.add(SalesUser(id=1, name="Test"))
            db.flush()
            client_row = Client(
                contact_name="A", company_name="B", responsible_id=1
            )
            db.add(client_row)
            db.flush()
            lead = Lead(
                contact_name="Иван",
                company_name="СК",
                phone="+79990000000",
                email="a@example.com",
                city="Казань",
                source="website",
                responsible_id=1,
                sport="Футбол",
                product_category="Форма",
                need_description="Форма",
                estimated_quantity=1,
                estimated_amount=Decimal("1000"),
            )
            db.add(lead)
            db.flush()
            db.add(LeadTask(lead_id=lead.id, title="Задача"))
            order = SalesOrder(
                number="SO-A",
                lead_id=lead.id,
                client_id=client_row.id,
                status=SalesOrderStatus.NEW,
                title="Заказ",
                responsible_id=1,
            )
            db.add(order)
            db.flush()
            item = SalesOrderItem(
                order_id=order.id,
                position=1,
                snapshot_name="Изделие",
                quantity=Decimal("1"),
                unit_price=Decimal("100"),
                line_amount=Decimal("100"),
                discount_amount=Decimal("0"),
                unit="шт",
            )
            db.add(item)
            db.flush()
            card = TechnicalCard(
                sales_order_id=order.id,
                sales_order_item_id=item.id,
                number="SO-A-1",
                card_seq=1,
                status=TechnicalCardStatus.DRAFT,
                quantity=Decimal("1"),
                nomenclature_name="Изделие",
            )
            db.add(card)
            db.commit()
            card_id = card.id

        with TestClient(app) as client:
            login_client(client, login="alice")
            listed = client.get(
                f"/technical-cards/{card_id}/collaboration/messages"
            )
            assert listed.status_code == 422, listed.text
            assert "standalone" in listed.json()["detail"].lower()
    finally:
        app.dependency_overrides.clear()
