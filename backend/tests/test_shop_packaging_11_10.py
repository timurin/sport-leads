"""Stage 11.10 — Упаковка shop stage fact write (`11.10.2`)."""

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
        title="Заказ Упаковка",
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


def _seed_packaging_card(db: Session) -> int:
    qc_stage = ProductionStage(name="ОТК", code="qc", is_active=True, sort_order=60)
    packaging_stage = ProductionStage(
        name="Упаковка", code="packaging", is_active=True, sort_order=70
    )
    db.add_all([qc_stage, packaging_stage])
    db.flush()

    order_id, item_id = _seed_order_item(db, "SO-PKG-1")

    card = TechnicalCard(
        sales_order_id=order_id,
        sales_order_item_id=item_id,
        number="SO-PKG-1-01",
        card_seq=1,
        status=TechnicalCardStatus.IN_PROGRESS,
        quantity=Decimal("2"),
        nomenclature_name="Изделие",
        current_stage_order=2,
        current_stage_label="Упаковка",
    )
    db.add(card)
    db.flush()
    db.add_all(
        [
            TechnicalCardStageResult(
                technical_card_id=card.id,
                stage_order=1,
                production_stage_id=qc_stage.id,
                stage_label="ОТК",
                status=TechnicalCardStageResultStatus.COMPLETED,
            ),
            TechnicalCardStageResult(
                technical_card_id=card.id,
                stage_order=2,
                production_stage_id=packaging_stage.id,
                stage_label="Упаковка",
                status=TechnicalCardStageResultStatus.IN_PROGRESS,
            ),
        ]
    )
    db.commit()
    return card.id


def test_packaging_stage_fact_write_and_bind() -> None:
    """11.10.2 — PATCH fact with shop_stage_code=packaging on current Упаковка step."""
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            card_id = _seed_packaging_card(db)

        with factory() as _auth_db:
            ensure_user_with_role(_auth_db, login="ops", role_code="shop_operator")
        with TestClient(app) as client:
            login_client(client, login="ops")
            ok = client.patch(
                f"/technical-cards/{card_id}/stages/2/fact",
                json={
                    "performer_name": "Упаковщик",
                    "work_done": "Комплект собран и упакован",
                    "duration_seconds": 420,
                    "shop_stage_code": "packaging",
                },
            )
            assert ok.status_code == 200, ok.text
            stage = next(
                row for row in ok.json()["stage_results"] if row["stage_order"] == 2
            )
            assert stage["performer_name"] == "Упаковщик"
            assert stage["work_done"] == "Комплект собран и упакован"
            assert stage["duration_seconds"] == 420

            wrong_module = client.patch(
                f"/technical-cards/{card_id}/stages/2/fact",
                json={"performer_name": "Петров", "shop_stage_code": "qc"},
            )
            assert wrong_module.status_code == 422, wrong_module.text

            wrong_stage = client.patch(
                f"/technical-cards/{card_id}/stages/1/fact",
                json={"performer_name": "Петров", "shop_stage_code": "packaging"},
            )
            assert wrong_stage.status_code == 422, wrong_stage.text
    finally:
        app.dependency_overrides.clear()


def _seed_qc_current_packaging_future_card(db: Session) -> int:
    qc_stage = ProductionStage(name="ОТК", code="qc", is_active=True, sort_order=60)
    packaging_stage = ProductionStage(
        name="Упаковка", code="packaging", is_active=True, sort_order=70
    )
    db.add_all([qc_stage, packaging_stage])
    db.flush()

    order_id, item_id = _seed_order_item(db, "SO-PKG-BIND")

    card = TechnicalCard(
        sales_order_id=order_id,
        sales_order_item_id=item_id,
        number="SO-PKG-BIND-01",
        card_seq=1,
        status=TechnicalCardStatus.IN_PROGRESS,
        quantity=Decimal("2"),
        nomenclature_name="Изделие",
        current_stage_order=1,
        current_stage_label="ОТК",
    )
    db.add(card)
    db.flush()
    db.add_all(
        [
            TechnicalCardStageResult(
                technical_card_id=card.id,
                stage_order=1,
                production_stage_id=qc_stage.id,
                stage_label="ОТК",
                status=TechnicalCardStageResultStatus.IN_PROGRESS,
            ),
            TechnicalCardStageResult(
                technical_card_id=card.id,
                stage_order=2,
                production_stage_id=packaging_stage.id,
                stage_label="Упаковка",
                status=TechnicalCardStageResultStatus.PENDING,
            ),
        ]
    )
    db.commit()
    return card.id


def test_packaging_shop_bind_rejects_when_current_is_not_packaging() -> None:
    """11.10.4 — shop_stage_code=packaging only while current routing step is Упаковка."""
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            card_id = _seed_qc_current_packaging_future_card(db)

        with factory() as _auth_db:
            ensure_user_with_role(_auth_db, login="ops", role_code="shop_operator")
        with TestClient(app) as client:
            login_client(client, login="ops")
            blocked_future = client.patch(
                f"/technical-cards/{card_id}/stages/2/fact",
                json={
                    "performer_name": "Упаковщик",
                    "work_done": "позже",
                    "duration_seconds": 100,
                    "shop_stage_code": "packaging",
                },
            )
            assert blocked_future.status_code == 422, blocked_future.text

            blocked_wrong_module_on_current = client.patch(
                f"/technical-cards/{card_id}/stages/1/fact",
                json={
                    "performer_name": "Упаковщик",
                    "work_done": "обход на текущем этапе",
                    "duration_seconds": 100,
                    "shop_stage_code": "packaging",
                },
            )
            assert (
                blocked_wrong_module_on_current.status_code == 422
            ), blocked_wrong_module_on_current.text

            allowed_qc = client.patch(
                f"/technical-cards/{card_id}/stages/1/fact",
                json={
                    "performer_name": "ОТК",
                    "work_done": "passed",
                    "duration_seconds": 100,
                    "shop_stage_code": "qc",
                },
            )
            assert allowed_qc.status_code == 200, allowed_qc.text
    finally:
        app.dependency_overrides.clear()


def _seed_packaging_current_pending_card(db: Session) -> int:
    packaging_stage = ProductionStage(
        name="Упаковка", code="packaging", is_active=True, sort_order=70
    )
    db.add(packaging_stage)
    db.flush()

    order_id, item_id = _seed_order_item(db, "SO-PKG-COMP")

    card = TechnicalCard(
        sales_order_id=order_id,
        sales_order_item_id=item_id,
        number="SO-PKG-COMP-01",
        card_seq=1,
        status=TechnicalCardStatus.IN_PROGRESS,
        quantity=Decimal("2"),
        nomenclature_name="Изделие",
        current_stage_order=1,
        current_stage_label="Упаковка",
    )
    db.add(card)
    db.flush()
    db.add(
        TechnicalCardStageResult(
            technical_card_id=card.id,
            stage_order=1,
            production_stage_id=packaging_stage.id,
            stage_label="Упаковка",
            status=TechnicalCardStageResultStatus.PENDING,
        )
    )
    db.commit()
    return card.id


def test_packaging_shop_stage_completion() -> None:
    """11.10.5 — complete Упаковка with performer / work_done / duration; card completes."""
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            card_id = _seed_packaging_current_pending_card(db)

        with factory() as _auth_db:
            ensure_user_with_role(_auth_db, login="ops", role_code="shop_operator")
        with TestClient(app) as client:
            login_client(client, login="ops")
            done = client.post(
                f"/technical-cards/{card_id}/stages/1/complete",
                json={
                    "performer_name": "Упаковщик",
                    "work_done": "Упаковано",
                    "duration_seconds": 300,
                },
            )
            assert done.status_code == 200, done.text
            body = done.json()
            assert body["status"] == "completed"
            stage = body["stage_results"][0]
            assert stage["status"] == "completed"
            assert stage["performer_name"] == "Упаковщик"
            assert stage["work_done"] == "Упаковано"
            assert stage["duration_seconds"] == 300
    finally:
        app.dependency_overrides.clear()
