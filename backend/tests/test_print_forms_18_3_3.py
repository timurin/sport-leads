"""Stage 18.3.3 - print-form registry API."""

from __future__ import annotations

import hashlib
import sys
import types

if "argon2" not in sys.modules:
    argon2_module = types.ModuleType("argon2")
    argon2_exceptions = types.ModuleType("argon2.exceptions")

    class VerifyMismatchError(Exception):
        pass

    class PasswordHasher:
        def hash(self, password: str) -> str:
            return hashlib.sha256(password.encode("utf-8")).hexdigest()

        def verify(self, password_hash: str, password: str) -> bool:
            candidate = hashlib.sha256(password.encode("utf-8")).hexdigest()
            if candidate != password_hash:
                raise VerifyMismatchError()
            return True

    argon2_module.PasswordHasher = PasswordHasher
    argon2_exceptions.VerifyMismatchError = VerifyMismatchError
    sys.modules["argon2"] = argon2_module
    sys.modules["argon2.exceptions"] = argon2_exceptions

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.print_form import (
    PrintFormStatus,
    PrintFormVersion,
    PrintFormVersionStatus,
)
from app.services import print_forms as print_forms_service
from tests.auth_test_helpers import ensure_user_with_role, login_client


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_print_forms_crud_and_lifecycle() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            ensure_user_with_role(db, login="admin", role_code="admin")

        with TestClient(app) as client:
            login_client(client, login="admin")
            created = client.post(
                "/print-forms",
                json={
                    "code": "sales_order_a4",
                    "title": "Заказ покупателя A4",
                    "binding_type": "model",
                    "binding_key": "sales_order",
                    "output_format": "pdf",
                },
            )
            assert created.status_code == 201, created.text
            print_form_id = created.json()["id"]
            assert created.json()["status"] == PrintFormStatus.DRAFT.value

            listed = client.get("/print-forms?q=sales_order")
            assert listed.status_code == 200, listed.text
            assert any(row["id"] == print_form_id for row in listed.json())

            patched = client.patch(
                f"/print-forms/{print_form_id}",
                json={
                    "title": "Заказ покупателя A4 PDF",
                    "binding_type": "directory",
                    "binding_key": "cities",
                },
            )
            assert patched.status_code == 200, patched.text
            assert patched.json()["binding_type"] == "directory"
            assert patched.json()["binding_key"] == "cities"

            activate_without_version = client.post(
                f"/print-forms/{print_form_id}/activate"
            )
            assert activate_without_version.status_code == 422

            with factory() as db:
                version = PrintFormVersion(
                    print_form_id=print_form_id,
                    version_no=1,
                    template_label="v1",
                    storage_kind="inline_text",
                    template_source="<html />",
                    status=PrintFormVersionStatus.PUBLISHED.value,
                    is_current=True,
                )
                db.add(version)
                db.commit()

            activated = client.post(f"/print-forms/{print_form_id}/activate")
            assert activated.status_code == 200, activated.text
            assert activated.json()["status"] == PrintFormStatus.ACTIVE.value

            archived = client.post(f"/print-forms/{print_form_id}/archive")
            assert archived.status_code == 200, archived.text
            assert archived.json()["status"] == PrintFormStatus.ARCHIVED.value

            fetched = client.get(f"/print-forms/{print_form_id}")
            assert fetched.status_code == 200, fetched.text
            assert fetched.json()["versions"][0]["is_current"] is True
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_print_forms_validate_directory_binding_and_permissions() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            ensure_user_with_role(db, login="admin", role_code="admin")
            ensure_user_with_role(
                db,
                login="editor",
                role_code="catalog_editor",
            )

        with TestClient(app) as client:
            login_client(client, login="admin")
            invalid_directory = client.post(
                "/print-forms",
                json={
                    "code": "bad_directory_form",
                    "title": "Bad directory",
                    "binding_type": "directory",
                    "binding_key": "unknown_directory",
                },
            )
            assert invalid_directory.status_code == 422, invalid_directory.text

        with TestClient(app) as client:
            login_client(client, login="editor")
            forbidden = client.post(
                "/print-forms",
                json={
                    "code": "sales_invoice_pdf",
                    "title": "Invoice",
                    "binding_type": "document_type",
                    "binding_key": "sales_invoice",
                },
            )
            assert forbidden.status_code == 403, forbidden.text
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_print_form_versions_preview_and_generate() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            ensure_user_with_role(db, login="admin", role_code="admin")

        with TestClient(app) as client:
            login_client(client, login="admin")
            created = client.post(
                "/print-forms",
                json={
                    "code": "sales_invoice_html",
                    "title": "Счёт HTML",
                    "binding_type": "document_type",
                    "binding_key": "sales_invoice",
                    "output_format": "html",
                },
            )
            assert created.status_code == 201, created.text
            print_form_id = created.json()["id"]

            version = client.post(
                f"/print-forms/{print_form_id}/versions",
                json={
                    "template_label": "v1 draft",
                    "storage_kind": "inline_text",
                    "template_source": "<h1>{{ document_number }}</h1><p>{{ customer.name }}</p>",
                },
            )
            assert version.status_code == 201, version.text
            version_id = version.json()["id"]
            assert version.json()["version_no"] == 1

            preview = client.post(
                f"/print-forms/{print_form_id}/preview",
                json={
                    "version_id": version_id,
                    "payload": {
                        "document_number": "INV-1",
                        "customer": {"name": "ООО Тест"},
                    },
                },
            )
            assert preview.status_code == 200, preview.text
            assert "<h1>INV-1</h1>" in preview.json()["content"]
            assert "ООО Тест" in preview.json()["content"]
            assert preview.json()["is_preview"] is True

            published = client.post(
                f"/print-forms/{print_form_id}/versions/{version_id}/publish",
                json={"is_current": True},
            )
            assert published.status_code == 200, published.text
            assert published.json()["status"] == "published"
            assert published.json()["is_current"] is True

            activated = client.post(f"/print-forms/{print_form_id}/activate")
            assert activated.status_code == 200, activated.text

            generated = client.post(
                "/print-forms/generate",
                json={
                    "binding_type": "document_type",
                    "binding_key": "sales_invoice",
                    "output_format": "html",
                    "payload": {
                        "document_number": "INV-2",
                        "customer": {"name": "АО Ромашка"},
                    },
                },
            )
            assert generated.status_code == 200, generated.text
            assert generated.json()["print_form_code"] == "sales_invoice_html"
            assert generated.json()["content_type"].startswith("text/html")
            assert "INV-2" in generated.json()["content"]
            assert "АО Ромашка" in generated.json()["content"]
            assert generated.json()["is_preview"] is False
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_print_form_generate_pdf_uses_html_template_fallback() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    original_render_pdf_bytes = print_forms_service._render_pdf_bytes
    print_forms_service._render_pdf_bytes = lambda html: f"PDF::{html}".encode("utf-8")
    try:
        with factory() as db:
            ensure_user_with_role(db, login="admin", role_code="admin")

        with TestClient(app) as client:
            login_client(client, login="admin")
            created = client.post(
                "/print-forms",
                json={
                    "code": "technical_card_a4_x2",
                    "title": "Tech card HTML",
                    "binding_type": "model",
                    "binding_key": "technical_card",
                    "output_format": "html",
                },
            )
            assert created.status_code == 201, created.text
            print_form_id = created.json()["id"]

            version = client.post(
                f"/print-forms/{print_form_id}/versions",
                json={
                    "template_label": "v1",
                    "storage_kind": "inline_text",
                    "template_source": "<h1>{{ document_number }}</h1>",
                },
            )
            assert version.status_code == 201, version.text
            version_id = version.json()["id"]

            published = client.post(
                f"/print-forms/{print_form_id}/versions/{version_id}/publish",
                json={"is_current": True},
            )
            assert published.status_code == 200, published.text

            activated = client.post(f"/print-forms/{print_form_id}/activate")
            assert activated.status_code == 200, activated.text

            generated = client.post(
                "/print-forms/generate",
                json={
                    "binding_type": "model",
                    "binding_key": "technical_card",
                    "output_format": "pdf",
                    "payload": {
                        "document_number": "TC-2",
                    },
                },
            )
            assert generated.status_code == 200, generated.text
            body = generated.json()
            assert body["output_format"] == "pdf"
            assert body["content_type"] == "application/pdf"
            assert body["content_encoding"] == "base64"
            assert body["file_name"].endswith(".pdf")
    finally:
        print_forms_service._render_pdf_bytes = original_render_pdf_bytes
        app.dependency_overrides.pop(get_db, None)
