"""Stage 11.4 — Design shop stage fact write on technical card."""

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
from app.models.sales import Client, Lead, LeadTask, SalesOrder, SalesOrderItem, SalesOrderStatus, SalesUser
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


def _seed_card(db: Session) -> int:
    db.add(SalesUser(id=1, name="Test"))
    design = ProductionStage(name="Дизайн", code="design", is_active=True, sort_order=10)
    cutting = ProductionStage(name="Раскрой", code="cutting", is_active=True, sort_order=20)
    db.add_all([design, cutting])
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
        estimated_quantity=2,
        estimated_amount=Decimal("2000"),
    )
    db.add(lead)
    db.flush()
    db.add(LeadTask(lead_id=lead.id, title="Задача"))
    order = SalesOrder(
        number="SO-DESIGN-1",
        lead_id=lead.id,
        client_id=client.id,
        status=SalesOrderStatus.NEW,
        title="Заказ дизайн",
        responsible_id=1,
    )
    db.add(order)
    db.flush()
    item = SalesOrderItem(
        order_id=order.id,
        position=1,
        snapshot_name="Изделие",
        quantity=Decimal("2"),
        unit_price=Decimal("100"),
        line_amount=Decimal("200"),
        discount_amount=Decimal("0"),
        unit="шт",
    )
    db.add(item)
    db.flush()

    card = TechnicalCard(
        sales_order_id=order.id,
        sales_order_item_id=item.id,
        number="SO-DESIGN-1-01",
        card_seq=1,
        status=TechnicalCardStatus.IN_PROGRESS,
        quantity=Decimal("2"),
        nomenclature_name="Изделие",
        current_stage_order=1,
        current_stage_label="Дизайн",
    )
    db.add(card)
    db.flush()
    db.add_all(
        [
            TechnicalCardStageResult(
                technical_card_id=card.id,
                stage_order=1,
                production_stage_id=design.id,
                stage_label="Дизайн",
                status=TechnicalCardStageResultStatus.IN_PROGRESS,
            ),
            TechnicalCardStageResult(
                technical_card_id=card.id,
                stage_order=2,
                production_stage_id=cutting.id,
                stage_label="Раскрой",
                status=TechnicalCardStageResultStatus.PENDING,
            ),
        ]
    )
    db.commit()
    return card.id


def test_design_stage_fact_write_and_bind() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            card_id = _seed_card(db)

        with TestClient(app) as client:
            ok = client.patch(
                f"/technical-cards/{card_id}/stages/1/fact",
                json={
                    "performer_name": "Иванов",
                    "work_done": "Подготовка макета",
                    "duration_seconds": 2400,
                    "shop_stage_code": "design",
                },
            )
            assert ok.status_code == 200, ok.text
            stage = next(
                row for row in ok.json()["stage_results"] if row["stage_order"] == 1
            )
            assert stage["performer_name"] == "Иванов"
            assert stage["work_done"] == "Подготовка макета"
            assert stage["duration_seconds"] == 2400

            wrong_module = client.patch(
                f"/technical-cards/{card_id}/stages/1/fact",
                json={"performer_name": "Петров", "shop_stage_code": "cutting"},
            )
            assert wrong_module.status_code == 422, wrong_module.text

            wrong_stage = client.patch(
                f"/technical-cards/{card_id}/stages/2/fact",
                json={"performer_name": "Петров", "shop_stage_code": "cutting"},
            )
            assert wrong_stage.status_code == 422, wrong_stage.text
    finally:
        app.dependency_overrides.clear()
