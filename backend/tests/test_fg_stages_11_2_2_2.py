"""Stage 11.2.2.2 — FG ProductionStage seed + routing append after packaging."""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.models.production_stage import ProductionStage
from app.models.sales import (
    Client,
    Lead,
    LeadTask,
    SalesOrder,
    SalesOrderItem,
    SalesOrderStatus,
    SalesUser,
)
from app.models.shop_routing import ShopRoutingStageLine, ShopRoutingTemplate
from app.models.technical_card import TechnicalCard, TechnicalCardStatus
from app.services.technical_cards import _apply_routing_template


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def _seed(db: Session) -> tuple[TechnicalCard, ShopRoutingTemplate]:
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

    packaging = ProductionStage(
        name="Упаковка", code="packaging", is_active=True, sort_order=70
    )
    ready = ProductionStage(
        name="Готовы к отгрузке",
        code="ready_to_ship",
        is_active=True,
        sort_order=80,
    )
    shipped = ProductionStage(
        name="Отгружены", code="shipped", is_active=True, sort_order=90
    )
    db.add_all([packaging, ready, shipped])
    db.flush()

    template = ShopRoutingTemplate(name="FG route", code="fg-route", is_active=True)
    db.add(template)
    db.flush()
    db.add(
        ShopRoutingStageLine(
            routing_template_id=template.id,
            stage_order=1,
            production_stage_id=packaging.id,
            stage_label=packaging.name,
        )
    )

    order = SalesOrder(
        number="SO-FG-1",
        lead_id=lead.id,
        client_id=client.id,
        status=SalesOrderStatus.NEW,
        title="FG",
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
        number="SO-FG-1-01",
        card_seq=1,
        status=TechnicalCardStatus.DRAFT,
        quantity=Decimal("1"),
        nomenclature_name="Изделие",
    )
    db.add(card)
    db.commit()
    db.refresh(card)
    db.refresh(template)
    return card, template


def test_apply_routing_appends_ready_to_ship_and_shipped() -> None:
    factory = _session_factory()
    with factory() as db:
        card, template = _seed(db)
        template = db.get(ShopRoutingTemplate, template.id)
        card = db.get(TechnicalCard, card.id)
        assert template is not None and card is not None
        # Eager stage_lines
        _ = template.stage_lines
        _apply_routing_template(db, card, template)
        db.commit()
        db.refresh(card)

        orders = sorted(card.stage_results, key=lambda row: row.stage_order)
        assert len(orders) == 3
        codes = []
        for row in orders:
            stage = db.get(ProductionStage, row.production_stage_id)
            assert stage is not None
            codes.append(stage.code)
        assert codes == ["packaging", "ready_to_ship", "shipped"]
        assert orders[0].stage_order == 1
        assert orders[1].stage_order == 2
        assert orders[2].stage_order == 3


def test_apply_routing_does_not_duplicate_existing_fg_stages() -> None:
    factory = _session_factory()
    with factory() as db:
        card, template = _seed(db)
        packaging = db.scalar(
            select(ProductionStage).where(ProductionStage.code == "packaging")
        )
        ready = db.scalar(
            select(ProductionStage).where(ProductionStage.code == "ready_to_ship")
        )
        shipped = db.scalar(
            select(ProductionStage).where(ProductionStage.code == "shipped")
        )
        assert packaging and ready and shipped
        db.add_all(
            [
                ShopRoutingStageLine(
                    routing_template_id=template.id,
                    stage_order=2,
                    production_stage_id=ready.id,
                    stage_label=ready.name,
                ),
                ShopRoutingStageLine(
                    routing_template_id=template.id,
                    stage_order=3,
                    production_stage_id=shipped.id,
                    stage_label=shipped.name,
                ),
            ]
        )
        db.commit()
        template = db.get(ShopRoutingTemplate, template.id)
        card = db.get(TechnicalCard, card.id)
        assert template is not None and card is not None
        _ = template.stage_lines
        _apply_routing_template(db, card, template)
        db.commit()
        db.refresh(card)
        assert len(card.stage_results) == 3
