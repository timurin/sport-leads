"""Stage 4.5.3 — product model catalog import / export."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.product_model import ProductModel
from app.services.file_io import parse_tabular_bytes
from app.services.product_model_file_columns import PRODUCT_MODEL_FILE_HEADERS


@pytest.fixture()
def session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    yield factory
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture()
def client(session_factory: sessionmaker[Session]) -> TestClient:
    def override_get_db():
        with session_factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _csv_file(content: str) -> dict:
    return {"file": ("models.csv", content.encode("utf-8"), "text/csv")}


def test_import_template_columns(client: TestClient) -> None:
    response = client.get("/product-models/import-template?format=csv")
    assert response.status_code == 200, response.text
    table = parse_tabular_bytes(response.content, filename="t.csv")
    assert table.headers == list(PRODUCT_MODEL_FILE_HEADERS)
    assert len(table.rows) == 2


def test_export_import_round_trip(client: TestClient, session_factory) -> None:
    created = client.post(
        "/product-models",
        json={
            "article": "PM-IO-1",
            "name": "Export Model",
            "size_type": "men",
            "description": "desc",
            "status": "draft",
        },
    )
    assert created.status_code == 201, created.text

    exported = client.get("/product-models/export?format=csv&search=Export%20Model")
    assert exported.status_code == 200, exported.text
    table = parse_tabular_bytes(exported.content, filename="e.csv")
    for header in PRODUCT_MODEL_FILE_HEADERS:
        assert header in table.headers
    row = next(r for r in table.rows if r["article"] == "PM-IO-1")
    assert row["name"] == "Export Model"
    assert row["size_type"] == "men"

    csv = (
        "article,name,size_type,description,status\n"
        "PM-IO-2,Imported Model,women,from file,draft\n"
    )
    dry = client.post("/product-models/import?dry_run=true", files=_csv_file(csv))
    assert dry.status_code == 200, dry.text
    assert dry.json()["can_commit"] is True

    commit = client.post("/product-models/import?dry_run=false", files=_csv_file(csv))
    assert commit.status_code == 200, commit.text
    body = commit.json()
    assert body["created_count"] == 1

    with session_factory() as db:
        count = db.scalar(
            select(func.count())
            .select_from(ProductModel)
            .where(ProductModel.article == "PM-IO-2")
        )
    assert int(count or 0) == 1


def test_import_upsert_by_article(client: TestClient) -> None:
    created = client.post(
        "/product-models",
        json={
            "article": "PM-UPSERT",
            "name": "Before",
            "size_type": "kids",
            "status": "draft",
        },
    )
    assert created.status_code == 201, created.text

    csv = (
        "article,name,size_type,description,status\n"
        "PM-UPSERT,After Update,kids,changed,draft\n"
    )
    commit = client.post("/product-models/import?dry_run=false", files=_csv_file(csv))
    assert commit.status_code == 200, commit.text
    body = commit.json()
    assert body["updated_count"] == 1
    assert body["created_count"] == 0

    listed = client.get("/product-models?search=PM-UPSERT")
    assert listed.status_code == 200
    row = next(r for r in listed.json() if r["article"] == "PM-UPSERT")
    assert row["name"] == "After Update"
    assert row["description"] == "changed"


def test_template_round_trip_dry_run(client: TestClient) -> None:
    template = client.get("/product-models/import-template?format=csv")
    assert template.status_code == 200
    dry = client.post(
        "/product-models/import?dry_run=true",
        files={"file": ("template.csv", template.content, "text/csv")},
    )
    assert dry.status_code == 200, dry.text
    assert dry.json()["can_commit"] is True


def test_export_includes_assembly_and_routing_ids(
    client: TestClient, session_factory
) -> None:
    from app.models.shop_routing import ShopRoutingTemplate
    from app.services.product_model_file_columns import LIST_VALUE_SEPARATOR

    model = client.post(
        "/product-models",
        json={
            "article": "PM-REL-1",
            "name": "Rel Model",
            "size_type": "men",
            "status": "draft",
        },
    )
    assert model.status_code == 201, model.text
    model_id = model.json()["id"]

    variant_a = client.post(
        f"/product-models/{model_id}/assembly-variants",
        json={"name": "Base", "is_active": True},
    )
    assert variant_a.status_code == 201, variant_a.text
    variant_b = client.post(
        f"/product-models/{model_id}/assembly-variants",
        json={"name": "Pro", "is_active": True},
    )
    assert variant_b.status_code == 201, variant_b.text

    with session_factory() as db:
        template = ShopRoutingTemplate(
            name="Route Rel", code="REL-RT", is_active=True
        )
        db.add(template)
        db.commit()
        db.refresh(template)
        template_id = template.id

    linked = client.post(
        f"/product-models/{model_id}/routings",
        json={"shop_routing_template_id": template_id, "is_active": True},
    )
    assert linked.status_code == 201, linked.text

    exported = client.get("/product-models/export?format=csv&search=Rel%20Model")
    assert exported.status_code == 200, exported.text
    table = parse_tabular_bytes(exported.content, filename="r.csv")
    assert "assembly_variant_ids" in table.headers
    assert "routing_template_ids" in table.headers
    row = next(r for r in table.rows if r["article"] == "PM-REL-1")
    assembly_ids = {
        int(part)
        for part in (row.get("assembly_variant_ids") or "").split(LIST_VALUE_SEPARATOR)
        if part.strip()
    }
    assert variant_a.json()["id"] in assembly_ids
    assert variant_b.json()["id"] in assembly_ids
    assert str(template_id) in (row.get("routing_template_ids") or "")


def test_export_includes_photo_columns(client: TestClient) -> None:
    import base64
    from pathlib import Path

    from app.services.product_model_file_columns import LIST_VALUE_SEPARATOR
    from app.services.product_models import MEDIA_ROOT

    # Minimal valid 1x1 PNG
    png_bytes = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    )
    assert "photo_paths" in PRODUCT_MODEL_FILE_HEADERS
    assert "photo_urls" in PRODUCT_MODEL_FILE_HEADERS

    model = client.post(
        "/product-models",
        json={
            "article": "PM-PHOTO-1",
            "name": "Photo Model",
            "size_type": "men",
            "status": "draft",
        },
    )
    assert model.status_code == 201, model.text
    model_id = model.json()["id"]

    media = client.post(
        f"/product-models/{model_id}/media",
        json={
            "filename": "cover.png",
            "mime_type": "image/png",
            "content_base64": base64.b64encode(png_bytes).decode("ascii"),
            "is_primary": True,
        },
    )
    assert media.status_code == 201, media.text
    media_id = media.json()["id"]

    exported = client.get("/product-models/export?format=csv&search=Photo%20Model")
    assert exported.status_code == 200, exported.text
    table = parse_tabular_bytes(exported.content, filename="p.csv")
    assert "photo_paths" in table.headers
    assert "photo_urls" in table.headers
    row = next(r for r in table.rows if r["article"] == "PM-PHOTO-1")
    paths = [
        part
        for part in (row.get("photo_paths") or "").split(LIST_VALUE_SEPARATOR)
        if part.strip()
    ]
    assert paths, "expected photo_paths in export"
    assert any("cover.png" in part for part in paths)
    assert f"/product-models/{model_id}/media/{media_id}/content" in (
        row.get("photo_urls") or ""
    )

    source = Path(paths[0])
    assert source.is_file() or (MEDIA_ROOT / paths[0]).is_file()
    if not source.is_file():
        source = MEDIA_ROOT / paths[0]

    other = client.post(
        "/product-models",
        json={
            "article": "PM-PHOTO-2",
            "name": "Photo Import Target",
            "size_type": "women",
            "status": "draft",
        },
    )
    assert other.status_code == 201, other.text
    other_id = other.json()["id"]

    csv_body = (
        "article,name,size_type,photo_paths,status\n"
        f'PM-PHOTO-2,Photo Import Target,women,"{source}",draft\n'
    )
    committed = client.post(
        "/product-models/import?dry_run=false",
        files={"file": ("photos.csv", csv_body.encode("utf-8"), "text/csv")},
    )
    assert committed.status_code == 200, committed.text
    assert committed.json()["updated_count"] == 1

    listed = client.get(f"/product-models/{other_id}/media")
    assert listed.status_code == 200, listed.text
    filenames = {item["filename"] for item in listed.json()}
    assert any(name.endswith("cover.png") for name in filenames)
