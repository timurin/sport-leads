"""Stage 11.6 — Print shop stage fact, op volumes, material gate."""

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
from app.models.shop_routing import WorkCenter
from app.models.technical_card import (
    TechnicalCard,
    TechnicalCardCompositionLine,
    TechnicalCardCompositionLineKind,
    TechnicalCardOperationLine,
    TechnicalCardOperationLineSourceKind,
    TechnicalCardStageResult,
    TechnicalCardStageResultStatus,
    TechnicalCardStatus,
    TechOperationVolumeUnit,
)


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def _seed_print_card(db: Session) -> tuple[int, int, int, int]:
    db.add(SalesUser(id=1, name="Test"))
    print_stage = ProductionStage(name="Печать", code="print", is_active=True, sort_order=30)
    sewing = ProductionStage(name="Пошив", code="sewing", is_active=True, sort_order=40)
    db.add_all([print_stage, sewing])
    db.flush()
    work_center = WorkCenter(
        name="Сублимация-1",
        code="subl-1",
        production_stage_id=print_stage.id,
        is_active=True,
    )
    db.add(work_center)
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
        number="SO-PRINT-1",
        lead_id=lead.id,
        client_id=client.id,
        status=SalesOrderStatus.NEW,
        title="Заказ печать",
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
        number="SO-PRINT-1-01",
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
    material = TechnicalCardCompositionLine(
        technical_card_id=card.id,
        sequence=1,
        line_kind=TechnicalCardCompositionLineKind.MATERIAL,
        snapshot_name="Термотрансфер",
        production_stage_id=print_stage.id,
        planned_qty=Decimal("1.000"),
        unit="шт",
        fact_qty=None,
    )
    op_line = TechnicalCardOperationLine(
        technical_card_id=card.id,
        sequence=1,
        source_kind=TechnicalCardOperationLineSourceKind.ROUTING,
        tech_operation_id=101,
        operation_name="Сублимация",
        volume_unit=TechOperationVolumeUnit.LINEAR_METERS,
        volume=Decimal("0"),
        production_stage_id=print_stage.id,
        stage_label="Печать",
    )
    db.add_all([material, op_line])
    db.commit()
    return card.id, material.id, op_line.id, work_center.id


def test_print_stage_fact_volumes_and_material_gate() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            card_id, material_id, op_line_id, work_center_id = _seed_print_card(db)

        with TestClient(app) as client:
            fact = client.patch(
                f"/technical-cards/{card_id}/stages/1/fact",
                json={
                    "performer_name": "Печатник",
                    "work_done": "Сублимация логотипа",
                    "duration_seconds": 1200,
                    "work_center_id": work_center_id,
                    "shop_stage_code": "print",
                },
            )
            assert fact.status_code == 200, fact.text
            stage = next(
                row for row in fact.json()["stage_results"] if row["stage_order"] == 1
            )
            assert stage["performer_name"] == "Печатник"
            assert stage["work_center_id"] == work_center_id

            volume = client.patch(
                f"/technical-cards/{card_id}/operation-lines/{op_line_id}",
                json={"volume": "12.500", "shop_stage_code": "print"},
            )
            assert volume.status_code == 200, volume.text
            ops = volume.json()["operation_lines"]
            assert ops[0]["volume"] == "12.500"

            blocked = client.post(
                f"/technical-cards/{card_id}/stages/1/complete",
                json={"performer_name": "Печатник"},
            )
            assert blocked.status_code == 422, blocked.text
            assert "fact_qty" in blocked.text.lower()

            qty = client.patch(
                f"/technical-cards/{card_id}/composition/{material_id}/fact-qty",
                json={"fact_qty": "1.000", "shop_stage_code": "print"},
            )
            assert qty.status_code == 200, qty.text

            done = client.post(
                f"/technical-cards/{card_id}/stages/1/complete",
                json={"performer_name": "Печатник"},
            )
            assert done.status_code == 200, done.text
            body = done.json()
            assert body["current_stage_label"] == "Пошив"
            assert body["current_stage_order"] == 2
            print_stage = next(
                row for row in body["stage_results"] if row["stage_order"] == 1
            )
            sewing_stage = next(
                row for row in body["stage_results"] if row["stage_order"] == 2
            )
            assert print_stage["status"] == "completed"
            assert sewing_stage["status"] == "pending"

            deleted = client.delete(
                f"/technical-cards/{card_id}/composition/{material_id}"
                f"?shop_stage_code=print"
            )
            assert deleted.status_code == 422, deleted.text
    finally:
        app.dependency_overrides.clear()


def test_print_shop_can_delete_current_stage_material() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            card_id, material_id, _, _ = _seed_print_card(db)

        with TestClient(app) as client:
            deleted = client.delete(
                f"/technical-cards/{card_id}/composition/{material_id}"
                f"?shop_stage_code=print"
            )
            assert deleted.status_code == 200, deleted.text
            materials = [
                row
                for row in deleted.json()["composition_lines"]
                if row["line_kind"] == "material"
            ]
            assert materials == []
    finally:
        app.dependency_overrides.clear()
