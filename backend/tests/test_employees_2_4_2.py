"""Stage 2.4.2 — employees CRUD vs demo catalog."""

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.sales import Organization


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_employees_crud_active_only_and_org_embed() -> None:
    factory = _session_factory()
    with factory() as db:
        active_org = Organization(name="ИП Вектор", tax_id="1655000000", is_active=True)
        other_org = Organization(name="ООО Спорт", tax_id="7707083893", is_active=True)
        db.add_all([active_org, other_org])
        db.commit()
        org_id = active_org.id
        other_id = other_org.id

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as api:
            missing_org = api.post(
                "/employees",
                json={"full_name": "Нет органа", "organization_id": 999999},
            )
            assert missing_org.status_code == 422

            created = api.post(
                "/employees",
                json={
                    "full_name": "  Мария Иванова  ",
                    "organization_id": org_id,
                    "position": "Менеджер по продажам",
                    "department": "Отдел продаж",
                    "phone": "+7 999 100-20-30",
                    "email": "m.ivanova@mosmade.ru",
                    "employment_date": "2024-02-10",
                },
            )
            assert created.status_code == 201
            body = created.json()
            assert body["full_name"] == "Мария Иванова"
            assert body["organization_id"] == org_id
            assert body["organization_name"] == "ИП Вектор"
            assert body["is_active"] is True
            assert "platform_user_id" not in body
            employee_id = body["id"]

            archived = api.post(
                "/employees",
                json={
                    "full_name": "Алексей Смирнов",
                    "organization_id": other_id,
                    "is_active": False,
                },
            )
            assert archived.status_code == 201
            archived_id = archived.json()["id"]

            active = api.get("/employees")
            assert active.status_code == 200
            names = [row["full_name"] for row in active.json()]
            assert names == ["Мария Иванова"]
            assert "organization_name" in active.json()[0]
            assert "tasks" not in active.json()[0]

            all_rows = api.get("/employees", params={"active_only": False})
            assert {row["full_name"] for row in all_rows.json()} == {
                "Мария Иванова",
                "Алексей Смирнов",
            }

            filtered = api.get(
                "/employees",
                params={"active_only": False, "organization_id": other_id},
            )
            assert [row["id"] for row in filtered.json()] == [archived_id]

            missing = api.get("/employees/999999")
            assert missing.status_code == 404

            detail = api.get(f"/employees/{employee_id}")
            assert detail.status_code == 200
            assert detail.json()["email"] == "m.ivanova@mosmade.ru"
            assert detail.json()["employment_date"] == "2024-02-10"

            empty_patch = api.patch(f"/employees/{employee_id}", json={})
            assert empty_patch.status_code == 422

            patched = api.patch(
                f"/employees/{employee_id}",
                json={"department": "Дизайн", "is_active": False},
            )
            assert patched.status_code == 200
            assert patched.json()["department"] == "Дизайн"
            assert patched.json()["is_active"] is False

            still_hidden = api.get("/employees")
            assert all(row["id"] != employee_id for row in still_hidden.json())

            bad_org = api.patch(
                f"/employees/{employee_id}",
                json={"organization_id": 999999},
            )
            assert bad_org.status_code == 422
    finally:
        app.dependency_overrides.clear()
