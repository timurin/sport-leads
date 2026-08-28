"""Stage 13.1.2.3 — Purchase order API CRUD + confirm/cancel."""

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
from app.models.supplier import Supplier, SupplierPrice
from app.models.warehouse import Warehouse


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_purchase_orders_api_flow() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            supplier = Supplier(name="Текстиль-Опт", code="TO-1", is_active=True)
            warehouse = Warehouse(
                name="Основной", code="MAIN", is_active=True, is_default=True
            )
            product = Nomenclature(
                name="Кулир",
                category="Материалы",
                nomenclature_type=NomenclatureType.MATERIAL,
                unit="м",
                base_price=Decimal("100.00"),
            )
            db.add_all([supplier, warehouse, product])
            db.commit()
            db.refresh(supplier)
            db.refresh(warehouse)
            db.refresh(product)
            db.add(
                SupplierPrice(
                    supplier_id=supplier.id,
                    nomenclature_id=product.id,
                    unit_price=Decimal("120.00"),
                    currency="RUB",
                )
            )
            db.commit()
            supplier_id = supplier.id
            warehouse_id = warehouse.id
            nom_id = product.id

        with TestClient(app) as client:
            empty = client.post(
                "/purchase-orders",
                json={"supplier_id": supplier_id},
            )
            assert empty.status_code == 201, empty.text
            draft_id = empty.json()["id"]
            assert empty.json()["number"].startswith("PO-")
            assert empty.json()["status"] == "draft"
            assert empty.json()["lines"] == []
            assert empty.json()["total_amount"] == "0.00"

            bad_confirm = client.post(f"/purchase-orders/{draft_id}/confirm")
            assert bad_confirm.status_code == 422

            priced = client.post(
                f"/purchase-orders/{draft_id}/lines",
                json={"nomenclature_id": nom_id, "quantity": "10"},
            )
            assert priced.status_code == 201, priced.text
            body = priced.json()
            assert body["lines"][0]["unit_price"] == "120.00"
            assert body["lines"][0]["line_amount"] == "1200.00"
            assert body["total_amount"] == "1200.00"
            line_id = body["lines"][0]["id"]

            patched = client.patch(
                f"/purchase-orders/{draft_id}",
                json={
                    "warehouse_id": warehouse_id,
                    "expected_date": "2026-09-15",
                    "notes": "Срок критичный",
                },
            )
            assert patched.status_code == 200, patched.text
            assert patched.json()["warehouse_id"] == warehouse_id
            assert patched.json()["warehouse_name"] == "Основной"

            qty = client.patch(
                f"/purchase-orders/{draft_id}/lines/{line_id}",
                json={"quantity": "5", "unit_price": "130.00"},
            )
            assert qty.status_code == 200
            assert qty.json()["total_amount"] == "650.00"

            listed = client.get("/purchase-orders")
            assert listed.status_code == 200
            assert len(listed.json()) == 1
            assert "lines" not in listed.json()[0]
            assert listed.json()[0]["supplier_name"] == "Текстиль-Опт"
            assert listed.json()[0]["total_amount"] == "650.00"

            confirmed = client.post(f"/purchase-orders/{draft_id}/confirm")
            assert confirmed.status_code == 200, confirmed.text
            assert confirmed.json()["status"] == "ordered"
            assert confirmed.json()["ordered_at"] is not None

            blocked = client.post(
                f"/purchase-orders/{draft_id}/lines",
                json={"nomenclature_id": nom_id, "quantity": "1", "unit_price": "1"},
            )
            assert blocked.status_code == 422

            cancelled = client.post(f"/purchase-orders/{draft_id}/cancel")
            assert cancelled.status_code == 200
            assert cancelled.json()["status"] == "cancelled"
    finally:
        app.dependency_overrides.clear()
