"""Stage 11.1.2.4 — Planned WorkCenter assign on TC stage (not shop-current bind)."""

from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
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
from app.models.shop_routing import WorkCenter
from app.models.technical_card import (
    TechnicalCard,
    TechnicalCardStageResult,
    TechnicalCardStageResultStatus,
    TechnicalCardStatus,
)


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
    wc = WorkCenter(
        name="Сублимация-2",
        code="subl-2",
        production_stage_id=print_stage.id,
        is_active=True,
    )
    db.add(wc)
    db.flush()

    client = Client(contact_name="A", company_name="B", responsible_id=1)
    db.add(client)
    db.flush()
    lead = Lead(
        contact_name="Иван",
        company_name="СК",
        phone="+79990000002",
        email="c@example.com",
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
        number="SO-WC-PLAN",
        lead_id=lead.id,
        client_id=client.id,
        status=SalesOrderStatus.NEW,
        title="Заказ plan WC",
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
        number="SO-WC-PLAN-01",
        card_seq=1,
        status=TechnicalCardStatus.DRAFT,
        quantity=Decimal("1"),
        nomenclature_name="Изделие",
        current_stage_order=1,
        current_stage_label="Печать",
    )
    db.add(card)
    db.flush()
    db.add_all(
        [
            TechnicalCardStageResult(
                technical_card_id=card.id,
                stage_order=1,
                production_stage_id=print_stage.id,
                stage_label="Печать",
                status=TechnicalCardStageResultStatus.PENDING,
            ),
            TechnicalCardStageResult(
                technical_card_id=card.id,
                stage_order=2,
                production_stage_id=sewing.id,
                stage_label="Пошив",
                status=TechnicalCardStageResultStatus.PENDING,
            ),
        ]
    )
    db.commit()
    return card.id, wc.id, 2


def test_assign_planned_work_center_on_future_stage() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            card_id, wc_id, future_order = _seed(db)

        with TestClient(app) as client:
            # Future stage (not current) can receive planned equipment.
            assigned = client.patch(
                f"/technical-cards/{card_id}/stages/{future_order}/planned-work-center",
                json={"work_center_id": None},
            )
            # sewing stage + print WC should conflict when production_stage differs
            conflict = client.patch(
                f"/technical-cards/{card_id}/stages/{future_order}/planned-work-center",
                json={"work_center_id": wc_id},
            )
            assert conflict.status_code == 422, conflict.text

            ok = client.patch(
                f"/technical-cards/{card_id}/stages/1/planned-work-center",
                json={"work_center_id": wc_id},
            )
            assert ok.status_code == 200, ok.text
            stages = {row["stage_order"]: row for row in ok.json()["stage_results"]}
            assert stages[1]["work_center_id"] == wc_id
            assert stages[2]["work_center_id"] is None

            cleared = client.patch(
                f"/technical-cards/{card_id}/stages/1/planned-work-center",
                json={"work_center_id": None},
            )
            assert cleared.status_code == 200, cleared.text
            assert cleared.json()["stage_results"][0]["work_center_id"] is None
            assert assigned.status_code == 200, assigned.text
    finally:
        app.dependency_overrides.clear()
