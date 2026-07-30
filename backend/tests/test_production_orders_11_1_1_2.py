"""Stage 11.1.1.2 — ProductionOrder / ProductionBatch DB persistence (ADR-018)."""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.models.production_order import (
    ProductionBatch,
    ProductionBatchCardLink,
    ProductionBatchStatus,
    ProductionOrder,
    ProductionOrderStatus,
)
from app.models.sales import (
    Client,
    Lead,
    LeadTask,
    SalesOrder,
    SalesOrderItem,
    SalesOrderStatus,
    SalesUser,
)
from app.models.technical_card import TechnicalCard, TechnicalCardStatus


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def _seed_order_and_card(db: Session) -> tuple[int, int]:
    db.add(SalesUser(id=1, name="Test"))
    client = Client(contact_name="A", company_name="B", responsible_id=1)
    db.add(client)
    db.flush()
    lead = Lead(
        contact_name="Иван",
        company_name="СК",
        phone="+79990000000",
        email="a@example.com",
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
        number="SO-PO-1",
        lead_id=lead.id,
        client_id=client.id,
        status=SalesOrderStatus.NEW,
        title="Заказ для PO",
        responsible_id=1,
    )
    db.add(order)
    db.flush()
    item = SalesOrderItem(
        order_id=order.id,
        position=1,
        snapshot_name="Изделие",
        quantity=Decimal("1"),
        unit_price=Decimal("100"),
        line_amount=Decimal("100"),
        discount_amount=Decimal("0"),
        unit="шт",
    )
    db.add(item)
    db.flush()
    card = TechnicalCard(
        sales_order_id=order.id,
        sales_order_item_id=item.id,
        number="SO-PO-1-01",
        card_seq=1,
        status=TechnicalCardStatus.DRAFT,
        quantity=Decimal("1"),
        nomenclature_name="Изделие",
    )
    db.add(card)
    db.commit()
    return order.id, card.id


def test_production_order_batch_and_card_link_persist() -> None:
    factory = _session_factory()
    with factory() as db:
        order_id, card_id = _seed_order_and_card(db)

        po = ProductionOrder(
            sales_order_id=order_id,
            number="PO-SO-PO-1-1",
            order_seq=1,
            status=ProductionOrderStatus.DRAFT.value,
        )
        db.add(po)
        db.flush()

        batch = ProductionBatch(
            production_order_id=po.id,
            number="PO-SO-PO-1-1-B1",
            batch_seq=1,
            status=ProductionBatchStatus.DRAFT.value,
        )
        db.add(batch)
        db.flush()

        link = ProductionBatchCardLink(
            production_batch_id=batch.id,
            technical_card_id=card_id,
        )
        db.add(link)
        db.commit()

        loaded = db.scalar(select(ProductionOrder).where(ProductionOrder.id == po.id))
        assert loaded is not None
        assert loaded.number == "PO-SO-PO-1-1"
        assert len(loaded.batches) == 1
        assert loaded.batches[0].number == "PO-SO-PO-1-1-B1"
        assert len(loaded.batches[0].card_links) == 1
        assert loaded.batches[0].card_links[0].technical_card_id == card_id


def test_technical_card_cannot_belong_to_two_batches() -> None:
    factory = _session_factory()
    with factory() as db:
        order_id, card_id = _seed_order_and_card(db)
        po = ProductionOrder(
            sales_order_id=order_id,
            number="PO-SO-PO-1-1",
            order_seq=1,
        )
        db.add(po)
        db.flush()
        b1 = ProductionBatch(
            production_order_id=po.id,
            number="PO-SO-PO-1-1-B1",
            batch_seq=1,
        )
        b2 = ProductionBatch(
            production_order_id=po.id,
            number="PO-SO-PO-1-1-B2",
            batch_seq=2,
        )
        db.add_all([b1, b2])
        db.flush()
        db.add(
            ProductionBatchCardLink(
                production_batch_id=b1.id,
                technical_card_id=card_id,
            )
        )
        db.commit()

        db.add(
            ProductionBatchCardLink(
                production_batch_id=b2.id,
                technical_card_id=card_id,
            )
        )
        try:
            db.commit()
            raise AssertionError("expected unique technical_card_id violation")
        except IntegrityError:
            db.rollback()
