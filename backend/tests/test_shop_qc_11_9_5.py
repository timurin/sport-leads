"""Stage 11.9.5 — QC shop: stage completion regression test."""

from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from tests.auth_test_helpers import ensure_user_with_role, login_client
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


def _seed_qc_current_pending_card(db: Session) -> int:
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
        number="SO-QC-COMP-1",
        lead_id=lead.id,
        client_id=client.id,
        status=SalesOrderStatus.NEW,
        title="Заказ QC completion",
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
        number="SO-QC-COMP-01",
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
                status=TechnicalCardStageResultStatus.PENDING,
            )
        ],
    )
    db.add(card)
    db.commit()
    return card.id


def test_qc_shop_stage_completion_accepts_scrap_rework_notes() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            card_id = _seed_qc_current_pending_card(db)

        with factory() as _auth_db:
            ensure_user_with_role(_auth_db, login="ops", role_code="shop_operator")
        with TestClient(app) as client:
            login_client(client, login="ops")
            done = client.post(
                f"/technical-cards/{card_id}/stages/1/complete",
                json={
                    "performer_name": "ОТК мастер",
                    "scrap_qty": "0.100",
                    "rework_qty": "0.050",
                    "notes": "контроль выполнен",
                },
            )
            assert done.status_code == 200, done.text
            body = done.json()
            assert body["status"] == "completed"
            stage = body["stage_results"][0]
            assert stage["status"] == "completed"
            assert stage["performer_name"] == "ОТК мастер"
            assert Decimal(stage["scrap_qty"]) == Decimal("0.100")
            assert Decimal(stage["rework_qty"]) == Decimal("0.050")
            assert stage["notes"] == "контроль выполнен"
    finally:
        app.dependency_overrides.clear()

