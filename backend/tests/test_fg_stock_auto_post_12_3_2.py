"""Stage 12.3.2 / 11.2.2.4 — auto-post FG stock on ready_to_ship / shipped complete."""

from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from tests.auth_test_helpers import ensure_user_with_role, login_client
from app.models.nomenclature import Nomenclature, NomenclatureType
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
from app.models.stock import StockDocument, StockDocumentType
from app.models.technical_card import (
    TechnicalCard,
    TechnicalCardStageResult,
    TechnicalCardStageResultStatus,
    TechnicalCardStatus,
)
from app.models.warehouse import Warehouse


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def _seed_fg_card(
    db: Session,
    *,
    quantity: Decimal = Decimal("5"),
    scrap_qty: Decimal | None = Decimal("2"),
    with_nomenclature: bool = True,
) -> tuple[int, int, int]:
    warehouse = Warehouse(
        name="Основной",
        code="main",
        is_active=True,
        is_default=True,
    )
    product = Nomenclature(
        name="Футболка PRO",
        category="Форма",
        nomenclature_type=NomenclatureType.PRODUCT,
        unit="шт",
        base_price=Decimal("1500.00"),
    )
    db.add_all([warehouse, product])
    db.flush()

    qc = ProductionStage(name="ОТК", code="qc", is_active=True, sort_order=60)
    packaging = ProductionStage(
        name="Упаковка", code="packaging", is_active=True, sort_order=70
    )
    ready = ProductionStage(
        name="Готовы к отгрузке",
        code="ready_to_ship",
        is_active=True,
        sort_order=80,
    )
    shipped = ProductionStage(
        name="Отгружены", code="shipped", is_active=True, sort_order=90
    )
    db.add_all([qc, packaging, ready, shipped])
    db.flush()

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
        estimated_quantity=1,
        estimated_amount=Decimal("1000"),
    )
    db.add(lead)
    db.flush()
    db.add(LeadTask(lead_id=lead.id, title="Задача"))
    order = SalesOrder(
        number="SO-FG-AUTO-1",
        lead_id=lead.id,
        client_id=client.id,
        status=SalesOrderStatus.NEW,
        title="FG auto",
        responsible_id=1,
    )
    db.add(order)
    db.flush()
    item = SalesOrderItem(
        order_id=order.id,
        position=1,
        snapshot_name="Изделие",
        quantity=quantity,
        unit_price=Decimal("100"),
        line_amount=quantity * Decimal("100"),
        discount_amount=Decimal("0"),
        unit="шт",
    )
    db.add(item)
    db.flush()

    card = TechnicalCard(
        sales_order_id=order.id,
        sales_order_item_id=item.id,
        number="SO-FG-AUTO-1-01",
        card_seq=1,
        status=TechnicalCardStatus.IN_PROGRESS,
        quantity=quantity,
        nomenclature_id=product.id if with_nomenclature else None,
        nomenclature_name="Футболка PRO" if with_nomenclature else None,
        current_stage_order=3,
        current_stage_label="Готовы к отгрузке",
    )
    db.add(card)
    db.flush()
    db.add_all(
        [
            TechnicalCardStageResult(
                technical_card_id=card.id,
                stage_order=1,
                production_stage_id=qc.id,
                stage_label="ОТК",
                status=TechnicalCardStageResultStatus.COMPLETED,
                scrap_qty=scrap_qty,
            ),
            TechnicalCardStageResult(
                technical_card_id=card.id,
                stage_order=2,
                production_stage_id=packaging.id,
                stage_label="Упаковка",
                status=TechnicalCardStageResultStatus.COMPLETED,
            ),
            TechnicalCardStageResult(
                technical_card_id=card.id,
                stage_order=3,
                production_stage_id=ready.id,
                stage_label="Готовы к отгрузке",
                status=TechnicalCardStageResultStatus.IN_PROGRESS,
            ),
            TechnicalCardStageResult(
                technical_card_id=card.id,
                stage_order=4,
                production_stage_id=shipped.id,
                stage_label="Отгружены",
                status=TechnicalCardStageResultStatus.PENDING,
            ),
        ]
    )
    db.commit()
    return warehouse.id, product.id, card.id


def test_complete_ready_to_ship_posts_fg_receipt_minus_scrap() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            warehouse_id, product_id, card_id = _seed_fg_card(db)

        with factory() as _auth_db:
            ensure_user_with_role(_auth_db, login="ops", role_code="shop_operator")
        with TestClient(app) as client:
            login_client(client, login="ops")
            response = client.post(
                f"/technical-cards/{card_id}/stages/3/complete",
                json={},
            )
            assert response.status_code == 200, response.text
            assert response.json()["current_stage_order"] == 4

            balances = client.get(
                "/stock/balances",
                params={"warehouse_id": warehouse_id, "nomenclature_id": product_id},
            )
            assert balances.status_code == 200
            assert Decimal(balances.json()[0]["quantity"]) == Decimal("3.000")

        with factory() as db:
            docs = db.scalars(
                select(StockDocument).where(
                    StockDocument.technical_card_id == card_id,
                    StockDocument.doc_type == StockDocumentType.FG_RECEIPT.value,
                )
            ).all()
            assert len(docs) == 1
            assert docs[0].status == "posted"
            assert docs[0].sales_order_id is not None
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_complete_shipped_posts_fg_issue_and_clears_balance() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            warehouse_id, product_id, card_id = _seed_fg_card(
                db, scrap_qty=Decimal("1")
            )

        with factory() as _auth_db:
            ensure_user_with_role(_auth_db, login="ops", role_code="shop_operator")
        with TestClient(app) as client:
            login_client(client, login="ops")
            ready = client.post(
                f"/technical-cards/{card_id}/stages/3/complete",
                json={},
            )
            assert ready.status_code == 200, ready.text

            shipped = client.post(
                f"/technical-cards/{card_id}/stages/4/complete",
                json={},
            )
            assert shipped.status_code == 200, shipped.text
            assert shipped.json()["status"] == "completed"

            balances = client.get(
                "/stock/balances",
                params={"warehouse_id": warehouse_id, "nomenclature_id": product_id},
            )
            assert balances.status_code == 200
            # Zero balances are omitted from the projection.
            assert balances.json() == []

        with factory() as db:
            issue_docs = db.scalars(
                select(StockDocument).where(
                    StockDocument.technical_card_id == card_id,
                    StockDocument.doc_type == StockDocumentType.FG_ISSUE.value,
                )
            ).all()
            assert len(issue_docs) == 1
            assert issue_docs[0].status == "posted"
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_ready_to_ship_requires_nomenclature() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            _, _, card_id = _seed_fg_card(db, with_nomenclature=False)

        with factory() as _auth_db:
            ensure_user_with_role(_auth_db, login="ops", role_code="shop_operator")
        with TestClient(app) as client:
            login_client(client, login="ops")
            response = client.post(
                f"/technical-cards/{card_id}/stages/3/complete",
                json={},
            )
            assert response.status_code == 422, response.text

        with factory() as db:
            card = db.get(TechnicalCard, card_id)
            assert card is not None
            ready = next(s for s in card.stage_results if s.stage_order == 3)
            assert ready.status == TechnicalCardStageResultStatus.IN_PROGRESS
            docs = db.scalars(
                select(StockDocument).where(
                    StockDocument.technical_card_id == card_id
                )
            ).all()
            assert docs == []
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_rollback_ready_to_ship_blocked_after_fg_receipt() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            _, _, card_id = _seed_fg_card(db, scrap_qty=None)

        with factory() as _auth_db:
            ensure_user_with_role(_auth_db, login="ops", role_code="shop_operator")
        with TestClient(app) as client:
            login_client(client, login="ops")
            complete = client.post(
                f"/technical-cards/{card_id}/stages/3/complete",
                json={},
            )
            assert complete.status_code == 200, complete.text

            rollback = client.post(
                f"/technical-cards/{card_id}/stages/3/rollback",
            )
            assert rollback.status_code == 422, rollback.text
            assert "складской документ" in rollback.json()["detail"].lower()
    finally:
        app.dependency_overrides.pop(get_db, None)
