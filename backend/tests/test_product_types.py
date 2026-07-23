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


def test_product_types_crud_and_unique_name() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            created = client.post(
                "/product-types",
                json={"name": " Футболка ", "is_active": True, "sort_order": 10},
            )
            assert created.status_code == 201, created.text
            body = created.json()
            assert body["name"] == "Футболка"
            assert body["is_active"] is True
            assert body["sort_order"] == 10
            product_type_id = body["id"]

            duplicate = client.post(
                "/product-types",
                json={"name": "Футболка", "sort_order": 0},
            )
            assert duplicate.status_code == 409

            second = client.post(
                "/product-types",
                json={"name": "Шорты", "is_active": False, "sort_order": 5},
            )
            assert second.status_code == 201, second.text

            listed = client.get("/product-types")
            assert listed.status_code == 200
            names = [row["name"] for row in listed.json()]
            assert names == ["Шорты", "Футболка"]

            active_only = client.get("/product-types", params={"is_active": True})
            assert active_only.status_code == 200
            assert [row["name"] for row in active_only.json()] == ["Футболка"]

            searched = client.get("/product-types", params={"search": "Футб"})
            assert searched.status_code == 200
            assert len(searched.json()) == 1

            patched = client.patch(
                f"/product-types/{product_type_id}",
                json={"sort_order": 1, "is_active": False},
            )
            assert patched.status_code == 200, patched.text
            assert patched.json()["sort_order"] == 1
            assert patched.json()["is_active"] is False

            negative_sort = client.post(
                "/product-types",
                json={"name": "Брак", "sort_order": -1},
            )
            assert negative_sort.status_code == 422

            deleted = client.delete(f"/product-types/{product_type_id}")
            assert deleted.status_code == 204

            missing = client.get(f"/product-types/{product_type_id}")
            assert missing.status_code == 404
    finally:
        app.dependency_overrides.clear()
