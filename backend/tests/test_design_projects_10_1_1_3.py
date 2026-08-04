"""Stage 10.1.1.3 — DesignProject / DesignVersion API (ADR-021)."""

from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
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


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_design_versions_one_current "
                "ON design_versions (design_project_id) "
                "WHERE status = 'current'"
            )
        )
    return sessionmaker(bind=engine, expire_on_commit=False)


def _seed(db: Session) -> tuple[int, int, int]:
    db.add(SalesUser(id=1, name="Test"))
    client = Client(contact_name="A", company_name="B", responsible_id=1)
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
        estimated_quantity=2,
        estimated_amount=Decimal("2000"),
    )
    db.add(lead)
    db.flush()
    db.add(LeadTask(lead_id=lead.id, title="Задача"))
    order = SalesOrder(
        number="SO-DP-API",
        lead_id=lead.id,
        client_id=client.id,
        status=SalesOrderStatus.NEW,
        title="Заказ DP API",
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
        number="SO-DP-API-01",
        card_seq=1,
        status=TechnicalCardStatus.DRAFT,
        quantity=Decimal("1"),
        nomenclature_name="Изделие",
    )
    db.add(card)
    db.commit()
    return order.id, item.id, card.id


def test_design_project_api_create_versions_set_current() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            sales_order_id, item_id, card_id = _seed(db)

        with TestClient(app) as client:
            created = client.post(
                "/design-projects",
                json={
                    "sales_order_id": sales_order_id,
                    "title": "Макет формы",
                },
            )
            assert created.status_code == 201, created.text
            body = created.json()
            assert body["number"] == "DP-SO-DP-API-1"
            assert body["project_seq"] == 1
            assert body["status"] == "draft"
            assert body["versions"] == []
            project_id = body["id"]

            listed = client.get(
                "/design-projects", params={"sales_order_id": sales_order_id}
            )
            assert listed.status_code == 200
            assert len(listed.json()) == 1
            assert listed.json()[0]["version_count"] == 0

            v1 = client.post(
                f"/design-projects/{project_id}/versions",
                json={
                    "notes": "черновик",
                    "sales_order_item_id": item_id,
                    "technical_card_id": card_id,
                },
            )
            assert v1.status_code == 201, v1.text
            v1_body = v1.json()
            assert v1_body["version_no"] == 1
            assert v1_body["label"] == "v1"
            assert v1_body["status"] == "draft"
            v1_id = v1_body["id"]

            detail = client.get(f"/design-projects/{project_id}")
            assert detail.status_code == 200
            assert detail.json()["status"] == "in_progress"
            assert len(detail.json()["versions"]) == 1

            set_cur = client.post(
                f"/design-projects/{project_id}/versions/{v1_id}/set-current"
            )
            assert set_cur.status_code == 200, set_cur.text
            assert set_cur.json()["status"] == "current"

            v2 = client.post(
                f"/design-projects/{project_id}/versions",
                json={"make_current": True},
            )
            assert v2.status_code == 201, v2.text
            assert v2.json()["version_no"] == 2
            assert v2.json()["status"] == "current"

            versions = client.get(f"/design-projects/{project_id}/versions")
            assert versions.status_code == 200
            by_no = {row["version_no"]: row for row in versions.json()}
            assert by_no[1]["status"] == "superseded"
            assert by_no[2]["status"] == "current"

            ready = client.patch(
                f"/design-projects/{project_id}",
                json={"status": "ready"},
            )
            assert ready.status_code == 200, ready.text
            assert ready.json()["status"] == "ready"

            archived = client.patch(
                f"/design-projects/{project_id}",
                json={"status": "archived"},
            )
            assert archived.status_code == 200
            blocked = client.post(
                f"/design-projects/{project_id}/versions",
                json={},
            )
            assert blocked.status_code == 422, blocked.text
    finally:
        app.dependency_overrides.clear()


def test_design_version_rejects_foreign_order_links() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            sales_order_id, _, card_id = _seed(db)
            lead2 = Lead(
                contact_name="Пётр",
                company_name="СК2",
                phone="+79990000001",
                email="b@example.com",
                city="Казань",
                source="website",
                responsible_id=1,
                sport="Футбол",
                product_category="Форма",
                need_description="Форма",
                estimated_quantity=1,
                estimated_amount=Decimal("500"),
            )
            db.add(lead2)
            db.flush()
            db.add(LeadTask(lead_id=lead2.id, title="Задача 2"))
            other = SalesOrder(
                number="SO-OTHER-DP",
                lead_id=lead2.id,
                client_id=db.get(SalesOrder, sales_order_id).client_id,
                status=SalesOrderStatus.NEW,
                title="Другой",
                responsible_id=1,
            )
            db.add(other)
            db.commit()
            other_id = other.id

        with TestClient(app) as client:
            project = client.post(
                "/design-projects",
                json={"sales_order_id": other_id},
            )
            assert project.status_code == 201, project.text
            bad = client.post(
                f"/design-projects/{project.json()['id']}/versions",
                json={"technical_card_id": card_id},
            )
            assert bad.status_code == 422, bad.text
    finally:
        app.dependency_overrides.clear()


def test_design_project_404() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            missing = client.get("/design-projects/999999")
            assert missing.status_code == 404
    finally:
        app.dependency_overrides.clear()
