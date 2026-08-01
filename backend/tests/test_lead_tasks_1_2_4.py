from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.sales import Lead, LeadEvent, LeadEventType, LeadStatus, LeadTask, LeadTaskStatus, SalesUser


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
        db.add(SalesUser(id=3, name="Inactive", is_active=False))
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


def test_list_sales_users_active_only(client: TestClient) -> None:
    response = client.get("/sales-users")
    assert response.status_code == 200
    body = response.json()
    assert [item["id"] for item in body] == [2, 1]
    assert all(item["is_active"] for item in body)


def test_lead_task_crud_and_history(client: TestClient, session_factory: sessionmaker[Session]) -> None:
    due_at = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    create = client.post(
        "/leads/1/tasks",
        json={
            "title": "Позвонить клиенту",
            "task_type": "call",
            "priority": "high",
            "description": "Уточнить тираж",
            "due_at": due_at,
            "assigned_to_id": 2,
            "created_by_id": 1,
        },
    )
    assert create.status_code == 201, create.text
    task = create.json()
    assert task["title"] == "Позвонить клиенту"
    assert task["assigned_to_name"] == "Manager Two"
    assert task["status"] == "open"
    task_id = task["id"]

    listed = client.get("/leads/1/tasks")
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    patched = client.patch(
        f"/leads/1/tasks/{task_id}",
        json={"title": "Позвонить повторно", "priority": "urgent"},
    )
    assert patched.status_code == 200
    assert patched.json()["title"] == "Позвонить повторно"
    assert patched.json()["priority"] == "urgent"

    completed = client.post(
        f"/leads/1/tasks/{task_id}/complete",
        json={"result": "Договорились на КП"},
    )
    assert completed.status_code == 200
    assert completed.json()["status"] == "completed"
    assert completed.json()["result"] == "Договорились на КП"

    reopen = client.post(f"/leads/1/tasks/{task_id}/reopen")
    assert reopen.status_code == 200
    assert reopen.json()["status"] == "open"
    assert reopen.json()["result"] is None

    deleted = client.delete(f"/leads/1/tasks/{task_id}")
    assert deleted.status_code == 204
    assert client.get("/leads/1/tasks").json() == []

    with session_factory() as db:
        events = list(
            db.scalars(
                select(LeadEvent)
                .where(LeadEvent.lead_id == 1)
                .order_by(LeadEvent.id)
            ).all()
        )
        types = [event.event_type for event in events]
        assert LeadEventType.TASK_CREATED in types
        assert LeadEventType.TASK_COMPLETED in types


def test_lead_task_defaults_assignee_from_responsible(client: TestClient) -> None:
    due_at = (datetime.now(UTC) + timedelta(days=2)).isoformat()
    response = client.post(
        "/leads/1/tasks",
        json={
            "title": "Без явного исполнителя",
            "due_at": due_at,
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["assigned_to_id"] == 1
    assert body["assigned_to_name"] == "System"


def test_lead_task_rejects_inactive_assignee(client: TestClient) -> None:
    due_at = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    response = client.post(
        "/leads/1/tasks",
        json={
            "title": "Bad assignee",
            "due_at": due_at,
            "assigned_to_id": 3,
        },
    )
    assert response.status_code == 404


def test_lead_task_complete_state_guard(client: TestClient, session_factory: sessionmaker[Session]) -> None:
    with session_factory() as db:
        db.add(
            LeadTask(
                lead_id=1,
                title="Already done",
                status=LeadTaskStatus.COMPLETED,
                due_at=datetime.now(UTC),
            )
        )
        db.commit()
        task_id = db.scalar(select(LeadTask.id).where(LeadTask.lead_id == 1))

    response = client.post(f"/leads/1/tasks/{task_id}/complete", json={})
    assert response.status_code == 409
