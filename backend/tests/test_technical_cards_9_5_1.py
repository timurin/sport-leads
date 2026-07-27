"""Stage 9.5.1 — order manufacturing completeness + READY+ status gates."""

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
from app.models.product_model import ProductModel, ProductModelSizeType, ProductModelStatus
from app.models.production_stage import ProductionStage
from app.models.sales import Lead, LeadTask, SalesUser
from app.models.shop_routing import ShopRoutingStageLine, ShopRoutingTemplate
from app.models.tech_operation import TechOperation
from app.models.technical_card import TechOperationVolumeUnit


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


def _seed(db: Session) -> dict[str, int]:
    product = Nomenclature(
        name="Футболка PRO",
        category="Форма",
        nomenclature_type=NomenclatureType.PRODUCT,
        unit="шт",
        base_price=Decimal("1500.00"),
    )
    material = Nomenclature(
        name="Ткань",
        category="Материалы",
        nomenclature_type=NomenclatureType.MATERIAL,
        unit="м",
        base_price=Decimal("100.00"),
    )
    print_stage = ProductionStage(
        name="Печать", code="print", is_active=True, sort_order=30
    )
    db.add_all([product, material, print_stage])
    db.flush()

    op = TechOperation(
        name="Печать",
        code="print",
        volume_unit=TechOperationVolumeUnit.LINEAR_METERS,
        production_stage_id=print_stage.id,
        is_active=True,
        sort_order=1,
    )
    db.add(op)
    db.flush()

    template = ShopRoutingTemplate(
        name="Стандарт",
        code="std",
        is_active=True,
        stage_lines=[
            ShopRoutingStageLine(
                stage_order=1,
                production_stage_id=print_stage.id,
                stage_label="Печать",
                tech_operation_id=op.id,
            ),
        ],
    )
    db.add(template)
    db.flush()

    model = ProductModel(
        article="F-213",
        name="Футболка 213",
        size_type=ProductModelSizeType.MEN,
        status=ProductModelStatus.ACTIVE,
        default_routing_template_id=template.id,
    )
    db.add(model)
    db.commit()
    return {
        "product": product.id,
        "material": material.id,
        "model": model.id,
    }


def _add_lead(factory: sessionmaker[Session]) -> int:
    with factory() as db:
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
            need_description="Форма",
            estimated_quantity=10,
            estimated_amount=Decimal("15000"),
        )
        db.add(lead)
        db.flush()
        db.add(LeadTask(lead_id=lead.id, title="Позвонить"))
        db.commit()
        return lead.id


def _complete_card(client: TestClient, card_id: int) -> None:
    assert client.post(f"/technical-cards/{card_id}/start").status_code == 200
    done = client.post(f"/technical-cards/{card_id}/stages/1/complete")
    assert done.status_code == 200, done.text
    assert done.json()["status"] == "completed"


def test_vacuous_completeness_allows_ready_without_eligible_lines() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            ids = _seed(db)
        lead_id = _add_lead(factory)

        with TestClient(app) as client:
            order_id = client.post(
                f"/leads/{lead_id}/convert",
                json={"completed_by_id": 1},
            ).json()["order"]["id"]

            # Non-product line only — not eligible for TC.
            material_item = client.post(
                f"/orders/{order_id}/items",
                json={
                    "nomenclature_id": ids["material"],
                    "snapshot_name": "Ткань",
                    "unit": "м",
                    "quantity": "3",
                    "unit_price": "100",
                },
            )
            assert material_item.status_code == 201, material_item.text

            completeness = client.get(f"/orders/{order_id}/manufacturing-completeness")
            assert completeness.status_code == 200, completeness.text
            body = completeness.json()
            assert body["eligible_count"] == 0
            assert body["manufacturing_complete"] is True
            assert body["completeness_percent"] == 100

            assert (
                client.patch(f"/orders/{order_id}/status", json={"status": "ready"}).status_code
                == 200
            )
    finally:
        app.dependency_overrides.clear()


def test_ready_blocked_until_all_eligible_cards_completed() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            ids = _seed(db)
        lead_id = _add_lead(factory)

        with TestClient(app) as client:
            order_id = client.post(
                f"/leads/{lead_id}/convert",
                json={"completed_by_id": 1},
            ).json()["order"]["id"]

            item = client.post(
                f"/orders/{order_id}/items",
                json={
                    "nomenclature_id": ids["product"],
                    "product_model_id": ids["model"],
                    "snapshot_name": "Футболка PRO",
                    "unit": "шт",
                    "quantity": "2",
                    "unit_price": "1500",
                },
            )
            assert item.status_code == 201, item.text

            missing = client.get(f"/orders/{order_id}/manufacturing-completeness")
            assert missing.status_code == 200
            assert missing.json()["manufacturing_complete"] is False
            assert missing.json()["missing_count"] == 1

            # PRODUCTION allowed without completeness; READY blocked.
            assert (
                client.patch(
                    f"/orders/{order_id}/status", json={"status": "production"}
                ).status_code
                == 200
            )
            blocked = client.patch(f"/orders/{order_id}/status", json={"status": "ready"})
            assert blocked.status_code == 409, blocked.text
            assert "incomplete" in blocked.json()["detail"].lower()

            generated = client.post(f"/orders/{order_id}/technical-cards/generate")
            assert generated.status_code in {200, 201}, generated.text
            card_id = generated.json()["created"][0]["id"]

            draft_gate = client.patch(f"/orders/{order_id}/status", json={"status": "ready"})
            assert draft_gate.status_code == 409

            open_state = client.get(f"/orders/{order_id}/manufacturing-completeness").json()
            assert open_state["open_count"] == 1
            assert open_state["manufacturing_complete"] is False

            _complete_card(client, card_id)

            done = client.get(f"/orders/{order_id}/manufacturing-completeness").json()
            assert done["manufacturing_complete"] is True
            assert done["completed_count"] == 1
            assert done["completeness_percent"] == 100
            assert done["blocking_item_ids"] == []

            ready = client.patch(f"/orders/{order_id}/status", json={"status": "ready"})
            assert ready.status_code == 200, ready.text
            assert ready.json()["status"] == "ready"

            shipped = client.patch(f"/orders/{order_id}/status", json={"status": "shipped"})
            assert shipped.status_code == 200
    finally:
        app.dependency_overrides.clear()


def test_cancelled_card_blocks_completeness() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            ids = _seed(db)
        lead_id = _add_lead(factory)

        with TestClient(app) as client:
            order_id = client.post(
                f"/leads/{lead_id}/convert",
                json={"completed_by_id": 1},
            ).json()["order"]["id"]

            assert (
                client.post(
                    f"/orders/{order_id}/items",
                    json={
                        "nomenclature_id": ids["product"],
                        "product_model_id": ids["model"],
                        "snapshot_name": "Футболка PRO",
                        "unit": "шт",
                        "quantity": "1",
                        "unit_price": "1500",
                    },
                ).status_code
                == 201
            )

            generated = client.post(f"/orders/{order_id}/technical-cards/generate")
            card_id = generated.json()["created"][0]["id"]
            cancelled = client.post(f"/technical-cards/{card_id}/cancel")
            assert cancelled.status_code == 200, cancelled.text

            body = client.get(f"/orders/{order_id}/manufacturing-completeness").json()
            assert body["manufacturing_complete"] is False
            assert body["cancelled_count"] == 1
            assert body["missing_count"] == 1

            assert (
                client.patch(f"/orders/{order_id}/status", json={"status": "ready"}).status_code
                == 409
            )
    finally:
        app.dependency_overrides.clear()
