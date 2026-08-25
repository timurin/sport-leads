"""Stage 7.1.2 — Specification SQLAlchemy persistence (ADR-031)."""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import create_engine, inspect, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.models.production_order import (
    ProductionBatch,
    ProductionBatchStatus,
    ProductionOrder,
    ProductionOrderStatus,
)
from app.models.sales import Client, Lead, LeadTask, SalesOrder, SalesOrderStatus, SalesUser
from app.models.specification import (
    Specification,
    SpecificationMaterialLine,
    SpecificationVersion,
    SpecificationVersionStatus,
)
from app.models.technical_card import TechnicalCard


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_specification_tables_and_technical_card_fk_are_registered() -> None:
    tables = set(Base.metadata.tables)
    for name in (
        "specifications",
        "specification_versions",
        "specification_product_lines",
        "specification_material_lines",
        "specification_operation_lines",
    ):
        assert name in tables

    fk_targets = {
        fk.target_fullname
        for fk in TechnicalCard.__table__.c.specification_version_id.foreign_keys
    }
    assert "specification_versions.id" in fk_targets


def test_specification_header_and_draft_version_persist() -> None:
    factory = _session_factory()
    with factory() as db:
        db.add(SalesUser(id=1, name="Test"))
        client = Client(contact_name="A", company_name="B", responsible_id=1)
        db.add(client)
        db.flush()
        lead = Lead(
            contact_name="Иван",
            company_name="СК",
            phone="+79990000000",
            email="spec@example.com",
            city="Казань",
            source="website",
            responsible_id=1,
            sport="Футбол",
            product_category="Форма",
            need_description="Форма",
            estimated_quantity=1,
            estimated_amount=Decimal("1000"),
        )
        db.add(lead)
        db.flush()
        db.add(LeadTask(lead_id=lead.id, title="Задача"))
        order = SalesOrder(
            number="SO-SPEC-1",
            lead_id=lead.id,
            client_id=client.id,
            status=SalesOrderStatus.NEW,
            title="Заказ для Spec",
            responsible_id=1,
        )
        db.add(order)
        db.flush()
        po = ProductionOrder(
            sales_order_id=order.id,
            number="PO-SPEC-1",
            order_seq=1,
            status=ProductionOrderStatus.DRAFT.value,
        )
        db.add(po)
        db.flush()
        batch = ProductionBatch(
            production_order_id=po.id,
            number="PO-SPEC-1-B1",
            batch_seq=1,
            status=ProductionBatchStatus.DRAFT.value,
        )
        db.add(batch)
        db.flush()

        spec = Specification(
            production_batch_id=batch.id,
            number=f"{batch.number}-SPEC",
            sales_order_id=order.id,
            production_order_id=po.id,
        )
        db.add(spec)
        db.flush()
        version = SpecificationVersion(
            specification_id=spec.id,
            version_no=1,
            status=SpecificationVersionStatus.DRAFT,
        )
        db.add(version)
        db.flush()
        db.add(
            SpecificationMaterialLine(
                specification_version_id=version.id,
                sequence=1,
                snapshot_name="Ткань",
                unit="м",
                planned_qty=Decimal("2.500"),
                fact_qty=Decimal("2.400"),
            )
        )
        db.commit()

        loaded = db.scalar(select(Specification).where(Specification.id == spec.id))
        assert loaded is not None
        assert loaded.number == "PO-SPEC-1-B1-SPEC"
        assert loaded.batch.id == batch.id
        assert len(loaded.versions) == 1
        assert loaded.versions[0].status == SpecificationVersionStatus.DRAFT
        assert loaded.versions[0].material_lines[0].snapshot_name == "Ткань"

        duplicate = SpecificationVersion(
            specification_id=spec.id,
            version_no=2,
            status=SpecificationVersionStatus.DRAFT,
        )
        db.add(duplicate)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
        else:
            inspector = inspect(db.get_bind())
            indexes = inspector.get_indexes("specification_versions")
            has_partial = any(
                row.get("name") == "uq_specification_versions_one_draft"
                for row in indexes
            )
            assert has_partial is False, "two drafts must violate one-draft unique"
            db.rollback()
