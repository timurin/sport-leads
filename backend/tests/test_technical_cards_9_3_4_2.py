"""9.3.4.2: planned_qty prefill from ProductModelOperationNorm × order qty."""

from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.models.nomenclature import Nomenclature, NomenclatureType
from app.models.product_model import (
    ProductModel,
    ProductModelOperationNorm,
    ProductModelRoutingLink,
    ProductModelSizeType,
    ProductModelStatus,
)
from app.models.production_stage import ProductionStage
from app.models.sales import Client, Lead, LeadTask, SalesOrder, SalesOrderItem, SalesOrderStatus, SalesUser
from app.models.shop_routing import ShopRoutingTemplate
from app.models.technical_card import (
    TechnicalCard,
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


def test_composition_planned_qty_prefill_from_norms() -> None:
    factory = _session_factory()
    with factory() as db:
        db.add(SalesUser(id=1, name="Test"))
        cutting = ProductionStage(
            name="Раскрой", code="cutting", is_active=True, sort_order=20
        )
        print_stage = ProductionStage(
            name="Печать", code="print", is_active=True, sort_order=30
        )
        template = ShopRoutingTemplate(name="Маршрут A", code="ra", is_active=True)
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
        db.add_all([cutting, print_stage, template, material, product])
        db.flush()

        model = ProductModel(
            article="PM-9342",
            name="Модель 9342",
            size_type=ProductModelSizeType.MEN,
            status=ProductModelStatus.ACTIVE,
            default_routing_template_id=template.id,
        )
        db.add(model)
        db.flush()

        link = ProductModelRoutingLink(
            product_model_id=model.id,
            shop_routing_template_id=template.id,
            is_active=True,
            sort_order=0,
        )
        db.add(link)
        db.flush()
        db.add(
            ProductModelOperationNorm(
                product_model_routing_link_id=link.id,
                production_stage_id=cutting.id,
                tech_operation_id=None,
                norm_qty_per_item=Decimal("0.700"),
                unit="м",
            )
        )

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
            number="SO-SMOKE-9342",
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
            quantity=Decimal("10"),
            unit_price=Decimal("1000"),
            discount_amount=Decimal("0"),
            line_amount=Decimal("10000"),
            product_model_id=model.id,
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
            product_model_id=model.id,
            routing_template_id=template.id,
            routing_template_name=template.name,
        )
        db.add(card)
        db.commit()

        card_id = card.id
        stage_id = cutting.id
        other_stage_id = print_stage.id
        material_id = material.id
        template_id = template.id

    with factory() as db:
        hint_qty, hint_unit = tc_service.resolve_composition_planned_qty_hint(
            db,
            tc_service.get_technical_card(db, card_id),
            stage_id,
        )
        assert hint_qty == Decimal("7.000")
        assert hint_unit == "м"

        # Material add with stage + omitted planned_qty → prefill
        updated = tc_service.replace_composition_lines(
            db,
            card_id,
            [
                TechnicalCardCompositionLineWrite(
                    sequence=1,
                    line_kind=TechnicalCardCompositionLineKind.MATERIAL,
                    nomenclature_id=material_id,
                    snapshot_name="Ткань",
                    planned_qty=None,
                    production_stage_id=stage_id,
                    unit=None,
                )
            ],
        )
        row = updated.composition_lines[0]
        assert row.planned_qty == Decimal("7.000")
        assert row.unit == "м"
        assert row.fact_qty is None

        # Explicit planned_qty is not overwritten
        kept = tc_service.replace_composition_lines(
            db,
            card_id,
            [
                TechnicalCardCompositionLineWrite(
                    sequence=1,
                    line_kind=TechnicalCardCompositionLineKind.MATERIAL,
                    nomenclature_id=material_id,
                    snapshot_name="Ткань",
                    planned_qty=Decimal("1.111"),
                    production_stage_id=stage_id,
                    unit="м",
                )
            ],
        )
        assert kept.composition_lines[0].planned_qty == Decimal("1.111")

        # Stage without norm → leave planned null
        no_norm = tc_service.replace_composition_lines(
            db,
            card_id,
            [
                TechnicalCardCompositionLineWrite(
                    sequence=1,
                    line_kind=TechnicalCardCompositionLineKind.MATERIAL,
                    nomenclature_id=material_id,
                    snapshot_name="Ткань",
                    planned_qty=None,
                    production_stage_id=other_stage_id,
                    unit=None,
                )
            ],
        )
        assert no_norm.composition_lines[0].planned_qty is None

        # Generate path: revive/build applies hints to existing MATERIAL with null planned
        card = tc_service.get_technical_card(db, card_id)
        card.composition_lines[0].planned_qty = None
        card.composition_lines[0].production_stage_id = stage_id
        card.routing_template_id = template_id
        db.flush()
        filled = tc_service._apply_planned_qty_hints_to_composition(db, card)
        assert filled == 1
        assert card.composition_lines[0].planned_qty == Decimal("7.000")
