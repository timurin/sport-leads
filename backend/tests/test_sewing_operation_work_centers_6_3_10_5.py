"""Stage 6.3.10.5 — equipment link does not leak into assembly snapshot contour."""

from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.production_stage import ProductionStage
from app.models.shop_routing import WorkCenter


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_assembly_operation_line_has_no_work_center_column() -> None:
    table = Base.metadata.tables["assembly_operation_lines"]
    cols = {column.name for column in table.columns}
    assert "work_center_id" not in cols
    assert "work_center_ids" not in cols


def test_sewing_op_equipment_link_survives_crud_without_assembly_fields() -> None:
    factory = _session_factory()

    with factory() as seed_db:
        sewing = ProductionStage(name="Пошив", code="sewing", is_active=True, sort_order=1)
        seed_db.add(sewing)
        seed_db.flush()
        wc = WorkCenter(
            name="Оверлок-рег",
            code="OV-REG",
            production_stage_id=sewing.id,
            is_active=True,
        )
        seed_db.add(wc)
        seed_db.commit()
        wc_id = wc.id

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            created = client.post(
                "/sewing-operations",
                json={
                    "name": "Регресс шов",
                    "cost": "15.00",
                    "work_center_ids": [wc_id],
                },
            )
            assert created.status_code == 201, created.text
            body = created.json()
            assert body["work_center_ids"] == [wc_id]
            assert Decimal(body["cost"]) == Decimal("15.00")
            # catalog payload stays flat; no routing/TC fields
            assert "work_center_id" not in body
    finally:
        app.dependency_overrides.clear()
