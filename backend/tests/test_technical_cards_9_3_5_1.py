"""9.3.5.1: route TechOperation required materials prefill TC composition."""

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
from app.models.shop_routing import ShopRoutingStageLine, ShopRoutingTemplate
from app.models.tech_operation import TechOperation, TechOperationRequiredMaterial
from app.services import technical_cards as tc_service


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_generate_and_apply_routing_sync_required_materials_to_composition() -> None:
    factory = _session_factory()
    with factory() as db:
        db.add(SalesUser(id=1, name="Test"))
        print_stage = ProductionStage(
            name="Печать", code="print", is_active=True, sort_order=30
        )
        material = Nomenclature(
            name="Сублимационная бумага",
            category="Материалы",
            nomenclature_type=NomenclatureType.MATERIAL,
            unit="м",
            base_price=Decimal("0"),
        )
        product = Nomenclature(
            name="Игровая футболка",
            category="Форма",
            nomenclature_type=NomenclatureType.PRODUCT,
            unit="шт",
            base_price=Decimal("1000"),
        )
        template_a = ShopRoutingTemplate(name="Маршрут A", code="route-a", is_active=True)
        template_b = ShopRoutingTemplate(name="Маршрут B", code="route-b", is_active=True)
        db.add_all([print_stage, material, product, template_a, template_b])
        db.flush()

        op_a = TechOperation(
            name="Сублимация A",
            code="SUB-A",
            volume_unit="linear_meters",
            production_stage_id=print_stage.id,
            is_active=True,
            sort_order=10,
        )
        op_b = TechOperation(
            name="Сублимация B",
            code="SUB-B",
            volume_unit="linear_meters",
            production_stage_id=print_stage.id,
            is_active=True,
            sort_order=20,
        )
        db.add_all([op_a, op_b])
        db.flush()

        db.add_all(
            [
                TechOperationRequiredMaterial(
                    tech_operation_id=op_a.id,
                    nomenclature_id=material.id,
                    quantity=Decimal("1.000"),
                ),
                TechOperationRequiredMaterial(
                    tech_operation_id=op_b.id,
                    nomenclature_id=material.id,
                    quantity=Decimal("2.500"),
                ),
                ShopRoutingStageLine(
                    routing_template_id=template_a.id,
                    stage_order=1,
                    production_stage_id=print_stage.id,
                    stage_label=print_stage.name,
                    tech_operation_id=op_a.id,
                ),
                ShopRoutingStageLine(
                    routing_template_id=template_b.id,
                    stage_order=1,
                    production_stage_id=print_stage.id,
                    stage_label=print_stage.name,
                    tech_operation_id=op_b.id,
                ),
            ]
        )

        model = ProductModel(
            article="PM-9351",
            name="Модель 9351",
            size_type=ProductModelSizeType.MEN,
            status=ProductModelStatus.ACTIVE,
            default_routing_template_id=template_a.id,
        )
        db.add(model)
        db.flush()

        link_a = ProductModelRoutingLink(
            product_model_id=model.id,
            shop_routing_template_id=template_a.id,
            is_active=True,
            sort_order=0,
        )
        link_b = ProductModelRoutingLink(
            product_model_id=model.id,
            shop_routing_template_id=template_b.id,
            is_active=True,
            sort_order=1,
        )
        db.add_all([link_a, link_b])
        db.flush()

        db.add_all(
            [
                ProductModelOperationNorm(
                    product_model_routing_link_id=link_a.id,
                    production_stage_id=print_stage.id,
                    tech_operation_id=op_a.id,
                    norm_qty_per_item=Decimal("1.000"),
                    unit="м",
                ),
                ProductModelOperationNorm(
                    product_model_routing_link_id=link_b.id,
                    production_stage_id=print_stage.id,
                    tech_operation_id=op_b.id,
                    norm_qty_per_item=Decimal("2.000"),
                    unit="м",
                ),
            ]
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
            number="SO-SMOKE-9351",
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
            snapshot_name="Игровая футболка",
            unit="шт",
            quantity=Decimal("3"),
            unit_price=Decimal("1000"),
            discount_amount=Decimal("0"),
            line_amount=Decimal("3000"),
            product_model_id=model.id,
        )
        db.add(item)
        db.commit()

        order_id = order.id
        template_b_id = template_b.id
        print_stage_id = print_stage.id

    with factory() as db:
        generated = tc_service.generate_technical_cards(db, order_id)
        assert len(generated.created) == 1
        card = generated.created[0]

        material_lines = [
            row
            for row in card.composition_lines
            if row.nomenclature_id is not None
        ]
        assert len(material_lines) == 1
        assert material_lines[0].snapshot_name == "Сублимационная бумага"
        assert material_lines[0].production_stage_id == print_stage_id
        assert material_lines[0].planned_qty == Decimal("3.000")
        assert material_lines[0].unit == "м"
        assert material_lines[0].fact_qty is None

        updated = tc_service.apply_routing_template(db, card.id, template_b_id)
        updated_material_lines = [
            row
            for row in updated.composition_lines
            if row.nomenclature_id is not None
        ]
        assert len(updated_material_lines) == 1
        assert updated_material_lines[0].snapshot_name == "Сублимационная бумага"
        assert updated_material_lines[0].production_stage_id == print_stage_id
        assert updated_material_lines[0].planned_qty == Decimal("15.000")
        assert updated_material_lines[0].unit == "м"
