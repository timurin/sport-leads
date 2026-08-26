"""Stage 26.2.2 — order technical-cards list uses slim DTO with stage_results."""

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


def test_order_technical_cards_list_embeds_stage_results_without_fat_collections() -> None:
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
            db.add(product)
            db.commit()
            product_id = product.id

        with factory() as db:
            lead = Lead(
                contact_name="Иван",
                company_name="СК",
                phone="+79990000000",
                email="a@b.c",
                city="Казань",
                source="website",
                responsible_id=1,
                sport="Футбол",
                product_category="Форма",
                need_description="x",
                estimated_quantity=1,
                estimated_amount=Decimal("1500"),
            )
            db.add(lead)
            db.flush()
            db.add(LeadTask(lead_id=lead.id, title="t"))
            db.commit()
            lead_id = lead.id

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
                        "snapshot_name": "Футболка PRO",
                        "unit": "шт",
                        "quantity": "1",
                        "unit_price": "1500",
                    },
                ).status_code
                == 201
            )
            gen = client.post(f"/orders/{order_id}/technical-cards/generate")
            assert gen.status_code in {200, 201}, gen.text

            listed = client.get(f"/orders/{order_id}/technical-cards")
            assert listed.status_code == 200, listed.text
            body = listed.json()
            assert len(body) == 1
            assert "stage_results" in body[0]
            assert isinstance(body[0]["stage_results"], list)
            assert "composition_lines" not in body[0]
            assert "unit_lines" not in body[0]
            assert "media_items" not in body[0]
            assert "assembly_sewing_operations" not in body[0]
            assert body[0]["number"]
    finally:
        app.dependency_overrides.clear()
