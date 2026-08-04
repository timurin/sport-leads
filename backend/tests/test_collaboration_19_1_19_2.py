"""Stage 19.1–19.2 — internal collaboration order chat (ADR-026)."""

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


def _seed_order(db: Session, *, number: str = "SO-COLLAB-1") -> tuple[int, int]:
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
        number=number,
        lead_id=lead.id,
        client_id=client.id,
        status=SalesOrderStatus.NEW,
        title="Заказ collab",
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
        number=f"{number}-01",
        card_seq=1,
        status=TechnicalCardStatus.DRAFT,
        quantity=Decimal("1"),
        nomenclature_name="Изделие",
    )
    db.add(card)
    db.flush()
    return order.id, card.id


def test_collaboration_messages_mentions_and_auth() -> None:
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
            order_id, card_id = _seed_order(db)
            other_order_id, _ = _seed_order(db, number="SO-COLLAB-2")
            db.commit()

        with TestClient(app) as client:
            assert (
                client.get(f"/orders/{order_id}/collaboration/messages").status_code
                == 401
            )

            login_client(client, login="alice")
            listed = client.get(f"/orders/{order_id}/collaboration/messages")
            assert listed.status_code == 200, listed.text
            assert listed.json() == []

            created = client.post(
                f"/orders/{order_id}/collaboration/messages",
                json={
                    "body": "Нужна правка @bob по макету",
                    "technical_card_id": card_id,
                },
            )
            assert created.status_code == 201, created.text
            body = created.json()
            assert body["body"].startswith("Нужна правка")
            assert body["technical_card_id"] == card_id
            assert body["author_login"] == "alice"
            assert len(body["mentions"]) == 1
            assert body["mentions"][0]["mentioned_login_snapshot"] == "bob"

            filtered = client.get(
                f"/orders/{order_id}/collaboration/messages",
                params={"technical_card_id": card_id},
            )
            assert filtered.status_code == 200
            assert len(filtered.json()) == 1

            missing = client.get("/orders/999999/collaboration/messages")
            assert missing.status_code == 404

            foreign_card = client.post(
                f"/orders/{other_order_id}/collaboration/messages",
                json={"body": "чужая ТК", "technical_card_id": card_id},
            )
            assert foreign_card.status_code == 422

            candidates = client.get(
                "/collaboration/mention-candidates",
                params={"q": "bo"},
            )
            assert candidates.status_code == 200
            logins = {row["login"] for row in candidates.json()}
            assert "bob" in logins
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_collaboration_microtasks_assign_complete_list() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            alice_id = ensure_user_with_role(db, login="alice", role_code="admin")
            bob_id = ensure_user_with_role(
                db, login="bob", role_code="shop_operator"
            )
            order_id, card_id = _seed_order(db)
            db.commit()

        with TestClient(app) as client:
            login_client(client, login="alice")

            templates = client.get("/collaboration/microtask-title-templates")
            assert templates.status_code == 200
            assert "Правка по макету" in templates.json()
            assert "Не хватает материала" in templates.json()

            msg = client.post(
                f"/orders/{order_id}/collaboration/messages",
                json={"body": "Создаём задачу"},
            )
            assert msg.status_code == 201
            message_id = msg.json()["id"]

            created = client.post(
                f"/orders/{order_id}/collaboration/microtasks",
                json={
                    "title": "Правка по макету",
                    "assignee_platform_user_id": bob_id,
                    "technical_card_id": card_id,
                    "source_message_id": message_id,
                },
            )
            assert created.status_code == 201, created.text
            task = created.json()
            assert task["status"] == "open"
            assert task["assignee_platform_user_id"] == bob_id
            assert task["created_by_platform_user_id"] == alice_id
            assert task["source_message_id"] == message_id

            listed = client.get(f"/orders/{order_id}/collaboration/microtasks")
            assert listed.status_code == 200
            assert len(listed.json()) == 1

            by_assignee = client.get(
                f"/orders/{order_id}/collaboration/microtasks",
                params={"assignee_platform_user_id": bob_id},
            )
            assert by_assignee.status_code == 200
            assert len(by_assignee.json()) == 1

            done = client.patch(
                f"/collaboration/microtasks/{task['id']}",
                json={"status": "done"},
            )
            assert done.status_code == 200
            assert done.json()["status"] == "done"
            assert done.json()["completed_at"] is not None

            reopen = client.patch(
                f"/collaboration/microtasks/{task['id']}",
                json={"status": "open"},
            )
            assert reopen.status_code == 200
            assert reopen.json()["status"] == "open"
            assert reopen.json()["completed_at"] is None
    finally:
        app.dependency_overrides.pop(get_db, None)
