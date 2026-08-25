"""Stage 7.1.2.3 / 7.2 — Specification schemas, API, refresh, approve, immutability."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.production_order import (
    ProductionBatch,
    ProductionBatchCardLink,
    ProductionOrder,
)
from app.models.sales import (
    Client,
    Lead,
    LeadTask,
    SalesOrder,
    SalesOrderItem,
    SalesOrderStatus,
    SalesUser,
)
from app.models.sewing_operation import SewingOperation
from app.models.sewing_work_ledger import (
    SewingWorkKind,
    SewingWorkLedgerEntry,
    SewingWorkStatus,
)
from app.models.specification import Specification
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
from app.schemas.specification import SpecificationCreate, SpecificationListItem
from app.services.auth import create_platform_user


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def _bind_app(factory: sessionmaker[Session]) -> None:
    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    app.state.session_factory = factory


def _qty(value: object) -> Decimal:
    return Decimal(str(value))


def _seed_batch_with_card(
    db: Session,
    *,
    order_number: str = "SO-SPEC-1",
    card_status: TechnicalCardStatus = TechnicalCardStatus.COMPLETED,
    planned_qty: Decimal = Decimal("3"),
    fact_qty: Decimal = Decimal("2.5"),
    with_sewing: bool = False,
) -> tuple[int, int, int]:
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
        email=f"{order_number.lower()}@example.com",
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
        number=order_number,
        lead_id=lead.id,
        client_id=client.id,
        status=SalesOrderStatus.NEW,
        title="Заказ spec",
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
    db.add(item)
    db.flush()
    sewing_op_id = None
    if with_sewing:
        sewing = SewingOperation(
            name=f"Оверлок {order_number}",
            cost=Decimal("10"),
            quantity_per_item=1,
            duration_seconds=30,
        )
        db.add(sewing)
        db.flush()
        sewing_op_id = sewing.id
    card = TechnicalCard(
        sales_order_id=order.id,
        sales_order_item_id=item.id,
        number=f"{order_number}-01",
        card_seq=1,
        status=card_status,
        quantity=Decimal("2"),
        nomenclature_name="Изделие A",
        product_model_name="Модель A",
        assembly_variant_name="База",
        stage_results=[
            TechnicalCardStageResult(
                stage_order=1,
                stage_label="Пошив",
                status=TechnicalCardStageResultStatus.COMPLETED,
                performer_name="Швея 1",
                duration_seconds=100,
            )
        ],
        composition_lines=[
            TechnicalCardCompositionLine(
                sequence=1,
                line_kind=TechnicalCardCompositionLineKind.MATERIAL,
                snapshot_name="Ткань",
                unit="м",
                planned_qty=planned_qty,
                fact_qty=fact_qty,
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
                volume=Decimal("10"),
                stage_order=1,
                stage_label="Пошив",
            )
        ],
    )
    if with_sewing:
        card.operation_lines.append(
            TechnicalCardOperationLine(
                sequence=2,
                source_kind=TechnicalCardOperationLineSourceKind.SEWING,
                sewing_operation_id=sewing_op_id,
                operation_name="Оверлок",
                volume_unit=TechOperationVolumeUnit.PIECES,
                volume=Decimal("4"),
            )
        )
    db.add(card)
    db.flush()
    po = ProductionOrder(
        sales_order_id=order.id,
        number=f"PO-{order_number}-1",
        order_seq=1,
        status="draft",
    )
    db.add(po)
    db.flush()
    batch = ProductionBatch(
        production_order_id=po.id,
        number=f"{po.number}-B1",
        batch_seq=1,
        status="draft",
    )
    db.add(batch)
    db.flush()
    db.add(
        ProductionBatchCardLink(
            production_batch_id=batch.id,
            technical_card_id=card.id,
        )
    )
    db.commit()
    return batch.id, card.id, po.id


def test_specification_create_schema_rejects_non_positive_batch() -> None:
    try:
        SpecificationCreate(production_batch_id=0)
        raise AssertionError("expected validation error")
    except Exception:
        pass
    item = SpecificationListItem.model_validate(
        {
            "id": 1,
            "number": "PO-1-B1-SPEC",
            "production_batch_id": 9,
            "production_batch_number": "PO-1-B1",
            "sales_order_id": 2,
            "sales_order_number": "SO-1",
            "production_order_id": 3,
            "production_order_number": "PO-1",
            "current_version_no": 1,
            "current_version_status": "draft",
            "created_at": "2026-08-25T10:00:00+00:00",
            "updated_at": "2026-08-25T10:00:00+00:00",
        }
    )
    assert item.number.endswith("-SPEC")
    assert "product_lines" not in item.model_dump()


def test_specification_api_create_refresh_approve_and_immutability() -> None:
    factory = _session_factory()
    _bind_app(factory)
    try:
        with factory() as db:
            batch_id, card_id, po_id = _seed_batch_with_card(db, with_sewing=True)
            card = db.get(TechnicalCard, card_id)
            assert card is not None
            sewing_line = next(
                line
                for line in card.operation_lines
                if line.source_kind == TechnicalCardOperationLineSourceKind.SEWING
                or str(line.source_kind) == "sewing"
            )
            user = create_platform_user(
                db, login="sewer-spec", password="secret-pass", display_name="Швея"
            )
            db.add(
                SewingWorkLedgerEntry(
                    platform_user_id=user.id,
                    technical_card_id=card.id,
                    kind=SewingWorkKind.OPERATION,
                    operation_line_id=sewing_line.id,
                    qty=Decimal("3"),
                    status=SewingWorkStatus.COMPLETED,
                    unit_price=Decimal("10"),
                    price_label="Оверлок",
                    completed_at=datetime.now(UTC),
                )
            )
            db.commit()

        with TestClient(app) as client:
            missing = client.post("/specifications", json={"production_batch_id": 99999})
            assert missing.status_code == 422

            created = client.post(
                "/specifications", json={"production_batch_id": batch_id}
            )
            assert created.status_code == 201, created.text
            body = created.json()
            spec_id = body["id"]
            assert body["number"].endswith("-SPEC")
            assert body["current_version_status"] == "draft"
            current = body["current_version"]
            assert len(current["product_lines"]) == 1
            assert current["product_lines"][0]["nomenclature_name"] == "Изделие A"
            assert len(current["material_lines"]) == 1
            assert _qty(current["material_lines"][0]["planned_qty"]) == Decimal("3")
            assert _qty(current["material_lines"][0]["fact_qty"]) == Decimal("2.5")
            routing = next(
                row for row in current["operation_lines"] if row["source_kind"] == "routing"
            )
            sewing = next(
                row for row in current["operation_lines"] if row["source_kind"] == "sewing"
            )
            assert _qty(routing["planned_volume"]) == Decimal("10")
            assert _qty(routing["fact_volume"]) == Decimal("10")
            assert routing["performer_name"] == "Швея 1"
            assert _qty(sewing["planned_volume"]) == Decimal("4")
            assert _qty(sewing["fact_volume"]) == Decimal("3")

            listed = client.get(
                "/specifications", params={"production_order_id": po_id}
            )
            assert listed.status_code == 200
            assert len(listed.json()) == 1
            assert listed.json()[0]["id"] == spec_id
            assert "current_version" not in listed.json()[0]

            again = client.post(
                "/specifications", json={"production_batch_id": batch_id}
            )
            assert again.status_code == 200
            assert again.json()["id"] == spec_id
            assert again.json()["current_version"]["version_no"] == 1

            with factory() as db:
                card = db.get(TechnicalCard, card_id)
                assert card is not None
                card.status = TechnicalCardStatus.IN_PROGRESS
                db.commit()

            blocked = client.post(f"/specifications/{spec_id}/approve")
            assert blocked.status_code == 422
            assert "терминальн" in blocked.json()["detail"].lower()

            with factory() as db:
                card = db.get(TechnicalCard, card_id)
                assert card is not None
                card.status = TechnicalCardStatus.COMPLETED
                db.commit()

            approved = client.post(f"/specifications/{spec_id}/approve")
            assert approved.status_code == 200, approved.text
            assert approved.json()["current_version_status"] == "approved"
            assert approved.json()["current_version"]["version_no"] == 1

            with factory() as db:
                card = db.get(TechnicalCard, card_id)
                assert card is not None
                assert card.specification_version_label == "v1"
                card.composition_lines[0].planned_qty = Decimal("99")
                db.commit()

            frozen = client.get(f"/specifications/{spec_id}")
            assert frozen.status_code == 200
            planned = frozen.json()["current_version"]["material_lines"][0]["planned_qty"]
            assert _qty(planned) == Decimal("3")

            refresh_blocked = client.post(f"/specifications/{spec_id}/refresh")
            assert refresh_blocked.status_code == 422

            draft2 = client.post(f"/specifications/{spec_id}/new-draft")
            assert draft2.status_code == 200, draft2.text
            assert draft2.json()["current_version_status"] == "draft"
            assert draft2.json()["current_version"]["version_no"] == 2
            refreshed_plan = draft2.json()["current_version"]["material_lines"][0][
                "planned_qty"
            ]
            assert _qty(refreshed_plan) == Decimal("99")

            conflict = client.post(f"/specifications/{spec_id}/new-draft")
            assert conflict.status_code == 409

            cancelled = client.post(f"/specifications/{spec_id}/cancel-draft")
            assert cancelled.status_code == 200
            assert cancelled.json()["current_version_status"] == "approved"
    finally:
        app.dependency_overrides.clear()


def test_specification_create_requires_linked_tech_card() -> None:
    factory = _session_factory()
    _bind_app(factory)
    try:
        with factory() as db:
            db.add(SalesUser(id=1, name="Test"))
            client_row = Client(contact_name="A", company_name="B", responsible_id=1)
            db.add(client_row)
            db.flush()
            lead = Lead(
                contact_name="Иван",
                company_name="СК",
                phone="+79990000000",
                email="empty-batch@example.com",
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
                number="SO-EMPTY-SPEC",
                lead_id=lead.id,
                client_id=client_row.id,
                status=SalesOrderStatus.NEW,
                title="Пустая партия",
                responsible_id=1,
            )
            db.add(order)
            db.flush()
            po = ProductionOrder(
                sales_order_id=order.id,
                number="PO-SO-EMPTY-SPEC-1",
                order_seq=1,
                status="draft",
            )
            db.add(po)
            db.flush()
            batch = ProductionBatch(
                production_order_id=po.id,
                number="PO-SO-EMPTY-SPEC-1-B1",
                batch_seq=1,
                status="draft",
            )
            db.add(batch)
            db.commit()
            batch_id = batch.id

        with TestClient(app) as client:
            response = client.post(
                "/specifications", json={"production_batch_id": batch_id}
            )
            assert response.status_code == 422
            assert client.get("/specifications/1").status_code == 404
            listed = client.get("/specifications")
            assert listed.status_code == 200
            assert listed.json() == []
    finally:
        app.dependency_overrides.clear()


def test_specification_header_unique_per_batch() -> None:
    factory = _session_factory()
    _bind_app(factory)
    try:
        with factory() as db:
            batch_id, _, _ = _seed_batch_with_card(db, order_number="SO-SPEC-UNIQ")
        with TestClient(app) as client:
            first = client.post(
                "/specifications", json={"production_batch_id": batch_id}
            )
            second = client.post(
                "/specifications", json={"production_batch_id": batch_id}
            )
            assert first.status_code == 201
            assert second.status_code == 200
            assert first.json()["id"] == second.json()["id"]
            with factory() as db:
                count = len(db.scalars(select(Specification)).all())
                assert count == 1
    finally:
        app.dependency_overrides.clear()
