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


def test_sewing_operation_folders_tree_and_reorder() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            root = client.post(
                "/sewing-operation-folders",
                json={"name": " Базовая "},
            )
            assert root.status_code == 201, root.text
            root_id = root.json()["id"]
            assert root.json()["name"] == "Базовая"
            assert root.json()["parent_id"] is None

            child = client.post(
                "/sewing-operation-folders",
                json={"name": "Втачные", "parent_id": root_id},
            )
            assert child.status_code == 201, child.text
            child_id = child.json()["id"]

            cycle = client.patch(
                f"/sewing-operation-folders/{root_id}",
                json={"parent_id": child_id},
            )
            assert cycle.status_code == 422

            dup = client.post(
                "/sewing-operation-folders",
                json={"name": "базовая"},
            )
            assert dup.status_code == 409

            op_a = client.post(
                "/sewing-operations",
                json={
                    "name": "Оверлок",
                    "cost": "10.00",
                    "folder_id": child_id,
                },
            )
            assert op_a.status_code == 201, op_a.text
            assert op_a.json()["folder_id"] == child_id
            op_a_id = op_a.json()["id"]

            op_b = client.post(
                "/sewing-operations",
                json={
                    "name": "Распошив",
                    "cost": "12.00",
                    "folder_id": child_id,
                },
            )
            assert op_b.status_code == 201, op_b.text
            op_b_id = op_b.json()["id"]
            assert op_b.json()["sort_order"] > op_a.json()["sort_order"]

            moved = client.post(
                f"/sewing-operations/{op_b_id}/move-sibling",
                json={"direction": "up"},
            )
            assert moved.status_code == 200, moved.text
            listed = client.get("/sewing-operations", params={"folder_id": child_id})
            assert listed.status_code == 200
            ids = [row["id"] for row in listed.json()]
            assert ids[0] == op_b_id
            assert ids[1] == op_a_id

            blocked = client.delete(f"/sewing-operation-folders/{child_id}")
            assert blocked.status_code == 422

            client.delete(f"/sewing-operations/{op_a_id}")
            client.delete(f"/sewing-operations/{op_b_id}")
            deleted = client.delete(f"/sewing-operation-folders/{child_id}")
            assert deleted.status_code == 204

            sibling = client.post(
                "/sewing-operation-folders",
                json={"name": "Вторая"},
            )
            assert sibling.status_code == 201
            sibling_id = sibling.json()["id"]
            moved_folder = client.post(
                f"/sewing-operation-folders/{sibling_id}/move-sibling",
                json={"direction": "up"},
            )
            assert moved_folder.status_code == 200
            folders = client.get("/sewing-operation-folders")
            assert folders.status_code == 200
            root_ids = [
                row["id"]
                for row in folders.json()
                if row["parent_id"] is None
            ]
            assert root_ids[0] == sibling_id
    finally:
        app.dependency_overrides.clear()


def test_sewing_operations_crud_still_works_with_folder_fields() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            created = client.post(
                "/sewing-operations",
                json={
                    "name": " Базовая сборка ",
                    "cost": "120.50",
                    "quantity_per_item": 2,
                    "duration_seconds": 125,
                },
            )
            assert created.status_code == 201, created.text
            body = created.json()
            assert body["folder_id"] is None
            assert "sort_order" in body
            assert Decimal(body["cost"]) == Decimal("120.50")
    finally:
        app.dependency_overrides.clear()
