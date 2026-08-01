"""Stage 9.3.3 — operation volume lines (soft prefill until 8.1.3)."""

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
from app.models.sales import Lead, LeadTask, SalesUser
from app.models.technical_card import TechnicalCardStatus


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


def _seed_product(db: Session) -> int:
    product = Nomenclature(
        name="Футболка PRO",
        category="Форма",
        nomenclature_type=NomenclatureType.PRODUCT,
        unit="шт",
        base_price=Decimal("1500.00"),
    )
    db.add(product)
    db.commit()
    return product.id


def test_operation_lines_replace_patch_and_soft_prefill() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            product_id = _seed_product(db)
        lead_id = _add_lead(factory)

        with TestClient(app) as client:
            order_id = client.post(
                f"/leads/{lead_id}/convert",
                json={"completed_by_id": 1},
            ).json()["order"]["id"]
            client.post(
                f"/orders/{order_id}/items",
                json={
                    "nomenclature_id": product_id,
                    "snapshot_name": "Футболка PRO",
                    "unit": "шт",
                    "quantity": "2",
                    "unit_price": "1500",
                },
            )
            card = client.post(
                f"/orders/{order_id}/technical-cards/generate"
            ).json()["created"][0]
            card_id = card["id"]
            assert card["operation_lines"] == []

            # Soft prefill: catalog table may exist (8.1.3) but empty → no demo rows
            prefill = client.post(
                f"/technical-cards/{card_id}/operation-lines/prefill"
            )
            assert prefill.status_code == 200, prefill.text
            body = prefill.json()
            assert body["prefilled"] is False
            assert body["card"]["operation_lines"] == []
            assert body["catalog_available"] in {True, False}
            if body["catalog_available"]:
                assert "empty" in body["message"].lower() or "demo" in body["message"].lower()
            else:
                assert "8.1.3" in body["message"]

            replaced = client.put(
                f"/technical-cards/{card_id}/operation-lines",
                json={
                    "lines": [
                        {
                            "sequence": 1,
                            "operation_name": "Сублимационная печать",
                            "volume_unit": "linear_meters",
                            "volume": "0",
                            "stage_order": 1,
                            "stage_label": "Печать",
                        },
                        {
                            "sequence": 2,
                            "operation_name": "Пошив",
                            "volume_unit": "pieces",
                            "volume": "2.000",
                            "stage_order": 2,
                            "stage_label": "Пошив",
                        },
                    ]
                },
            )
            assert replaced.status_code == 200, replaced.text
            lines = replaced.json()["operation_lines"]
            assert len(lines) == 2
            assert lines[0]["volume_unit"] == "linear_meters"
            assert lines[1]["volume"] == "2.000"
            line1_id = lines[0]["id"]

            listed = client.get(f"/technical-cards/{card_id}/operation-lines")
            assert listed.status_code == 200
            assert [row["sequence"] for row in listed.json()] == [1, 2]

            patched = client.patch(
                f"/technical-cards/{card_id}/operation-lines/{line1_id}",
                json={"volume": "3.500"},
            )
            assert patched.status_code == 200, patched.text
            assert patched.json()["operation_lines"][0]["volume"] == "3.500"
            # stage binding unchanged
            assert patched.json()["operation_lines"][0]["stage_order"] == 1

            # Duplicate stage_order rejected
            bad_stage = client.put(
                f"/technical-cards/{card_id}/operation-lines",
                json={
                    "lines": [
                        {
                            "sequence": 1,
                            "operation_name": "A",
                            "volume_unit": "pieces",
                            "volume": "0",
                            "stage_order": 1,
                        },
                        {
                            "sequence": 2,
                            "operation_name": "B",
                            "volume_unit": "pieces",
                            "volume": "0",
                            "stage_order": 1,
                        },
                    ]
                },
            )
            assert bad_stage.status_code == 422

            # Prefill skipped when lines already present
            again = client.post(
                f"/technical-cards/{card_id}/operation-lines/prefill"
            )
            assert again.status_code == 200
            assert again.json()["prefilled"] is False
            assert "already present" in again.json()["message"]

            # Mark in_progress → full replace forbidden
            with factory() as db:
                from app.models.technical_card import TechnicalCard

                card_row = db.get(TechnicalCard, card_id)
                assert card_row is not None
                card_row.status = TechnicalCardStatus.IN_PROGRESS
                db.commit()

            blocked_replace = client.put(
                f"/technical-cards/{card_id}/operation-lines",
                json={"lines": []},
            )
            assert blocked_replace.status_code == 422

            volume_ok = client.patch(
                f"/technical-cards/{card_id}/operation-lines/{line1_id}",
                json={"volume": "4.000"},
            )
            assert volume_ok.status_code == 200
            assert volume_ok.json()["operation_lines"][0]["volume"] == "4.000"
            assert volume_ok.json()["operation_lines"][0]["stage_order"] == 1
    finally:
        app.dependency_overrides.clear()
