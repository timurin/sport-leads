"""Stage 9.2.2 — technical card stage machine and gates."""

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
    op = TechOperation(
        name="Печать",
        code="print",
        volume_unit=TechOperationVolumeUnit.LINEAR_METERS,
        is_active=True,
        sort_order=1,
    )
    db.add_all([product, op])
    db.flush()

    template = ShopRoutingTemplate(
        name="Стандарт",
        code="std",
        is_active=True,
        stage_lines=[
            ShopRoutingStageLine(
                stage_order=1,
                stage_label="Печать",
                tech_operation_id=op.id,
            ),
            ShopRoutingStageLine(
                stage_order=2,
                stage_label="ОТК",
                is_quality_checkpoint=True,
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
        "model": model.id,
        "template": template.id,
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


def test_stage_gates_complete_rollback_and_card_completion() -> None:
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

            generated = client.post(f"/orders/{order_id}/technical-cards/generate")
            assert generated.status_code in {200, 201}, generated.text
            card = generated.json()["created"][0]
            card_id = card["id"]
            assert card["status"] == "draft"
            assert len(card["stage_results"]) == 2
            assert card["stage_results"][0]["status"] == "pending"

            # Cannot skip to stage 2.
            skip = client.post(f"/technical-cards/{card_id}/stages/2/start")
            assert skip.status_code == 422, skip.text

            started = client.post(f"/technical-cards/{card_id}/start")
            assert started.status_code == 200, started.text
            body = started.json()
            assert body["status"] == "in_progress"
            assert body["stage_results"][0]["status"] == "in_progress"
            assert body["current_stage_order"] == 1

            done1 = client.post(
                f"/technical-cards/{card_id}/stages/1/complete",
                json={
                    "performer_name": "Аня",
                    "scrap_qty": "0.5",
                    "notes": "ок",
                },
            )
            assert done1.status_code == 200, done1.text
            body = done1.json()
            assert body["stage_results"][0]["status"] == "completed"
            assert body["stage_results"][0]["performer_name"] == "Аня"
            assert Decimal(body["stage_results"][0]["scrap_qty"]) == Decimal("0.5")
            assert body["current_stage_order"] == 2

            # Rollback stage 1 while stage 2 still pending.
            rolled = client.post(f"/technical-cards/{card_id}/stages/1/rollback")
            assert rolled.status_code == 200, rolled.text
            assert rolled.json()["stage_results"][0]["status"] == "in_progress"
            assert rolled.json()["stage_results"][0]["completed_at"] is None

            # Complete both stages → card completed.
            assert (
                client.post(f"/technical-cards/{card_id}/stages/1/complete").status_code
                == 200
            )
            assert (
                client.post(
                    f"/technical-cards/{card_id}/stages/2/complete",
                    json={"performer_name": "ОТК"},
                ).status_code
                == 200
            )
            final = client.get(f"/technical-cards/{card_id}").json()
            assert final["status"] == "completed"
            assert all(s["status"] == "completed" for s in final["stage_results"])

            # No further complete after card completed.
            blocked = client.post(f"/technical-cards/{card_id}/stages/2/complete")
            assert blocked.status_code in {409, 422}

            # Rollback last stage reopens card.
            reopen = client.post(f"/technical-cards/{card_id}/stages/2/rollback")
            assert reopen.status_code == 200, reopen.text
            assert reopen.json()["status"] == "in_progress"

            # Cannot rollback stage 1 while stage 2 is in_progress.
            bad = client.post(f"/technical-cards/{card_id}/stages/1/rollback")
            assert bad.status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_start_without_routing_stages_rejected() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            product = Nomenclature(
                name="Товар",
                category="Форма",
                nomenclature_type=NomenclatureType.PRODUCT,
                unit="шт",
                base_price=Decimal("100"),
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
            assert (
                client.post(
                    f"/orders/{order_id}/items",
                    json={
                        "nomenclature_id": product_id,
                        "snapshot_name": "Товар",
                        "unit": "шт",
                        "quantity": "1",
                        "unit_price": "100",
                    },
                ).status_code
                == 201
            )
            generated = client.post(f"/orders/{order_id}/technical-cards/generate")
            assert generated.status_code in {200, 201}, generated.text
            card_id = generated.json()["created"][0]["id"]
            assert generated.json()["created"][0]["stage_results"] == []

            started = client.post(f"/technical-cards/{card_id}/start")
            assert started.status_code == 422
    finally:
        app.dependency_overrides.clear()
