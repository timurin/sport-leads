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


def test_apply_sewing_template_append_and_replace() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            model = client.post(
                "/product-models",
                json={"article": "TPL-AV", "name": "Модель", "size_type": "men"},
            )
            assert model.status_code == 201, model.text
            model_id = model.json()["id"]

            op_a = client.post(
                "/sewing-operations",
                json={"name": "A"},
            )
            op_b = client.post(
                "/sewing-operations",
                json={"name": "B"},
            )
            op_c = client.post(
                "/sewing-operations",
                json={"name": "C"},
            )
            assert op_a.status_code == 201 and op_b.status_code == 201
            assert op_c.status_code == 201
            id_a, id_b, id_c = op_a.json()["id"], op_b.json()["id"], op_c.json()["id"]

            template = client.post(
                "/sewing-operation-templates",
                json={
                    "name": "Pack AB",
                    "sewing_operation_ids": [id_a, id_b],
                },
            )
            assert template.status_code == 201, template.text
            template_id = template.json()["id"]

            variant = client.post(
                f"/product-models/{model_id}/assembly-variants",
                json={"name": "Base", "sewing_operation_ids": [id_c]},
            )
            assert variant.status_code == 201, variant.text
            variant_id = variant.json()["id"]
            assert [line["sewing_operation_id"] for line in variant.json()["operation_lines"]] == [
                id_c
            ]

            appended = client.post(
                f"/product-models/{model_id}/assembly-variants/{variant_id}/apply-sewing-template",
                json={"template_id": template_id, "mode": "append"},
            )
            assert appended.status_code == 200, appended.text
            names = [line["operation_name"] for line in appended.json()["operation_lines"]]
            assert names == ["C", "A", "B"]
            assert all(
                line["sewing_operation_id"] is not None
                for line in appended.json()["operation_lines"]
            )

            replaced = client.post(
                f"/product-models/{model_id}/assembly-variants/{variant_id}/apply-sewing-template",
                json={"template_id": template_id, "mode": "replace"},
            )
            assert replaced.status_code == 200, replaced.text
            names = [line["operation_name"] for line in replaced.json()["operation_lines"]]
            assert names == ["A", "B"]
            assert replaced.json()["operation_lines"][0]["cost"] == "0.00"
            assert replaced.json()["operation_lines"][0]["quantity_per_item"] == 1
            assert replaced.json()["operation_lines"][0]["duration_seconds"] == 0
    finally:
        app.dependency_overrides.pop(get_db, None)
