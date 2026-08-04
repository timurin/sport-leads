"""Stage 8.2.3.7 — TC generate / apply-routing respects model routing whitelist."""

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
from app.models.product_model import (
    ProductModel,
    ProductModelRoutingLink,
    ProductModelSizeType,
    ProductModelStatus,
)
from app.models.sales import (
    Client,
    Lead,
    LeadTask,
    SalesOrder,
    SalesOrderItem,
    SalesOrderStatus,
    SalesUser,
)
from app.models.shop_routing import ShopRoutingTemplate
from app.models.technical_card import TechnicalCard, TechnicalCardStatus


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def _seed(db: Session) -> dict[str, int]:
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

    product = Nomenclature(
        name="Футболка",
        category="Форма",
        nomenclature_type=NomenclatureType.PRODUCT,
        unit="шт",
        base_price=Decimal("100"),
    )
    model = ProductModel(
        article="PM-WL-1",
        name="Модель whitelist",
        size_type=ProductModelSizeType.MEN,
        status=ProductModelStatus.ACTIVE,
    )
    db.add_all([product, model])
    db.flush()

    route_ok = ShopRoutingTemplate(name="Разрешённый", code="rt-ok", is_active=True)
    route_foreign = ShopRoutingTemplate(name="Чужой", code="rt-x", is_active=True)
    db.add_all([route_ok, route_foreign])
    db.flush()

    db.add(
        ProductModelRoutingLink(
            product_model_id=model.id,
            shop_routing_template_id=route_ok.id,
            sort_order=0,
            is_active=True,
        )
    )
    model.default_routing_template_id = route_ok.id

    order = SalesOrder(
        number="SO-WL-1",
        lead_id=lead.id,
        client_id=client.id,
        status=SalesOrderStatus.NEW,
        title="Whitelist TC",
        responsible_id=1,
    )
    db.add(order)
    db.flush()

    item = SalesOrderItem(
        order_id=order.id,
        position=1,
        nomenclature_id=product.id,
        snapshot_name="Футболка",
        quantity=Decimal("1"),
        unit_price=Decimal("100"),
        line_amount=Decimal("100"),
        discount_amount=Decimal("0"),
        unit="шт",
        product_model_id=model.id,
        product_model_article=model.article,
        product_model_name=model.name,
        routing_template_id=route_ok.id,
        routing_template_name=route_ok.name,
    )
    db.add(item)
    db.flush()

    card = TechnicalCard(
        sales_order_id=order.id,
        sales_order_item_id=item.id,
        number="SO-WL-1-01",
        card_seq=1,
        status=TechnicalCardStatus.DRAFT,
        quantity=item.quantity,
        nomenclature_id=product.id,
        nomenclature_name=product.name,
        nomenclature_type=NomenclatureType.PRODUCT.value,
        product_model_id=model.id,
        product_model_article=model.article,
        product_model_name=model.name,
    )
    db.add(card)
    db.commit()

    return {
        "card_id": card.id,
        "route_ok_id": route_ok.id,
        "route_foreign_id": route_foreign.id,
        "order_id": order.id,
    }


def test_apply_routing_rejects_foreign_when_whitelist_nonempty() -> None:
    SessionLocal = _session_factory()
    db = SessionLocal()
    ids = _seed(db)

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            allowed = client.post(
                f"/technical-cards/{ids['card_id']}/apply-routing",
                json={"routing_template_id": ids["route_ok_id"]},
            )
            assert allowed.status_code == 200, allowed.text
            assert allowed.json()["routing_template_id"] == ids["route_ok_id"]

            foreign = client.post(
                f"/technical-cards/{ids['card_id']}/apply-routing",
                json={"routing_template_id": ids["route_foreign_id"]},
            )
            assert foreign.status_code == 422, foreign.text
            assert "whitelist" in foreign.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_db, None)
        db.close()


def test_generate_uses_order_item_routing_when_present() -> None:
    SessionLocal = _session_factory()
    db = SessionLocal()
    ids = _seed(db)

    # Remove pre-seeded card so generate creates a fresh one from the order item.
    card = db.get(TechnicalCard, ids["card_id"])
    assert card is not None
    db.delete(card)
    db.commit()

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            generated = client.post(
                f"/orders/{ids['order_id']}/technical-cards/generate",
                json={},
            )
            assert generated.status_code == 201, generated.text
            body = generated.json()
            assert len(body["created"]) == 1
            card_payload = body["created"][0]
            assert card_payload["routing_template_id"] == ids["route_ok_id"]
    finally:
        app.dependency_overrides.pop(get_db, None)
        db.close()
