"""Stage 9.1.2 — technical card persistence (ADR-016).

Covers header, composition, unit lines, TechnicalCardOperationLine (soft
tech_operation_id without 8.1.3 FK), and stage results. No generate API.
"""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.models.nomenclature import Nomenclature, NomenclatureType
from app.models.sales import Client, Lead, SalesOrder, SalesOrderItem, SalesOrderStatus, SalesUser
from app.models.technical_card import (
    TechnicalCard,
    TechnicalCardCompositionLine,
    TechnicalCardCompositionLineKind,
    TechnicalCardOperationLine,
    TechnicalCardStageResult,
    TechnicalCardStageResultStatus,
    TechnicalCardStatus,
    TechnicalCardUnitLine,
    TechOperationVolumeUnit,
)
from app.schemas.technical_card import (
    TechnicalCardOperationLineRead,
    TechnicalCardRead,
    TechnicalCardWrite,
)


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def _seed_order_item(db: Session) -> tuple[SalesOrder, SalesOrderItem]:
    db.add(SalesUser(id=1, name="Test user"))
    client = Client(contact_name="Иван", company_name="СК Олимп", responsible_id=1)
    lead = Lead(
        contact_name="Иван",
        company_name="СК Олимп",
        phone="+79990000000",
        responsible_id=1,
        source="website",
    )
    db.add_all([client, lead])
    db.flush()

    nomenclature = Nomenclature(
        name="Футболка PRO",
        category="Форма",
        nomenclature_type=NomenclatureType.PRODUCT,
        unit="шт",
        base_price=Decimal("1500.00"),
    )
    db.add(nomenclature)
    db.flush()

    order = SalesOrder(
        number="SO-9001",
        lead_id=lead.id,
        client_id=client.id,
        status=SalesOrderStatus.NEW,
        title="Заказ ТК",
        responsible_id=1,
    )
    db.add(order)
    db.flush()

    item = SalesOrderItem(
        order_id=order.id,
        nomenclature_id=nomenclature.id,
        position=1,
        snapshot_name="Футболка PRO",
        size_range="M",
        personalization="Иванов",
        unit="шт",
        quantity=Decimal("2"),
        unit_price=Decimal("1500.00"),
        discount_amount=Decimal("0"),
        line_amount=Decimal("3000.00"),
    )
    db.add(item)
    db.commit()
    db.refresh(order)
    db.refresh(item)
    return order, item


def test_technical_card_persists_header_unit_op_volume_and_stage_results() -> None:
    factory = _session_factory()
    with factory() as db:
        order, item = _seed_order_item(db)

        card = TechnicalCard(
            sales_order_id=order.id,
            sales_order_item_id=item.id,
            number=f"{order.number}-1",
            card_seq=1,
            status=TechnicalCardStatus.DRAFT,
            quantity=item.quantity,
            nomenclature_id=item.nomenclature_id,
            nomenclature_name=item.snapshot_name,
            nomenclature_type=NomenclatureType.PRODUCT.value,
            current_stage_order=1,
            current_stage_label="Печать",
            composition_lines=[
                TechnicalCardCompositionLine(
                    sequence=1,
                    line_kind=TechnicalCardCompositionLineKind.MATERIAL,
                    snapshot_name="Ткань сублимация",
                    quantity=Decimal("1.250"),
                    unit="м",
                )
            ],
            unit_lines=[
                TechnicalCardUnitLine(
                    unit_index=1,
                    size="M",
                    personalization="Иванов",
                    print_number="10",
                ),
                TechnicalCardUnitLine(
                    unit_index=2,
                    size="L",
                    personalization="Петров",
                    print_number="7",
                ),
            ],
            # Prefill soft until 8.1.3: snapshot without FK; volume may be zero.
            operation_lines=[
                TechnicalCardOperationLine(
                    sequence=1,
                    tech_operation_id=None,
                    operation_name="Сублимационная печать",
                    volume_unit=TechOperationVolumeUnit.LINEAR_METERS,
                    volume=Decimal("0"),
                    stage_order=1,
                    stage_label="Печать",
                ),
                TechnicalCardOperationLine(
                    sequence=2,
                    tech_operation_id=None,
                    operation_name="Пошив",
                    volume_unit=TechOperationVolumeUnit.PIECES,
                    volume=Decimal("2.000"),
                    stage_order=2,
                    stage_label="Пошив",
                ),
            ],
            stage_results=[
                TechnicalCardStageResult(
                    stage_order=1,
                    stage_label="Печать",
                    status=TechnicalCardStageResultStatus.PENDING,
                ),
                TechnicalCardStageResult(
                    stage_order=2,
                    stage_label="Пошив",
                    status=TechnicalCardStageResultStatus.PENDING,
                ),
            ],
        )
        db.add(card)
        db.commit()
        card_id = card.id

    with factory() as db:
        loaded = db.scalar(
            select(TechnicalCard).where(TechnicalCard.id == card_id)
        )
        assert loaded is not None
        assert loaded.number == "SO-9001-1"
        assert loaded.card_seq == 1
        assert loaded.status == TechnicalCardStatus.DRAFT
        assert loaded.quantity == Decimal("2")
        assert len(loaded.composition_lines) == 1
        assert loaded.composition_lines[0].snapshot_name == "Ткань сублимация"
        assert [u.unit_index for u in loaded.unit_lines] == [1, 2]
        assert loaded.unit_lines[0].print_number == "10"
        assert len(loaded.operation_lines) == 2
        assert loaded.operation_lines[0].volume_unit == TechOperationVolumeUnit.LINEAR_METERS
        assert loaded.operation_lines[0].tech_operation_id is None
        assert loaded.operation_lines[1].volume == Decimal("2.000")
        assert [s.stage_order for s in loaded.stage_results] == [1, 2]

        read = TechnicalCardRead.model_validate(loaded)
        assert read.number == "SO-9001-1"
        assert len(read.operation_lines) == 2
        assert read.operation_lines[0].volume_unit == TechOperationVolumeUnit.LINEAR_METERS
        assert read.unit_lines[1].personalization == "Петров"
        assert read.stage_results[0].status == TechnicalCardStageResultStatus.PENDING


def test_technical_card_one_per_order_item_unique() -> None:
    factory = _session_factory()
    with factory() as db:
        order, item = _seed_order_item(db)
        db.add(
            TechnicalCard(
                sales_order_id=order.id,
                sales_order_item_id=item.id,
                number=f"{order.number}-1",
                card_seq=1,
                status=TechnicalCardStatus.DRAFT,
                quantity=Decimal("2"),
            )
        )
        db.commit()

        db.add(
            TechnicalCard(
                sales_order_id=order.id,
                sales_order_item_id=item.id,
                number=f"{order.number}-2",
                card_seq=2,
                status=TechnicalCardStatus.DRAFT,
                quantity=Decimal("2"),
            )
        )
        try:
            db.commit()
            raise AssertionError("expected unique sales_order_item_id violation")
        except IntegrityError:
            db.rollback()


def test_technical_card_write_schema_round_trip_op_volume() -> None:
    payload = TechnicalCardWrite(
        sales_order_id=1,
        sales_order_item_id=2,
        number="SO-1-1",
        card_seq=1,
        quantity=Decimal("3"),
        operation_lines=[
            {
                "sequence": 1,
                "operation_name": " ВТО ",
                "volume_unit": "pieces",
                "volume": "0",
                "stage_order": 3,
                "stage_label": "ВТО",
            }
        ],
    )
    assert payload.operation_lines[0].operation_name == "ВТО"
    assert payload.operation_lines[0].volume_unit == TechOperationVolumeUnit.PIECES
    assert payload.operation_lines[0].tech_operation_id is None

    line_read = TechnicalCardOperationLineRead(
        id=10,
        technical_card_id=1,
        sequence=1,
        operation_name="ВТО",
        volume_unit=TechOperationVolumeUnit.PIECES,
        volume=Decimal("0"),
        stage_order=3,
        stage_label="ВТО",
        created_at="2026-07-26T12:00:00Z",
        updated_at="2026-07-26T12:00:00Z",
    )
    assert line_read.volume == Decimal("0")


def test_technical_card_cascade_deletes_child_rows() -> None:
    factory = _session_factory()
    with factory() as db:
        order, item = _seed_order_item(db)
        card = TechnicalCard(
            sales_order_id=order.id,
            sales_order_item_id=item.id,
            number=f"{order.number}-1",
            card_seq=1,
            status=TechnicalCardStatus.DRAFT,
            quantity=Decimal("1"),
            unit_lines=[TechnicalCardUnitLine(unit_index=1, size="M")],
            operation_lines=[
                TechnicalCardOperationLine(
                    sequence=1,
                    operation_name="Упаковка",
                    volume_unit=TechOperationVolumeUnit.PIECES,
                    volume=Decimal("1"),
                )
            ],
            stage_results=[
                TechnicalCardStageResult(
                    stage_order=1,
                    stage_label="Упаковка",
                    status=TechnicalCardStageResultStatus.PENDING,
                )
            ],
        )
        db.add(card)
        db.commit()
        card_id = card.id

        db.delete(card)
        db.commit()

        assert db.scalar(select(TechnicalCard).where(TechnicalCard.id == card_id)) is None
        assert (
            db.scalar(
                select(TechnicalCardUnitLine).where(
                    TechnicalCardUnitLine.technical_card_id == card_id
                )
            )
            is None
        )
        assert (
            db.scalar(
                select(TechnicalCardOperationLine).where(
                    TechnicalCardOperationLine.technical_card_id == card_id
                )
            )
            is None
        )
        assert (
            db.scalar(
                select(TechnicalCardStageResult).where(
                    TechnicalCardStageResult.technical_card_id == card_id
                )
            )
            is None
        )
