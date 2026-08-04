"""Stage 12.3.1 — FG stock document types fg_receipt / fg_issue (ADR-019)."""

from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.nomenclature import Nomenclature, NomenclatureType
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
from app.models.warehouse import Warehouse


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def _seed(db: Session) -> tuple[int, int, int, int]:
    warehouse = Warehouse(
        name="Основной",
        code="main",
        is_active=True,
        is_default=True,
    )
    product = Nomenclature(
        name="Футболка PRO",
        category="Форма",
        nomenclature_type=NomenclatureType.PRODUCT,
        unit="шт",
        base_price=Decimal("1500.00"),
    )
    db.add_all([warehouse, product])
    db.flush()
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
        estimated_quantity=1,
        estimated_amount=Decimal("1000"),
    )
    db.add(lead)
    db.flush()
    db.add(LeadTask(lead_id=lead.id, title="Задача"))
    order = SalesOrder(
        number="SO-FG-1",
        lead_id=lead.id,
        client_id=client.id,
        status=SalesOrderStatus.NEW,
        title="FG",
        responsible_id=1,
    )
    db.add(order)
    db.flush()
    item = SalesOrderItem(
        order_id=order.id,
        position=1,
        snapshot_name="Изделие",
        quantity=Decimal("5"),
        unit_price=Decimal("100"),
        line_amount=Decimal("500"),
        discount_amount=Decimal("0"),
        unit="шт",
    )
    db.add(item)
    db.flush()
    card = TechnicalCard(
        sales_order_id=order.id,
        sales_order_item_id=item.id,
        number="SO-FG-1-01",
        card_seq=1,
        status=TechnicalCardStatus.DRAFT,
        quantity=Decimal("5"),
        nomenclature_id=product.id,
        nomenclature_name="Футболка PRO",
    )
    db.add(card)
    db.commit()
    return warehouse.id, product.id, card.id, order.id


def test_fg_receipt_and_issue_post_with_tc_links() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            warehouse_id, product_id, card_id, order_id = _seed(db)

        with TestClient(app) as client:
            receipt = client.post(
                "/stock/documents",
                json={
                    "doc_type": "fg_receipt",
                    "warehouse_id": warehouse_id,
                    "technical_card_id": card_id,
                    "lines": [
                        {"nomenclature_id": product_id, "quantity": "5.000"}
                    ],
                    "post": True,
                },
            )
            assert receipt.status_code == 201, receipt.text
            body = receipt.json()
            assert body["doc_type"] == "fg_receipt"
            assert body["technical_card_id"] == card_id
            assert body["sales_order_id"] == order_id
            assert body["ledger_lines"][0]["quantity"] == "5.000"
            assert body["ledger_lines"][0]["technical_card_id"] == card_id

            balances = client.get(
                "/stock/balances",
                params={"warehouse_id": warehouse_id, "nomenclature_id": product_id},
            )
            assert balances.status_code == 200
            assert Decimal(balances.json()[0]["quantity"]) == Decimal("5.000")

            issue = client.post(
                "/stock/documents",
                json={
                    "doc_type": "fg_issue",
                    "warehouse_id": warehouse_id,
                    "technical_card_id": card_id,
                    "sales_order_id": order_id,
                    "lines": [
                        {"nomenclature_id": product_id, "quantity": "2.000"}
                    ],
                    "post": True,
                },
            )
            assert issue.status_code == 201, issue.text
            assert issue.json()["doc_type"] == "fg_issue"
            assert issue.json()["ledger_lines"][0]["quantity"] == "-2.000"

            after = client.get(
                "/stock/balances",
                params={"warehouse_id": warehouse_id, "nomenclature_id": product_id},
            )
            assert Decimal(after.json()[0]["quantity"]) == Decimal("3.000")
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_fg_receipt_requires_technical_card() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            warehouse_id, product_id, _, _ = _seed(db)

        with TestClient(app) as client:
            response = client.post(
                "/stock/documents",
                json={
                    "doc_type": "fg_receipt",
                    "warehouse_id": warehouse_id,
                    "lines": [
                        {"nomenclature_id": product_id, "quantity": "1"}
                    ],
                },
            )
            assert response.status_code == 422, response.text
    finally:
        app.dependency_overrides.pop(get_db, None)
