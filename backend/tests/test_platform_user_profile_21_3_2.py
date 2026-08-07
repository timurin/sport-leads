"""Stage 21.3.2 — platform user profile PATCH."""

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


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_update_platform_user_profile() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            rbac_service.ensure_rbac_seed(db)
            admin = create_platform_user(
                db,
                login="admin",
                password="secret-pass",
                display_name="Admin",
            )
            rbac_service.ensure_admin_role_for_user(db, admin)
            target = create_platform_user(
                db,
                login="target",
                password="secret-pass",
                display_name="Target",
            )
            admin_id = admin.id
            target_id = target.id

        with TestClient(app) as client:
            login = client.post(
                "/auth/login",
                json={"login": "admin", "password": "secret-pass"},
            )
            assert login.status_code == 200, login.text

            patched = client.patch(
                f"/platform-users/{target_id}",
                json={
                    "display_name": "Target Updated",
                    "email": "target@example.com",
                    "phone": "+70001112233",
                    "department": "Ops",
                    "position": "Lead",
                    "manager_platform_user_id": admin_id,
                    "language": "en",
                },
            )
            assert patched.status_code == 200, patched.text
            body = patched.json()
            assert body["display_name"] == "Target Updated"
            assert body["email"] == "target@example.com"
            assert body["department"] == "Ops"
            assert body["position"] == "Lead"
            assert body["manager_platform_user_id"] == admin_id
            assert body["language"] == "en"

            clear_manager = client.patch(
                f"/platform-users/{target_id}",
                json={"manager_platform_user_id": None},
            )
            assert clear_manager.status_code == 200, clear_manager.text
            assert clear_manager.json()["manager_platform_user_id"] is None

            self_mgr = client.patch(
                f"/platform-users/{target_id}",
                json={"manager_platform_user_id": target_id},
            )
            assert self_mgr.status_code == 422

            empty = client.patch(f"/platform-users/{target_id}", json={})
            assert empty.status_code == 422

            missing = client.patch(
                "/platform-users/999999",
                json={"display_name": "Nope"},
            )
            assert missing.status_code == 404
    finally:
        app.dependency_overrides.pop(get_db, None)
