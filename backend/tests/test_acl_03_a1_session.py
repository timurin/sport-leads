"""ACL-03 / P0-A1: employees, clients, client folders and orders require a session."""

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.auth import PlatformUser
from app.models.sales import Client, Employee, SalesOrder
from tests.auth_test_helpers import login_any_session, login_client


def _factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def _counts(factory: sessionmaker[Session]) -> tuple[int, int, int]:
    with factory() as db:
        return (
            db.scalar(select(func.count()).select_from(Employee)) or 0,
            db.scalar(select(func.count()).select_from(Client)) or 0,
            db.scalar(select(func.count()).select_from(SalesOrder)) or 0,
        )


def test_anonymous_a1_routes_reject_without_writing() -> None:
    factory = _factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    before = _counts(factory)
    try:
        with TestClient(app) as api:
            calls = [
                api.get("/employees"),
                api.post("/employees", json={"full_name": "Аноним", "organization_id": 1}),
                api.patch("/employees/1", json={"full_name": "Аноним"}),
                api.get("/clients"),
                api.post("/clients", json={"contact_name": "Аноним"}),
                api.patch("/clients/1", json={"contact_name": "Аноним"}),
                api.delete("/clients/1/bank-accounts/1"),
                api.get("/client-folders"),
                api.post("/client-folders", json={"name": "Аноним"}),
                api.delete("/client-folders/1"),
                api.get("/orders"),
                api.post(
                    "/orders",
                    json={"client_id": 1, "responsible_id": 1, "title": "Аноним"},
                ),
                api.patch("/orders/1/discount", json={"discount_percent": "10"}),
                api.patch("/orders/1/payment", json={"payment_status": "paid"}),
                api.post("/orders/1/invoices", json={}),
                api.delete("/orders/1/items/1"),
            ]
            for response in calls:
                assert response.status_code == 401, response.text
                assert response.json()["detail"] == "Требуется вход"
        assert _counts(factory) == before
        with TestClient(app) as api:
            assert api.get("/health").status_code == 200
            assert api.get("/version").status_code == 200
            assert api.get("/leads").status_code != 401
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_any_active_session_reads_empty_a1_lists() -> None:
    factory = _factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            login_any_session(db)
        with TestClient(app) as api:
            login_client(api, login="acl03.session")
            for path in ("/employees", "/clients", "/client-folders", "/orders"):
                response = api.get(path)
                assert response.status_code == 200, response.text
                assert response.json() == []
            me = api.get("/auth/me")
            assert me.status_code == 200
            with factory() as db:
                assert db.scalar(select(func.count()).select_from(PlatformUser)) == 1
    finally:
        app.dependency_overrides.pop(get_db, None)
