"""Stage 26.3.7 — tech-card client typeahead persist (SalesOrder / order group)."""

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
from app.models.sales import Client, SalesUser
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


def _payload(nomenclature_id: int, order_number: str = "1410") -> dict[str, object]:
    return {
        "nomenclature_id": nomenclature_id,
        "order_number": order_number,
        "tech_cards_planned_count": 5,
        "desired_date": "2026-09-15",
        "quantity": 3,
    }


def test_standalone_tech_card_client_patch_and_create() -> None:
    factory = _session_factory()
    db = factory()
    nomenclature_id = _add_nomenclature(db)
    client = Client(contact_name="Иван", company_name="СК Олимп", responsible_id=1)
    db.add(client)
    ensure_user_with_role(
        db,
        login="admin37",
        display_name="Анна Админ",
        role_code="admin",
    )
    db.commit()
    client_id = client.id
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
        login_client(api, login="admin37")
        created = api.post(
            "/technical-cards/standalone",
            json=_payload(nomenclature_id),
        )
        assert created.status_code == 201, created.text
        body = created.json()
        card_id = body["id"]
        assert body["client_id"] is None
        assert body["client_name"] is None

        denied = TestClient(app)
        denied.cookies.clear()
        unauth = denied.patch(
            f"/technical-cards/{card_id}/client",
            json={"client_id": client_id},
        )
        assert unauth.status_code == 401

        missing = api.patch(
            f"/technical-cards/{card_id}/client",
            json={"client_id": 999999},
        )
        assert missing.status_code == 404, missing.text

        patched = api.patch(
            f"/technical-cards/{card_id}/client",
            json={"client_id": client_id},
        )
        assert patched.status_code == 200, patched.text
        saved = patched.json()
        assert saved["client_id"] == client_id
        assert saved["client_name"] == "СК Олимп"

        listed = api.get("/clients", params={"q": "Олимп", "limit": 20})
        assert listed.status_code == 200, listed.text
        assert any(row["id"] == client_id for row in listed.json())

        new_client = api.post(
            "/clients",
            json={"contact_name": "Пётр", "company_name": "Новый клуб"},
        )
        assert new_client.status_code == 201, new_client.text
        new_id = new_client.json()["id"]
        switched = api.patch(
            f"/technical-cards/{card_id}/client",
            json={"client_id": new_id},
        )
        assert switched.status_code == 200, switched.text
        assert switched.json()["client_id"] == new_id
        assert switched.json()["client_name"] == "Новый клуб"

        cleared = api.patch(
            f"/technical-cards/{card_id}/client",
            json={"client_id": None},
        )
        assert cleared.status_code == 200, cleared.text
        assert cleared.json()["client_id"] is None
        assert cleared.json()["client_name"] is None
    finally:
        app.dependency_overrides.clear()
