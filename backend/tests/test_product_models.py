from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.product_model import ProductModel, ProductModelSizeType, ProductModelStatus
from app.models.size_grid import SizeGrid, SizeGridSizeType
from app.schemas.product_model import ProductModelCreate, ProductModelRead, ProductModelUpdate


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
    size_type: SizeGridSizeType = SizeGridSizeType.MEN,
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
    assert patched.json()["size_grid_id"] == size_grid_id


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

        patch = ProductModelUpdate(name="Футболка 213")
        row.name = patch.name or row.name
        row.status = ProductModelStatus.ACTIVE
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
            assert "update_product_model" in operation_ids
    finally:
        app.dependency_overrides.clear()


def test_product_model_update_api_persists_and_validates() -> None:
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
                    "article": "213",
                    "name": "Футболка спортивная",
                    "size_type": "men",
                    "description": "Мужская",
                },
            )
            assert created.status_code == 201, created.text
            model_id = created.json()["id"]

            other = client.post(
                "/product-models",
                json={"article": "213-W", "name": "Женская", "size_type": "women"},
            )
            assert other.status_code == 201, other.text

            patched = client.patch(
                f"/product-models/{model_id}",
                json={
                    "name": " Футболка 213 ",
                    "description": "  Обновлено  ",
                    "size_type": "kids",
                },
            )
            assert patched.status_code == 200, patched.text
            body = patched.json()
            assert body["name"] == "Футболка 213"
            assert body["description"] == "Обновлено"
            assert body["size_type"] == "kids"
            assert body["status"] == "draft"

            reopened = client.get(f"/product-models/{model_id}")
            assert reopened.status_code == 200
            assert reopened.json()["name"] == "Футболка 213"
            assert reopened.json()["size_type"] == "kids"

            conflict = client.patch(
                f"/product-models/{model_id}",
                json={"article": "213-W"},
            )
            assert conflict.status_code == 409

            with factory() as db:
                kids_grid = _add_size_grid(
                    db, name="Детская тест", size_type=SizeGridSizeType.KIDS
                )
                kids_grid_id = kids_grid.id
            _link_size_grid(client, model_id, kids_grid_id)

            activated = client.post(f"/product-models/{model_id}/activate")
            assert activated.status_code == 200
            assert activated.json()["status"] == "active"

            locked_size = client.patch(
                f"/product-models/{model_id}",
                json={"size_type": "women"},
            )
            # Existing kids grid remains; incompatible size_type patch is rejected.
            assert locked_size.status_code == 422

            to_draft = client.post(f"/product-models/{model_id}/draft")
            assert to_draft.status_code == 200, to_draft.text
            assert to_draft.json()["status"] == "draft"
            assert to_draft.json()["has_journal_operations"] is False

            missing = client.patch(
                "/product-models/999999",
                json={"name": "Нет"},
            )
            assert missing.status_code == 404

            openapi = client.get("/openapi.json")
            assert openapi.status_code == 200
            paths = openapi.json()["paths"]
            assert "patch" in paths["/product-models/{model_id}"]
    finally:
        app.dependency_overrides.clear()


def test_product_model_status_actions_api() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            created = client.post(
                "/product-models",
                json={"article": "S-01", "name": "Шорты", "size_type": "men"},
            )
            assert created.status_code == 201, created.text
            model_id = created.json()["id"]
            assert created.json()["status"] == "draft"
            assert created.json()["size_grid_id"] is None

            blocked = client.post(f"/product-models/{model_id}/activate")
            assert blocked.status_code == 422

            with factory() as db:
                men_grid = _add_size_grid(db, name="Мужская тест")
                men_grid_id = men_grid.id
                kids_grid = _add_size_grid(
                    db, name="Детская тест", size_type=SizeGridSizeType.KIDS
                )
                kids_grid_id = kids_grid.id

            switched = client.patch(
                f"/product-models/{model_id}",
                json={"size_grid_id": kids_grid_id},
            )
            assert switched.status_code == 200, switched.text
            assert switched.json()["size_type"] == "kids"
            assert switched.json()["size_grid_id"] == kids_grid_id

            _link_size_grid(client, model_id, men_grid_id)
            assert client.get(f"/product-models/{model_id}").json()["size_type"] == "men"

            activated = client.post(f"/product-models/{model_id}/activate")
            assert activated.status_code == 200
            assert activated.json()["status"] == "active"

            # Idempotent activate
            again = client.post(f"/product-models/{model_id}/activate")
            assert again.status_code == 200
            assert again.json()["status"] == "active"

            archived = client.post(f"/product-models/{model_id}/archive")
            assert archived.status_code == 200
            assert archived.json()["status"] == "archived"

            # Reactivate archived → active (domain §2.2)
            reactivated = client.post(f"/product-models/{model_id}/activate")
            assert reactivated.status_code == 200
            assert reactivated.json()["status"] == "active"

            draft_only = client.post(
                "/product-models",
                json={"article": "S-02", "name": "Черновик", "size_type": "kids"},
            )
            draft_id = draft_only.json()["id"]
            with factory() as db:
                kids_grid = _add_size_grid(
                    db, name="Детская архив", size_type=SizeGridSizeType.KIDS
                )
                kids_grid_id = kids_grid.id
            _link_size_grid(client, draft_id, kids_grid_id)
            archived_draft = client.post(f"/product-models/{draft_id}/archive")
            assert archived_draft.status_code == 200
            assert archived_draft.json()["status"] == "archived"

            missing = client.post("/product-models/999999/activate")
            assert missing.status_code == 404

            openapi = client.get("/openapi.json")
            assert openapi.status_code == 200
            operation_ids = {
                method.get("operationId")
                for path_item in openapi.json()["paths"].values()
                for method in path_item.values()
                if isinstance(method, dict) and method.get("operationId")
            }
            assert "activate_product_model" in operation_ids
            assert "archive_product_model" in operation_ids
    finally:
        app.dependency_overrides.clear()


def test_product_model_version_lifecycle_api() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            created = client.post(
                "/product-models",
                json={"article": "V-01", "name": "Версия", "size_type": "men"},
            )
            assert created.status_code == 201, created.text
            model_id = created.json()["id"]

            versions = client.get(f"/product-models/{model_id}/versions")
            assert versions.status_code == 200
            assert len(versions.json()) == 1
            v1 = versions.json()[0]
            assert v1["version_number"] == 1
            assert v1["state"] == "draft"
            assert v1["label"] == "v1"
            v1_id = v1["id"]

            published = client.post(f"/product-models/{model_id}/versions/{v1_id}/publish")
            assert published.status_code == 200, published.text
            assert published.json()["state"] == "published"
            assert published.json()["published_at"] is not None

            draft2 = client.post(
                f"/product-models/{model_id}/versions",
                json={"source_version_id": v1_id, "note": " Правка после публикации "},
            )
            assert draft2.status_code == 201, draft2.text
            v2 = draft2.json()
            assert v2["version_number"] == 2
            assert v2["state"] == "draft"
            assert v2["note"] == "Правка после публикации"
            v2_id = v2["id"]

            published2 = client.post(f"/product-models/{model_id}/versions/{v2_id}/publish")
            assert published2.status_code == 200
            assert published2.json()["state"] == "published"

            after = client.get(f"/product-models/{model_id}/versions")
            assert after.status_code == 200
            by_number = {item["version_number"]: item for item in after.json()}
            assert by_number[1]["state"] == "archived"
            assert by_number[2]["state"] == "published"

            archived = client.post(f"/product-models/{model_id}/versions/{v2_id}/archive")
            assert archived.status_code == 200
            assert archived.json()["state"] == "archived"

            reject_publish = client.post(
                f"/product-models/{model_id}/versions/{v2_id}/publish"
            )
            assert reject_publish.status_code == 422

            missing_model = client.get("/product-models/999999/versions")
            assert missing_model.status_code == 404

            openapi = client.get("/openapi.json")
            assert openapi.status_code == 200
            operation_ids = {
                method.get("operationId")
                for path_item in openapi.json()["paths"].values()
                for method in path_item.values()
                if isinstance(method, dict) and method.get("operationId")
            }
            assert "list_product_model_versions" in operation_ids
            assert "create_product_model_version" in operation_ids
            assert "publish_product_model_version" in operation_ids
            assert "archive_product_model_version" in operation_ids
    finally:
        app.dependency_overrides.clear()


def test_product_model_cover_upload_and_delete_api() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            created = client.post(
                "/product-models",
                json={"article": "IMG-01", "name": "С обложкой", "size_type": "men"},
            )
            assert created.status_code == 201, created.text
            model_id = created.json()["id"]

            png_b64 = (
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8"
                "z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
            )
            uploaded = client.post(
                f"/product-models/{model_id}/cover",
                json={
                    "filename": "dot.png",
                    "mime_type": "image/png",
                    "content_base64": png_b64,
                },
            )
            assert uploaded.status_code == 200, uploaded.text
            cover_url = uploaded.json()["cover_image_url"]
            assert cover_url is not None
            assert cover_url.startswith(f"/product-models/{model_id}/media/")
            assert cover_url.endswith("/content")

            content = client.get(f"/product-models/{model_id}/cover/content")
            assert content.status_code == 200
            assert content.headers["content-type"].startswith("image/png")

            deleted = client.delete(f"/product-models/{model_id}/cover")
            assert deleted.status_code == 200
            assert deleted.json()["cover_image_url"] is None

            missing = client.get(f"/product-models/{model_id}/cover/content")
            assert missing.status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_product_model_media_gallery_and_history_fifo() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    png_b64 = (
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8"
        "z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    )
    try:
        with TestClient(app) as client:
            created = client.post(
                "/product-models",
                json={"article": "GAL-01", "name": "Галерея", "size_type": "women"},
            )
            assert created.status_code == 201, created.text
            model_id = created.json()["id"]

            history = client.get(f"/product-models/{model_id}/history")
            assert history.status_code == 200
            assert any(entry["action"] == "Модель создана" for entry in history.json())

            first = client.post(
                f"/product-models/{model_id}/media",
                json={
                    "filename": "a.png",
                    "mime_type": "image/png",
                    "content_base64": png_b64,
                },
            )
            assert first.status_code == 201, first.text
            assert first.json()["is_primary"] is True
            media_a = first.json()["id"]

            second = client.post(
                f"/product-models/{model_id}/media",
                json={
                    "filename": "b.png",
                    "mime_type": "image/png",
                    "content_base64": png_b64,
                },
            )
            assert second.status_code == 201, second.text
            media_b = second.json()["id"]
            assert second.json()["is_primary"] is False

            listed = client.get(f"/product-models/{model_id}/media")
            assert listed.status_code == 200
            assert len(listed.json()) == 2

            primary = client.patch(
                f"/product-models/{model_id}/media/{media_b}",
                json={"is_primary": True},
            )
            assert primary.status_code == 200
            assert primary.json()["is_primary"] is True

            model = client.get(f"/product-models/{model_id}")
            assert model.json()["cover_image_url"] == (
                f"/product-models/{model_id}/media/{media_b}/content"
            )

            content = client.get(f"/product-models/{model_id}/media/{media_b}/content")
            assert content.status_code == 200

            deleted = client.delete(f"/product-models/{model_id}/media/{media_a}")
            assert deleted.status_code == 204

            # FIFO: keep at most 10 history rows
            for index in range(20):
                patched = client.patch(
                    f"/product-models/{model_id}",
                    json={"description": f"note-{index}"},
                )
                assert patched.status_code == 200, patched.text

            history_after = client.get(f"/product-models/{model_id}/history")
            assert history_after.status_code == 200
            rows = history_after.json()
            assert len(rows) == 10
            assert rows[0]["action"].startswith("Обновлены поля")
            assert all(entry["actor"] == "Система" for entry in rows)

            openapi = client.get("/openapi.json")
            assert openapi.status_code == 200
            operation_ids = {
                method.get("operationId")
                for path_item in openapi.json()["paths"].values()
                for method in path_item.values()
                if isinstance(method, dict) and method.get("operationId")
            }
            assert "list_product_model_media" in operation_ids
            assert "add_product_model_media" in operation_ids
            assert "list_product_model_history" in operation_ids
    finally:
        app.dependency_overrides.clear()


def test_product_model_copy_creates_draft() -> None:
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
                    "article": "SRC-01",
                    "name": "Источник",
                    "size_type": "men",
                    "description": "Описание",
                },
            )
            assert created.status_code == 201, created.text
            model_id = created.json()["id"]
            with factory() as db:
                men_grid = _add_size_grid(db, name="Мужская копия")
                men_grid_id = men_grid.id
            _link_size_grid(client, model_id, men_grid_id)
            client.post(f"/product-models/{model_id}/activate")

            copied = client.post(f"/product-models/{model_id}/copy")
            assert copied.status_code == 201, copied.text
            body = copied.json()
            assert body["status"] == "draft"
            assert body["article"].startswith("SRC-01-копия")
            assert body["name"] == "Источник (копия)"
            assert body["id"] != model_id
            assert body["description"] == "Описание"
            assert body["size_grid_id"] == men_grid_id
    finally:
        app.dependency_overrides.clear()


def test_product_model_size_grid_link_api() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            men_grid = _add_size_grid(db, name="Мужская связь")
            women_grid = _add_size_grid(
                db, name="Женская связь", size_type=SizeGridSizeType.WOMEN
            )
            men_grid_id, women_grid_id = men_grid.id, women_grid.id

        with TestClient(app) as client:
            created = client.post(
                "/product-models",
                json={
                    "article": "SG-01",
                    "name": "С сеткой",
                    "size_type": "men",
                    "size_grid_id": men_grid_id,
                },
            )
            assert created.status_code == 201, created.text
            model_id = created.json()["id"]
            assert created.json()["size_grid_id"] == men_grid_id
            assert created.json()["size_type"] == "men"

            derived = client.post(
                "/product-models",
                json={
                    "article": "SG-02",
                    "name": "Тип из сетки",
                    "size_type": "men",
                    "size_grid_id": women_grid_id,
                },
            )
            assert derived.status_code == 201, derived.text
            assert derived.json()["size_type"] == "women"
            assert derived.json()["size_grid_id"] == women_grid_id

            missing_grid = client.patch(
                f"/product-models/{model_id}",
                json={"size_grid_id": 999999},
            )
            assert missing_grid.status_code == 422

            incompatible_type = client.patch(
                f"/product-models/{model_id}",
                json={"size_type": "women"},
            )
            assert incompatible_type.status_code == 422

            linked = client.patch(
                f"/product-models/{model_id}",
                json={"size_grid_id": women_grid_id},
            )
            assert linked.status_code == 200, linked.text
            assert linked.json()["size_grid_id"] == women_grid_id
            assert linked.json()["size_type"] == "women"

            activated = client.post(f"/product-models/{model_id}/activate")
            assert activated.status_code == 200

            blocked_clear = client.patch(
                f"/product-models/{model_id}",
                json={"size_grid_id": None},
            )
            assert blocked_clear.status_code == 422

            still_linked = client.get(f"/product-models/{model_id}")
            assert still_linked.json()["size_grid_id"] == women_grid_id
            assert still_linked.json()["has_journal_operations"] is False

            to_draft = client.post(f"/product-models/{model_id}/draft")
            assert to_draft.status_code == 200, to_draft.text
            assert to_draft.json()["status"] == "draft"
    finally:
        app.dependency_overrides.clear()
