"""Stage 9.4.2 layout amend — tech-card media max 3, apply-routing, sewing lines, order enrich."""

from __future__ import annotations

import base64
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.nomenclature import Nomenclature, NomenclatureType
from app.models.production_stage import ProductionStage
from app.models.sales import (
    Client,
    Lead,
    LeadTask,
    SalesOrder,
    SalesOrderItem,
    SalesOrderItemAssemblyOperationSnapshot,
    SalesOrderStatus,
    SalesUser,
)
from app.models.sewing_operation import SewingOperation
from app.models.shop_routing import ShopRoutingStageLine, ShopRoutingTemplate
from app.models.tech_operation import TechOperation, TechOperationVolumeUnit
from app.models.technical_card import (
    TechnicalCard,
    TechnicalCardMedia,
    TechnicalCardOperationLineSourceKind,
    TechnicalCardStatus,
)


def _tiny_png_b64() -> str:
    # 1x1 PNG
    raw = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f"
        b"\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    return base64.b64encode(raw).decode("ascii")


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        db.add(SalesUser(id=1, name="Менеджер Тест"))
        db.add(
            Client(
                id=1,
                contact_name="Клиент Тест",
                company_name="ООО Спорт",
                responsible_id=1,
            )
        )
        db.add(
            ProductionStage(
                name="Пошив",
                code="sewing",
                sort_order=40,
                is_active=True,
            )
        )
        db.commit()
    return factory


def _seed_order_with_card(db: Session) -> tuple[int, int]:
    lead = Lead(
        contact_name="Иван",
        company_name="СК",
        phone="+79990000001",
        email="a@example.com",
        city="Москва",
        source="website",
        responsible_id=1,
        sport="Футбол",
        product_category="Форма",
        need_description="Тест",
        estimated_quantity=10,
        estimated_amount=Decimal("10000"),
    )
    db.add(lead)
    db.flush()
    db.add(LeadTask(lead_id=lead.id, title="Task"))
    product = Nomenclature(
        name="Футболка",
        category="Форма",
        nomenclature_type=NomenclatureType.PRODUCT,
        unit="шт",
        base_price=Decimal("1000"),
    )
    db.add(product)
    db.flush()
    order = SalesOrder(
        number="ORD-9427",
        lead_id=lead.id,
        client_id=1,
        responsible_id=1,
        title="Заказ",
        status=SalesOrderStatus.NEW,
        desired_date=None,
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
        assembly_variant_name="Стандарт",
    )
    db.add(item)
    db.flush()
    sewing = SewingOperation(name="Строчка", cost=Decimal("50"), duration_seconds=120)
    db.add(sewing)
    db.flush()
    db.add(
        SalesOrderItemAssemblyOperationSnapshot(
            order_item_id=item.id,
            sequence=1,
            operation_name="Строчка",
            cost=Decimal("50"),
            duration_seconds=120,
            sewing_operation_id=sewing.id,
        )
    )
    tech_op = TechOperation(
        name="Печать",
        code="print",
        volume_unit=TechOperationVolumeUnit.LINEAR_METERS,
        is_active=True,
    )
    db.add(tech_op)
    db.flush()
    sewing_stage = db.scalar(select(ProductionStage).where(ProductionStage.code == "sewing"))
    assert sewing_stage is not None
    template = ShopRoutingTemplate(name="Маршрут А", code="R-A", is_active=True)
    db.add(template)
    db.flush()
    db.add(
        ShopRoutingStageLine(
            routing_template_id=template.id,
            stage_order=1,
            production_stage_id=sewing_stage.id,
            stage_label="Пошив",
            tech_operation_id=tech_op.id,
            is_quality_checkpoint=False,
        )
    )
    card = TechnicalCard(
        sales_order_id=order.id,
        sales_order_item_id=item.id,
        number="ORD-9427-1",
        card_seq=1,
        status=TechnicalCardStatus.DRAFT,
        quantity=Decimal("2"),
        nomenclature_id=product.id,
        nomenclature_name="Футболка",
        assembly_variant_name="Стандарт",
    )
    db.add(card)
    db.commit()
    return card.id, template.id


def test_media_max_three_apply_routing_sewing_and_order_enrich() -> None:
    factory = _session_factory()

    def override_get_db():
        db = factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    try:
        with factory() as db:
            card_id, template_id = _seed_order_with_card(db)

        # Order enrich on read
        response = client.get(f"/technical-cards/{card_id}")
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["order_number"] == "ORD-9427"
        assert body["client_name"] == "ООО Спорт"
        assert body["responsible_name"] == "Менеджер Тест"

        # Apply routing → routing + sewing op lines
        apply = client.post(
            f"/technical-cards/{card_id}/apply-routing",
            json={"routing_template_id": template_id},
        )
        assert apply.status_code == 200, apply.text
        applied = apply.json()
        assert applied["routing_template_id"] == template_id
        kinds = [row["source_kind"] for row in applied["operation_lines"]]
        assert "routing" in kinds
        assert "sewing" in kinds
        sewing_rows = [
            row for row in applied["operation_lines"] if row["source_kind"] == "sewing"
        ]
        assert sewing_rows[0]["operation_name"] == "Строчка"
        assert sewing_rows[0]["stage_label"] == "Пошив"

        # Media max 3
        payload = {
            "filename": "a.png",
            "mime_type": "image/png",
            "content_base64": _tiny_png_b64(),
            "is_primary": True,
        }
        for index in range(3):
            payload["filename"] = f"a{index}.png"
            payload["is_primary"] = index == 0
            created = client.post(f"/technical-cards/{card_id}/media", json=payload)
            assert created.status_code in {200, 201}, created.text

        fourth = client.post(
            f"/technical-cards/{card_id}/media",
            json={
                "filename": "overflow.png",
                "mime_type": "image/png",
                "content_base64": _tiny_png_b64(),
                "is_primary": False,
            },
        )
        assert fourth.status_code == 422, fourth.text

        with factory() as db:
            rows = db.scalars(
                select(TechnicalCardMedia).where(
                    TechnicalCardMedia.technical_card_id == card_id
                )
            ).all()
            assert len(rows) == 3

        card_after = client.get(f"/technical-cards/{card_id}")
        assert len(card_after.json()["media_items"]) == 3
        assert all("content_url" in item for item in card_after.json()["media_items"])
    finally:
        app.dependency_overrides.clear()
