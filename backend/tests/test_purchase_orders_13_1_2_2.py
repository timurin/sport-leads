"""Stage 13.1.2.2 — PurchaseOrder model smoke."""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.models.nomenclature import Nomenclature, NomenclatureType
from app.models.purchase_order import PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus
from app.models.supplier import Supplier
from app.models.warehouse import Warehouse


def test_purchase_order_models_persist() -> None:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)

    with factory() as db:
        supplier = Supplier(name="Текстиль-Опт", is_active=True)
        warehouse = Warehouse(name="Основной", code="MAIN", is_active=True, is_default=True)
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

        order = PurchaseOrder(
            number="PO-000001",
            supplier_id=supplier.id,
            status=PurchaseOrderStatus.DRAFT.value,
            warehouse_id=warehouse.id,
            currency="RUB",
        )
        order.lines.append(
            PurchaseOrderLine(
                nomenclature_id=product.id,
                quantity=Decimal("10.000"),
                unit_price=Decimal("150.00"),
            )
        )
        db.add(order)
        db.commit()
        db.refresh(order)

        assert order.id is not None
        assert len(order.lines) == 1
        assert order.lines[0].unit_price == Decimal("150.00")
