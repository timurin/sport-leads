"""9.3.4.1 smoke: composition planned_qty / fact_qty / production_stage_id."""

from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.models.nomenclature import Nomenclature, NomenclatureType
from app.models.production_stage import ProductionStage
from app.models.sales import Client, Lead, LeadTask, SalesOrder, SalesOrderItem, SalesOrderStatus, SalesUser
from app.models.technical_card import (
    TechnicalCard,
    TechnicalCardCompositionLine,
    TechnicalCardCompositionLineKind,
    TechnicalCardStatus,
)
from app.schemas.technical_card import TechnicalCardCompositionLineWrite
from app.services import technical_cards as tc_service


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_composition_planned_fact_and_stage_persist() -> None:
    factory = _session_factory()
    with factory() as db:
        db.add(SalesUser(id=1, name="Test"))
        cutting = ProductionStage(
            name="Раскрой", code="cutting", is_active=True, sort_order=20
        )
        material = Nomenclature(
            name="Ткань",
            category="Материалы",
            nomenclature_type=NomenclatureType.MATERIAL,
            unit="м",
            base_price=Decimal("100"),
        )
        product = Nomenclature(
            name="Футболка",
            category="Форма",
            nomenclature_type=NomenclatureType.PRODUCT,
            unit="шт",
            base_price=Decimal("1000"),
        )
        db.add_all([cutting, material, product])
        db.flush()

        client = Client(contact_name="A", company_name="B", responsible_id=1)


        lead = Lead(
            contact_name="A",
            company_name="B",
            phone="+7",
            email="a@b.c",
            city="X",
            source="website",
            responsible_id=1,
            sport="Футбол",
            product_category="Форма",
            need_description="x",
            estimated_quantity=1,
            estimated_amount=Decimal("1000"),


        )


        db.add_all([client, lead])


        db.flush()


        db.add(LeadTask(lead_id=lead.id, title="t"))


        order = SalesOrder(


            number="SO-SMOKE-9341",


            lead_id=lead.id,


            client_id=client.id,


            status=SalesOrderStatus.NEW,


            title="Order",


        )
        db.add(order)
        db.flush()
        item = SalesOrderItem(
            order_id=order.id,
            position=1,
            nomenclature_id=product.id,
            snapshot_name="Футболка",
            unit="шт",
            quantity=Decimal("2"),
            unit_price=Decimal("1000"),
            discount_amount=Decimal("0"),
            line_amount=Decimal("2000"),
        )
        db.add(item)
        db.flush()

        card = TechnicalCard(
            sales_order_id=order.id,
            sales_order_item_id=item.id,
            number=f"{order.number}-1",
            card_seq=1,
            status=TechnicalCardStatus.DRAFT,
            quantity=item.quantity,
            nomenclature_id=product.id,
            nomenclature_name=product.name,
            nomenclature_type=NomenclatureType.PRODUCT.value,
            composition_lines=[
                TechnicalCardCompositionLine(
                    sequence=1,
                    line_kind=TechnicalCardCompositionLineKind.MATERIAL,
                    nomenclature_id=material.id,
                    snapshot_name="Ткань",
                    planned_qty=Decimal("1.250"),
                    fact_qty=None,
                    production_stage_id=cutting.id,
                    unit="м",
                )
            ],
        )
        db.add(card)
        db.commit()
        card_id = card.id
        stage_id = cutting.id
        material_id = material.id

    with factory() as db:
        loaded = tc_service.get_technical_card(db, card_id)
        row = loaded.composition_lines[0]
        assert row.planned_qty == Decimal("1.250")
        assert row.fact_qty is None
        assert row.production_stage_id == stage_id

        updated = tc_service.replace_composition_lines(
            db,
            card_id,
            [
                TechnicalCardCompositionLineWrite(
                    sequence=1,
                    line_kind=TechnicalCardCompositionLineKind.MATERIAL,
                    nomenclature_id=material_id,
                    snapshot_name="Ткань",
                    planned_qty=Decimal("3.500"),
                    production_stage_id=stage_id,
                    unit="м",
                )
            ],
        )
        row = updated.composition_lines[0]
        assert row.planned_qty == Decimal("3.500")
        assert row.fact_qty is None
        assert row.production_stage_id == stage_id
        assert getattr(TechnicalCardCompositionLine, "quantity", None) is None
