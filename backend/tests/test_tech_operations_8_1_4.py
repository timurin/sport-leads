"""Stage 8.1.4 — TechOperation required materials."""

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


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_tech_operation_required_materials_round_trip() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            stage = ProductionStage(name="Печать", code="print", sort_order=30, is_active=True)
            paper = Nomenclature(
                name="Сублимационная бумага",
                category="Материалы",
                nomenclature_type=NomenclatureType.MATERIAL,
                unit="м",
                base_price=Decimal("0"),
            )
            ink = Nomenclature(
                name="Чернила",
                category="Материалы",
                nomenclature_type=NomenclatureType.MATERIAL,
                unit="г",
                base_price=Decimal("0"),
            )
            db.add_all([stage, paper, ink])
            db.commit()
            db.refresh(stage)
            db.refresh(paper)
            db.refresh(ink)

        with TestClient(app) as client:
            created = client.post(
                "/tech-operations",
                json={
                    "name": "Сублимационная печать",
                    "code": "SUBL",
                    "volume_unit": "linear_meters",
                    "production_stage_id": stage.id,
                    "required_materials": [
                        {"nomenclature_id": paper.id, "quantity": "1"},
                        {"nomenclature_id": ink.id, "quantity": "10"},
                    ],
                },
            )
            assert created.status_code == 201, created.text
            payload = created.json()
            assert len(payload["required_materials"]) == 2
            assert payload["required_materials"][0]["nomenclature_name"] == "Сублимационная бумага"

            operation_id = payload["id"]
            updated = client.patch(
                f"/tech-operations/{operation_id}",
                json={
                    "required_materials": [
                        {"nomenclature_id": paper.id, "quantity": "1.5"},
                    ]
                },
            )
            assert updated.status_code == 200, updated.text
            updated_payload = updated.json()
            assert len(updated_payload["required_materials"]) == 1
            material = updated_payload["required_materials"][0]
            assert material["tech_operation_id"] == operation_id
            assert material["nomenclature_id"] == paper.id
            assert material["nomenclature_name"] == "Сублимационная бумага"
            assert Decimal(str(material["quantity"])) == Decimal("1.5")
            assert material["unit"] == "м"
    finally:
        app.dependency_overrides.clear()
