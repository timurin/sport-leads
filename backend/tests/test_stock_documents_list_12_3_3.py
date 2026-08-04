"""Stage 12.3.3 — list stock documents for movements journal."""

from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.nomenclature import Nomenclature, NomenclatureType
from app.models.warehouse import Warehouse


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def _seed(db: Session) -> tuple[int, int]:
    warehouse = Warehouse(
        name="Основной",
        code="main",
        is_active=True,
        is_default=True,
    )
    product = Nomenclature(
        name="Футболка PRO",
        category="Форма",
        nomenclature_type=NomenclatureType.PRODUCT,
        unit="шт",
        base_price=Decimal("1500.00"),
    )
    db.add_all([warehouse, product])
    db.commit()
    return warehouse.id, product.id


def test_list_stock_documents_filters_and_order() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            warehouse_id, product_id = _seed(db)

        with TestClient(app) as client:
            receipt = client.post(
                "/stock/documents",
                json={
                    "doc_type": "receipt",
                    "warehouse_id": warehouse_id,
                    "lines": [
                        {"nomenclature_id": product_id, "quantity": "10"}
                    ],
                    "post": True,
                },
            )
            assert receipt.status_code == 201, receipt.text

            draft = client.post(
                "/stock/documents",
                json={
                    "doc_type": "issue",
                    "warehouse_id": warehouse_id,
                    "lines": [
                        {"nomenclature_id": product_id, "quantity": "2"}
                    ],
                    "post": False,
                },
            )
            assert draft.status_code == 201, draft.text

            all_docs = client.get("/stock/documents", params={"limit": 50})
            assert all_docs.status_code == 200, all_docs.text
            rows = all_docs.json()
            assert len(rows) == 2
            assert rows[0]["id"] == receipt.json()["id"]
            assert rows[1]["id"] == draft.json()["id"]

            posted_only = client.get(
                "/stock/documents", params={"status": "posted"}
            )
            assert posted_only.status_code == 200
            assert len(posted_only.json()) == 1
            assert posted_only.json()[0]["doc_type"] == "receipt"

            issues = client.get(
                "/stock/documents", params={"doc_type": "issue"}
            )
            assert issues.status_code == 200
            assert len(issues.json()) == 1
            assert issues.json()[0]["status"] == "draft"
    finally:
        app.dependency_overrides.pop(get_db, None)
