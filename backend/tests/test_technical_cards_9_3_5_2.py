"""9.3.5.2: explicit warning when route material has no matching model norm."""

from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.models.nomenclature import Nomenclature, NomenclatureType
from app.models.product_model import ProductModel, ProductModelSizeType, ProductModelStatus
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


def test_generate_keeps_route_material_visible_and_warns_when_norm_missing() -> None:
    factory = _session_factory()
    with factory() as db:
        db.add(SalesUser(id=1, name="Test"))
        print_stage = ProductionStage(
            name="Печать", code="print", is_active=True, sort_order=30
        )
        material = Nomenclature(
            name="Чернила",
            category="Материалы",
            nomenclature_type=NomenclatureType.MATERIAL,
            unit="г",
            base_price=Decimal("0"),
        )
        product = Nomenclature(
            name="Игровая майка",
            category="Форма",
            nomenclature_type=NomenclatureType.PRODUCT,
            unit="шт",
            base_price=Decimal("1000"),
        )
        template = ShopRoutingTemplate(name="Маршрут без нормы", code="route-miss", is_active=True)
        db.add_all([print_stage, material, product, template])
        db.flush()

        operation = TechOperation(
            name="DTF печать",
            code="DTF",
            volume_unit="linear_meters",
            production_stage_id=print_stage.id,
            is_active=True,
            sort_order=10,
        )
        db.add(operation)
        db.flush()
        db.add_all(
            [
                TechOperationRequiredMaterial(
                    tech_operation_id=operation.id,
                    nomenclature_id=material.id,
                    quantity=Decimal("0.250"),
                ),
                ShopRoutingStageLine(
                    routing_template_id=template.id,
                    stage_order=1,
                    production_stage_id=print_stage.id,
                    stage_label=print_stage.name,
                    tech_operation_id=operation.id,
                ),
            ]
        )

        model = ProductModel(
            article="PM-9352",
            name="Модель 9352",
            size_type=ProductModelSizeType.MEN,
            status=ProductModelStatus.ACTIVE,
            default_routing_template_id=template.id,
        )
        db.add(model)

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
            number="SO-SMOKE-9352",
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
            snapshot_name="Игровая майка",
            unit="шт",
            quantity=Decimal("5"),
            unit_price=Decimal("1000"),
            discount_amount=Decimal("0"),
            line_amount=Decimal("5000"),
            product_model_id=model.id,
        )
        db.add(item)
        db.commit()
        order_id = order.id

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
        assert material_lines[0].snapshot_name == "Чернила"
        assert material_lines[0].production_stage_id == print_stage.id
        assert material_lines[0].planned_qty is None
        assert material_lines[0].notes == "Норма модели для техоперации не найдена"
