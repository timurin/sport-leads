"""Stage 28.4 — standalone TC scan + FG paths without SalesOrder."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.nomenclature import Nomenclature, NomenclatureType
from app.models.production_stage import ProductionStage
from app.models.stock import StockDocument, StockDocumentType
from app.models.technical_card import (
    TechnicalCard,
    TechnicalCardOrderGroup,
    TechnicalCardStageResult,
    TechnicalCardStageResultStatus,
    TechnicalCardStatus,
    TechnicalCardUnitLine,
)
from app.models.warehouse import Warehouse
from tests.auth_test_helpers import ensure_user_with_role, login_client


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def _bind_app(factory: sessionmaker[Session]):
    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    previous = getattr(app.state, "session_factory", None)
    app.state.session_factory = factory
    return previous


def _seed_standalone_scan_card(db: Session, *, token: str) -> dict[str, int]:
    print_stage = ProductionStage(name="Печать", code="print", is_active=True, sort_order=30)
    sewing = ProductionStage(name="Пошив", code="sewing", is_active=True, sort_order=40)
    db.add_all([print_stage, sewing])
    db.flush()
    group = TechnicalCardOrderGroup(
        order_number="1310",
        tech_cards_planned_count=5,
        desired_date=date(2026, 9, 15),
    )
    db.add(group)
    db.flush()
    card = TechnicalCard(
        sales_order_id=None,
        sales_order_item_id=None,
        order_group_id=group.id,
        number="1310-1",
        card_seq=1,
        status=TechnicalCardStatus.IN_PROGRESS,
        quantity=Decimal("2"),
        nomenclature_name="Футболка внутренняя",
        current_stage_order=1,
        current_stage_label=print_stage.name,
        qr_token=token,
    )
    db.add(card)
    db.flush()
    db.add_all(
        [
            TechnicalCardStageResult(
                technical_card_id=card.id,
                stage_order=1,
                production_stage_id=print_stage.id,
                stage_label=print_stage.name,
                status=TechnicalCardStageResultStatus.IN_PROGRESS,
            ),
            TechnicalCardStageResult(
                technical_card_id=card.id,
                stage_order=2,
                production_stage_id=sewing.id,
                stage_label=sewing.name,
                status=TechnicalCardStageResultStatus.PENDING,
            ),
        ]
    )
    db.add(
        TechnicalCardUnitLine(
            technical_card_id=card.id,
            unit_index=1,
            production_stage_id=print_stage.id,
        )
    )
    db.commit()
    return {"card_id": card.id, "print_id": print_stage.id}


def _seed_standalone_fg_card(db: Session) -> tuple[int, int, int]:
    warehouse = Warehouse(
        name="Основной",
        code="main",
        is_active=True,
        is_default=True,
    )
    product = Nomenclature(
        name="Футболка внутренняя",
        category="Форма",
        nomenclature_type=NomenclatureType.PRODUCT,
        unit="шт",
        base_price=Decimal("1500.00"),
    )
    db.add_all([warehouse, product])
    db.flush()
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
    db.add_all([packaging, ready, shipped])
    db.flush()
    group = TechnicalCardOrderGroup(
        order_number="FG-B",
        tech_cards_planned_count=1,
        desired_date=date(2026, 10, 1),
    )
    db.add(group)
    db.flush()
    card = TechnicalCard(
        sales_order_id=None,
        sales_order_item_id=None,
        order_group_id=group.id,
        number="FG-B-1",
        card_seq=1,
        status=TechnicalCardStatus.IN_PROGRESS,
        quantity=Decimal("4"),
        nomenclature_id=product.id,
        nomenclature_name=product.name,
        current_stage_order=2,
        current_stage_label=ready.name,
    )
    db.add(card)
    db.flush()
    db.add_all(
        [
            TechnicalCardStageResult(
                technical_card_id=card.id,
                stage_order=1,
                production_stage_id=packaging.id,
                stage_label=packaging.name,
                status=TechnicalCardStageResultStatus.COMPLETED,
            ),
            TechnicalCardStageResult(
                technical_card_id=card.id,
                stage_order=2,
                production_stage_id=ready.id,
                stage_label=ready.name,
                status=TechnicalCardStageResultStatus.IN_PROGRESS,
            ),
            TechnicalCardStageResult(
                technical_card_id=card.id,
                stage_order=3,
                production_stage_id=shipped.id,
                stage_label=shipped.name,
                status=TechnicalCardStageResultStatus.PENDING,
            ),
        ]
    )
    db.commit()
    return warehouse.id, product.id, card.id


def test_standalone_scan_get_is_null_order_safe() -> None:
    factory = _session_factory()
    previous = _bind_app(factory)
    try:
        with factory() as db:
            ensure_user_with_role(db, login="admin1", role_code="admin")
            _seed_standalone_scan_card(db, token="standalone-scan-token")

        with TestClient(app) as client:
            login_client(client, login="admin1")
            scan = client.get("/tech-card-scan/standalone-scan-token")
            assert scan.status_code == 200, scan.text
            body = scan.json()
            assert body["number"] == "1310-1"
            assert body["display_number"] == "1310-1/5"
            assert body["nomenclature_name"] == "Футболка внутренняя"
            assert any(row["stage_code"] == "print" for row in body["allowed_stages"])
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.state.session_factory = previous


def test_standalone_fg_receipt_allows_null_sales_order() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            warehouse_id, product_id, card_id = _seed_standalone_fg_card(db)
        with factory() as auth_db:
            ensure_user_with_role(auth_db, login="ops", role_code="shop_operator")
        with TestClient(app) as client:
            login_client(client, login="ops")
            response = client.post(
                f"/technical-cards/{card_id}/stages/2/complete",
                json={},
            )
            assert response.status_code == 200, response.text
            balances = client.get(
                "/stock/balances",
                params={"warehouse_id": warehouse_id, "nomenclature_id": product_id},
            )
            assert balances.status_code == 200
            assert Decimal(balances.json()[0]["quantity"]) == Decimal("4.000")
        with factory() as db:
            docs = db.scalars(
                select(StockDocument).where(
                    StockDocument.technical_card_id == card_id,
                    StockDocument.doc_type == StockDocumentType.FG_RECEIPT.value,
                )
            ).all()
            assert len(docs) == 1
            assert docs[0].status == "posted"
            assert docs[0].sales_order_id is None
    finally:
        app.dependency_overrides.pop(get_db, None)
