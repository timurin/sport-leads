from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.product_model import ProductModel, ProductModelSizeType, ProductModelStatus
from app.schemas.product_model import ProductModelCreate, ProductModelRead, ProductModelUpdate


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_product_model_persists_create_read_update_and_unique_article() -> None:
    factory = _session_factory()
    with factory() as db:
        payload = ProductModelCreate(
            article=" 213 ",
            name=" Футболка спортивная ",
            size_type=ProductModelSizeType.MEN,
            description="  Мужская  ",
        )
        row = ProductModel(
            article=payload.article,
            name=payload.name,
            size_type=payload.size_type,
            description=payload.description,
            status=payload.status,
        )
        db.add(row)
        db.commit()
        db.refresh(row)

        assert row.id is not None
        assert row.article == "213"
        assert row.name == "Футболка спортивная"
        assert row.size_type == ProductModelSizeType.MEN
        assert row.description == "Мужская"
        assert row.status == ProductModelStatus.DRAFT

        read = ProductModelRead.model_validate(row)
        assert read.article == "213"
        assert read.size_type == ProductModelSizeType.MEN

        patch = ProductModelUpdate(name="Футболка 213", status=ProductModelStatus.ACTIVE)
        row.name = patch.name or row.name
        row.status = patch.status or row.status
        db.commit()
        db.refresh(row)
        assert row.name == "Футболка 213"
        assert row.status == ProductModelStatus.ACTIVE

        duplicate = ProductModel(
            article="213",
            name="Дубликат",
            size_type=ProductModelSizeType.WOMEN,
            status=ProductModelStatus.DRAFT,
        )
        db.add(duplicate)
        try:
            db.commit()
            raised = False
        except IntegrityError:
            db.rollback()
            raised = True
        assert raised

        women = ProductModel(
            article="213-W",
            name="Футболка 213 женская",
            size_type=ProductModelSizeType.WOMEN,
            status=ProductModelStatus.DRAFT,
        )
        db.add(women)
        db.commit()
        articles = db.scalars(select(ProductModel.article).order_by(ProductModel.article)).all()
        assert articles == ["213", "213-W"]


def test_product_model_create_and_list_api_rejects_duplicate_article() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            created = client.post(
                "/product-models",
                json={
                    "article": " 213 ",
                    "name": " Футболка спортивная ",
                    "size_type": "men",
                    "description": " Мужская ",
                },
            )
            assert created.status_code == 201, created.text
            body = created.json()
            assert body["article"] == "213"
            assert body["name"] == "Футболка спортивная"
            assert body["size_type"] == "men"
            assert body["status"] == "draft"
            model_id = body["id"]

            duplicate = client.post(
                "/product-models",
                json={"article": "213", "name": "Дубликат", "size_type": "women"},
            )
            assert duplicate.status_code == 409

            listed = client.get("/product-models", params={"search": "213"})
            assert listed.status_code == 200
            assert len(listed.json()) == 1
            assert listed.json()[0]["id"] == model_id

            by_id = client.get(f"/product-models/{model_id}")
            assert by_id.status_code == 200
            assert by_id.json()["article"] == "213"

            missing = client.get("/product-models/999999")
            assert missing.status_code == 404

            openapi = client.get("/openapi.json")
            assert openapi.status_code == 200
            paths = openapi.json()["paths"]
            assert "/product-models" in paths
            assert "get" in paths["/product-models"]
            assert "post" in paths["/product-models"]
            operation_ids = {
                method.get("operationId")
                for path_item in paths.values()
                for method in path_item.values()
                if isinstance(method, dict) and method.get("operationId")
            }
            assert "list_product_models" in operation_ids
            assert "create_product_model" in operation_ids
            assert "get_product_model" in operation_ids
    finally:
        app.dependency_overrides.clear()
