"""Stage 11.1.2.2 — Snapshot WorkCenter from routing stage line onto TC stage_results."""

from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
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
from app.models.shop_routing import ShopRoutingStageLine, ShopRoutingTemplate, WorkCenter
from app.models.technical_card import TechnicalCard, TechnicalCardStatus


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def _seed(db: Session) -> tuple[int, int, int]:
    db.add(SalesUser(id=1, name="Test"))
    print_stage = ProductionStage(
        name="Печать", code="print", is_active=True, sort_order=30
    )
    sewing = ProductionStage(
        name="Пошив", code="sewing", is_active=True, sort_order=40
    )
    db.add_all([print_stage, sewing])
    db.flush()

    work_center = WorkCenter(
        name="Сублимация-1",
        code="subl-1",
        production_stage_id=print_stage.id,
        is_active=True,
    )
    db.add(work_center)
    db.flush()

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
        number="SO-WC-1",
        lead_id=lead.id,
        client_id=client.id,
        status=SalesOrderStatus.NEW,
        title="Заказ WC",
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

    template = ShopRoutingTemplate(name="Маршрут WC", code="R-WC", is_active=True)
    db.add(template)
    db.flush()
    db.add_all(
        [
            ShopRoutingStageLine(
                routing_template_id=template.id,
                stage_order=1,
                production_stage_id=print_stage.id,
                stage_label="Печать",
                work_center_id=work_center.id,
                is_quality_checkpoint=False,
            ),
            ShopRoutingStageLine(
                routing_template_id=template.id,
                stage_order=2,
                production_stage_id=sewing.id,
                stage_label="Пошив",
                work_center_id=None,
                is_quality_checkpoint=False,
            ),
        ]
    )

    card = TechnicalCard(
        sales_order_id=order.id,
        sales_order_item_id=item.id,
        number="SO-WC-1-01",
        card_seq=1,
        status=TechnicalCardStatus.DRAFT,
        quantity=Decimal("1"),
        nomenclature_name="Изделие",
    )
    db.add(card)
    db.commit()
    return card.id, template.id, work_center.id


def test_apply_routing_snapshots_work_center_onto_stage_results() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            card_id, template_id, work_center_id = _seed(db)

        with TestClient(app) as client:
            applied = client.post(
                f"/technical-cards/{card_id}/apply-routing",
                json={"routing_template_id": template_id},
            )
            assert applied.status_code == 200, applied.text
            stages = applied.json()["stage_results"]
            assert len(stages) == 2
            by_order = {row["stage_order"]: row for row in stages}
            assert by_order[1]["stage_label"] == "Печать"
            assert by_order[1]["work_center_id"] == work_center_id
            assert by_order[2]["stage_label"] == "Пошив"
            assert by_order[2]["work_center_id"] is None

        with factory() as db:
            card = db.get(TechnicalCard, card_id)
            assert card is not None
            results = sorted(card.stage_results, key=lambda row: row.stage_order)
            assert results[0].work_center_id == work_center_id
            assert results[1].work_center_id is None
            # template still has the planned WC (master not mutated)
            template = db.scalar(
                select(ShopRoutingTemplate).where(ShopRoutingTemplate.id == template_id)
            )
            assert template is not None
            line = next(line for line in template.stage_lines if line.stage_order == 1)
            assert line.work_center_id == work_center_id
    finally:
        app.dependency_overrides.clear()
