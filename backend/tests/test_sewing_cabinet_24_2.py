"""Stage 24.2 — sewing work ledger API: queue, take, release, complete, pools."""

from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
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
    SalesOrderItemAssemblyOperationSnapshot,
    SalesOrderStatus,
    SalesUser,
)
from app.models.sewing_operation import SewingOperation
from app.models.technical_card import (
    TechnicalCard,
    TechnicalCardOperationLine,
    TechnicalCardOperationLineSourceKind,
    TechnicalCardStageResult,
    TechnicalCardStageResultStatus,
    TechnicalCardStatus,
    TechnicalCardUnitLine,
    TechOperationVolumeUnit,
)
from tests.auth_test_helpers import ensure_user_with_role, login_client


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


def _seed_sewing_card(db: Session, *, number: str = "SO-CAB-1") -> tuple[int, int]:
    print_stage = ProductionStage(name="Печать", code="print", is_active=True, sort_order=30)
    sewing = ProductionStage(name="Пошив", code="sewing", is_active=True, sort_order=40)
    db.add_all([print_stage, sewing])
    db.flush()
    order_id, item_id = _seed_order_item(db, number)
    catalog = SewingOperation(
        name="Оверлок",
        description="Оверлок",
    )
    db.add(catalog)
    db.flush()
    card = TechnicalCard(
        sales_order_id=order_id,
        sales_order_item_id=item_id,
        number=f"{number}-01",
        card_seq=1,
        status=TechnicalCardStatus.IN_PROGRESS,
        quantity=Decimal("2"),
        nomenclature_name="Футболка",
        assembly_variant_name="Базовый",
        assembly_variant_total_cost=Decimal("120.50"),
        current_stage_order=2,
        current_stage_label="Пошив",
    )
    db.add(card)
    db.flush()
    db.add(
        SalesOrderItemAssemblyOperationSnapshot(
            order_item_id=item_id,
            sequence=1,
            operation_name="Оверлок",
            cost=Decimal("40.00"),
            quantity_per_item=1,
            duration_seconds=0,
            sewing_operation_id=catalog.id,
        )
    )
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
            TechnicalCardUnitLine(
                technical_card_id=card.id,
                unit_index=1,
                size="M",
            ),
            TechnicalCardUnitLine(
                technical_card_id=card.id,
                unit_index=2,
                size="L",
            ),
            TechnicalCardOperationLine(
                technical_card_id=card.id,
                sequence=1,
                source_kind=TechnicalCardOperationLineSourceKind.SEWING,
                sewing_operation_id=catalog.id,
                operation_name="Оверлок",
                volume_unit=TechOperationVolumeUnit.PIECES,
                volume=Decimal("4"),
            ),
        ]
    )
    db.commit()
    line_id = db.scalars(
        select(TechnicalCardOperationLine.id).where(
            TechnicalCardOperationLine.technical_card_id == card.id
        )
    ).first()
    assert line_id is not None
    return card.id, line_id


def _bind_app(factory: sessionmaker[Session]):
    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    previous = getattr(app.state, "session_factory", None)
    app.state.session_factory = factory
    return previous


def test_queue_embeds_remaining_pools_without_child_fetches() -> None:
    factory = _session_factory()
    previous = _bind_app(factory)
    try:
        with factory() as db:
            ensure_user_with_role(db, login="sewer1", role_code="sewer")
            card_id, line_id = _seed_sewing_card(db)

        with TestClient(app) as client:
            login_client(client, login="sewer1")
            queue = client.get("/sewing-cabinet/queue")
            assert queue.status_code == 200, queue.text
            rows = queue.json()
            assert len(rows) == 1
            item = rows[0]
            assert item["technical_card_id"] == card_id
            assert item["piece_cap"] == 2
            assert Decimal(str(item["piece_remaining"])) == Decimal("2")
            assert Decimal(str(item["piece_unit_price"])) == Decimal("120.50")
            assert len(item["operations"]) == 1
            assert item["operations"][0]["operation_line_id"] == line_id
            assert Decimal(str(item["operations"][0]["remaining"])) == Decimal("4")
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.state.session_factory = previous


def test_take_complete_release_and_independent_pools() -> None:
    factory = _session_factory()
    previous = _bind_app(factory)
    try:
        with factory() as db:
            ensure_user_with_role(db, login="sewer1", role_code="sewer")
            card_id, line_id = _seed_sewing_card(db)

        with TestClient(app) as client:
            login_client(client, login="sewer1")
            over = client.post(
                "/sewing-cabinet/take",
                json={
                    "technical_card_id": card_id,
                    "kind": "piece",
                    "qty": "3",
                },
            )
            assert over.status_code == 409, over.text

            taken = client.post(
                "/sewing-cabinet/take",
                json={
                    "technical_card_id": card_id,
                    "kind": "piece",
                    "qty": "1",
                },
            )
            assert taken.status_code == 201, taken.text
            piece_id = taken.json()["id"]
            assert taken.json()["status"] == "reserved"
            assert Decimal(str(taken.json()["unit_price"])) == Decimal("120.50")

            queue = client.get("/sewing-cabinet/queue").json()
            assert Decimal(str(queue[0]["piece_remaining"])) == Decimal("1")
            assert Decimal(str(queue[0]["operations"][0]["remaining"])) == Decimal("4")

            op_taken = client.post(
                "/sewing-cabinet/take",
                json={
                    "technical_card_id": card_id,
                    "kind": "operation",
                    "operation_line_id": line_id,
                    "qty": "2",
                },
            )
            assert op_taken.status_code == 201, op_taken.text
            assert Decimal(str(op_taken.json()["unit_price"])) == Decimal("40.00")
            queue = client.get("/sewing-cabinet/queue").json()
            assert Decimal(str(queue[0]["piece_remaining"])) == Decimal("1")
            assert Decimal(str(queue[0]["operations"][0]["remaining"])) == Decimal("2")

            released = client.post(f"/sewing-cabinet/entries/{piece_id}/release")
            assert released.status_code == 200, released.text
            assert released.json()["status"] == "released"
            queue = client.get("/sewing-cabinet/queue").json()
            assert Decimal(str(queue[0]["piece_remaining"])) == Decimal("2")

            again = client.post(
                "/sewing-cabinet/take",
                json={
                    "technical_card_id": card_id,
                    "kind": "piece",
                    "qty": "2",
                },
            )
            assert again.status_code == 201, again.text
            completed = client.post(
                f"/sewing-cabinet/entries/{again.json()['id']}/complete"
            )
            assert completed.status_code == 200, completed.text
            cabinet = client.get("/sewing-cabinet?period=day")
            assert cabinet.status_code == 200, cabinet.text
            body = cabinet.json()
            assert Decimal(str(body["earnings_completed"])) == Decimal("241.00")
            assert body["profile"]["login"] == "sewer1"
            assert len(body["reserved"]) == 1
            assert body["queue"] is not None
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.state.session_factory = previous


def test_take_rejected_off_sewing_and_null_piece_price() -> None:
    factory = _session_factory()
    previous = _bind_app(factory)
    try:
        with factory() as db:
            ensure_user_with_role(db, login="sewer1", role_code="sewer")
            print_stage = ProductionStage(
                name="Печать", code="print", is_active=True, sort_order=30
            )
            sewing = ProductionStage(
                name="Пошив", code="sewing", is_active=True, sort_order=40
            )
            db.add_all([print_stage, sewing])
            db.flush()
            order_id, item_id = _seed_order_item(db, "SO-OFF")
            card = TechnicalCard(
                sales_order_id=order_id,
                sales_order_item_id=item_id,
                number="SO-OFF-01",
                card_seq=1,
                status=TechnicalCardStatus.IN_PROGRESS,
                quantity=Decimal("1"),
                current_stage_order=1,
                current_stage_label="Печать",
                assembly_variant_total_cost=None,
            )
            db.add(card)
            db.flush()
            db.add(
                TechnicalCardStageResult(
                    technical_card_id=card.id,
                    stage_order=1,
                    production_stage_id=print_stage.id,
                    stage_label="Печать",
                    status=TechnicalCardStageResultStatus.IN_PROGRESS,
                )
            )
            db.add(
                TechnicalCardUnitLine(technical_card_id=card.id, unit_index=1, size="M")
            )
            db.commit()
            card_id = card.id

        with TestClient(app) as client:
            login_client(client, login="sewer1")
            denied = client.post(
                "/sewing-cabinet/take",
                json={"technical_card_id": card_id, "kind": "piece", "qty": "1"},
            )
            assert denied.status_code == 422, denied.text
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.state.session_factory = previous


def test_manager_can_complete_foreign_row_sewer_cannot() -> None:
    factory = _session_factory()
    previous = _bind_app(factory)
    try:
        with factory() as db:
            ensure_user_with_role(db, login="sewer1", role_code="sewer")
            ensure_user_with_role(db, login="sewer2", role_code="sewer")
            ensure_user_with_role(db, login="master1", role_code="shop_master")
            card_id, _line_id = _seed_sewing_card(db)

        with TestClient(app) as client:
            login_client(client, login="sewer1")
            taken = client.post(
                "/sewing-cabinet/take",
                json={"technical_card_id": card_id, "kind": "piece", "qty": "1"},
            )
            assert taken.status_code == 201, taken.text
            entry_id = taken.json()["id"]
            client.post("/auth/logout")

            login_client(client, login="sewer2")
            forbidden = client.post(f"/sewing-cabinet/entries/{entry_id}/complete")
            assert forbidden.status_code == 403, forbidden.text
            other = client.get("/sewing-cabinet/users/1")
            assert other.status_code == 403
            client.post("/auth/logout")

            login_client(client, login="master1")
            allowed = client.post(f"/sewing-cabinet/entries/{entry_id}/complete")
            assert allowed.status_code == 200, allowed.text
            sewers = client.get("/sewing-cabinet/sewers")
            assert sewers.status_code == 200, sewers.text
            logins = {item["login"] for item in sewers.json()}
            assert {"sewer1", "sewer2", "master1"} <= logins
            foreign = client.get(
                f"/sewing-cabinet/users/{taken.json()['platform_user_id']}"
            )
            assert foreign.status_code == 200, foreign.text
            assert foreign.json()["queue"] is None
            assert Decimal(str(foreign.json()["earnings_completed"])) == Decimal(
                "120.50"
            )
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.state.session_factory = previous
