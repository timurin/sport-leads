"""Stage 24.1.1–24.1.2 — sewing cabinet RBAC seed + restricted API shell."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.services.auth import create_platform_user
from app.services import rbac as rbac_service
from app.services.sewing_cabinet_access import is_sewing_cabinet_api_path_allowed
from tests.auth_test_helpers import ensure_user_with_role, login_client


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_ensure_rbac_seed_creates_sewing_cabinet_catalog() -> None:
    factory = _session_factory()
    with factory() as db:
        rbac_service.ensure_rbac_seed(db)
        db.commit()
        codes = {code for code, _desc in rbac_service.MVP_PERMISSIONS}
        assert rbac_service.PERM_SEWING_CABINET_READ_OWN in codes
        from app.models.rbac import Permission, Role
        from sqlalchemy import select

        perm_codes = set(db.scalars(select(Permission.code)).all())
        assert rbac_service.PERM_SEWING_CABINET_READ_OWN in perm_codes
        assert rbac_service.PERM_SEWING_CABINET_READ_ANY in perm_codes
        assert rbac_service.PERM_SEWING_CABINET_WRITE in perm_codes
        role_codes = set(db.scalars(select(Role.code)).all())
        assert {
            "admin",
            "catalog_editor",
            "shop_operator",
            "sewer",
            "company_lead",
            "technologist",
            "shop_master",
        } <= role_codes


def test_sewing_cabinet_api_allowlist() -> None:
    assert is_sewing_cabinet_api_path_allowed("/auth/me")
    assert is_sewing_cabinet_api_path_allowed("/health")
    assert is_sewing_cabinet_api_path_allowed("/health/ready")
    assert is_sewing_cabinet_api_path_allowed("/sewing-cabinet/queue")
    assert is_sewing_cabinet_api_path_allowed("/tech-card-scan/opaque-token")
    assert not is_sewing_cabinet_api_path_allowed("/clients")
    assert not is_sewing_cabinet_api_path_allowed("/production-stages")


def test_sewer_me_and_restricted_api_shell() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    previous_factory = getattr(app.state, "session_factory", None)
    app.state.session_factory = factory
    try:
        with factory() as db:
            ensure_user_with_role(db, login="sewer1", role_code="sewer")
            ensure_user_with_role(db, login="admin1", role_code="admin")
            ensure_user_with_role(db, login="ops1", role_code="shop_operator")

        with TestClient(app) as client:
            login_client(client, login="sewer1")
            me = client.get("/auth/me")
            assert me.status_code == 200, me.text
            body = me.json()
            assert "sewer" in body["roles"]
            assert rbac_service.PERM_SEWING_CABINET_READ_OWN in body["permissions"]
            assert rbac_service.PERM_SEWING_CABINET_WRITE in body["permissions"]
            assert rbac_service.PERM_SEWING_CABINET_READ_ANY not in body["permissions"]

            blocked = client.get("/clients")
            assert blocked.status_code == 403, blocked.text
            assert "кабинету" in blocked.json()["detail"].lower()

            health = client.get("/health")
            assert health.status_code == 200, health.text

            client.post("/auth/logout")
            login_client(client, login="admin1")
            admin_me = client.get("/auth/me")
            assert admin_me.status_code == 200, admin_me.text
            admin_perms = admin_me.json()["permissions"]
            assert rbac_service.PERM_SEWING_CABINET_READ_OWN in admin_perms
            assert rbac_service.PERM_SEWING_CABINET_READ_ANY in admin_perms
            assert rbac_service.PERM_SEWING_CABINET_WRITE in admin_perms
            allowed = client.get("/clients")
            assert allowed.status_code == 200, allowed.text

            client.post("/auth/logout")
            login_client(client, login="ops1")
            ops_me = client.get("/auth/me")
            assert ops_me.status_code == 200, ops_me.text
            ops_perms = ops_me.json()["permissions"]
            assert rbac_service.PERM_SEWING_CABINET_READ_OWN not in ops_perms
            assert rbac_service.PERM_SHOP_KANBAN_TRANSITION in ops_perms
            ops_clients = client.get("/clients")
            assert ops_clients.status_code == 200, ops_clients.text
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.state.session_factory = previous_factory


def test_company_lead_is_not_restricted() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    previous_factory = getattr(app.state, "session_factory", None)
    app.state.session_factory = factory
    try:
        with factory() as db:
            user = create_platform_user(
                db,
                login="lead1",
                password="secret-pass",
                display_name="Lead",
            )
            rbac_service.ensure_rbac_seed(db)
            rbac_service.assign_role(
                db,
                platform_user_id=user.id,
                role_code="company_lead",
            )
            loaded = rbac_service.load_user_with_rbac(db, user.id)
            assert loaded is not None
            assert rbac_service.is_sewing_cabinet_restricted(loaded) is False

        with TestClient(app) as client:
            login_client(client, login="lead1")
            me = client.get("/auth/me")
            perms = me.json()["permissions"]
            assert rbac_service.PERM_SEWING_CABINET_READ_ANY in perms
            assert rbac_service.PERM_SEWING_CABINET_READ_OWN not in perms
            listed = client.get("/clients")
            assert listed.status_code == 200, listed.text
    finally:
        app.dependency_overrides.pop(get_db, None)
        app.state.session_factory = previous_factory
