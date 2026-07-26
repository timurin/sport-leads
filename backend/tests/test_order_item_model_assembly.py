"""Order-item model + assembly: ADR-014 / 3.2.5.3 smoke + 3.2.5.5 regression.

Coverage:
- whitelist filter (empty optional / non-empty required; foreign model rejected)
- foreign assembly variant rejected
- required variant when model has active variants
- snapshot immutability vs later catalog edits
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.nomenclature import Nomenclature, NomenclatureType
from app.models.product_model import (
    AssemblyOperationLine,
    AssemblyVariant,
    NomenclatureProductModel,
    ProductModel,
    ProductModelSizeType,
    ProductModelStatus,
)
from app.models.sales import Lead, LeadTask, SalesOrderItem, SalesUser


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        db.add(SalesUser(id=1, name="Test user"))
        db.commit()
    return factory


def _add_lead(session_factory: sessionmaker[Session]) -> int:
    with session_factory() as db:
        lead = Lead(
            contact_name="Иван Петров",
            company_name="СК Олимп",
            phone="+79990000000",
            email="sales@example.com",
            city="Казань",
            source="website",
            responsible_id=1,
            sport="Футбол",
            product_category="Форма",
            need_description="Форма для команды",
            estimated_quantity=25,
            estimated_amount=Decimal("250000"),
        )
        db.add(lead)
        db.flush()
        db.add(LeadTask(lead_id=lead.id, title="Позвонить клиенту"))
        db.commit()
        return lead.id


def _seed_catalog(db: Session) -> dict[str, int]:
    empty_product = Nomenclature(
        name="PRODUCT без whitelist",
        category="Форма",
        nomenclature_type=NomenclatureType.PRODUCT,
        unit="шт",
        base_price=Decimal("1000.00"),
    )
    whitelist_product = Nomenclature(
        name="PRODUCT с whitelist",
        category="Форма",
        nomenclature_type=NomenclatureType.PRODUCT,
        unit="шт",
        base_price=Decimal("1500.00"),
    )
    model_a = ProductModel(
        article="PMA-001",
        name="Модель A",
        size_type=ProductModelSizeType.MEN,
        status=ProductModelStatus.ACTIVE,
    )
    model_b = ProductModel(
        article="PMB-002",
        name="Модель B",
        size_type=ProductModelSizeType.WOMEN,
        status=ProductModelStatus.ACTIVE,
    )
    model_c = ProductModel(
        article="PMC-003",
        name="Модель C без вариантов",
        size_type=ProductModelSizeType.KIDS,
        status=ProductModelStatus.ACTIVE,
    )
    db.add_all([empty_product, whitelist_product, model_a, model_b, model_c])
    db.flush()

    variant_a = AssemblyVariant(
        product_model_id=model_a.id,
        name="С отстрочкой",
        is_active=True,
        sort_order=0,
    )
    variant_a_inactive = AssemblyVariant(
        product_model_id=model_a.id,
        name="Архивный пакет A",
        is_active=False,
        sort_order=1,
    )
    variant_b = AssemblyVariant(
        product_model_id=model_b.id,
        name="Базовый B",
        is_active=True,
        sort_order=0,
    )
    db.add_all([variant_a, variant_a_inactive, variant_b])
    db.flush()

    db.add_all(
        [
            AssemblyOperationLine(
                assembly_variant_id=variant_a.id,
                sequence=1,
                operation_name="Базовая сборка",
                cost=Decimal("100.00"),
                duration_seconds=60,
            ),
            AssemblyOperationLine(
                assembly_variant_id=variant_a.id,
                sequence=2,
                operation_name="Отстрочка",
                cost=Decimal("50.50"),
                duration_seconds=30,
            ),
            AssemblyOperationLine(
                assembly_variant_id=variant_b.id,
                sequence=1,
                operation_name="Сборка B",
                cost=Decimal("10.00"),
                duration_seconds=15,
            ),
        ]
    )
    db.add_all(
        [
            NomenclatureProductModel(
                nomenclature_id=whitelist_product.id,
                product_model_id=model_a.id,
                sort_order=0,
            ),
            NomenclatureProductModel(
                nomenclature_id=whitelist_product.id,
                product_model_id=model_c.id,
                sort_order=1,
            ),
        ]
    )
    db.commit()
    return {
        "empty_product_id": empty_product.id,
        "whitelist_product_id": whitelist_product.id,
        "model_a_id": model_a.id,
        "model_b_id": model_b.id,
        "model_c_id": model_c.id,
        "variant_a_id": variant_a.id,
        "variant_a_inactive_id": variant_a_inactive.id,
        "variant_b_id": variant_b.id,
    }


@contextmanager
def _client(factory: sessionmaker[Session]) -> Iterator[TestClient]:
    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            yield client
    finally:
        app.dependency_overrides.clear()


def _convert_order(client: TestClient, factory: sessionmaker[Session]) -> int:
    lead_id = _add_lead(factory)
    return client.post(
        f"/leads/{lead_id}/convert",
        json={"completed_by_id": 1},
    ).json()["order"]["id"]


def test_order_item_model_assembly_adr014_rules() -> None:
    """3.2.5.3 smoke: core ADR-014 create-path rules."""
    factory = _session_factory()
    with factory() as db:
        ids = _seed_catalog(db)

    with _client(factory) as client:
        order_id = _convert_order(client, factory)

        # 1. PRODUCT empty whitelist + no model → OK
        ok_empty = client.post(
            f"/orders/{order_id}/items",
            json={
                "nomenclature_id": ids["empty_product_id"],
                "snapshot_name": "Без модели",
                "unit": "шт",
                "quantity": "1",
                "unit_price": "1000",
            },
        )
        assert ok_empty.status_code == 201, ok_empty.text
        body = ok_empty.json()
        assert body["product_model_id"] is None
        assert body["assembly_variant_id"] is None
        assert body["assembly_operation_snapshots"] == []

        # 2. PRODUCT non-empty whitelist + no model → 400
        missing_model = client.post(
            f"/orders/{order_id}/items",
            json={
                "nomenclature_id": ids["whitelist_product_id"],
                "snapshot_name": "Нужна модель",
                "unit": "шт",
                "quantity": "1",
                "unit_price": "1500",
            },
        )
        assert missing_model.status_code == 400, missing_model.text
        assert "product model is required" in missing_model.json()["detail"].lower()

        # 3. PRODUCT whitelist + foreign model id → 400
        foreign_model = client.post(
            f"/orders/{order_id}/items",
            json={
                "nomenclature_id": ids["whitelist_product_id"],
                "product_model_id": ids["model_b_id"],
                "assembly_variant_id": ids["variant_b_id"],
                "snapshot_name": "Чужая модель",
                "unit": "шт",
                "quantity": "1",
                "unit_price": "1500",
            },
        )
        assert foreign_model.status_code == 400, foreign_model.text
        assert "available-models" in foreign_model.json()["detail"].lower()

        # 4. whitelist model + active variant → snapshots filled
        with_variant = client.post(
            f"/orders/{order_id}/items",
            json={
                "nomenclature_id": ids["whitelist_product_id"],
                "product_model_id": ids["model_a_id"],
                "assembly_variant_id": ids["variant_a_id"],
                "snapshot_name": "Модель A со сборкой",
                "unit": "шт",
                "quantity": "2",
                "unit_price": "1500",
            },
        )
        assert with_variant.status_code == 201, with_variant.text
        filled = with_variant.json()
        assert filled["product_model_id"] == ids["model_a_id"]
        assert filled["product_model_article"] == "PMA-001"
        assert filled["product_model_name"] == "Модель A"
        assert filled["product_model_size_type"] == "men"
        assert filled["assembly_variant_id"] == ids["variant_a_id"]
        assert filled["assembly_variant_name"] == "С отстрочкой"
        assert Decimal(filled["assembly_variant_total_cost"]) == Decimal("150.50")
        ops = filled["assembly_operation_snapshots"]
        assert len(ops) == 2
        assert [row["sequence"] for row in ops] == [1, 2]
        assert [row["operation_name"] for row in ops] == ["Базовая сборка", "Отстрочка"]
        assert [Decimal(row["cost"]) for row in ops] == [
            Decimal("100.00"),
            Decimal("50.50"),
        ]

        # 5. model with active variants but no assembly_variant_id → 400
        missing_variant = client.post(
            f"/orders/{order_id}/items",
            json={
                "nomenclature_id": ids["whitelist_product_id"],
                "product_model_id": ids["model_a_id"],
                "snapshot_name": "Модель без варианта",
                "unit": "шт",
                "quantity": "1",
                "unit_price": "1500",
            },
        )
        assert missing_variant.status_code == 400, missing_variant.text
        assert "assembly variant is required" in missing_variant.json()["detail"].lower()

        # 6. assembly variant of another model → 400
        foreign_variant = client.post(
            f"/orders/{order_id}/items",
            json={
                "nomenclature_id": ids["whitelist_product_id"],
                "product_model_id": ids["model_a_id"],
                "assembly_variant_id": ids["variant_b_id"],
                "snapshot_name": "Чужой вариант",
                "unit": "шт",
                "quantity": "1",
                "unit_price": "1500",
            },
        )
        assert foreign_variant.status_code == 400, foreign_variant.text
        assert "assembly variant not found" in foreign_variant.json()["detail"].lower()


def test_order_item_rejects_foreign_model_and_variant() -> None:
    """3.2.5.5: foreign model outside whitelist and variant of another model rejected."""
    factory = _session_factory()
    with factory() as db:
        ids = _seed_catalog(db)

    with _client(factory) as client:
        order_id = _convert_order(client, factory)

        foreign_model = client.post(
            f"/orders/{order_id}/items",
            json={
                "nomenclature_id": ids["whitelist_product_id"],
                "product_model_id": ids["model_b_id"],
                "assembly_variant_id": ids["variant_b_id"],
                "snapshot_name": "Чужая модель",
                "unit": "шт",
                "quantity": "1",
                "unit_price": "1500",
            },
        )
        assert foreign_model.status_code == 400
        assert "available-models" in foreign_model.json()["detail"].lower()

        foreign_variant = client.post(
            f"/orders/{order_id}/items",
            json={
                "nomenclature_id": ids["whitelist_product_id"],
                "product_model_id": ids["model_a_id"],
                "assembly_variant_id": ids["variant_b_id"],
                "snapshot_name": "Чужой вариант",
                "unit": "шт",
                "quantity": "1",
                "unit_price": "1500",
            },
        )
        assert foreign_variant.status_code == 400
        assert "assembly variant not found" in foreign_variant.json()["detail"].lower()


def test_order_item_whitelist_filter_and_zero_variants_optional() -> None:
    """3.2.5.5: empty whitelist optional; whitelist requires model; zero active variants → variant optional."""
    factory = _session_factory()
    with factory() as db:
        ids = _seed_catalog(db)

    with _client(factory) as client:
        order_id = _convert_order(client, factory)

        empty_ok = client.post(
            f"/orders/{order_id}/items",
            json={
                "nomenclature_id": ids["empty_product_id"],
                "snapshot_name": "Пустой whitelist",
                "unit": "шт",
                "quantity": "1",
                "unit_price": "1000",
            },
        )
        assert empty_ok.status_code == 201, empty_ok.text

        required_model = client.post(
            f"/orders/{order_id}/items",
            json={
                "nomenclature_id": ids["whitelist_product_id"],
                "snapshot_name": "Whitelist без модели",
                "unit": "шт",
                "quantity": "1",
                "unit_price": "1500",
            },
        )
        assert required_model.status_code == 400

        no_variants = client.post(
            f"/orders/{order_id}/items",
            json={
                "nomenclature_id": ids["whitelist_product_id"],
                "product_model_id": ids["model_c_id"],
                "snapshot_name": "Модель без вариантов сборки",
                "unit": "шт",
                "quantity": "1",
                "unit_price": "1500",
            },
        )
        assert no_variants.status_code == 201, no_variants.text
        body = no_variants.json()
        assert body["product_model_id"] == ids["model_c_id"]
        assert body["product_model_article"] == "PMC-003"
        assert body["product_model_size_type"] == "kids"
        assert body["assembly_variant_id"] is None
        assert body["assembly_operation_snapshots"] == []


def test_order_item_rejects_inactive_assembly_variant_on_new_select() -> None:
    """3.2.5.5: inactive assembly variant cannot be newly selected."""
    factory = _session_factory()
    with factory() as db:
        ids = _seed_catalog(db)

    with _client(factory) as client:
        order_id = _convert_order(client, factory)
        response = client.post(
            f"/orders/{order_id}/items",
            json={
                "nomenclature_id": ids["whitelist_product_id"],
                "product_model_id": ids["model_a_id"],
                "assembly_variant_id": ids["variant_a_inactive_id"],
                "snapshot_name": "Неактивный вариант",
                "unit": "шт",
                "quantity": "1",
                "unit_price": "1500",
            },
        )
        assert response.status_code == 400, response.text
        detail = response.json()["detail"].lower()
        assert "inactive" in detail or "not found" in detail or "assembly variant" in detail


def test_order_item_assembly_snapshots_immutable_after_catalog_edit() -> None:
    """3.2.5.5: catalog edits must not rewrite stored order-item assembly snapshots."""
    factory = _session_factory()
    with factory() as db:
        ids = _seed_catalog(db)

    with _client(factory) as client:
        order_id = _convert_order(client, factory)
        created = client.post(
            f"/orders/{order_id}/items",
            json={
                "nomenclature_id": ids["whitelist_product_id"],
                "product_model_id": ids["model_a_id"],
                "assembly_variant_id": ids["variant_a_id"],
                "snapshot_name": "Снимок до правки каталога",
                "unit": "шт",
                "quantity": "1",
                "unit_price": "1500",
            },
        )
        assert created.status_code == 201, created.text
        item = created.json()
        item_id = item["id"]
        assert item["assembly_variant_name"] == "С отстрочкой"
        assert Decimal(item["assembly_variant_total_cost"]) == Decimal("150.50")
        assert [row["operation_name"] for row in item["assembly_operation_snapshots"]] == [
            "Базовая сборка",
            "Отстрочка",
        ]
        assert [Decimal(row["cost"]) for row in item["assembly_operation_snapshots"]] == [
            Decimal("100.00"),
            Decimal("50.50"),
        ]

        # Mutate live catalog masters (variant name, costs, add a third op line).
        with factory() as db:
            variant = db.get(AssemblyVariant, ids["variant_a_id"])
            assert variant is not None
            variant.name = "С отстрочкой (новая редакция)"
            lines = db.scalars(
                select(AssemblyOperationLine)
                .where(AssemblyOperationLine.assembly_variant_id == variant.id)
                .order_by(AssemblyOperationLine.sequence)
            ).all()
            assert len(lines) == 2
            lines[0].operation_name = "Базовая сборка v2"
            lines[0].cost = Decimal("999.00")
            lines[1].cost = Decimal("1.00")
            db.add(
                AssemblyOperationLine(
                    assembly_variant_id=variant.id,
                    sequence=3,
                    operation_name="Новая операция",
                    cost=Decimal("5.00"),
                    duration_seconds=10,
                )
            )
            model = db.get(ProductModel, ids["model_a_id"])
            assert model is not None
            model.article = "PMA-CHANGED"
            model.name = "Модель A изменена"
            db.commit()

        # Unrelated PATCH (qty) must not refresh snapshots from catalog.
        patched = client.patch(
            f"/orders/{order_id}/items/{item_id}",
            json={"quantity": "3"},
        )
        assert patched.status_code == 200, patched.text
        after = patched.json()
        assert after["quantity"] == "3"
        assert after["product_model_article"] == "PMA-001"
        assert after["product_model_name"] == "Модель A"
        assert after["assembly_variant_name"] == "С отстрочкой"
        assert Decimal(after["assembly_variant_total_cost"]) == Decimal("150.50")
        assert [row["operation_name"] for row in after["assembly_operation_snapshots"]] == [
            "Базовая сборка",
            "Отстрочка",
        ]
        assert [Decimal(row["cost"]) for row in after["assembly_operation_snapshots"]] == [
            Decimal("100.00"),
            Decimal("50.50"),
        ]
        assert len(after["assembly_operation_snapshots"]) == 2

        # Persist rows still match the original snapshot set.
        with factory() as db:
            stored = db.get(SalesOrderItem, item_id)
            assert stored is not None
            assert stored.product_model_article == "PMA-001"
            assert stored.assembly_variant_name == "С отстрочкой"
            assert stored.assembly_variant_total_cost == Decimal("150.50")
            assert len(stored.assembly_operation_snapshots) == 2
            assert [row.operation_name for row in stored.assembly_operation_snapshots] == [
                "Базовая сборка",
                "Отстрочка",
            ]
