"""Stage 13.1.1.2 — Supplier + SupplierPrice tables and constraints."""

from __future__ import annotations

from decimal import Decimal

import pytest
from sqlalchemy import create_engine, inspect, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.models.nomenclature import Nomenclature, NomenclatureType
from app.models.supplier import Supplier, SupplierPrice


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_supplier_tables_are_registered() -> None:
    table_names = set(Base.metadata.tables)
    assert "suppliers" in table_names
    assert "supplier_prices" in table_names
    supplier_cols = {column.name for column in inspect(Supplier).columns}
    assert {"name", "code", "inn", "kpp", "is_active", "legal_address"} <= supplier_cols
    price_cols = {column.name for column in inspect(SupplierPrice).columns}
    assert {
        "supplier_id",
        "nomenclature_id",
        "unit_price",
        "currency",
        "comment",
    } <= price_cols


def test_supplier_and_price_persist() -> None:
    factory = _session_factory()

    with factory() as db:
        product = Nomenclature(
            name="Ткань кулир",
            category="Материалы",
            nomenclature_type=NomenclatureType.MATERIAL,
            unit="м",
            base_price=Decimal("120.00"),
        )
        supplier = Supplier(
            name="Текстиль-Снаб",
            code="TS-01",
            inn="7707083893",
            is_active=True,
        )
        db.add_all([product, supplier])
        db.flush()

        price = SupplierPrice(
            supplier_id=supplier.id,
            nomenclature_id=product.id,
            unit_price=Decimal("95.50"),
            currency="RUB",
            comment="опт от 100 м",
        )
        db.add(price)
        db.commit()

        loaded = db.scalars(
            select(Supplier).where(Supplier.code == "TS-01")
        ).one()
        assert loaded.name == "Текстиль-Снаб"
        assert loaded.inn == "7707083893"
        assert len(loaded.prices) == 1
        assert loaded.prices[0].unit_price == Decimal("95.50")
        assert loaded.prices[0].currency == "RUB"
        assert loaded.prices[0].nomenclature_id == product.id


def test_supplier_code_unique_when_set() -> None:
    factory = _session_factory()

    with factory() as db:
        db.add(Supplier(name="A", code="DUP", is_active=True))
        db.flush()
        db.add(Supplier(name="B", code="DUP", is_active=True))
        with pytest.raises(IntegrityError):
            db.flush()


def test_supplier_price_unique_per_nomenclature() -> None:
    factory = _session_factory()

    with factory() as db:
        product = Nomenclature(
            name="Нитки",
            category="Материалы",
            nomenclature_type=NomenclatureType.MATERIAL,
            unit="шт",
            base_price=Decimal("10.00"),
        )
        supplier = Supplier(name="ШвейМаг", is_active=True)
        db.add_all([product, supplier])
        db.flush()
        db.add(
            SupplierPrice(
                supplier_id=supplier.id,
                nomenclature_id=product.id,
                unit_price=Decimal("12.00"),
            )
        )
        db.flush()
        db.add(
            SupplierPrice(
                supplier_id=supplier.id,
                nomenclature_id=product.id,
                unit_price=Decimal("11.00"),
            )
        )
        with pytest.raises(IntegrityError):
            db.flush()
