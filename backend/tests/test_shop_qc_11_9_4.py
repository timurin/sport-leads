"""Stage 11.9.4 — Bind rule for shop-stage fact writes (OTK/qc).

QC module writes must be allowed only when the card's current routing stage
matches ProductionStage.code='qc'.
"""

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


def _seed_print_current_qc_future_card(db: Session) -> int:
    db.add(SalesUser(id=1, name="Test"))

    client = Client(contact_name="A", company_name="B", responsible_id=1)
    db.add(client)

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

    print_stage = ProductionStage(
        name="Печать", code="print", is_active=True, sort_order=10
    )
    qc_stage = ProductionStage(name="ОТК", code="qc", is_active=True, sort_order=20)
    db.add_all([print_stage, qc_stage])
    db.flush()

    order = SalesOrder(
        number="SO-QC-BIND-1",
        lead_id=lead.id,
        client_id=client.id,
        status=SalesOrderStatus.NEW,
        title="Заказ QC bind",
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

    # Current routing stage is PRINT, but we attempt to write with shop_stage_code='qc'.
    card = TechnicalCard(
        sales_order_id=order.id,
        sales_order_item_id=item.id,
        number="SO-QC-BIND-01",
        card_seq=1,
        status=TechnicalCardStatus.IN_PROGRESS,
        quantity=item.quantity,
        nomenclature_name="Изделие",
        current_stage_order=1,
        current_stage_label="Печать",
        stage_results=[
            TechnicalCardStageResult(
                stage_order=1,
                production_stage_id=print_stage.id,
                stage_label="Печать",
                status=TechnicalCardStageResultStatus.IN_PROGRESS,
            ),
            TechnicalCardStageResult(
                stage_order=2,
                production_stage_id=qc_stage.id,
                stage_label="ОТК",
                status=TechnicalCardStageResultStatus.PENDING,
            ),
        ],
    )
    db.add(card)
    db.commit()
    return card.id


def test_qc_shop_fact_bind_rejects_when_current_is_not_qc() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            card_id = _seed_print_current_qc_future_card(db)

        with TestClient(app) as client:
            wrong_current = client.patch(
                f"/technical-cards/{card_id}/stages/1/fact",
                json={
                    "performer_name": "Мастер QC",
                    "work_done": "passed",
                    "duration_seconds": 120,
                    "scrap_qty": "0.1",
                    "rework_qty": "0.0",
                    "notes": "должно отклониться",
                    "shop_stage_code": "qc",
                },
            )
            assert wrong_current.status_code == 422, wrong_current.text

            allowed_print = client.patch(
                f"/technical-cards/{card_id}/stages/1/fact",
                json={
                    "performer_name": "Мастер Print",
                    "work_done": "ok",
                    "duration_seconds": 120,
                    "scrap_qty": "0.1",
                    "rework_qty": "0.0",
                    "notes": "должно пройти",
                    "shop_stage_code": "print",
                },
            )
            assert allowed_print.status_code == 200, allowed_print.text
    finally:
        app.dependency_overrides.clear()

