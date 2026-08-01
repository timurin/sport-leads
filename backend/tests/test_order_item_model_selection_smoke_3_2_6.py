"""3.2.6.1 — Order-item model selection smoke (PRODUCT → model → assembly → routing).

Single reference path on API TestClient data:
- whitelist filter / required model
- autofill article / name / size_type
- assembly variant offer + reject foreign variant
- routing offer from model whitelist + reject foreign routing
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
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
    empty_product = Nomenclature(
        name="PRODUCT без whitelist",
        category="Форма",
        nomenclature_type=NomenclatureType.PRODUCT,
        unit="шт",
        base_price=Decimal("1000.00"),
    )
    whitelist_product = Nomenclature(
        name="PRODUCT с whitelist",
        category="Форма",
        nomenclature_type=NomenclatureType.PRODUCT,
        unit="шт",
        base_price=Decimal("1500.00"),
    )
    model_a = ProductModel(
        article="SMOKE-A",
        name="Модель Smoke A",
        size_type=ProductModelSizeType.MEN,
        status=ProductModelStatus.ACTIVE,
    )
    model_b = ProductModel(
        article="SMOKE-B",
        name="Модель Smoke B",
        size_type=ProductModelSizeType.WOMEN,
        status=ProductModelStatus.ACTIVE,
    )
    db.add_all([empty_product, whitelist_product, model_a, model_b])
    db.flush()

    variant_a = AssemblyVariant(
        product_model_id=model_a.id,
        name="Сборка A",
        is_active=True,
        sort_order=0,
    )
    variant_b = AssemblyVariant(
        product_model_id=model_b.id,
        name="Сборка B",
        is_active=True,
        sort_order=0,
    )
    db.add_all([variant_a, variant_b])
    db.flush()
    db.add_all(
        [
            AssemblyOperationLine(
                assembly_variant_id=variant_a.id,
                sequence=1,
                operation_name="Операция A",
                cost=Decimal("20.00"),
                duration_seconds=20,
            ),
            AssemblyOperationLine(
                assembly_variant_id=variant_b.id,
                sequence=1,
                operation_name="Операция B",
                cost=Decimal("30.00"),
                duration_seconds=30,
            ),
        ]
    )

    route_a = ShopRoutingTemplate(name="Маршрут Smoke A", code="smoke-a", is_active=True)
    route_b = ShopRoutingTemplate(name="Маршрут Smoke B", code="smoke-b", is_active=True)
    db.add_all([route_a, route_b])
    db.flush()

    db.add_all(
        [
            ProductModelRoutingLink(
                product_model_id=model_a.id,
                shop_routing_template_id=route_a.id,
                sort_order=0,
                is_active=True,
            ),
            ProductModelRoutingLink(
                product_model_id=model_b.id,
                shop_routing_template_id=route_b.id,
                sort_order=0,
                is_active=True,
            ),
            NomenclatureProductModel(
                nomenclature_id=whitelist_product.id,
                product_model_id=model_a.id,
                sort_order=0,
            ),
        ]
    )
    db.commit()
    return {
        "empty_product_id": empty_product.id,
        "whitelist_product_id": whitelist_product.id,
        "model_a_id": model_a.id,
        "model_b_id": model_b.id,
        "variant_a_id": variant_a.id,
        "variant_b_id": variant_b.id,
        "route_a_id": route_a.id,
        "route_b_id": route_b.id,
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


def test_order_item_model_selection_smoke_3_2_6() -> None:
    """End-to-end smoke checklist for 3.2.6.1 on persistent API rules."""
    factory = _session_factory()
    with factory() as db:
        ids = _seed_catalog(db)

    with _client(factory) as client:
        order_id = _convert_order(client, factory)

        # 1. Empty PRODUCT whitelist → model optional
        empty_ok = client.post(
            f"/orders/{order_id}/items",
            json={
                "nomenclature_id": ids["empty_product_id"],
                "snapshot_name": "Без модели",
                "unit": "шт",
                "quantity": "1",
                "unit_price": "1000",
            },
        )
        assert empty_ok.status_code == 201, empty_ok.text
        assert empty_ok.json()["product_model_id"] is None

        # 2. Non-empty whitelist without model → reject
        missing_model = client.post(
            f"/orders/{order_id}/items",
            json={
                "nomenclature_id": ids["whitelist_product_id"],
                "snapshot_name": "Нужна модель",
                "unit": "шт",
                "quantity": "1",
                "unit_price": "1500",
            },
        )
        assert missing_model.status_code == 400, missing_model.text
        assert "product model is required" in missing_model.json()["detail"].lower()

        # 3. Foreign model (not on PRODUCT available list) → reject
        foreign_model = client.post(
            f"/orders/{order_id}/items",
            json={
                "nomenclature_id": ids["whitelist_product_id"],
                "product_model_id": ids["model_b_id"],
                "assembly_variant_id": ids["variant_b_id"],
                "routing_template_id": ids["route_b_id"],
                "snapshot_name": "Чужая модель",
                "unit": "шт",
                "quantity": "1",
                "unit_price": "1500",
            },
        )
        assert foreign_model.status_code == 400, foreign_model.text
        assert "available-models" in foreign_model.json()["detail"].lower()

        # 4. Whitelist model without assembly → reject (active variants exist)
        missing_variant = client.post(
            f"/orders/{order_id}/items",
            json={
                "nomenclature_id": ids["whitelist_product_id"],
                "product_model_id": ids["model_a_id"],
                "routing_template_id": ids["route_a_id"],
                "snapshot_name": "Нужен вариант",
                "unit": "шт",
                "quantity": "1",
                "unit_price": "1500",
            },
        )
        assert missing_variant.status_code == 400, missing_variant.text
        assert "assembly variant is required" in missing_variant.json()["detail"].lower()

        # 5. Whitelist model + foreign assembly variant → reject
        foreign_variant = client.post(
            f"/orders/{order_id}/items",
            json={
                "nomenclature_id": ids["whitelist_product_id"],
                "product_model_id": ids["model_a_id"],
                "assembly_variant_id": ids["variant_b_id"],
                "routing_template_id": ids["route_a_id"],
                "snapshot_name": "Чужой вариант",
                "unit": "шт",
                "quantity": "1",
                "unit_price": "1500",
            },
        )
        assert foreign_variant.status_code == 400, foreign_variant.text
        assert "assembly variant not found" in foreign_variant.json()["detail"].lower()

        # 6. Whitelist model without routing → reject (active routing links exist)
        missing_routing = client.post(
            f"/orders/{order_id}/items",
            json={
                "nomenclature_id": ids["whitelist_product_id"],
                "product_model_id": ids["model_a_id"],
                "assembly_variant_id": ids["variant_a_id"],
                "snapshot_name": "Нужен маршрут",
                "unit": "шт",
                "quantity": "1",
                "unit_price": "1500",
            },
        )
        assert missing_routing.status_code == 400, missing_routing.text
        assert "routing template is required" in missing_routing.json()["detail"].lower()

        # 7. Foreign routing (other model's whitelist) → reject
        foreign_routing = client.post(
            f"/orders/{order_id}/items",
            json={
                "nomenclature_id": ids["whitelist_product_id"],
                "product_model_id": ids["model_a_id"],
                "assembly_variant_id": ids["variant_a_id"],
                "routing_template_id": ids["route_b_id"],
                "snapshot_name": "Чужой маршрут",
                "unit": "шт",
                "quantity": "1",
                "unit_price": "1500",
            },
        )
        assert foreign_routing.status_code == 400, foreign_routing.text
        assert "routing whitelist" in foreign_routing.json()["detail"].lower()

        # 8. Happy path: model + assembly + routing → autofill snapshots
        ok = client.post(
            f"/orders/{order_id}/items",
            json={
                "nomenclature_id": ids["whitelist_product_id"],
                "product_model_id": ids["model_a_id"],
                "assembly_variant_id": ids["variant_a_id"],
                "routing_template_id": ids["route_a_id"],
                "snapshot_name": "Полный путь",
                "unit": "шт",
                "quantity": "2",
                "unit_price": "1500",
            },
        )
        assert ok.status_code == 201, ok.text
        body = ok.json()
        assert body["product_model_id"] == ids["model_a_id"]
        assert body["product_model_article"] == "SMOKE-A"
        assert body["product_model_name"] == "Модель Smoke A"
        assert body["product_model_size_type"] == "men"
        assert body["assembly_variant_id"] == ids["variant_a_id"]
        assert body["assembly_variant_name"] == "Сборка A"
        assert Decimal(body["assembly_variant_total_cost"]) == Decimal("20.00")
        assert len(body["assembly_operation_snapshots"]) == 1
        assert body["routing_template_id"] == ids["route_a_id"]
        assert body["routing_template_name"] == "Маршрут Smoke A"
