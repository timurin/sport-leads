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
