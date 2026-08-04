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


def test_product_model_folders_create_nest_move_cycle_delete() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            root = client.post(
                "/product-model-folders",
                json={"name": " Каталог "},
            )
            assert root.status_code == 201, root.text
            root_id = root.json()["id"]
            assert root.json()["name"] == "Каталог"
            assert root.json()["parent_id"] is None

            child = client.post(
                "/product-model-folders",
                json={"name": "Футболки", "parent_id": root_id},
            )
            assert child.status_code == 201, child.text
            child_id = child.json()["id"]
            assert child.json()["parent_id"] == root_id

            other = client.post(
                "/product-model-folders",
                json={"name": "Шорты"},
            )
            assert other.status_code == 201, other.text
            other_id = other.json()["id"]

            cycle = client.patch(
                f"/product-model-folders/{root_id}",
                json={"parent_id": child_id},
            )
            assert cycle.status_code == 422

            model = client.post(
                "/product-models",
                json={
                    "article": "PM-100",
                    "name": "Модель в папке",
                    "size_type": "men",
                    "folder_id": child_id,
                },
            )
            assert model.status_code == 201, model.text
            body = model.json()
            assert body["folder_id"] == child_id
            assert "sort_order" in body
            model_id = body["id"]

            moved = client.patch(
                f"/product-models/{model_id}",
                json={"folder_id": other_id},
            )
            assert moved.status_code == 200, moved.text
            assert moved.json()["folder_id"] == other_id

            blocked = client.delete(f"/product-model-folders/{other_id}")
            assert blocked.status_code == 422

            clear = client.patch(
                f"/product-models/{model_id}",
                json={"folder_id": None},
            )
            assert clear.status_code == 200, clear.text
            assert clear.json()["folder_id"] is None

            deleted = client.delete(f"/product-model-folders/{other_id}")
            assert deleted.status_code == 204

            deleted_child = client.delete(f"/product-model-folders/{child_id}")
            assert deleted_child.status_code == 204
    finally:
        app.dependency_overrides.clear()
