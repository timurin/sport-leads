"""9.6.4: generate/prefill services respect technical card settings defaults."""

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
from app.models.production_stage import ProductionStage
from app.models.sales import Lead, LeadTask, SalesUser
from app.models.tech_operation import TechOperation


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


def test_generate_respects_settings_defaults() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            db.add(
                Nomenclature(
                    name="Доставка",
                    category="Услуги",
                    nomenclature_type=NomenclatureType.SERVICE,
                    unit="шт",
                    base_price=Decimal("500.00"),
                )
            )
            db.commit()

        lead_id = _add_lead(factory)
        with TestClient(app) as client:
            settings = client.put(
                "/technical-card-settings",
                json={
                    "eligible_nomenclature_types": ["SERVICE"],
                    "numbering_template": "{cardSeq}/{orderNo}",
                    "unit_field_size_type_enabled": False,
                    "unit_field_size_enabled": False,
                    "unit_field_personalization_enabled": False,
                    "unit_field_print_number_enabled": True,
                    "unit_field_notes_enabled": False,
                    "stage_label_binding_mode": "snapshot",
                },
            )
            assert settings.status_code == 200, settings.text

            order_id = client.post(
                f"/leads/{lead_id}/convert",
                json={"completed_by_id": 1},
            ).json()["order"]["id"]
            order_number = client.get(f"/orders/{order_id}").json()["number"]

            service_item = client.post(
                f"/orders/{order_id}/items",
                json={
                    "nomenclature_id": 1,
                    "snapshot_name": "Доставка",
                    "size_range": "M",
                    "personalization": "Иванов",
                    "unit": "шт",
                    "quantity": "2",
                    "unit_price": "500",
                },
            )
            assert service_item.status_code == 201, service_item.text
            service_item_id = service_item.json()["id"]

            preview = client.post(f"/orders/{order_id}/technical-cards/preview")
            assert preview.status_code == 200, preview.text
            line = next(
                row
                for row in preview.json()["lines"]
                if row["sales_order_item_id"] == service_item_id
            )
            assert line["eligible"] is True

            generated = client.post(f"/orders/{order_id}/technical-cards/generate")
            assert generated.status_code == 201, generated.text
            card = generated.json()["created"][0]
            assert card["number"] == f"1/{order_number}"
            assert card["unit_lines"][0]["size_type"] is None
            assert card["unit_lines"][0]["size"] is None
            assert card["unit_lines"][0]["personalization"] is None
    finally:
        app.dependency_overrides.clear()


def test_prefill_operation_lines_uses_stage_snapshot_label() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            product = Nomenclature(
                name="Футболка PRO",
                category="Форма",
                nomenclature_type=NomenclatureType.PRODUCT,
                unit="шт",
                base_price=Decimal("1500.00"),
            )
            stage = ProductionStage(
                name="Печать",
                code="print",
                is_active=True,
                sort_order=1,
            )
            db.add_all([product, stage])
            db.flush()
            db.add(
                TechOperation(
                    name="Сублимация",
                    code="SUBLIMATION",
                    volume_unit="pieces",
                    production_stage_id=stage.id,
                    is_active=True,
                    sort_order=1,
                )
            )
            db.commit()

        lead_id = _add_lead(factory)
        with TestClient(app) as client:
            order_id = client.post(
                f"/leads/{lead_id}/convert",
                json={"completed_by_id": 1},
            ).json()["order"]["id"]
            client.post(
                f"/orders/{order_id}/items",
                json={
                    "nomenclature_id": 1,
                    "snapshot_name": "Футболка PRO",
                    "unit": "шт",
                    "quantity": "1",
                    "unit_price": "1500",
                },
            )
            card = client.post(
                f"/orders/{order_id}/technical-cards/generate"
            ).json()["created"][0]

            prefill = client.post(
                f"/technical-cards/{card['id']}/operation-lines/prefill"
            )
            assert prefill.status_code == 200, prefill.text
            line = prefill.json()["card"]["operation_lines"][0]
            assert line["production_stage_id"] is not None
            assert line["stage_label"] == "Печать"
    finally:
        app.dependency_overrides.clear()
