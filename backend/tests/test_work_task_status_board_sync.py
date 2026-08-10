"""WorkTask status ↔ board stage «Готово» sync (2026-08-10)."""

from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.sales import Lead, SalesUser
from app.schemas.work_tasks import WorkTaskBoardStageCreate
from app.services import work_task_board_stages as board_svc
from tests.auth_test_helpers import ensure_user_with_role, login_client


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def _seed_lead(db: Session) -> int:
    if db.get(SalesUser, 1) is None:
        db.add(SalesUser(id=1, name="Test"))
        db.flush()
    lead = Lead(
        contact_name="Иван",
        company_name="СК",
        phone="+79990000000",
        email="a@example.com",
        city="Казань",
        source="website",
        responsible_id=1,
        sport="Футбол",
        product_category="Форма",
        need_description="Форма",
        estimated_quantity=1,
        estimated_amount=Decimal("1000"),
    )
    db.add(lead)
    db.flush()
    return lead.id


def test_status_done_moves_to_gotovo_and_board_gotovo_closes() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            ensure_user_with_role(db, login="admin", role_code="admin")
            lead_id = _seed_lead(db)
            backlog = board_svc.create_board_stage(
                db, WorkTaskBoardStageCreate(name="Бэклог", sort_order=10)
            )
            doing = board_svc.create_board_stage(
                db, WorkTaskBoardStageCreate(name="В работе", sort_order=20)
            )
            done_stage = board_svc.create_board_stage(
                db, WorkTaskBoardStageCreate(name="Готово", sort_order=40)
            )
            backlog_id = backlog.id
            doing_id = doing.id
            done_id = done_stage.id
            db.commit()

        with TestClient(app) as client:
            login_client(client, login="admin")
            created = client.post(
                "/work-tasks",
                json={
                    "title": "Sync task",
                    "lead_id": lead_id,
                    "board_stage_id": doing_id,
                },
            )
            assert created.status_code == 201, created.text
            task_id = created.json()["id"]

            closed = client.patch(
                f"/work-tasks/{task_id}",
                json={"status": "done"},
            )
            assert closed.status_code == 200, closed.text
            body = closed.json()
            assert body["status"] == "done"
            assert body["board_stage_id"] == done_id
            assert body["completed_at"] is not None

            reopened = client.patch(
                f"/work-tasks/{task_id}",
                json={"status": "open"},
            )
            assert reopened.status_code == 200, reopened.text
            body = reopened.json()
            assert body["status"] == "open"
            assert body["board_stage_id"] == backlog_id
            assert body["completed_at"] is None

            to_done_col = client.patch(
                f"/work-tasks/{task_id}",
                json={"board_stage_id": done_id},
            )
            assert to_done_col.status_code == 200, to_done_col.text
            body = to_done_col.json()
            assert body["status"] == "done"
            assert body["board_stage_id"] == done_id

            leave_done = client.patch(
                f"/work-tasks/{task_id}",
                json={"board_stage_id": doing_id},
            )
            assert leave_done.status_code == 200, leave_done.text
            body = leave_done.json()
            assert body["status"] == "open"
            assert body["board_stage_id"] == doing_id
            assert body["completed_at"] is None
    finally:
        app.dependency_overrides.pop(get_db, None)
