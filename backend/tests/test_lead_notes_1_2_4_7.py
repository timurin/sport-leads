from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.sales import Lead, LeadNote, LeadStatus, SalesUser
import pytest


@pytest.fixture()
def session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        db.add(SalesUser(id=1, name="System", is_active=True))
        db.add(SalesUser(id=2, name="Manager Two", is_active=True))
        db.add(
            Lead(
                id=1,
                status=LeadStatus.NEW,
                contact_name="Иван Тестов",
                company_name="ООО Тест",
                responsible_id=1,
            )
        )
        db.commit()
    yield factory
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture()
def client(session_factory: sessionmaker[Session]) -> TestClient:
    def override_get_db():
        with session_factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_lead_note_crud_pin_and_mentions(client: TestClient, session_factory: sessionmaker[Session]) -> None:
    create = client.post(
        "/leads/1/notes",
        json={
            "body": "Нужно уточнить размеры",
            "author_id": 1,
            "mentioned_user_ids": [2],
        },
    )
    assert create.status_code == 201, create.text
    note = create.json()
    assert note["body"] == "Нужно уточнить размеры"
    assert note["author_name"] == "System"
    assert note["mentioned_user_ids"] == [2]
    assert note["is_pinned"] is False
    note_id = note["id"]

    listed = client.get("/leads/1/notes")
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    patched = client.patch(
        f"/leads/1/notes/{note_id}",
        json={"body": "Размеры подтверждены", "mentioned_user_ids": []},
    )
    assert patched.status_code == 200
    assert patched.json()["body"] == "Размеры подтверждены"
    assert patched.json()["mentioned_user_ids"] == []

    pinned = client.post(f"/leads/1/notes/{note_id}/toggle-pin")
    assert pinned.status_code == 200
    assert pinned.json()["is_pinned"] is True

    unpinned = client.post(f"/leads/1/notes/{note_id}/toggle-pin")
    assert unpinned.status_code == 200
    assert unpinned.json()["is_pinned"] is False

    deleted = client.delete(f"/leads/1/notes/{note_id}")
    assert deleted.status_code == 204
    assert client.get("/leads/1/notes").json() == []

    with session_factory() as db:
        assert db.scalar(select(LeadNote).where(LeadNote.lead_id == 1)) is None


def test_lead_note_defaults_author_from_responsible(client: TestClient) -> None:
    response = client.post(
        "/leads/1/notes",
        json={"body": "Без явного автора"},
    )
    assert response.status_code == 201, response.text
    assert response.json()["author_id"] == 1


def test_lead_note_rejects_blank_body(client: TestClient) -> None:
    response = client.post("/leads/1/notes", json={"body": "   "})
    assert response.status_code == 422
