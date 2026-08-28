"""Stage 13.1.1.3 — Supplier + SupplierPrice API CRUD."""

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
from app.models.supplier import Supplier


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_suppliers_api_list_detail_prices_and_delete_guard() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            product = Nomenclature(
                name="Кулир",
                category="Материалы",
                nomenclature_type=NomenclatureType.MATERIAL,
                unit="м",
                base_price=Decimal("100.00"),
            )
            db.add(product)
            db.commit()
            db.refresh(product)
            nom_id = product.id

        with TestClient(app) as client:
            created = client.post(
                "/suppliers",
                json={
                    "name": "Текстиль-Снаб",
                    "code": "TS-01",
                    "inn": "7707083893",
                    "is_active": True,
                },
            )
            assert created.status_code == 201, created.text
            body = created.json()
            supplier_id = body["id"]
            assert body["prices"] == []
            assert "kpp" in body

            listed = client.get("/suppliers")
            assert listed.status_code == 200
            assert len(listed.json()) == 1
            assert "prices" not in listed.json()[0]
            assert listed.json()[0]["name"] == "Текстиль-Снаб"

            conflict = client.post(
                "/suppliers",
                json={"name": "Другой", "code": "TS-01", "is_active": True},
            )
            assert conflict.status_code == 409

            price = client.post(
                f"/suppliers/{supplier_id}/prices",
                json={
                    "nomenclature_id": nom_id,
                    "unit_price": "95.50",
                    "currency": "RUB",
                    "comment": "опт",
                },
            )
            assert price.status_code == 201, price.text
            assert price.json()["nomenclature_name"] == "Кулир"
            price_id = price.json()["id"]

            dup = client.post(
                f"/suppliers/{supplier_id}/prices",
                json={"nomenclature_id": nom_id, "unit_price": "90.00"},
            )
            assert dup.status_code == 409

            detail = client.get(f"/suppliers/{supplier_id}")
            assert detail.status_code == 200
            assert len(detail.json()["prices"]) == 1

            patched = client.patch(
                f"/suppliers/{supplier_id}/prices/{price_id}",
                json={"unit_price": "88.00"},
            )
            assert patched.status_code == 200
            assert patched.json()["unit_price"] == "88.00"

            deny_delete = client.delete(f"/suppliers/{supplier_id}")
            assert deny_delete.status_code == 422

            assert (
                client.delete(f"/suppliers/{supplier_id}/prices/{price_id}").status_code
                == 204
            )
            assert client.delete(f"/suppliers/{supplier_id}").status_code == 204

            with factory() as db:
                assert db.get(Supplier, supplier_id) is None
    finally:
        app.dependency_overrides.pop(get_db, None)
