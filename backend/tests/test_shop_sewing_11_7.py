"""Stage 11.7 — Пошив shop stage fact write + current-stage bind (`11.7.2` / `11.7.4`)."""

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


def _seed_order_item(db: Session, number: str) -> tuple[int, int]:
    if db.get(SalesUser, 1) is None:
        db.add(SalesUser(id=1, name="Test"))
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
        number=number,
        lead_id=lead.id,
        client_id=client.id,
        status=SalesOrderStatus.NEW,
        title="Заказ пошив",
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


def _seed_sewing_card(db: Session) -> int:
    print_stage = ProductionStage(name="Печать", code="print", is_active=True, sort_order=30)
    sewing = ProductionStage(name="Пошив", code="sewing", is_active=True, sort_order=40)
    wto = ProductionStage(name="ВТО", code="wto", is_active=True, sort_order=50)
    db.add_all([print_stage, sewing, wto])
    db.flush()
    order_id, item_id = _seed_order_item(db, "SO-SEWING-1")

    card = TechnicalCard(
        sales_order_id=order_id,
        sales_order_item_id=item_id,
        number="SO-SEWING-1-01",
        card_seq=1,
        status=TechnicalCardStatus.IN_PROGRESS,
        quantity=Decimal("2"),
        nomenclature_name="Изделие",
        current_stage_order=2,
        current_stage_label="Пошив",
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
                production_stage_id=sewing.id,
                stage_label="Пошив",
                status=TechnicalCardStageResultStatus.IN_PROGRESS,
            ),
            TechnicalCardStageResult(
                technical_card_id=card.id,
                stage_order=3,
                production_stage_id=wto.id,
                stage_label="ВТО",
                status=TechnicalCardStageResultStatus.PENDING,
            ),
        ]
    )
    db.commit()
    return card.id


def _seed_print_current_card(db: Session) -> int:
    """Card currently on Печать — sewing module must not write."""
    print_stage = ProductionStage(name="Печать", code="print", is_active=True, sort_order=30)
    sewing = ProductionStage(name="Пошив", code="sewing", is_active=True, sort_order=40)
    db.add_all([print_stage, sewing])
    db.flush()
    order_id, item_id = _seed_order_item(db, "SO-SEWING-BIND")

    card = TechnicalCard(
        sales_order_id=order_id,
        sales_order_item_id=item_id,
        number="SO-SEWING-BIND-01",
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
                production_stage_id=sewing.id,
                stage_label="Пошив",
                status=TechnicalCardStageResultStatus.PENDING,
            ),
        ]
    )
    db.commit()
    return card.id


def test_sewing_stage_fact_write_and_bind() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            card_id = _seed_sewing_card(db)

        with TestClient(app) as client:
            ok = client.patch(
                f"/technical-cards/{card_id}/stages/2/fact",
                json={
                    "performer_name": "Сидоров",
                    "work_done": "Сборка корпуса",
                    "duration_seconds": 3600,
                    "shop_stage_code": "sewing",
                },
            )
            assert ok.status_code == 200, ok.text
            stage = next(
                row for row in ok.json()["stage_results"] if row["stage_order"] == 2
            )
            assert stage["performer_name"] == "Сидоров"
            assert stage["work_done"] == "Сборка корпуса"
            assert stage["duration_seconds"] == 3600

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

            complete = client.post(
                f"/technical-cards/{card_id}/stages/2/complete",
                json={"performer_name": "Сидоров", "notes": "Готово"},
            )
            assert complete.status_code == 200, complete.text
            sewing = next(
                row
                for row in complete.json()["stage_results"]
                if row["stage_order"] == 2
            )
            assert sewing["status"] == "completed"
            assert complete.json()["current_stage_label"] == "ВТО"
    finally:
        app.dependency_overrides.clear()


def test_sewing_shop_bind_rejects_when_current_is_not_sewing() -> None:
    """11.7.4 — shop_stage_code=sewing only while current routing step is Пошив."""
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            card_id = _seed_print_current_card(db)

        with TestClient(app) as client:
            blocked = client.patch(
                f"/technical-cards/{card_id}/stages/1/fact",
                json={
                    "performer_name": "Швея",
                    "work_done": "рано",
                    "shop_stage_code": "sewing",
                },
            )
            assert blocked.status_code == 422, blocked.text

            blocked_future = client.patch(
                f"/technical-cards/{card_id}/stages/2/fact",
                json={
                    "performer_name": "Швея",
                    "work_done": "обход",
                    "shop_stage_code": "sewing",
                },
            )
            assert blocked_future.status_code == 422, blocked_future.text
    finally:
        app.dependency_overrides.clear()
