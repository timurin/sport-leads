"""9.6.2–9.6.3: technical card settings singleton defaults and API."""

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.services import technical_card_settings as settings_service


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_get_technical_card_settings_creates_singleton_defaults() -> None:
    factory = _session_factory()
    with factory() as db:
        first = settings_service.get_technical_card_settings(db)
        second = settings_service.get_technical_card_settings(db)

        assert first.id == 1
        assert second.id == 1
        assert first.eligible_nomenclature_types == ["PRODUCT"]
        assert first.numbering_template == "{orderNo}-{cardSeq}"
        assert first.unit_field_size_type_enabled is True
        assert first.unit_field_size_enabled is True
        assert first.unit_field_personalization_enabled is True
        assert first.unit_field_print_number_enabled is True
        assert first.unit_field_notes_enabled is True
        assert first.stage_label_binding_mode == "snapshot"


def test_technical_card_settings_api_reads_and_updates_singleton() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            response = client.get("/technical-card-settings")
            assert response.status_code == 200, response.text
            assert response.json()["eligible_nomenclature_types"] == ["PRODUCT"]

            updated = client.put(
                "/technical-card-settings",
                json={
                    "eligible_nomenclature_types": ["product", "goods", "product"],
                    "numbering_template": " {orderNo}-{cardSeq} ",
                    "unit_field_size_type_enabled": True,
                    "unit_field_size_enabled": False,
                    "unit_field_personalization_enabled": True,
                    "unit_field_print_number_enabled": False,
                    "unit_field_notes_enabled": True,
                    "stage_label_binding_mode": " snapshot ",
                },
            )
            assert updated.status_code == 200, updated.text
            body = updated.json()
            assert body["eligible_nomenclature_types"] == ["PRODUCT", "GOODS"]
            assert body["numbering_template"] == "{orderNo}-{cardSeq}"
            assert body["unit_field_size_enabled"] is False
            assert body["unit_field_print_number_enabled"] is False
            assert body["stage_label_binding_mode"] == "snapshot"

            repeated = client.get("/technical-card-settings")
            assert repeated.status_code == 200, repeated.text
            assert repeated.json()["eligible_nomenclature_types"] == ["PRODUCT", "GOODS"]
            assert repeated.json()["unit_field_size_enabled"] is False
    finally:
        app.dependency_overrides.clear()
