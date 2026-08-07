"""Stage 0.2 list performance regressions (`0.2.2` / `0.2.3.1` / `0.2.3.2`).

Product-models assembly_cost embed is also covered in `test_assembly_variants.py`.
"""

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
from app.models.product_model import ProductModelSizeType


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_product_models_list_embeds_assembly_cost_bounds() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            created = client.post(
                "/product-models",
                json={
                    "article": "COST-1",
                    "name": "Cost model",
                    "size_type": ProductModelSizeType.MEN.value,
                },
            )
            assert created.status_code == 201, created.text
            model_id = created.json()["id"]

            variant = client.post(
                f"/product-models/{model_id}/assembly-variants",
                json={
                    "name": "Базовый",
                    "operation_lines": [
                        {"operation_name": "Сборка", "cost": "100.00", "quantity_per_item": 2},
                    ],
                },
            )
            assert variant.status_code == 201, variant.text

            listed = client.get("/product-models")
            assert listed.status_code == 200, listed.text
            row = next(item for item in listed.json() if item["id"] == model_id)
            assert Decimal(str(row["assembly_cost_min"])) == Decimal("200.00")
            assert Decimal(str(row["assembly_cost_max"])) == Decimal("200.00")
    finally:
        app.dependency_overrides.clear()


def test_characteristic_definitions_list_embeds_option_count() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            created = client.post(
                "/characteristics/definitions",
                json={"name": "List size options", "kind": "LIST"},
            )
            assert created.status_code == 201, created.text
            definition_id = created.json()["id"]
            for code, label in (("s", "S"), ("m", "M"), ("l", "L")):
                assert (
                    client.post(
                        f"/characteristics/definitions/{definition_id}/options",
                        json={"code": code, "label": label},
                    ).status_code
                    == 201
                )

            listed = client.get("/characteristics/definitions")
            assert listed.status_code == 200, listed.text
            row = next(item for item in listed.json() if item["id"] == definition_id)
            assert row["option_count"] == 3

            batch = client.get(
                "/characteristics/options-batch",
                params=[("characteristic_id", definition_id)],
            )
            assert batch.status_code == 200, batch.text
            options = batch.json()["options"][str(definition_id)]
            assert len(options) == 3
            assert {item["code"] for item in options} == {"s", "m", "l"}
    finally:
        app.dependency_overrides.clear()


def test_nomenclature_list_extras_batch_covers_and_values() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            item = Nomenclature(
                name="Ткань batch",
                category="Материалы",
                nomenclature_type=NomenclatureType.MATERIAL,
                unit="м",
                base_price=Decimal("10.00"),
            )
            db.add(item)
            db.commit()
            item_id = item.id

        with TestClient(app) as client:
            extras = client.get(
                "/nomenclatures/list-extras",
                params=[("nomenclature_id", str(item_id))],
            )
            assert extras.status_code == 200, extras.text
            body = extras.json()
            assert str(item_id) in body["covers"]
            assert str(item_id) in body["values"]
            assert body["covers"][str(item_id)] is None
            assert isinstance(body["values"][str(item_id)], list)
    finally:
        app.dependency_overrides.clear()
