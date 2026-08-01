"""Stage 11.8 — ВТО shop stage fact write + current-stage bind (`11.8.2`)."""

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


def _seed_order_item(db: Session, number: str) -> tuple[int, int]:
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
        estimated_quantity=2,
        estimated_amount=Decimal("2000"),
    )
    db.add(lead)
    db.flush()
    db.add(LeadTask(lead_id=lead.id, title="Задача"))
    order = SalesOrder(
        number=number,
        lead_id=lead.id,
        client_id=client.id,
        status=SalesOrderStatus.NEW,
        title="Заказ ВТО",
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
    return order.id, item.id


def _seed_wto_card(db: Session) -> int:
    print_stage = ProductionStage(name="Печать", code="print", is_active=True, sort_order=30)
    wto_stage = ProductionStage(name="ВТО", code="wto", is_active=True, sort_order=40)
    qc_stage = ProductionStage(name="ОТК", code="qc", is_active=True, sort_order=50)
    db.add_all([print_stage, wto_stage, qc_stage])
    db.flush()

    order_id, item_id = _seed_order_item(db, "SO-WTO-1")

    card = TechnicalCard(
        sales_order_id=order_id,
        sales_order_item_id=item_id,
        number="SO-WTO-1-01",
        card_seq=1,
        status=TechnicalCardStatus.IN_PROGRESS,
        quantity=Decimal("2"),
        nomenclature_name="Изделие",
        current_stage_order=2,
        current_stage_label="ВТО",
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
                status=TechnicalCardStageResultStatus.COMPLETED,
            ),
            TechnicalCardStageResult(
                technical_card_id=card.id,
                stage_order=2,
                production_stage_id=wto_stage.id,
                stage_label="ВТО",
                status=TechnicalCardStageResultStatus.IN_PROGRESS,
            ),
            TechnicalCardStageResult(
                technical_card_id=card.id,
                stage_order=3,
                production_stage_id=qc_stage.id,
                stage_label="ОТК",
                status=TechnicalCardStageResultStatus.PENDING,
            ),
        ]
    )
    db.commit()
    return card.id


def test_wto_stage_fact_write_and_bind() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            card_id = _seed_wto_card(db)

        with TestClient(app) as client:
            ok = client.patch(
                f"/technical-cards/{card_id}/stages/2/fact",
                json={
                    "performer_name": "Мастер ВТО",
                    "work_done": "Влажно-тепловая обработка",
                    "duration_seconds": 900,
                    "shop_stage_code": "wto",
                },
            )
            assert ok.status_code == 200, ok.text
            stage = next(row for row in ok.json()["stage_results"] if row["stage_order"] == 2)
            assert stage["performer_name"] == "Мастер ВТО"
            assert stage["work_done"] == "Влажно-тепловая обработка"
            assert stage["duration_seconds"] == 900

            wrong_module = client.patch(
                f"/technical-cards/{card_id}/stages/2/fact",
                json={"performer_name": "Петров", "shop_stage_code": "print"},
            )
            assert wrong_module.status_code == 422, wrong_module.text

            wrong_stage = client.patch(
                f"/technical-cards/{card_id}/stages/3/fact",
                json={"performer_name": "Петров", "shop_stage_code": "wto"},
            )
            assert wrong_stage.status_code == 422, wrong_stage.text
    finally:
        app.dependency_overrides.clear()


def _seed_print_current_card(db: Session) -> int:
    print_stage = ProductionStage(name="Печать", code="print", is_active=True, sort_order=30)
    wto_stage = ProductionStage(name="ВТО", code="wto", is_active=True, sort_order=40)
    qc_stage = ProductionStage(name="ОТК", code="qc", is_active=True, sort_order=50)
    db.add_all([print_stage, wto_stage, qc_stage])
    db.flush()

    order_id, item_id = _seed_order_item(db, "SO-WTO-BIND")

    card = TechnicalCard(
        sales_order_id=order_id,
        sales_order_item_id=item_id,
        number="SO-WTO-BIND-01",
        card_seq=1,
        status=TechnicalCardStatus.IN_PROGRESS,
        quantity=Decimal("2"),
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
                status=TechnicalCardStageResultStatus.IN_PROGRESS,
            ),
            TechnicalCardStageResult(
                technical_card_id=card.id,
                stage_order=2,
                production_stage_id=wto_stage.id,
                stage_label="ВТО",
                status=TechnicalCardStageResultStatus.PENDING,
            ),
            TechnicalCardStageResult(
                technical_card_id=card.id,
                stage_order=3,
                production_stage_id=qc_stage.id,
                stage_label="ОТК",
                status=TechnicalCardStageResultStatus.PENDING,
            ),
        ]
    )
    db.commit()
    return card.id


def test_wto_shop_bind_rejects_when_current_is_not_wto() -> None:
    """11.8.4 — shop_stage_code=wto only while current routing step is ВТО."""
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            card_id = _seed_print_current_card(db)

        with TestClient(app) as client:
            blocked_future = client.patch(
                f"/technical-cards/{card_id}/stages/2/fact",
                json={
                    "performer_name": "Мастер ВТО",
                    "work_done": "позже",
                    "duration_seconds": 100,
                    "shop_stage_code": "wto",
                },
            )
            assert blocked_future.status_code == 422, blocked_future.text

            blocked_wrong_module_on_current = client.patch(
                f"/technical-cards/{card_id}/stages/1/fact",
                json={
                    "performer_name": "Мастер ВТО",
                    "work_done": "обход на текущем этапе",
                    "duration_seconds": 100,
                    "shop_stage_code": "wto",
                },
            )
            assert blocked_wrong_module_on_current.status_code == 422, blocked_wrong_module_on_current.text
    finally:
        app.dependency_overrides.clear()

