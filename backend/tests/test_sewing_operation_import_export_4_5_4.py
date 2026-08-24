"""Stage 4.5.4 — sewing-operation catalog import / export."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.production_stage import ProductionStage
from app.models.sewing_operation import SewingOperation
from app.models.shop_routing import WorkCenter
from app.services.file_io import parse_tabular_bytes
from app.services.sewing_operation_file_columns import SEWING_OPERATION_FILE_HEADERS


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def _csv_file(content: str) -> dict:
    return {"file": ("ops.csv", content.encode("utf-8"), "text/csv")}


def _seed_sewing_wc(db: Session) -> None:
    sewing = ProductionStage(name="Пошив", code="sewing", is_active=True, sort_order=1)
    db.add(sewing)
    db.flush()
    db.add(
        WorkCenter(
            name="Оверлок-1",
            code="OV-1",
            production_stage_id=sewing.id,
            is_active=True,
        )
    )
    db.commit()


def test_import_template_columns() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            response = client.get("/sewing-operations/import-template?format=csv")
            assert response.status_code == 200, response.text
            table = parse_tabular_bytes(response.content, filename="t.csv")
            assert table.headers == list(SEWING_OPERATION_FILE_HEADERS)
            assert len(table.rows) == 2
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_export_import_round_trip_and_upsert() -> None:
    factory = _session_factory()
    with factory() as db:
        _seed_sewing_wc(db)

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            created = client.post(
                "/sewing-operations",
                json={"name": "Export Op", "cost": "10.00", "duration_seconds": 30},
            )
            assert created.status_code == 201, created.text

            exported = client.get("/sewing-operations/export?format=csv&search=Export%20Op")
            assert exported.status_code == 200, exported.text
            table = parse_tabular_bytes(exported.content, filename="e.csv")
            for header in SEWING_OPERATION_FILE_HEADERS:
                assert header in table.headers
            row = next(r for r in table.rows if r["name"] == "Export Op")
            assert row["cost"] in {"10.00", "10.0", "10"}

            csv = (
                "name,cost,quantity_per_item,duration_seconds,folder_path,work_center_codes\n"
                "Imported Op,25.50,2,45,Пошив / Швы,OV-1\n"
            )
            dry = client.post("/sewing-operations/import?dry_run=true", files=_csv_file(csv))
            assert dry.status_code == 200, dry.text
            assert dry.json()["can_commit"] is True
            assert dry.json()["created_count"] == 1
            with factory() as db:
                assert db.scalar(select(func.count()).select_from(SewingOperation)) == 1

            commit = client.post(
                "/sewing-operations/import?dry_run=false", files=_csv_file(csv)
            )
            assert commit.status_code == 200, commit.text
            body = commit.json()
            assert body["created_count"] == 1
            assert body["updated_count"] == 0

            listed = client.get("/sewing-operations?search=Imported")
            assert listed.status_code == 200
            imported = listed.json()[0]
            assert imported["quantity_per_item"] == 2
            assert imported["work_center_ids"]
            folders = client.get("/sewing-operation-folders").json()
            names = {row["name"] for row in folders}
            assert "Пошив" in names
            assert "Швы" in names

            upsert = (
                "name,cost,quantity_per_item,duration_seconds\n"
                "Imported Op,40.00,3,60\n"
            )
            updated = client.post(
                "/sewing-operations/import?dry_run=false", files=_csv_file(upsert)
            )
            assert updated.status_code == 200, updated.text
            assert updated.json()["updated_count"] == 1
            assert updated.json()["created_count"] == 0
            after = client.get("/sewing-operations?search=Imported").json()[0]
            assert after["quantity_per_item"] == 3
            assert after["duration_seconds"] == 60
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_import_rejects_bad_cost_unknown_wc_and_empty_folder_path_is_root() -> None:
    factory = _session_factory()
    with factory() as db:
        _seed_sewing_wc(db)

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            created = client.post(
                "/sewing-operations",
                json={"name": "Root Op", "cost": "5.00"},
            )
            assert created.status_code == 201

            bad_cost = client.post(
                "/sewing-operations/import?dry_run=true",
                files=_csv_file("name,cost\nBroken,-1\n"),
            )
            assert bad_cost.status_code == 200
            assert bad_cost.json()["can_commit"] is False
            assert any(err["code"] == "invalid_cost" for err in bad_cost.json()["errors"])

            unknown = client.post(
                "/sewing-operations/import?dry_run=true",
                files=_csv_file("name,cost,work_center_codes\nNew One,1.00,NOPE\n"),
            )
            assert unknown.json()["can_commit"] is False
            assert any(
                err["code"] == "unknown_work_center" for err in unknown.json()["errors"]
            )

            missing_name = client.post(
                "/sewing-operations/import?dry_run=true",
                files=_csv_file("cost\n10.00\n"),
            )
            assert missing_name.json()["can_commit"] is False
            assert any(err["code"] == "missing_column" for err in missing_name.json()["errors"])

            to_root = client.post(
                "/sewing-operations/import?dry_run=false",
                files=_csv_file("name,cost,folder_path\nRoot Op,5.00,\n"),
            )
            assert to_root.status_code == 200, to_root.text
            assert to_root.json()["updated_count"] == 1
            row = client.get("/sewing-operations?search=Root%20Op").json()[0]
            assert row["folder_id"] is None
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_template_round_trip_dry_run() -> None:
    factory = _session_factory()
    with factory() as db:
        _seed_sewing_wc(db)

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            template = client.get("/sewing-operations/import-template?format=csv")
            assert template.status_code == 200
            dry = client.post(
                "/sewing-operations/import?dry_run=true",
                files={"file": ("template.csv", template.content, "text/csv")},
            )
            assert dry.status_code == 200, dry.text
            assert dry.json()["can_commit"] is True
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_dry_run_does_not_create_folders() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            csv = (
                "name,cost,folder_path\n"
                "Ghost Op,1.00,NewFolder\n"
            )
            dry = client.post("/sewing-operations/import?dry_run=true", files=_csv_file(csv))
            assert dry.status_code == 200
            assert dry.json()["can_commit"] is True
            folders = client.get("/sewing-operation-folders").json()
            assert folders == []
            ops = client.get("/sewing-operations").json()
            assert ops == []
    finally:
        app.dependency_overrides.pop(get_db, None)
