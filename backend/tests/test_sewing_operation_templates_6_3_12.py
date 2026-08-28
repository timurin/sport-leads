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


def test_sewing_operation_templates_crud_and_lines() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            op1 = client.post(
                "/sewing-operations",
                json={"name": "Cut"},
            )
            op2 = client.post(
                "/sewing-operations",
                json={"name": "Sew"},
            )
            assert op1.status_code == 201, op1.text
            assert op2.status_code == 201, op2.text
            op1_id = op1.json()["id"]
            op2_id = op2.json()["id"]

            created = client.post(
                "/sewing-operation-templates",
                json={
                    "name": " Basic pack ",
                    "sewing_operation_ids": [op1_id, op2_id],
                },
            )
            assert created.status_code == 201, created.text
            body = created.json()
            assert body["name"] == "Basic pack"
            assert [line["sewing_operation_id"] for line in body["lines"]] == [
                op1_id,
                op2_id,
            ]
            assert body["lines"][0]["operation_name"] == "Cut"
            template_id = body["id"]

            dup = client.post(
                "/sewing-operation-templates",
                json={"name": "basic pack", "sewing_operation_ids": []},
            )
            assert dup.status_code == 409

            bad = client.post(
                "/sewing-operation-templates",
                json={
                    "name": "Dup ops",
                    "sewing_operation_ids": [op1_id, op1_id],
                },
            )
            assert bad.status_code == 422

            replaced = client.put(
                f"/sewing-operation-templates/{template_id}/lines",
                json={"sewing_operation_ids": [op2_id, op1_id]},
            )
            assert replaced.status_code == 200, replaced.text
            assert [
                line["sewing_operation_id"] for line in replaced.json()["lines"]
            ] == [op2_id, op1_id]

            listed = client.get("/sewing-operation-templates")
            assert listed.status_code == 200
            assert len(listed.json()) == 1

            deleted = client.delete(f"/sewing-operation-templates/{template_id}")
            assert deleted.status_code == 204
            assert client.get("/sewing-operation-templates").json() == []
    finally:
        app.dependency_overrides.clear()
