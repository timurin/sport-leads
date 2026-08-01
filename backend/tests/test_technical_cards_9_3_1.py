"""Stage 9.3.1 — model / pattern / material composition on technical card."""

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


def _seed(db: Session) -> dict[str, int]:
    product = Nomenclature(
        name="Футболка PRO",
        category="Форма",
        nomenclature_type=NomenclatureType.PRODUCT,
        unit="шт",
        base_price=Decimal("1500.00"),
    )
    material = Nomenclature(
        name="Ткань сублимация",
        category="Ткани",
        nomenclature_type=NomenclatureType.MATERIAL,
        unit="м",
        base_price=Decimal("200.00"),
    )
    goods = Nomenclature(
        name="Коробка",
        category="Упаковка",
        nomenclature_type=NomenclatureType.GOODS,
        unit="шт",
        base_price=Decimal("50.00"),
    )
    model = ProductModel(
        article="PM-901",
        name="Футболка 901",
        size_type=ProductModelSizeType.MEN,
        status=ProductModelStatus.ACTIVE,
        patterns_path="//files/patterns/pm-901",
    )
    db.add_all([product, material, goods, model])
    db.commit()
    return {
        "product": product.id,
        "material": material.id,
        "goods": goods.id,
        "model": model.id,
    }


def test_composition_replace_apply_spec_and_refresh_model() -> None:
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
            assert generated.status_code == 201, generated.text
            card = generated.json()["created"][0]
            card_id = card["id"]
            assert card["product_model_article"] == "PM-901"
            assert len(card["composition_lines"]) == 1
            assert card["composition_lines"][0]["line_kind"] == "pattern"
            assert card["composition_lines"][0]["notes"] == "//files/patterns/pm-901"

            # Reject GOODS as material line
            bad_material = client.put(
                f"/technical-cards/{card_id}/composition",
                json={
                    "lines": [
                        {
                            "sequence": 1,
                            "line_kind": "material",
                            "nomenclature_id": ids["goods"],
                            "snapshot_name": "Коробка",
                            "planned_qty": "1",
                            "unit": "шт",
                        }
                    ]
                },
            )
            assert bad_material.status_code == 422

            replaced = client.put(
                f"/technical-cards/{card_id}/composition",
                json={
                    "lines": [
                        {
                            "sequence": 1,
                            "line_kind": "pattern",
                            "snapshot_name": "Лекала: PM-901",
                            "notes": "//files/patterns/pm-901",
                        },
                        {
                            "sequence": 2,
                            "line_kind": "material",
                            "nomenclature_id": ids["material"],
                            "snapshot_name": "Ткань сублимация",
                            "planned_qty": "1.250",
                            "unit": "м",
                        },
                    ]
                },
            )
            assert replaced.status_code == 200, replaced.text
            kinds = [row["line_kind"] for row in replaced.json()["composition_lines"]]
            assert kinds == ["pattern", "material"]

            applied = client.post(
                f"/technical-cards/{card_id}/composition/apply-specification",
                json={
                    "specification_version_id": 42,
                    "specification_version_label": "Spec v3 approved",
                    "lines": [
                        {
                            "sequence": 1,
                            "line_kind": "material",
                            "nomenclature_id": ids["material"],
                            "snapshot_name": "Ткань сублимация",
                            "planned_qty": "2.000",
                            "unit": "м",
                        },
                        {
                            "sequence": 2,
                            "line_kind": "note",
                            "snapshot_name": "Норма из Spec v3",
                        },
                    ],
                },
            )
            assert applied.status_code == 200, applied.text
            body = applied.json()
            assert body["specification_version_id"] == 42
            assert body["specification_version_label"] == "Spec v3 approved"
            assert [row["line_kind"] for row in body["composition_lines"]] == [
                "material",
                "note",
            ]
            assert body["composition_lines"][0]["planned_qty"] == "2.000"

            # Refresh model re-adds pattern line from ProductModel.patterns_path
            refreshed = client.post(
                f"/technical-cards/{card_id}/composition/refresh-model"
            )
            assert refreshed.status_code == 200, refreshed.text
            kinds_after = [
                row["line_kind"] for row in refreshed.json()["composition_lines"]
            ]
            assert "pattern" in kinds_after
            assert "material" in kinds_after
            pattern = next(
                row
                for row in refreshed.json()["composition_lines"]
                if row["line_kind"] == "pattern"
            )
            assert pattern["notes"] == "//files/patterns/pm-901"
            # Spec stamp preserved on refresh
            assert refreshed.json()["specification_version_id"] == 42

            cancelled = client.post(f"/technical-cards/{card_id}/cancel")
            assert cancelled.status_code == 200
            blocked = client.put(
                f"/technical-cards/{card_id}/composition",
                json={"lines": []},
            )
            assert blocked.status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_apply_specification_requires_version_label() -> None:
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
            client.post(
                f"/orders/{order_id}/items",
                json={
                    "nomenclature_id": ids["product"],
                    "snapshot_name": "Футболка",
                    "unit": "шт",
                    "quantity": "1",
                    "unit_price": "10",
                },
            )
            card_id = client.post(
                f"/orders/{order_id}/technical-cards/generate"
            ).json()["created"][0]["id"]

            missing_label = client.post(
                f"/technical-cards/{card_id}/composition/apply-specification",
                json={
                    "specification_version_id": 1,
                    "specification_version_label": "   ",
                    "lines": [],
                },
            )
            assert missing_label.status_code == 422
    finally:
        app.dependency_overrides.clear()
