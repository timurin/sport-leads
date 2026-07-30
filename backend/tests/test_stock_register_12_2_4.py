"""Stage 12.2.4 — regression: post in/out → balance; never on Nomenclature (ADR-012)."""

from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, select
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


def _seed_two_warehouses(db: Session) -> tuple[int, int, int]:
    main = Warehouse(
        name="Основной",
        code="main",
        is_active=True,
        is_default=True,
    )
    reserve = Warehouse(
        name="Резервный",
        code="reserve",
        is_active=True,
        is_default=False,
    )
    product = Nomenclature(
        name="Футболка PRO",
        category="Форма",
        nomenclature_type=NomenclatureType.PRODUCT,
        unit="шт",
        base_price=Decimal("1500.00"),
    )
    db.add_all([main, reserve, product])
    db.commit()
    return main.id, reserve.id, product.id


def test_regression_post_in_out_balance_and_nomenclature_untouched() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            main_id, reserve_id, product_id = _seed_two_warehouses(db)
            before = db.get(Nomenclature, product_id)
            assert before is not None
            snapshot = {
                "name": before.name,
                "base_price": before.base_price,
                "unit": before.unit,
                "is_active": before.is_active,
            }

        columns = {column.name for column in inspect(Nomenclature).columns}
        assert "balance" not in columns
        assert "minimum_balance" not in columns
        assert "warehouse" not in columns
        assert "stock_quantity" not in columns

        with TestClient(app) as client:
            receipt_main = client.post(
                "/stock/documents",
                json={
                    "doc_type": "receipt",
                    "warehouse_id": main_id,
                    "lines": [
                        {"nomenclature_id": product_id, "quantity": "20"}
                    ],
                },
            )
            assert receipt_main.status_code == 201, receipt_main.text

            receipt_reserve = client.post(
                "/stock/documents",
                json={
                    "doc_type": "receipt",
                    "warehouse_id": reserve_id,
                    "lines": [
                        {"nomenclature_id": product_id, "quantity": "5"}
                    ],
                },
            )
            assert receipt_reserve.status_code == 201, receipt_reserve.text

            aggregated = client.get(
                "/stock/balances",
                params={"nomenclature_id": product_id},
            )
            assert aggregated.status_code == 200
            assert len(aggregated.json()) == 1
            assert Decimal(aggregated.json()[0]["quantity"]) == Decimal("25")
            assert aggregated.json()[0]["warehouse_id"] is None

            main_bal = client.get(
                "/stock/balances",
                params={
                    "warehouse_id": main_id,
                    "nomenclature_id": product_id,
                },
            )
            assert Decimal(main_bal.json()[0]["quantity"]) == Decimal("20")
            assert main_bal.json()[0]["warehouse_id"] == main_id

            issue = client.post(
                "/stock/documents",
                json={
                    "doc_type": "issue",
                    "warehouse_id": main_id,
                    "lines": [
                        {"nomenclature_id": product_id, "quantity": "4.5"}
                    ],
                },
            )
            assert issue.status_code == 201, issue.text
            assert issue.json()["ledger_lines"][0]["quantity"] == "-4.500"

            after_issue = client.get(
                "/stock/balances",
                params={
                    "warehouse_id": main_id,
                    "nomenclature_id": product_id,
                },
            )
            assert Decimal(after_issue.json()[0]["quantity"]) == Decimal("15.5")

            total = client.get(
                "/stock/balances",
                params={"nomenclature_id": product_id},
            )
            assert Decimal(total.json()[0]["quantity"]) == Decimal("20.5")

            # Re-post must fail; balances stay stable.
            again = client.post(
                f"/stock/documents/{issue.json()['id']}/post"
            )
            assert again.status_code == 422
            stable = client.get(
                "/stock/balances",
                params={"nomenclature_id": product_id},
            )
            assert Decimal(stable.json()[0]["quantity"]) == Decimal("20.5")

        with factory() as db:
            after = db.scalars(
                select(Nomenclature).where(Nomenclature.id == product_id)
            ).one()
            assert after.name == snapshot["name"]
            assert after.base_price == snapshot["base_price"]
            assert after.unit == snapshot["unit"]
            assert after.is_active == snapshot["is_active"]
            assert not hasattr(after, "balance")
    finally:
        app.dependency_overrides.pop(get_db, None)
