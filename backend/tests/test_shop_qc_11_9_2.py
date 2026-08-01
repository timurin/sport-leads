"""Stage 11.9.2 — ОТК shop stage fact write (scrap/rework/notes).

Goal: ensure PATCH /technical-cards/{id}/stages/{order}/fact accepts
scrap_qty/rework_qty/notes when shop_stage_code=qc and the card is on that stage.
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


def _seed_qc_card(db: Session) -> int:
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

    qc_stage = ProductionStage(name="ОТК", code="qc", is_active=True, sort_order=10)
    db.add(qc_stage)
    db.flush()

    order = SalesOrder(
        number="SO-QC-1",
        lead_id=lead.id,
        client_id=client.id,
        status=SalesOrderStatus.NEW,
        title="Заказ ОТК",
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
        number="SO-QC-1-01",
        card_seq=1,
        status=TechnicalCardStatus.IN_PROGRESS,
        quantity=item.quantity,
        nomenclature_name="Изделие",
        current_stage_order=1,
        current_stage_label="ОТК",
        stage_results=[
            TechnicalCardStageResult(
                stage_order=1,
                production_stage_id=qc_stage.id,
                stage_label="ОТК",
                status=TechnicalCardStageResultStatus.IN_PROGRESS,
            )
        ],
    )
    db.add(card)
    db.commit()
    return card.id


def test_qc_shop_stage_fact_write_scrap_rework_notes() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            card_id = _seed_qc_card(db)

        with TestClient(app) as client:
            ok = client.patch(
                f"/technical-cards/{card_id}/stages/1/fact",
                json={
                    "performer_name": "ОТК мастер",
                    "work_done": "passed",
                    "duration_seconds": 120,
                    "scrap_qty": "0.500",
                    "rework_qty": "0.250",
                    "notes": "партия ОТК",
                    "shop_stage_code": "qc",
                },
            )
            assert ok.status_code == 200, ok.text

            stage = next(
                row for row in ok.json()["stage_results"] if row["stage_order"] == 1
            )
            assert stage["performer_name"] == "ОТК мастер"
            assert stage["work_done"] == "passed"
            assert stage["duration_seconds"] == 120
            assert Decimal(stage["scrap_qty"]) == Decimal("0.500")
            assert Decimal(stage["rework_qty"]) == Decimal("0.250")
            assert stage["notes"] == "партия ОТК"

            wrong_module = client.patch(
                f"/technical-cards/{card_id}/stages/1/fact",
                json={"performer_name": "X", "shop_stage_code": "wto"},
            )
            assert wrong_module.status_code == 422, wrong_module.text
    finally:
        app.dependency_overrides.clear()

