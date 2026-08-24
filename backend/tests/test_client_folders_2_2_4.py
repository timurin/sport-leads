from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.sales import SalesUser


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_client_folders_create_nest_move_cycle_delete() -> None:
    factory = _session_factory()
    with factory() as db:
        db.add(SalesUser(id=1, name="Мария"))
        db.commit()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as api:
            root = api.post("/client-folders", json={"name": " Регионы "})
            assert root.status_code == 201, root.text
            root_id = root.json()["id"]
            assert root.json()["name"] == "Регионы"
            assert root.json()["parent_id"] is None

            child = api.post(
                "/client-folders",
                json={"name": "Казань", "parent_id": root_id},
            )
            assert child.status_code == 201, child.text
            child_id = child.json()["id"]

            other = api.post("/client-folders", json={"name": "Москва"})
            assert other.status_code == 201, other.text
            other_id = other.json()["id"]

            cycle = api.patch(
                f"/client-folders/{root_id}",
                json={"parent_id": child_id},
            )
            assert cycle.status_code == 422

            created = api.post(
                "/clients",
                json={"contact_name": "Иван Петров", "folder_id": child_id, "responsible_id": 1},
            )
            assert created.status_code == 201, created.text
            client_id = created.json()["id"]
            assert created.json()["folder_id"] == child_id
            assert created.json()["folder_name"] == "Казань"

            listed = api.get("/clients")
            assert listed.status_code == 200
            row = next(item for item in listed.json() if item["id"] == client_id)
            assert row["folder_id"] == child_id
            assert row["folder_name"] == "Казань"
            assert "items" not in row

            filtered = api.get("/clients", params={"folder_id": child_id})
            assert filtered.status_code == 200
            assert {item["id"] for item in filtered.json()} == {client_id}

            moved = api.patch(f"/clients/{client_id}", json={"folder_id": other_id})
            assert moved.status_code == 200, moved.text
            assert moved.json()["folder_id"] == other_id

            blocked = api.delete(f"/client-folders/{other_id}")
            assert blocked.status_code == 422

            cleared = api.patch(f"/clients/{client_id}", json={"folder_id": None})
            assert cleared.status_code == 200
            assert cleared.json()["folder_id"] is None

            deleted = api.delete(f"/client-folders/{other_id}")
            assert deleted.status_code == 204
    finally:
        app.dependency_overrides.pop(get_db, None)
