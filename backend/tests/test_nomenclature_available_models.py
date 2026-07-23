from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.size_grid import SizeGrid, SizeGridSizeType


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def _add_size_grid(
    db: Session,
    *,
    name: str,
    size_type: SizeGridSizeType,
) -> SizeGrid:
    grid = SizeGrid(name=name, size_type=size_type)
    db.add(grid)
    db.commit()
    db.refresh(grid)
    return grid


def _link_size_grid(client: TestClient, model_id: int, size_grid_id: int) -> None:
    patched = client.patch(
        f"/product-models/{model_id}",
        json={"size_grid_id": size_grid_id},
    )
    assert patched.status_code == 200, patched.text


def test_nomenclature_available_models_whitelist_rules() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            with factory() as db:
                women_grid = _add_size_grid(
                    db, name="Женская whitelist", size_type=SizeGridSizeType.WOMEN
                )
                kids_grid = _add_size_grid(
                    db, name="Детская whitelist", size_type=SizeGridSizeType.KIDS
                )
                women_grid_id = women_grid.id
                kids_grid_id = kids_grid.id

            product = client.post(
                "/nomenclatures",
                json={
                    "name": "Форма PRODUCT",
                    "category": "Форма",
                    "nomenclature_type": "PRODUCT",
                },
            )
            assert product.status_code == 201, product.text
            product_id = product.json()["id"]

            service = client.post(
                "/nomenclatures",
                json={
                    "name": "Услуга",
                    "category": "Услуги",
                    "nomenclature_type": "SERVICE",
                },
            )
            assert service.status_code == 201, service.text
            service_id = service.json()["id"]

            draft_model = client.post(
                "/product-models",
                json={
                    "article": "M-DRAFT",
                    "name": "Черновик",
                    "size_type": "men",
                },
            )
            assert draft_model.status_code == 201, draft_model.text
            draft_id = draft_model.json()["id"]

            active_model = client.post(
                "/product-models",
                json={
                    "article": "M-ACTIVE",
                    "name": "Активная",
                    "size_type": "women",
                },
            )
            assert active_model.status_code == 201, active_model.text
            active_id = active_model.json()["id"]
            _link_size_grid(client, active_id, women_grid_id)
            activated = client.post(f"/product-models/{active_id}/activate")
            assert activated.status_code == 200, activated.text

            second = client.post(
                "/product-models",
                json={
                    "article": "M-ACTIVE-2",
                    "name": "Активная 2",
                    "size_type": "kids",
                },
            )
            assert second.status_code == 201, second.text
            second_id = second.json()["id"]
            _link_size_grid(client, second_id, kids_grid_id)
            assert client.post(f"/product-models/{second_id}/activate").status_code == 200

            # Non-PRODUCT rejected
            rejected_type = client.post(
                f"/nomenclatures/{service_id}/available-models",
                json={"product_model_id": active_id},
            )
            assert rejected_type.status_code == 422
            assert "PRODUCT" in rejected_type.json()["detail"]

            # Draft model rejected
            rejected_draft = client.post(
                f"/nomenclatures/{product_id}/available-models",
                json={"product_model_id": draft_id},
            )
            assert rejected_draft.status_code == 422

            # Active model accepted
            linked = client.post(
                f"/nomenclatures/{product_id}/available-models",
                json={"product_model_id": active_id},
            )
            assert linked.status_code == 201, linked.text
            assert linked.json()["article"] == "M-ACTIVE"
            assert linked.json()["sort_order"] == 0

            duplicate = client.post(
                f"/nomenclatures/{product_id}/available-models",
                json={"product_model_id": active_id},
            )
            assert duplicate.status_code == 409

            linked2 = client.post(
                f"/nomenclatures/{product_id}/available-models",
                json={"product_model_id": second_id},
            )
            assert linked2.status_code == 201, linked2.text

            listed = client.get(f"/nomenclatures/{product_id}/available-models")
            assert listed.status_code == 200
            assert [row["product_model_id"] for row in listed.json()] == [
                active_id,
                second_id,
            ]

            reordered = client.put(
                f"/nomenclatures/{product_id}/available-models/order",
                json={"product_model_ids": [second_id, active_id]},
            )
            assert reordered.status_code == 200, reordered.text
            assert [row["product_model_id"] for row in reordered.json()] == [
                second_id,
                active_id,
            ]

            removed = client.delete(
                f"/nomenclatures/{product_id}/available-models/{active_id}"
            )
            assert removed.status_code == 204

            after = client.get(f"/nomenclatures/{product_id}/available-models")
            assert [row["product_model_id"] for row in after.json()] == [second_id]

            missing = client.delete(
                f"/nomenclatures/{product_id}/available-models/{active_id}"
            )
            assert missing.status_code == 404

            openapi = client.get("/openapi.json")
            assert openapi.status_code == 200
            operation_ids = {
                method.get("operationId")
                for path_item in openapi.json()["paths"].values()
                for method in path_item.values()
                if isinstance(method, dict) and method.get("operationId")
            }
            assert "list_nomenclature_available_models" in operation_ids
            assert "add_nomenclature_available_model" in operation_ids
            assert "remove_nomenclature_available_model" in operation_ids
            assert "reorder_nomenclature_available_models" in operation_ids
    finally:
        app.dependency_overrides.clear()
