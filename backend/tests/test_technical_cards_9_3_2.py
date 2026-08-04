"""Stage 9.3.2 — unit lines edit / aggregate import / reset defaults."""

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
from app.models.sales import Lead, LeadTask, SalesUser
from app.services.size_grids_seed import seed_mosmade_reference_grids


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        db.add(SalesUser(id=1, name="Test user"))
        db.commit()
    return factory


def _add_lead(session_factory: sessionmaker[Session]) -> int:
    with session_factory() as db:
        lead = Lead(
            contact_name="Иван Петров",
            company_name="СК Олимп",
            phone="+79990000000",
            email="sales@example.com",
            city="Казань",
            source="website",
            responsible_id=1,
            sport="Футбол",
            product_category="Форма",
            need_description="Форма для команды",
            estimated_quantity=25,
            estimated_amount=Decimal("250000"),
        )
        db.add(lead)
        db.flush()
        db.add(LeadTask(lead_id=lead.id, title="Позвонить клиенту"))
        db.commit()
        return lead.id


def _seed_product(db: Session) -> int:
    product = Nomenclature(
        name="Футболка PRO",
        category="Форма",
        nomenclature_type=NomenclatureType.PRODUCT,
        unit="шт",
        base_price=Decimal("1500.00"),
    )
    db.add(product)
    db.commit()
    return product.id


def test_unit_lines_patch_bulk_replace_import_reset() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            product_id = _seed_product(db)
        lead_id = _add_lead(factory)

        with TestClient(app) as client:
            order_id = client.post(
                f"/leads/{lead_id}/convert",
                json={"completed_by_id": 1},
            ).json()["order"]["id"]
            item = client.post(
                f"/orders/{order_id}/items",
                json={
                    "nomenclature_id": product_id,
                    "snapshot_name": "Футболка PRO",
                    "size_range": "M",
                    "personalization": "Иванов",
                    "color": "Белый",
                    "unit": "шт",
                    "quantity": "3",
                    "unit_price": "1500",
                },
            )
            assert item.status_code == 201, item.text

            card = client.post(
                f"/orders/{order_id}/technical-cards/generate"
            ).json()["created"][0]
            card_id = card["id"]
            assert len(card["unit_lines"]) == 3
            assert all(row["size"] == "M" for row in card["unit_lines"])
            assert all(row["personalization"] == "Иванов" for row in card["unit_lines"])
            assert all(row["color"] is None for row in card["unit_lines"])

            listed = client.get(f"/technical-cards/{card_id}/unit-lines")
            assert listed.status_code == 200
            assert [row["unit_index"] for row in listed.json()] == [1, 2, 3]
            line1_id = listed.json()[0]["id"]

            patched = client.patch(
                f"/technical-cards/{card_id}/unit-lines/{line1_id}",
                json={"print_number": "10", "personalization": "Сидоров"},
            )
            assert patched.status_code == 200, patched.text
            row1 = next(
                row for row in patched.json()["unit_lines"] if row["id"] == line1_id
            )
            assert row1["print_number"] == "10"
            assert row1["personalization"] == "Сидоров"
            assert row1["size"] == "M"

            bulk = client.post(
                f"/technical-cards/{card_id}/unit-lines/bulk",
                json={
                    "lines": [
                        {"unit_index": 2, "print_number": "7", "size": "L"},
                        {"unit_index": 3, "print_number": "9", "color": "Синий"},
                    ]
                },
            )
            assert bulk.status_code == 200, bulk.text
            by_index = {row["unit_index"]: row for row in bulk.json()["unit_lines"]}
            assert by_index[2]["print_number"] == "7"
            assert by_index[2]["size"] == "L"
            assert by_index[3]["print_number"] == "9"
            assert by_index[3]["color"] == "Синий"

            replaced = client.put(
                f"/technical-cards/{card_id}/unit-lines",
                json={
                    "lines": [
                        {
                            "unit_index": 1,
                            "size_type": "male",
                            "size": "S",
                            "personalization": "А",
                            "print_number": "1",
                            "color": "Красный",
                        },
                        {
                            "unit_index": 2,
                            "size_type": "female",
                            "size": "M",
                            "personalization": "Б",
                            "print_number": "2",
                        },
                        {
                            "unit_index": 3,
                            "size_type": "female",
                            "size": "L",
                            "personalization": "В",
                            "print_number": "3",
                        },
                    ]
                },
            )
            assert replaced.status_code == 200, replaced.text
            assert [
                (row["size_type"], row["size"], row["print_number"])
                for row in replaced.json()["unit_lines"]
            ] == [("male", "S", "1"), ("female", "M", "2"), ("female", "L", "3")]

            bad_count = client.put(
                f"/technical-cards/{card_id}/unit-lines",
                json={"lines": [{"unit_index": 1, "size": "S"}]},
            )
            assert bad_count.status_code == 422

            imported = client.post(
                f"/technical-cards/{card_id}/unit-lines/import",
                json={
                    "lines": [
                        {
                            "size_type": "male",
                            "size": "M",
                            "personalization": "Иванов",
                            "print_number": "10",
                            "quantity": 2,
                            "notes": "основа",
                        },
                        {
                            "size_type": "female",
                            "size": "S",
                            "personalization": "Петрова",
                            "print_number": "7",
                            "quantity": 1,
                            "notes": "резерв",
                        },
                    ]
                },
            )
            assert imported.status_code == 200, imported.text
            unit_lines = imported.json()["unit_lines"]
            assert [(row["size_type"], row["size"], row["print_number"]) for row in unit_lines] == [
                ("male", "M", "10"),
                ("male", "M", "10"),
                ("female", "S", "7"),
            ]
            assert unit_lines[0]["notes"] == "основа"
            assert unit_lines[2]["notes"] == "резерв"

            bad_import = client.post(
                f"/technical-cards/{card_id}/unit-lines/import",
                json={
                    "lines": [
                        {
                            "size_type": "male",
                            "size": "M",
                            "personalization": "Иванов",
                            "print_number": "10",
                            "quantity": 2,
                        }
                    ]
                },
            )
            assert bad_import.status_code == 422

            reset = client.post(
                f"/technical-cards/{card_id}/unit-lines/reset-defaults"
            )
            assert reset.status_code == 200, reset.text
            for row in reset.json()["unit_lines"]:
                assert row["size"] == "M"
                assert row["personalization"] == "Иванов"
                assert row["color"] is None
                assert row["print_number"] is None
                assert row["notes"] is None

            client.post(f"/technical-cards/{card_id}/cancel")
            blocked = client.patch(
                f"/technical-cards/{card_id}/unit-lines/{line1_id}",
                json={"size": "XL"},
            )
            assert blocked.status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_unit_lines_import_from_xlsx_template() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            product_id = _seed_product(db)
            seed_mosmade_reference_grids(db)
            db.commit()
        lead_id = _add_lead(factory)

        workbook = Workbook()
        sheet = workbook.active
        assert sheet is not None
        sheet.title = "TechCard"
        sheet.append(
            ["Номер", "Имя", "Тип размера", "Размер", "Рост", "Количество"]
        )
        sheet.append([10, "Иванов", "Мужской (Mosmade)", "48 / M", "", 2])
        sheet.append([7, "Петрова", "Женский (Mosmade)", "44 / S", "", 1])
        payload = io.BytesIO()
        workbook.save(payload)

        with TestClient(app) as client:
            order_id = client.post(
                f"/leads/{lead_id}/convert",
                json={"completed_by_id": 1},
            ).json()["order"]["id"]
            item = client.post(
                f"/orders/{order_id}/items",
                json={
                    "nomenclature_id": product_id,
                    "snapshot_name": "Футболка PRO",
                    "size_range": "M",
                    "personalization": "Иванов",
                    "color": "Белый",
                    "unit": "шт",
                    "quantity": "3",
                    "unit_price": "1500",
                },
            )
            assert item.status_code == 201, item.text

            card = client.post(
                f"/orders/{order_id}/technical-cards/generate"
            ).json()["created"][0]
            card_id = card["id"]

            imported = client.post(
                f"/technical-cards/{card_id}/unit-lines/import-file",
                files={
                    "file": (
                        "techcard-example.xlsx",
                        payload.getvalue(),
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    )
                },
            )
            assert imported.status_code == 200, imported.text
            unit_lines = imported.json()["unit_lines"]
            assert [(row["size_type"], row["size"], row["print_number"]) for row in unit_lines] == [
                ("male", "48 / M", "10"),
                ("male", "48 / M", "10"),
                ("female", "44 / S", "7"),
            ]
            assert [row["personalization"] for row in unit_lines] == [
                "Иванов",
                "Иванов",
                "Петрова",
            ]

            bad_workbook = Workbook()
            bad_sheet = bad_workbook.active
            assert bad_sheet is not None
            bad_sheet.title = "TechCard"
            bad_sheet.append(
                ["Номер", "Имя", "Тип размера", "Размер", "Рост", "Количество"]
            )
            bad_sheet.append([10, "Иванов", "Мужская (Mosmade)", "99/999", "", 3])
            bad_payload = io.BytesIO()
            bad_workbook.save(bad_payload)

            bad_import = client.post(
                f"/technical-cards/{card_id}/unit-lines/import-file",
                files={
                    "file": (
                        "techcard-example-bad.xlsx",
                        bad_payload.getvalue(),
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    )
                },
            )
            assert bad_import.status_code == 422, bad_import.text
            assert "размер не найден" in bad_import.json()["detail"].lower()
    finally:
        app.dependency_overrides.clear()
