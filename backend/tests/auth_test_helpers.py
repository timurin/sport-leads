"""Shared auth/RBAC helpers for API tests (Stage 17.1.2)."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.repositories import auth as auth_repo
from app.services.auth import create_platform_user
from app.services import rbac as rbac_service


def ensure_user_with_role(
    db: Session,
    *,
    login: str,
    password: str = "secret-pass",
    display_name: str | None = None,
    role_code: str,
) -> int:
    rbac_service.ensure_rbac_seed(db)
    existing = auth_repo.get_platform_user_by_login(db, login)
    if existing is None:
        user = create_platform_user(
            db,
            login=login,
            password=password,
            display_name=display_name or login,
        )
        user_id = user.id
    else:
        user_id = existing.id
    rbac_service.assign_role(
        db,
        platform_user_id=user_id,
        role_code=role_code,
    )
    return user_id


def attach_session(client: TestClient, *, login: str = "acl03.session") -> None:
    """Log the TestClient into whatever database `get_db` currently overrides."""
    from app.database.session import get_db
    from app.main import app

    override = app.dependency_overrides[get_db]
    generator = override()
    db = next(generator)
    try:
        login_any_session(db, login=login)
    finally:
        try:
            next(generator)
        except StopIteration:
            pass
    login_client(client, login=login)


def login_any_session(db: Session, *, login: str = "acl03.session") -> None:
    """Active platform user for routes that require a session and no extra permission."""
    if auth_repo.get_platform_user_by_login(db, login) is None:
        create_platform_user(
            db,
            login=login,
            password="secret-pass",
            display_name=login,
        )


def login_client(
    client: TestClient,
    *,
    login: str,
    password: str = "secret-pass",
) -> None:
    response = client.post(
        "/auth/login",
        json={"login": login, "password": password},
    )
    assert response.status_code == 200, response.text
