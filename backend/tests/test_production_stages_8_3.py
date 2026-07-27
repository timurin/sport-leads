"""Stage 8.3 — ProductionStage catalog + routing/ops bind."""

from __future__ import annotations

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


def test_production_stages_crud_and_routing_requires_stage() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            created = client.post(
                "/production-stages",
                json={
                    "name": " Печать ",
                    "code": " print ",
                    "sort_order": 30,
                },
            )
            assert created.status_code == 201, created.text
            print_id = created.json()["id"]
            assert created.json()["name"] == "Печать"
            assert created.json()["code"] == "print"

            qc = client.post(
                "/production-stages",
                json={"name": "ОТК", "code": "qc", "sort_order": 60},
            )
            assert qc.status_code == 201, qc.text
            qc_id = qc.json()["id"]

            cutting = client.post(
                "/production-stages",
                json={"name": "Раскрой", "code": "cutting", "sort_order": 20},
            )
            assert cutting.status_code == 201
            cutting_id = cutting.json()["id"]

            listed = client.get("/production-stages")
            assert listed.status_code == 200
            assert len(listed.json()) >= 3

            op = client.post(
                "/tech-operations",
                json={
                    "name": "Сублимация",
                    "code": "sub",
                    "volume_unit": "linear_meters",
                    "production_stage_id": print_id,
                },
            )
            assert op.status_code == 201, op.text
            assert op.json()["production_stage_id"] == print_id
            op_id = op.json()["id"]

            # Routing without production_stage_id rejected.
            missing = client.post(
                "/shop-routings",
                json={
                    "name": "Bad",
                    "stages": [{"stage_order": 1, "stage_label": "X"}],
                },
            )
            assert missing.status_code == 422

            # Op from print cannot bind to cutting step.
            wrong = client.post(
                "/shop-routings",
                json={
                    "name": "Wrong op",
                    "stages": [
                        {
                            "stage_order": 1,
                            "production_stage_id": cutting_id,
                            "tech_operation_id": op_id,
                        }
                    ],
                },
            )
            assert wrong.status_code == 422, wrong.text

            ok = client.post(
                "/shop-routings",
                json={
                    "name": "Стандарт",
                    "code": "std",
                    "stages": [
                        {
                            "stage_order": 1,
                            "production_stage_id": print_id,
                            "tech_operation_id": op_id,
                        },
                        {
                            "stage_order": 2,
                            "production_stage_id": qc_id,
                            "is_quality_checkpoint": True,
                        },
                    ],
                },
            )
            assert ok.status_code == 201, ok.text
            lines = ok.json()["stage_lines"]
            assert lines[0]["production_stage_id"] == print_id
            assert lines[0]["stage_label"] == "Печать"
            assert lines[1]["is_quality_checkpoint"] is True
            assert lines[1]["stage_label"] == "ОТК"
    finally:
        app.dependency_overrides.clear()
