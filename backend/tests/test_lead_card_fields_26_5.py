"""Stage 26.5 — extra lead card fields + RBAC gate."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.rbac import Permission, Role
from app.services import rbac as rbac_service
from tests.auth_test_helpers import ensure_user_with_role, login_client


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_ensure_rbac_seed_includes_lead_card_fields_manage() -> None:
    factory = _session_factory()
    with factory() as db:
        rbac_service.ensure_rbac_seed(db)
        db.commit()
        codes = {code for code, _desc in rbac_service.MVP_PERMISSIONS}
        assert rbac_service.PERM_LEADS_CARD_FIELDS_MANAGE in codes
        perm_codes = set(db.scalars(select(Permission.code)).all())
        assert rbac_service.PERM_LEADS_CARD_FIELDS_MANAGE in perm_codes
        admin = db.scalars(select(Role).where(Role.code == "admin")).first()
        assert admin is not None
        assert rbac_service.PERM_LEADS_CARD_FIELDS_MANAGE in {
            perm.code for perm in admin.permissions
        }


def test_lead_card_field_create_delete_requires_permission() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    previous_factory = getattr(app.state, "session_factory", None)
    app.state.session_factory = factory
    try:
        with factory() as db:
            from app.models.sales import Lead, LeadStatus

            ensure_user_with_role(db, login="editor", role_code="catalog_editor")
            ensure_user_with_role(db, login="admin1", role_code="admin")
            db.add(
                Lead(
                    contact_name="Test",
                    status=LeadStatus.NEW.value,
                )
            )
            db.commit()
            lead_id = db.scalars(select(Lead.id)).first()

        client = TestClient(app)
        login_client(client, login="editor")
        forbidden = client.post(
            "/lead-card-fields",
            json={"block": "interest", "label": "Курьер"},
        )
        assert forbidden.status_code == 403

        login_client(client, login="admin1")
        created = client.post(
            "/lead-card-fields",
            json={"block": "interest", "label": "Курьер"},
        )
        assert created.status_code == 201
        definition_id = created.json()["id"]

        listed = client.get("/lead-card-fields")
        assert listed.status_code == 200
        assert any(item["id"] == definition_id for item in listed.json())

        saved = client.put(
            f"/leads/{lead_id}/card-field-values",
            json={"items": [{"definition_id": definition_id, "value": "СДЭК"}]},
        )
        assert saved.status_code == 200
        assert saved.json()[0]["value"] == "СДЭК"

        login_client(client, login="editor")
        blocked_delete = client.delete(f"/lead-card-fields/{definition_id}")
        assert blocked_delete.status_code == 403

        login_client(client, login="admin1")
        deleted = client.delete(f"/lead-card-fields/{definition_id}")
        assert deleted.status_code == 204
        remaining = client.get("/lead-card-fields")
        assert remaining.json() == []
    finally:
        app.dependency_overrides.pop(get_db, None)
        if previous_factory is None:
            if hasattr(app.state, "session_factory"):
                delattr(app.state, "session_factory")
        else:
            app.state.session_factory = previous_factory
