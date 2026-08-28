"""Stage 26.3.9 — tech-card model + assembly persist."""

from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.characteristics import NomenclatureVariant  # noqa: F401
from app.models.media import NomenclatureMedia  # noqa: F401
from app.models.nomenclature import Nomenclature, NomenclatureHistoryEntry, NomenclatureType  # noqa: F401
from app.models.product_model import (
    AssemblyVariant,
    ProductModel,
    ProductModelSizeType,
    ProductModelStatus,
)
from app.models.sales import SalesUser
from tests.auth_test_helpers import ensure_user_with_role, login_client


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def _add_nomenclature(db: Session) -> int:
    if db.get(SalesUser, 1) is None:
        db.add(SalesUser(id=1, name="Test user"))
        db.flush()
    row = Nomenclature(
        name="Футболка PRO",
        category="Форма",
        nomenclature_type=NomenclatureType.PRODUCT,
        unit="шт",
        base_price=Decimal("1500.00"),
    )
    db.add(row)
    db.flush()
    return row.id


def _add_model(db: Session, article: str, name: str) -> tuple[int, int]:
    model = ProductModel(
        article=article,
        name=name,
        size_type=ProductModelSizeType.MEN,
        status=ProductModelStatus.ACTIVE,
    )
    db.add(model)
    db.flush()
    variant = AssemblyVariant(
        product_model_id=model.id,
        name="Сборка базовая",
        is_active=True,
        sort_order=0,
    )
    db.add(variant)
    db.flush()
    return model.id, variant.id


def _payload(nomenclature_id: int, order_number: str = "1412") -> dict[str, object]:
    return {
        "nomenclature_id": nomenclature_id,
        "order_number": order_number,
        "tech_cards_planned_count": 5,
        "desired_date": "2026-09-15",
        "quantity": 3,
    }


def test_standalone_tech_card_model_assembly_patch() -> None:
    factory = _session_factory()
    db = factory()
    nomenclature_id = _add_nomenclature(db)
    model_id, variant_id = _add_model(db, "PM-2639", "Модель 26.3.9")
    other_model_id, _other_variant_id = _add_model(db, "PM-OTHER", "Другая модель")
    ensure_user_with_role(
        db,
        login="admin39",
        display_name="Анна Админ",
        role_code="admin",
    )
    db.commit()
    db.close()

    def override_get_db():
        session = factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    api = TestClient(app)
    try:
        login_client(api, login="admin39")
        created = api.post(
            "/technical-cards/standalone",
            json=_payload(nomenclature_id),
        )
        assert created.status_code == 201, created.text
        card_id = created.json()["id"]
        assert created.json()["product_model_id"] is None

        denied = TestClient(app)
        denied.cookies.clear()
        unauth = denied.patch(
            f"/technical-cards/{card_id}/model-assembly",
            json={"product_model_id": model_id, "assembly_variant_id": variant_id},
        )
        assert unauth.status_code == 401

        mismatch = api.patch(
            f"/technical-cards/{card_id}/model-assembly",
            json={"product_model_id": other_model_id, "assembly_variant_id": variant_id},
        )
        assert mismatch.status_code == 422, mismatch.text

        listed = api.get("/product-models", params={"search": "PM-2639", "status": "active"})
        assert listed.status_code == 200, listed.text
        assert any(row["id"] == model_id for row in listed.json())

        variants = api.get(f"/product-models/{model_id}/assembly-variants", params={"active_only": True})
        assert variants.status_code == 200, variants.text
        assert any(row["id"] == variant_id for row in variants.json())

        patched = api.patch(
            f"/technical-cards/{card_id}/model-assembly",
            json={"product_model_id": model_id, "assembly_variant_id": variant_id},
        )
        assert patched.status_code == 200, patched.text
        saved = patched.json()
        assert saved["product_model_id"] == model_id
        assert saved["product_model_article"] == "PM-2639"
        assert saved["product_model_name"] == "Модель 26.3.9"
        assert saved["assembly_variant_id"] == variant_id
        assert saved["assembly_variant_name"] == "Сборка базовая"

        reread = api.get(f"/technical-cards/{card_id}")
        assert reread.status_code == 200, reread.text
        assert reread.json()["assembly_variant_id"] == variant_id
    finally:
        app.dependency_overrides.clear()
