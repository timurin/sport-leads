"""Stage 6.3.10.3 — sewing-operations work_center_ids API + sewing-stage gate."""

from __future__ import annotations

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


def _seed_stages_and_centers(db: Session) -> tuple[int, int, int]:
    sewing = ProductionStage(
        name="Пошив",
        code="sewing",
        is_active=True,
        sort_order=1,
    )
    cutting = ProductionStage(
        name="Раскрой",
        code="cutting",
        is_active=True,
        sort_order=2,
    )
    db.add_all([sewing, cutting])
    db.flush()

    sewing_wc = WorkCenter(
        name="Оверлок-1",
        code="OV-1",
        production_stage_id=sewing.id,
        is_active=True,
    )
    cutting_wc = WorkCenter(
        name="Раскройный стол-1",
        code="CUT-1",
        production_stage_id=cutting.id,
        is_active=True,
    )
    inactive_sewing = WorkCenter(
        name="Оверлок-выкл",
        code="OV-OFF",
        production_stage_id=sewing.id,
        is_active=False,
    )
    db.add_all([sewing_wc, cutting_wc, inactive_sewing])
    db.commit()
    return sewing_wc.id, cutting_wc.id, inactive_sewing.id


def test_sewing_operation_work_center_ids_create_update_and_reject() -> None:
    factory = _session_factory()

    with factory() as seed_db:
        sewing_wc_id, cutting_wc_id, inactive_wc_id = _seed_stages_and_centers(seed_db)

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            created = client.post(
                "/sewing-operations",
                json={
                    "name": "Стачивание бокового шва",
                    "work_center_ids": [sewing_wc_id],
                },
            )
            assert created.status_code == 201, created.text
            body = created.json()
            assert body["work_center_ids"] == [sewing_wc_id]
            operation_id = body["id"]

            listed = client.get("/sewing-operations")
            assert listed.status_code == 200
            assert listed.json()[0]["work_center_ids"] == [sewing_wc_id]

            got = client.get(f"/sewing-operations/{operation_id}")
            assert got.status_code == 200
            assert got.json()["work_center_ids"] == [sewing_wc_id]

            reject_cutting = client.patch(
                f"/sewing-operations/{operation_id}",
                json={"work_center_ids": [cutting_wc_id]},
            )
            assert reject_cutting.status_code == 422
            assert "Пошив" in reject_cutting.json()["detail"]

            reject_inactive = client.patch(
                f"/sewing-operations/{operation_id}",
                json={"work_center_ids": [inactive_wc_id]},
            )
            assert reject_inactive.status_code == 422

            clear = client.patch(
                f"/sewing-operations/{operation_id}",
                json={"work_center_ids": []},
            )
            assert clear.status_code == 200, clear.text
            assert clear.json()["work_center_ids"] == []

            create_reject = client.post(
                "/sewing-operations",
                json={
                    "name": "Плохой станок",
                    "work_center_ids": [cutting_wc_id],
                },
            )
            assert create_reject.status_code == 422

            filtered = client.get(
                "/work-centers",
                params={"production_stage_code": "sewing", "active_only": True},
            )
            assert filtered.status_code == 200
            codes = {row["code"] for row in filtered.json()}
            assert codes == {"OV-1"}
    finally:
        app.dependency_overrides.clear()
