"""Order-item routing snapshot: 3.2.7.2 smoke + 3.2.7.4 regression.

Coverage:
- require routing when model whitelist ≥1 active link
- foreign routing (other model's whitelist) rejected
- optional when whitelist empty
- inactive template / inactive link rejected on new select
- routing name snapshot immutable after catalog rename
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.nomenclature import Nomenclature, NomenclatureType
from app.models.product_model import (
    AssemblyOperationLine,
    AssemblyVariant,
    NomenclatureProductModel,
    ProductModel,
    ProductModelRoutingLink,
    ProductModelSizeType,
    ProductModelStatus,
)
from app.models.sales import Lead, LeadTask, SalesUser
from app.models.shop_routing import ShopRoutingTemplate


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


def _seed_catalog(db: Session) -> dict[str, int]:
    product = Nomenclature(
        name="PRODUCT с whitelist",
        category="Форма",
        nomenclature_type=NomenclatureType.PRODUCT,
        unit="шт",
        base_price=Decimal("1500.00"),
    )
    model_with_routing = ProductModel(
        article="PMR-001",
        name="Модель с маршрутами",
        size_type=ProductModelSizeType.MEN,
        status=ProductModelStatus.ACTIVE,
    )
    model_no_routing = ProductModel(
        article="PMR-002",
        name="Модель без маршрутов",
        size_type=ProductModelSizeType.WOMEN,
        status=ProductModelStatus.ACTIVE,
    )
    model_other = ProductModel(
        article="PMR-003",
        name="Другая модель",
        size_type=ProductModelSizeType.KIDS,
        status=ProductModelStatus.ACTIVE,
    )
    db.add_all([product, model_with_routing, model_no_routing, model_other])
    db.flush()

    variant = AssemblyVariant(
        product_model_id=model_with_routing.id,
        name="Базовый",
        is_active=True,
        sort_order=0,
    )
    variant_no_routing = AssemblyVariant(
        product_model_id=model_no_routing.id,
        name="Базовый NR",
        is_active=True,
        sort_order=0,
    )
    db.add_all([variant, variant_no_routing])
    db.flush()
    db.add(
        AssemblyOperationLine(
            assembly_variant_id=variant.id,
            sequence=1,
            operation_name="Сборка",
            cost=Decimal("10.00"),
            duration_seconds=10,
        )
    )
    db.add(
        AssemblyOperationLine(
            assembly_variant_id=variant_no_routing.id,
            sequence=1,
            operation_name="Сборка NR",
            cost=Decimal("5.00"),
            duration_seconds=5,
        )
    )

    route_a = ShopRoutingTemplate(name="Маршрут A", code="rt-a", is_active=True)
    route_b = ShopRoutingTemplate(name="Маршрут B", code="rt-b", is_active=True)
    route_foreign = ShopRoutingTemplate(name="Чужой", code="rt-x", is_active=True)
    route_inactive = ShopRoutingTemplate(name="Неактивный", code="rt-off", is_active=False)
    db.add_all([route_a, route_b, route_foreign, route_inactive])
    db.flush()

    db.add_all(
        [
            ProductModelRoutingLink(
                product_model_id=model_with_routing.id,
                shop_routing_template_id=route_a.id,
                sort_order=0,
                is_active=True,
            ),
            ProductModelRoutingLink(
                product_model_id=model_with_routing.id,
                shop_routing_template_id=route_b.id,
                sort_order=1,
                is_active=True,
            ),
            ProductModelRoutingLink(
                product_model_id=model_with_routing.id,
                shop_routing_template_id=route_inactive.id,
                sort_order=2,
                is_active=True,
            ),
            ProductModelRoutingLink(
                product_model_id=model_other.id,
                shop_routing_template_id=route_foreign.id,
                sort_order=0,
                is_active=True,
            ),
            NomenclatureProductModel(
                nomenclature_id=product.id,
                product_model_id=model_with_routing.id,
                sort_order=0,
            ),
            NomenclatureProductModel(
                nomenclature_id=product.id,
                product_model_id=model_no_routing.id,
                sort_order=1,
            ),
        ]
    )
    db.commit()
    return {
        "product_id": product.id,
        "model_with_routing_id": model_with_routing.id,
        "model_no_routing_id": model_no_routing.id,
        "variant_id": variant.id,
        "variant_no_routing_id": variant_no_routing.id,
        "route_a_id": route_a.id,
        "route_b_id": route_b.id,
        "route_foreign_id": route_foreign.id,
        "route_inactive_id": route_inactive.id,
    }


@contextmanager
def _client(factory: sessionmaker[Session]) -> Iterator[TestClient]:
    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.clear()


def _convert_order(client: TestClient, factory: sessionmaker[Session]) -> int:
    lead_id = _add_lead(factory)
    return client.post(
        f"/leads/{lead_id}/convert",
        json={"completed_by_id": 1},
    ).json()["order"]["id"]


def test_order_item_routing_required_when_whitelist_nonempty() -> None:
    factory = _session_factory()
    with factory() as db:
        ids = _seed_catalog(db)

    with _client(factory) as client:
        order_id = _convert_order(client, factory)

        missing = client.post(
            f"/orders/{order_id}/items",
            json={
                "nomenclature_id": ids["product_id"],
                "product_model_id": ids["model_with_routing_id"],
                "assembly_variant_id": ids["variant_id"],
                "snapshot_name": "Без маршрута",
                "unit": "шт",
                "quantity": "1",
                "unit_price": "1500",
            },
        )
        assert missing.status_code == 400, missing.text
        assert "routing template is required" in missing.json()["detail"].lower()

        ok = client.post(
            f"/orders/{order_id}/items",
            json={
                "nomenclature_id": ids["product_id"],
                "product_model_id": ids["model_with_routing_id"],
                "assembly_variant_id": ids["variant_id"],
                "routing_template_id": ids["route_a_id"],
                "snapshot_name": "С маршрутом",
                "unit": "шт",
                "quantity": "1",
                "unit_price": "1500",
            },
        )
        assert ok.status_code == 201, ok.text
        body = ok.json()
        assert body["routing_template_id"] == ids["route_a_id"]
        assert body["routing_template_name"] == "Маршрут A"


def test_order_item_rejects_foreign_routing() -> None:
    factory = _session_factory()
    with factory() as db:
        ids = _seed_catalog(db)

    with _client(factory) as client:
        order_id = _convert_order(client, factory)

        foreign = client.post(
            f"/orders/{order_id}/items",
            json={
                "nomenclature_id": ids["product_id"],
                "product_model_id": ids["model_with_routing_id"],
                "assembly_variant_id": ids["variant_id"],
                "routing_template_id": ids["route_foreign_id"],
                "snapshot_name": "Чужой маршрут",
                "unit": "шт",
                "quantity": "1",
                "unit_price": "1500",
            },
        )
        assert foreign.status_code == 400, foreign.text
        assert "routing whitelist" in foreign.json()["detail"].lower()


def test_order_item_routing_optional_when_whitelist_empty() -> None:
    factory = _session_factory()
    with factory() as db:
        ids = _seed_catalog(db)

    with _client(factory) as client:
        order_id = _convert_order(client, factory)

        ok = client.post(
            f"/orders/{order_id}/items",
            json={
                "nomenclature_id": ids["product_id"],
                "product_model_id": ids["model_no_routing_id"],
                "assembly_variant_id": ids["variant_no_routing_id"],
                "snapshot_name": "Без whitelist маршрутов",
                "unit": "шт",
                "quantity": "1",
                "unit_price": "1500",
            },
        )
        assert ok.status_code == 201, ok.text
        body = ok.json()
        assert body["routing_template_id"] is None
        assert body["routing_template_name"] is None


def test_order_item_rejects_inactive_routing_on_new_select() -> None:
    """3.2.7.4: inactive routing template cannot be newly selected."""
    factory = _session_factory()
    with factory() as db:
        ids = _seed_catalog(db)

    with _client(factory) as client:
        order_id = _convert_order(client, factory)
        response = client.post(
            f"/orders/{order_id}/items",
            json={
                "nomenclature_id": ids["product_id"],
                "product_model_id": ids["model_with_routing_id"],
                "assembly_variant_id": ids["variant_id"],
                "routing_template_id": ids["route_inactive_id"],
                "snapshot_name": "Неактивный маршрут",
                "unit": "шт",
                "quantity": "1",
                "unit_price": "1500",
            },
        )
        assert response.status_code == 400, response.text
        detail = response.json()["detail"].lower()
        assert "inactive" in detail or "routing" in detail


def test_order_item_rejects_inactive_routing_link_on_new_select() -> None:
    """3.2.7.4: inactive whitelist link cannot be newly selected."""
    factory = _session_factory()
    with factory() as db:
        ids = _seed_catalog(db)
        link = db.scalars(
            select(ProductModelRoutingLink).where(
                ProductModelRoutingLink.product_model_id == ids["model_with_routing_id"],
                ProductModelRoutingLink.shop_routing_template_id == ids["route_b_id"],
            )
        ).first()
        assert link is not None
        link.is_active = False
        db.commit()

    with _client(factory) as client:
        order_id = _convert_order(client, factory)
        response = client.post(
            f"/orders/{order_id}/items",
            json={
                "nomenclature_id": ids["product_id"],
                "product_model_id": ids["model_with_routing_id"],
                "assembly_variant_id": ids["variant_id"],
                "routing_template_id": ids["route_b_id"],
                "snapshot_name": "Неактивная связь whitelist",
                "unit": "шт",
                "quantity": "1",
                "unit_price": "1500",
            },
        )
        assert response.status_code == 400, response.text
        detail = response.json()["detail"].lower()
        assert "inactive" in detail or "whitelist" in detail


def test_order_item_routing_snapshot_immutable_after_catalog_rename() -> None:
    """3.2.7.4: catalog rename must not rewrite stored routing_template_name."""
    factory = _session_factory()
    with factory() as db:
        ids = _seed_catalog(db)

    with _client(factory) as client:
        order_id = _convert_order(client, factory)
        created = client.post(
            f"/orders/{order_id}/items",
            json={
                "nomenclature_id": ids["product_id"],
                "product_model_id": ids["model_with_routing_id"],
                "assembly_variant_id": ids["variant_id"],
                "routing_template_id": ids["route_a_id"],
                "snapshot_name": "Снимок маршрута",
                "unit": "шт",
                "quantity": "1",
                "unit_price": "1500",
            },
        )
        assert created.status_code == 201, created.text
        item = created.json()
        item_id = item["id"]
        assert item["routing_template_id"] == ids["route_a_id"]
        assert item["routing_template_name"] == "Маршрут A"

        with factory() as db:
            template = db.get(ShopRoutingTemplate, ids["route_a_id"])
            assert template is not None
            template.name = "Маршрут A (переименован)"
            db.commit()

        # Unrelated PATCH must not refresh routing name from catalog.
        patched = client.patch(
            f"/orders/{order_id}/items/{item_id}",
            json={"quantity": "2"},
        )
        assert patched.status_code == 200, patched.text
        after = patched.json()
        assert after["quantity"] == "2"
        assert after["routing_template_id"] == ids["route_a_id"]
        assert after["routing_template_name"] == "Маршрут A"

        # Re-read via GET order items / order detail if available.
        order = client.get(f"/orders/{order_id}")
        assert order.status_code == 200, order.text
        lines = order.json()["items"]
        row = next(line for line in lines if line["id"] == item_id)
        assert row["routing_template_name"] == "Маршрут A"
