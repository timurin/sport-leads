"""Stage 26.3.11 — tech-card product name snapshot (nomenclature_name)."""

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


def _payload(nomenclature_id: int) -> dict[str, object]:
    return {
        "nomenclature_id": nomenclature_id,
        "order_number": "1411",
        "tech_cards_planned_count": 5,
        "desired_date": "2026-09-15",
        "quantity": 3,
    }


def test_standalone_tech_card_product_name_patch() -> None:
    factory = _session_factory()
    db = factory()
    nomenclature_id = _add_nomenclature(db)
    ensure_user_with_role(
        db,
        login="admin311",
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
        login_client(api, login="admin311")
        created = api.post(
            "/technical-cards/standalone",
            json=_payload(nomenclature_id),
        )
        assert created.status_code == 201, created.text
        card_id = created.json()["id"]
        assert created.json()["nomenclature_name"] == "Футболка PRO"

        denied = TestClient(app)
        denied.cookies.clear()
        unauth = denied.patch(
            f"/technical-cards/{card_id}/nomenclature-name",
            json={"nomenclature_name": "Майка клубная"},
        )
        assert unauth.status_code == 401

        patched = api.patch(
            f"/technical-cards/{card_id}/nomenclature-name",
            json={"nomenclature_name": "  Майка клубная  "},
        )
        assert patched.status_code == 200, patched.text
        assert patched.json()["nomenclature_name"] == "Майка клубная"

        reread = api.get(f"/technical-cards/{card_id}")
        assert reread.status_code == 200, reread.text
        assert reread.json()["nomenclature_name"] == "Майка клубная"

        cleared = api.patch(
            f"/technical-cards/{card_id}/nomenclature-name",
            json={"nomenclature_name": "   "},
        )
        assert cleared.status_code == 200, cleared.text
        assert cleared.json()["nomenclature_name"] is None
    finally:
        app.dependency_overrides.clear()
