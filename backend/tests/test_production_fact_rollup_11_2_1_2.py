"""Stage 11.2.1.2 — Production order/batch fact roll-up API."""

from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
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
    TechOperationVolumeUnit,
    TechnicalCard,
    TechnicalCardCompositionLine,
    TechnicalCardCompositionLineKind,
    TechnicalCardOperationLine,
    TechnicalCardOperationLineSourceKind,
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


def _seed(db: Session) -> tuple[int, int, int]:
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
        number="SO-ROLL-1",
        lead_id=lead.id,
        client_id=client.id,
        status=SalesOrderStatus.NEW,
        title="Заказ roll-up",
        responsible_id=1,
    )
    db.add(order)
    db.flush()
    item = SalesOrderItem(
        order_id=order.id,
        position=1,
        snapshot_name="Изделие A",
        quantity=Decimal("2"),
        unit_price=Decimal("100"),
        line_amount=Decimal("200"),
        discount_amount=Decimal("0"),
        unit="шт",
    )
    item_b = SalesOrderItem(
        order_id=order.id,
        position=2,
        snapshot_name="Изделие B",
        quantity=Decimal("1"),
        unit_price=Decimal("100"),
        line_amount=Decimal("100"),
        discount_amount=Decimal("0"),
        unit="шт",
    )
    db.add_all([item, item_b])
    db.flush()

    card_a = TechnicalCard(
        sales_order_id=order.id,
        sales_order_item_id=item.id,
        number="SO-ROLL-1-01",
        card_seq=1,
        status=TechnicalCardStatus.COMPLETED,
        quantity=Decimal("2"),
        nomenclature_name="Изделие A",
        stage_results=[
            TechnicalCardStageResult(
                stage_order=1,
                stage_label="Пошив",
                status=TechnicalCardStageResultStatus.COMPLETED,
                performer_name="Швея 1",
                duration_seconds=100,
            ),
            TechnicalCardStageResult(
                stage_order=2,
                stage_label="ОТК",
                status=TechnicalCardStageResultStatus.COMPLETED,
                performer_name="ОТК",
                duration_seconds=50,
                scrap_qty=Decimal("0.5"),
                rework_qty=Decimal("0.2"),
            ),
        ],
        composition_lines=[
            TechnicalCardCompositionLine(
                sequence=1,
                line_kind=TechnicalCardCompositionLineKind.MATERIAL,
                snapshot_name="Ткань",
                unit="м",
                planned_qty=Decimal("3"),
                fact_qty=Decimal("2.5"),
            )
        ],
        operation_lines=[
            TechnicalCardOperationLine(
                sequence=1,
                source_kind=TechnicalCardOperationLineSourceKind.ROUTING,
                operation_name="Строчка",
                volume_unit=TechOperationVolumeUnit.PIECES,
                volume=Decimal("10"),
                stage_order=1,
                stage_label="Пошив",
            )
        ],
    )
    card_b = TechnicalCard(
        sales_order_id=order.id,
        sales_order_item_id=item_b.id,
        number="SO-ROLL-1-02",
        card_seq=2,
        status=TechnicalCardStatus.IN_PROGRESS,
        quantity=Decimal("1"),
        nomenclature_name="Изделие B",
        stage_results=[
            TechnicalCardStageResult(
                stage_order=1,
                stage_label="Пошив",
                status=TechnicalCardStageResultStatus.IN_PROGRESS,
                performer_name="Швея 1",
                duration_seconds=40,
            )
        ],
        composition_lines=[
            TechnicalCardCompositionLine(
                sequence=1,
                line_kind=TechnicalCardCompositionLineKind.MATERIAL,
                snapshot_name="Ткань",
                unit="м",
                planned_qty=Decimal("1"),
                fact_qty=Decimal("1"),
            ),
            TechnicalCardCompositionLine(
                sequence=2,
                line_kind=TechnicalCardCompositionLineKind.NOTE,
                snapshot_name="Примечание",
            ),
        ],
        operation_lines=[
            TechnicalCardOperationLine(
                sequence=1,
                source_kind=TechnicalCardOperationLineSourceKind.ROUTING,
                operation_name="Строчка",
                volume_unit=TechOperationVolumeUnit.PIECES,
                volume=Decimal("4"),
                stage_order=1,
                stage_label="Пошив",
            )
        ],
    )
    db.add_all([card_a, card_b])
    db.commit()
    return order.id, card_a.id, card_b.id


def test_production_fact_rollup_batch_and_order() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            sales_order_id, card_a_id, card_b_id = _seed(db)

        with TestClient(app) as client:
            created = client.post(
                "/production-orders",
                json={"sales_order_id": sales_order_id},
            )
            assert created.status_code == 201, created.text
            order_id = created.json()["id"]

            batch = client.post(f"/production-orders/{order_id}/batches", json={})
            assert batch.status_code == 201, batch.text
            batch_id = batch.json()["id"]

            empty = client.get(f"/production-batches/{batch_id}/fact-rollup")
            assert empty.status_code == 200, empty.text
            empty_body = empty.json()
            assert empty_body["scope"] == "batch"
            assert empty_body["technical_card_count"] == 0
            assert empty_body["quantity_total"] == "0"
            assert empty_body["performers"] == []
            assert empty_body["materials"] == []
            assert empty_body["operations"] == []

            attach_a = client.post(
                f"/production-batches/{batch_id}/cards",
                json={"technical_card_id": card_a_id},
            )
            assert attach_a.status_code == 200, attach_a.text
            attach_b = client.post(
                f"/production-batches/{batch_id}/cards",
                json={"technical_card_id": card_b_id},
            )
            assert attach_b.status_code == 200, attach_b.text

            batch_rollup = client.get(f"/production-batches/{batch_id}/fact-rollup")
            assert batch_rollup.status_code == 200, batch_rollup.text
            body = batch_rollup.json()
            assert body["scope"] == "batch"
            assert body["production_order_id"] == order_id
            assert body["production_batch_id"] == batch_id
            assert body["technical_card_count"] == 2
            assert set(body["technical_card_ids"]) == {card_a_id, card_b_id}
            assert body["quantity_total"] == "3.000"
            assert body["cards_completed"] == 1
            assert body["cards_in_progress"] == 1
            assert body["cards_other"] == 0
            assert body["duration_seconds_total"] == 190
            assert body["scrap_qty_total"] == "0.500"
            assert body["rework_qty_total"] == "0.200"
            assert [p["performer_name"] for p in body["performers"]] == ["ОТК", "Швея 1"]
            assert body["performers"][1]["stage_labels"] == ["Пошив"]
            assert len(body["materials"]) == 1
            assert body["materials"][0]["snapshot_name"] == "Ткань"
            assert body["materials"][0]["planned_qty"] == "4.000"
            assert body["materials"][0]["fact_qty"] == "3.500"
            assert len(body["operations"]) == 1
            assert body["operations"][0]["operation_name"] == "Строчка"
            assert body["operations"][0]["volume"] == "14.000"

            order_rollup = client.get(f"/production-orders/{order_id}/fact-rollup")
            assert order_rollup.status_code == 200, order_rollup.text
            order_body = order_rollup.json()
            assert order_body["scope"] == "order"
            assert order_body["production_batch_id"] is None
            assert order_body["technical_card_count"] == 2
            assert order_body["duration_seconds_total"] == 190

            missing = client.get("/production-batches/999999/fact-rollup")
            assert missing.status_code == 404
            missing_order = client.get("/production-orders/999999/fact-rollup")
            assert missing_order.status_code == 404
    finally:
        app.dependency_overrides.clear()
