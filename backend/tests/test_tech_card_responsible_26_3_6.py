"""Stage 26.3.6 — tech-card responsible PlatformUser picker."""

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


def _payload(nomenclature_id: int, order_number: str = "1310") -> dict[str, object]:
    return {
        "nomenclature_id": nomenclature_id,
        "order_number": order_number,
        "tech_cards_planned_count": 5,
        "desired_date": "2026-09-15",
        "quantity": 3,
    }


def test_responsible_candidates_default_creator_and_patch() -> None:
    factory = _session_factory()
    db = factory()
    nomenclature_id = _add_nomenclature(db)
    admin_id = ensure_user_with_role(
        db,
        login="admin26",
        display_name="Анна Админ",
        role_code="admin",
    )
    editor_id = ensure_user_with_role(
        db,
        login="editor26",
        display_name="Ева Редактор",
        role_code="catalog_editor",
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
    client = TestClient(app)
    try:
        anonymous = client.post(
            "/technical-cards/standalone",
            json=_payload(nomenclature_id, "1310"),
        )
        assert anonymous.status_code == 201, anonymous.text
        anon_body = anonymous.json()
        assert anon_body["created_by_platform_user_id"] is None
        assert anon_body["responsible_platform_user_id"] is None
        assert anon_body["responsible_name"] is None

        denied = client.get("/technical-cards/responsible-candidates")
        assert denied.status_code == 401

        login_client(client, login="admin26")
        created = client.post(
            "/technical-cards/standalone",
            json=_payload(nomenclature_id, "1311"),
        )
        assert created.status_code == 201, created.text
        body = created.json()
        card_id = body["id"]
        assert body["created_by_platform_user_id"] == admin_id
        assert body["created_by_name"] == "Анна Админ"
        assert body["responsible_platform_user_id"] is None
        assert body["responsible_name"] == "Анна Админ"

        candidates = client.get("/technical-cards/responsible-candidates")
        assert candidates.status_code == 200, candidates.text
        ids = {row["id"] for row in candidates.json()}
        assert admin_id in ids
        assert editor_id not in ids

        forbidden = client.patch(
            f"/technical-cards/{card_id}/responsible",
            json={"responsible_platform_user_id": editor_id},
        )
        assert forbidden.status_code == 422, forbidden.text

        missing = client.patch(
            f"/technical-cards/{card_id}/responsible",
            json={"responsible_platform_user_id": 999999},
        )
        assert missing.status_code == 404, missing.text

        patched = client.patch(
            f"/technical-cards/{card_id}/responsible",
            json={"responsible_platform_user_id": admin_id},
        )
        assert patched.status_code == 200, patched.text
        saved = patched.json()
        assert saved["responsible_platform_user_id"] == admin_id
        assert saved["responsible_name"] == "Анна Админ"
        assert saved["created_by_platform_user_id"] == admin_id

        listed = client.get("/technical-cards")
        assert listed.status_code == 200, listed.text
        row = next(item for item in listed.json() if item["id"] == card_id)
        assert row["responsible_name"] == "Анна Админ"
    finally:
        app.dependency_overrides.clear()
