"""Stage 19.4 — collaboration notification inbox."""

from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
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


def _seed_order(db: Session) -> tuple[int, int]:
    sales_user = db.get(SalesUser, 1)
    if sales_user is None:
        sales_user = SalesUser(id=1, name="Test")
        db.add(sales_user)
        db.flush()
    client = Client(contact_name="A", company_name="B", responsible_id=sales_user.id)
    db.add(client)
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
        number="SO-NOTIF-1",
        lead_id=lead.id,
        client_id=client.id,
        status=SalesOrderStatus.NEW,
        title="Заказ notif",
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
        number="SO-NOTIF-1-01",
        card_seq=1,
        status=TechnicalCardStatus.DRAFT,
        quantity=Decimal("1"),
        nomenclature_name="Изделие",
    )
    db.add(card)
    db.flush()
    return order.id, card.id


def test_collaboration_notifications_mention_assign_complete_and_read() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            ensure_user_with_role(db, login="alice", role_code="admin")
            bob_id = ensure_user_with_role(
                db, login="bob", role_code="shop_operator"
            )
            order_id, card_id = _seed_order(db)
            db.commit()

        with TestClient(app) as client:
            assert client.get("/collaboration/notifications").status_code == 401

            login_client(client, login="alice")
            created = client.post(
                f"/orders/{order_id}/collaboration/messages",
                json={
                    "body": "Смотри @bob",
                    "technical_card_id": card_id,
                },
            )
            assert created.status_code == 201, created.text

            task = client.post(
                f"/orders/{order_id}/collaboration/microtasks",
                json={
                    "title": "Правка по макету",
                    "assignee_platform_user_id": bob_id,
                    "technical_card_id": card_id,
                },
            )
            assert task.status_code == 201, task.text
            task_id = task.json()["id"]

            client.post("/auth/logout")
            login_client(client, login="bob")
            inbox = client.get("/collaboration/notifications")
            assert inbox.status_code == 200, inbox.text
            payload = inbox.json()
            assert payload["unread_count"] >= 2
            kinds = {item["kind"] for item in payload["items"]}
            assert "mention" in kinds
            assert "microtask_assigned" in kinds
            mention = next(i for i in payload["items"] if i["kind"] == "mention")
            assert mention["deep_link"] == f"/production/tech-cards/{card_id}"
            assert mention["read_at"] is None

            marked = client.post(
                f"/collaboration/notifications/{mention['id']}/read"
            )
            assert marked.status_code == 200
            assert marked.json()["read_at"] is not None

            done = client.patch(
                f"/collaboration/microtasks/{task_id}",
                json={"status": "done"},
            )
            assert done.status_code == 200

            client.post("/auth/logout")
            login_client(client, login="alice")
            alice_inbox = client.get(
                "/collaboration/notifications",
                params={"unread_only": True},
            )
            assert alice_inbox.status_code == 200
            alice_kinds = {i["kind"] for i in alice_inbox.json()["items"]}
            assert "microtask_completed" in alice_kinds

            read_all = client.post("/collaboration/notifications/read-all")
            assert read_all.status_code == 200
            assert read_all.json()["marked"] >= 1
            after = client.get(
                "/collaboration/notifications",
                params={"unread_only": True},
            )
            assert after.json()["unread_count"] == 0
            assert after.json()["items"] == []
    finally:
        app.dependency_overrides.pop(get_db, None)
