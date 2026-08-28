"""Stage 26.13 — Detailing catalog + model Materials BOM → TC prefill."""

from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.nomenclature import Nomenclature, NomenclatureType
from app.models.product_model import (
    ProductModel,
    ProductModelSizeType,
    ProductModelStatus,
)
from app.models.product_model_material import (
    ProductModelMaterialKind,
    ProductModelMaterialLine,
)
from app.models.product_type import ProductType
from app.models.production_stage import ProductionStage
from app.models.sales import (
    Client,
    Lead,
    LeadTask,
    SalesOrder,
    SalesOrderItem,
    SalesOrderStatus,
    SalesUser,
)
from app.models.shop_routing import ShopRoutingStageLine, ShopRoutingTemplate
from app.models.tech_operation import TechOperation, TechOperationRequiredMaterial
from app.services import technical_cards as tc_service
from app.services.tech_card_model_assembly import update_technical_card_model_assembly


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_detailing_crud_and_model_material_lines_api() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            product_type = ProductType(name="Футболка", is_active=True, sort_order=1)
            material = Nomenclature(
                name="Ткань сублимация",
                category="Материалы",
                nomenclature_type=NomenclatureType.MATERIAL,
                unit="м",
                base_price=Decimal("0"),
            )
            model = ProductModel(
                article="PM-2613",
                name="Модель материалов",
                size_type=ProductModelSizeType.MEN,
                status=ProductModelStatus.ACTIVE,
            )
            db.add_all([product_type, material, model])
            db.commit()
            db.refresh(product_type)
            db.refresh(material)
            db.refresh(model)
            product_type_id = product_type.id
            material_id = material.id
            model_id = model.id

        with TestClient(app) as client:
            created = client.post(
                "/detailing-items",
                json={
                    "name": "Перед",
                    "applicability_product_type_ids": [product_type_id],
                },
            )
            assert created.status_code == 201, created.text
            detailing_id = created.json()["id"]

            listed = client.get("/detailing-items")
            assert listed.status_code == 200
            assert any(row["id"] == detailing_id for row in listed.json())

            with factory() as db:
                row = db.get(ProductModel, model_id)
                assert row is not None
                row.product_type_id = product_type_id
                db.commit()

            replaced = client.put(
                f"/product-models/{model_id}/material-lines",
                json={
                    "lines": [
                        {
                            "kind": "fabric",
                            "nomenclature_id": material_id,
                            "planned_qty": "1.500",
                            "sequence": 1,
                            "fabric_stage_code": "print",
                            "detailing_item_ids": [detailing_id],
                            "detailing_names": ["Спинка"],
                        },
                        {
                            "kind": "print",
                            "nomenclature_id": material_id,
                            "planned_qty": "0.200",
                            "sequence": 1,
                        },
                    ]
                },
            )
            assert replaced.status_code == 200, replaced.text
            body = replaced.json()
            assert len(body) == 2
            fabric = next(row for row in body if row["kind"] == "fabric")
            assert fabric["fabric_stage_code"] == "print"
            names = {item["name"] for item in fabric["detailing_items"]}
            assert "Перед" in names
            assert "Спинка" in names

            listed_lines = client.get(f"/product-models/{model_id}/material-lines")
            assert listed_lines.status_code == 200
            assert len(listed_lines.json()) == 2
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_model_bom_prefills_tc_composition_on_bind() -> None:
    factory = _session_factory()
    with factory() as db:
        db.add(SalesUser(id=1, name="Test"))
        print_stage = ProductionStage(
            name="Печать", code="print", is_active=True, sort_order=30
        )
        material_bom = Nomenclature(
            name="Бумага из BOM",
            category="Материалы",
            nomenclature_type=NomenclatureType.MATERIAL,
            unit="м",
            base_price=Decimal("0"),
        )
        material_op = Nomenclature(
            name="Бумага из TechOp",
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
        template = ShopRoutingTemplate(
            name="Маршрут BOM", code="route-bom", is_active=True
        )
        db.add_all([print_stage, material_bom, material_op, product, template])
        db.flush()

        op = TechOperation(
            name="Сублимация",
            code="SUB-BOM",
            volume_unit="linear_meters",
            production_stage_id=print_stage.id,
            is_active=True,
            sort_order=10,
        )
        db.add(op)
        db.flush()
        db.add(
            TechOperationRequiredMaterial(
                tech_operation_id=op.id,
                nomenclature_id=material_op.id,
                quantity=Decimal("9.000"),
            )
        )
        db.add(
            ShopRoutingStageLine(
                routing_template_id=template.id,
                stage_order=1,
                production_stage_id=print_stage.id,
                stage_label=print_stage.name,
                tech_operation_id=op.id,
            )
        )

        model = ProductModel(
            article="PM-BOM",
            name="Модель с BOM",
            size_type=ProductModelSizeType.MEN,
            status=ProductModelStatus.ACTIVE,
            default_routing_template_id=template.id,
        )
        db.add(model)
        db.flush()
        db.add(
            ProductModelMaterialLine(
                product_model_id=model.id,
                kind=ProductModelMaterialKind.PRINT,
                nomenclature_id=material_bom.id,
                planned_qty=Decimal("1.000"),
                sequence=1,
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
            number="SO-BOM-2613",
            lead_id=lead.id,
            client_id=client.id,
            status=SalesOrderStatus.NEW,
            title="Order BOM",
        )
        db.add(order)
        db.flush()
        item = SalesOrderItem(
            order_id=order.id,
            position=1,
            nomenclature_id=product.id,
            snapshot_name="Игровая футболка",
            unit="шт",
            quantity=Decimal("10"),
            unit_price=Decimal("1000"),
            discount_amount=Decimal("0"),
            line_amount=Decimal("10000"),
            product_model_id=None,
        )
        db.add(item)
        db.commit()

        order_id = order.id
        model_id = model.id
        material_bom_id = material_bom.id
        material_op_id = material_op.id
        print_stage_id = print_stage.id

    with factory() as db:
        generated = tc_service.generate_technical_cards(db, order_id)
        assert len(generated.created) == 1
        card = generated.created[0]
        assert all(
            row.nomenclature_id != material_bom_id
            for row in card.composition_lines
            if row.nomenclature_id is not None
        )

        updated = update_technical_card_model_assembly(
            db,
            card.id,
            product_model_id=model_id,
            assembly_variant_id=None,
        )
        db.commit()
        materials = [
            row
            for row in updated.composition_lines
            if str(getattr(row.line_kind, "value", row.line_kind)) == "material"
        ]
        assert len(materials) == 1
        assert materials[0].nomenclature_id == material_bom_id
        assert materials[0].nomenclature_id != material_op_id
        assert materials[0].planned_qty == Decimal("10.000")
        assert materials[0].production_stage_id == print_stage_id
        assert materials[0].unit == "м"
