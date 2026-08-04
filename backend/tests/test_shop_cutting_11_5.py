"""Stage 11.5 — Раскрой shop fact + MATERIAL fact_qty bind / hard gate."""

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
from app.models.sales import Client, Lead, LeadTask, SalesOrder, SalesOrderItem, SalesOrderStatus, SalesUser
from app.models.technical_card import (
    TechnicalCard,
    TechnicalCardCompositionLine,
    TechnicalCardCompositionLineKind,
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


def _seed_cutting_card(db: Session) -> tuple[int, int]:
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
        number="SO-CUTTING-1",
        lead_id=lead.id,
        client_id=client.id,
        status=SalesOrderStatus.NEW,
        title="Заказ раскрой",
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
        number="SO-CUTTING-1-01",
        card_seq=1,
        status=TechnicalCardStatus.IN_PROGRESS,
        quantity=Decimal("2"),
        nomenclature_name="Изделие",
        current_stage_order=1,
        current_stage_label="Раскрой",
    )
    db.add(card)
    db.flush()
    db.add(
        TechnicalCardStageResult(
            technical_card_id=card.id,
            stage_order=1,
            production_stage_id=cutting.id,
            stage_label="Раскрой",
            status=TechnicalCardStageResultStatus.IN_PROGRESS,
        )
    )
    line = TechnicalCardCompositionLine(
        technical_card_id=card.id,
        sequence=1,
        line_kind=TechnicalCardCompositionLineKind.MATERIAL,
        snapshot_name="Ткань",
        production_stage_id=cutting.id,
        planned_qty=Decimal("2.500"),
        unit="м",
        fact_qty=None,
    )
    db.add(line)
    db.commit()
    return card.id, line.id


def test_cutting_stage_fact_and_material_gate() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            card_id, line_id = _seed_cutting_card(db)

        with factory() as _auth_db:
            ensure_user_with_role(_auth_db, login="ops", role_code="shop_operator")
        with TestClient(app) as client:
            login_client(client, login="ops")
            fact = client.patch(
                f"/technical-cards/{card_id}/stages/1/fact",
                json={
                    "performer_name": "Раскройщик",
                    "work_done": "Раскрой кроя",
                    "duration_seconds": 3600,
                    "shop_stage_code": "cutting",
                },
            )
            assert fact.status_code == 200, fact.text
            stage = next(
                row for row in fact.json()["stage_results"] if row["stage_order"] == 1
            )
            assert stage["performer_name"] == "Раскройщик"
            assert stage["work_done"] == "Раскрой кроя"
            assert stage["duration_seconds"] == 3600

            wrong_module = client.patch(
                f"/technical-cards/{card_id}/composition/{line_id}/fact-qty",
                json={"fact_qty": "1.000", "shop_stage_code": "print"},
            )
            assert wrong_module.status_code == 422, wrong_module.text

            blocked = client.post(
                f"/technical-cards/{card_id}/stages/1/complete",
                json={"performer_name": "Раскройщик"},
            )
            assert blocked.status_code == 422, blocked.text
            assert "fact_qty" in blocked.text.lower()

            qty = client.patch(
                f"/technical-cards/{card_id}/composition/{line_id}/fact-qty",
                json={"fact_qty": "2.750", "shop_stage_code": "cutting"},
            )
            assert qty.status_code == 200, qty.text
            materials = [
                row
                for row in qty.json()["composition_lines"]
                if row["line_kind"] == "material"
            ]
            assert materials[0]["fact_qty"] == "2.750"

            done = client.post(
                f"/technical-cards/{card_id}/stages/1/complete",
                json={"performer_name": "Раскройщик"},
            )
            assert done.status_code == 200, done.text
            completed = next(
                row for row in done.json()["stage_results"] if row["stage_order"] == 1
            )
            assert completed["status"] == "completed"
    finally:
        app.dependency_overrides.clear()
