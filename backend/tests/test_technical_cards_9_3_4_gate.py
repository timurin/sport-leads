"""9.3.4.3–9.3.4.5: material fact gate + shop fact write + regression."""

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
    ProductModelOperationNorm,
    ProductModelRoutingLink,
    ProductModelSizeType,
    ProductModelStatus,
)
from app.models.production_stage import ProductionStage
from app.models.sales import Client, Lead, LeadTask, SalesOrder, SalesOrderItem, SalesOrderStatus, SalesUser
from app.models.shop_routing import ShopRoutingStageLine, ShopRoutingTemplate
from app.models.tech_operation import TechOperation
from app.models.technical_card import (
    TechnicalCard,
    TechnicalCardCompositionLine,
    TechnicalCardCompositionLineKind,
    TechnicalCardStageResult,
    TechnicalCardStageResultStatus,
    TechnicalCardStatus,
    TechOperationVolumeUnit,
)
from app.services import technical_cards as tc_service
from app.services.technical_card_stages import complete_stage, start_technical_card
from app.services.technical_cards import TechnicalCardValidationError


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def _seed_order_card(db: Session) -> dict[str, int]:
    db.add(SalesUser(id=1, name="Test"))
    cutting = ProductionStage(name="Раскрой", code="cutting", is_active=True, sort_order=20)
    print_stage = ProductionStage(name="Печать", code="print", is_active=True, sort_order=30)
    qc = ProductionStage(name="ОТК", code="qc", is_active=True, sort_order=60)
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
    db.add_all([cutting, print_stage, qc, material, product])
    db.flush()

    op = TechOperation(
        name="Печать",
        code="print-op",
        volume_unit=TechOperationVolumeUnit.LINEAR_METERS,
        production_stage_id=print_stage.id,
        is_active=True,
        sort_order=1,
    )
    db.add(op)
    db.flush()

    template = ShopRoutingTemplate(
        name="Маршрут",
        code="rt-934",
        is_active=True,
        stage_lines=[
            ShopRoutingStageLine(
                stage_order=1,
                production_stage_id=cutting.id,
                stage_label="Раскрой",
            ),
            ShopRoutingStageLine(
                stage_order=2,
                production_stage_id=print_stage.id,
                stage_label="Печать",
                tech_operation_id=op.id,
            ),
            ShopRoutingStageLine(
                stage_order=3,
                production_stage_id=qc.id,
                stage_label="ОТК",
            ),
        ],
    )
    db.add(template)
    db.flush()

    model = ProductModel(
        article="PM-GATE",
        name="Модель gate",
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
            norm_qty_per_item=Decimal("0.500"),
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
        number="SO-GATE-934",
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
        quantity=Decimal("4"),
        unit_price=Decimal("1000"),
        discount_amount=Decimal("0"),
        line_amount=Decimal("4000"),
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
        stage_results=[
            TechnicalCardStageResult(
                stage_order=1,
                production_stage_id=cutting.id,
                stage_label="Раскрой",
                status=TechnicalCardStageResultStatus.PENDING,
            ),
            TechnicalCardStageResult(
                stage_order=2,
                production_stage_id=print_stage.id,
                stage_label="Печать",
                status=TechnicalCardStageResultStatus.PENDING,
            ),
            TechnicalCardStageResult(
                stage_order=3,
                production_stage_id=qc.id,
                stage_label="ОТК",
                status=TechnicalCardStageResultStatus.PENDING,
            ),
        ],
        composition_lines=[
            TechnicalCardCompositionLine(
                sequence=1,
                line_kind=TechnicalCardCompositionLineKind.MATERIAL,
                nomenclature_id=material.id,
                snapshot_name="Ткань",
                planned_qty=Decimal("2.000"),
                fact_qty=None,
                production_stage_id=cutting.id,
                unit="м",
            )
        ],
    )
    db.add(card)
    db.commit()
    return {
        "card_id": card.id,
        "cutting_id": cutting.id,
        "print_id": print_stage.id,
        "material_id": material.id,
        "line_id": card.composition_lines[0].id,
        "template_id": template.id,
    }


def test_material_fact_gate_reject_allow_and_qc_ungated() -> None:
    factory = _session_factory()
    with factory() as db:
        ids = _seed_order_card(db)
        card_id = ids["card_id"]
        line_id = ids["line_id"]

        start_technical_card(db, card_id)

        try:
            complete_stage(db, card_id, 1)
            raise AssertionError("expected cutting gate reject without fact_qty")
        except TechnicalCardValidationError as error:
            assert "fact_qty" in str(error).lower()

        updated = tc_service.set_composition_line_fact_qty(
            db, card_id, line_id, Decimal("1.750")
        )
        assert updated.composition_lines[0].fact_qty == Decimal("1.750")

        cutting_done = complete_stage(db, card_id, 1)
        assert cutting_done.stage_results[0].status == TechnicalCardStageResultStatus.COMPLETED

        # Print has no MATERIAL bound → gate allows
        print_done = complete_stage(db, card_id, 2)
        assert print_done.stage_results[1].status == TechnicalCardStageResultStatus.COMPLETED

        # QC never hard-gated by material
        qc_done = complete_stage(db, card_id, 3)
        assert qc_done.status == TechnicalCardStatus.COMPLETED


def test_manager_replace_does_not_write_fact_and_prefill_still_works() -> None:
    factory = _session_factory()
    with factory() as db:
        ids = _seed_order_card(db)
        card_id = ids["card_id"]
        material_id = ids["material_id"]
        cutting_id = ids["cutting_id"]
        line_id = ids["line_id"]

        tc_service.set_composition_line_fact_qty(db, card_id, line_id, Decimal("9.000"))

        from app.schemas.technical_card import TechnicalCardCompositionLineWrite

        replaced = tc_service.replace_composition_lines(
            db,
            card_id,
            [
                TechnicalCardCompositionLineWrite(
                    sequence=1,
                    line_kind=TechnicalCardCompositionLineKind.MATERIAL,
                    nomenclature_id=material_id,
                    snapshot_name="Ткань",
                    planned_qty=None,
                    production_stage_id=cutting_id,
                    unit=None,
                )
            ],
        )
        row = replaced.composition_lines[0]
        # Prefill from norms × qty (0.5 * 4)
        assert row.planned_qty == Decimal("2.000")
        # Manager replace resets fact
        assert row.fact_qty is None


def test_fact_qty_api_endpoint() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            ids = _seed_order_card(db)
            card_id = ids["card_id"]
            line_id = ids["line_id"]
            cutting_id = ids["cutting_id"]

        client = TestClient(app)
        patched = client.patch(
            f"/technical-cards/{card_id}/composition/{line_id}/fact-qty",
            json={"fact_qty": "3.250"},
        )
        assert patched.status_code == 200, patched.text
        body = patched.json()
        materials = [
            row
            for row in body["composition_lines"]
            if row["line_kind"] == "material"
        ]
        assert materials[0]["fact_qty"] == "3.250"
        assert materials[0]["planned_qty"] == "2.000"
        assert materials[0]["production_stage_id"] == cutting_id
    finally:
        app.dependency_overrides.clear()
