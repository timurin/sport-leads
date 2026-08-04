"""Folder default sewing template bind + create-model seed (`6.1.19`)."""

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_folder_default_template_seeds_base_assembly_on_model_create() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            op_a = client.post(
                "/sewing-operations",
                json={
                    "name": "Оверлок",
                    "cost": "10.00",
                    "quantity_per_item": 1,
                    "duration_seconds": 30,
                },
            )
            assert op_a.status_code == 201, op_a.text
            op_b = client.post(
                "/sewing-operations",
                json={
                    "name": "Распошив",
                    "cost": "20.00",
                    "quantity_per_item": 2,
                    "duration_seconds": 40,
                },
            )
            assert op_b.status_code == 201, op_b.text
            id_a = op_a.json()["id"]
            id_b = op_b.json()["id"]

            template = client.post(
                "/sewing-operation-templates",
                json={
                    "name": "Футболка базовая",
                    "sewing_operation_ids": [id_a, id_b],
                },
            )
            assert template.status_code == 201, template.text
            template_id = template.json()["id"]
            assert [
                line["sewing_operation_id"] for line in template.json()["lines"]
            ] == [id_a, id_b]

            folder = client.post(
                "/product-model-folders",
                json={
                    "name": "Футболки, майки",
                    "default_sewing_operation_template_id": template_id,
                },
            )
            assert folder.status_code == 201, folder.text
            body = folder.json()
            assert body["default_sewing_operation_template_id"] == template_id
            assert body["default_sewing_operation_template_name"] == "Футболка базовая"
            folder_id = body["id"]

            model = client.post(
                "/product-models",
                json={
                    "article": "FT-001",
                    "name": "Футболка тестовая",
                    "size_type": "men",
                    "folder_id": folder_id,
                },
            )
            assert model.status_code == 201, model.text
            model_id = model.json()["id"]

            variants = client.get(f"/product-models/{model_id}/assembly-variants")
            assert variants.status_code == 200, variants.text
            rows = variants.json()
            assert len(rows) == 1
            assert rows[0]["name"] == "Базовый"
            assert [line["sewing_operation_id"] for line in rows[0]["operation_lines"]] == [
                id_a,
                id_b,
            ]
            assert Decimal(rows[0]["total_cost"]) == Decimal("50.00")

            # Folder template change must not rewrite existing variant.
            other = client.post(
                "/sewing-operation-templates",
                json={"name": "Другой шаблон"},
            )
            assert other.status_code == 201, other.text
            patched = client.patch(
                f"/product-model-folders/{folder_id}",
                json={"default_sewing_operation_template_id": other.json()["id"]},
            )
            assert patched.status_code == 200, patched.text
            again = client.get(f"/product-models/{model_id}/assembly-variants")
            assert len(again.json()[0]["operation_lines"]) == 2

            # Clear binding.
            cleared = client.patch(
                f"/product-model-folders/{folder_id}",
                json={"default_sewing_operation_template_id": None},
            )
            assert cleared.status_code == 200, cleared.text
            assert cleared.json()["default_sewing_operation_template_id"] is None
    finally:
        app.dependency_overrides.clear()
