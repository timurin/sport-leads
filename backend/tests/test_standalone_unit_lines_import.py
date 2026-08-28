"""Standalone TC unit-line XLSX import (no sales_order_item)."""

from __future__ import annotations

import io
from decimal import Decimal

from fastapi.testclient import TestClient
from openpyxl import Workbook
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.nomenclature import Nomenclature, NomenclatureType
from app.models.sales import SalesUser
from app.services.size_grids_seed import MOSMADE_MEN_GRID_NAME, seed_mosmade_reference_grids


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_standalone_unit_lines_import_file_without_order_item() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            db.add(SalesUser(id=1, name="Test user"))
            product = Nomenclature(
                name="Футболка PRO",
                category="Форма",
                nomenclature_type=NomenclatureType.PRODUCT,
                unit="шт",
                base_price=Decimal("1500.00"),
            )
            db.add(product)
            seed_mosmade_reference_grids(db)
            db.commit()
            db.refresh(product)
            nomenclature_id = product.id

        workbook = Workbook()
        sheet = workbook.active
        assert sheet is not None
        sheet.append(
            ["Номер", "Имя", "Тип размера", "Размер", "Рост", "Количество"]
        )
        sheet.append([10, "Иванов", MOSMADE_MEN_GRID_NAME, "48 / M", "", 2])
        sheet.append([7, "Петрова", MOSMADE_MEN_GRID_NAME, "48 / M", "", 1])
        payload = io.BytesIO()
        workbook.save(payload)

        with TestClient(app) as client:
            created = client.post(
                "/technical-cards/standalone",
                json={
                    "nomenclature_id": nomenclature_id,
                    "order_number": "1401",
                    "tech_cards_planned_count": 1,
                    "desired_date": "2026-09-15",
                    "quantity": 3,
                },
            )
            assert created.status_code == 201, created.text
            card = created.json()
            assert card["sales_order_item_id"] is None
            card_id = card["id"]

            imported = client.post(
                f"/technical-cards/{card_id}/unit-lines/import-file",
                files={
                    "file": (
                        "techcart_example.xlsx",
                        payload.getvalue(),
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    )
                },
            )
            assert imported.status_code == 200, imported.text
            unit_lines = imported.json()["unit_lines"]
            assert len(unit_lines) == 3
            assert unit_lines[0]["personalization"] == "Иванов"
            assert unit_lines[0]["print_number"] == "10"
            assert unit_lines[2]["personalization"] == "Петрова"
    finally:
        app.dependency_overrides.clear()


def test_resolve_chromium_path_accepts_env_override(monkeypatch, tmp_path) -> None:
    from app.services import print_forms as print_forms_service

    fake = tmp_path / "chrome"
    fake.write_text("x", encoding="utf-8")
    monkeypatch.setenv("PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH", str(fake))
    monkeypatch.delenv("LOCALAPPDATA", raising=False)
    assert print_forms_service._resolve_chromium_executable_path() == str(fake)
