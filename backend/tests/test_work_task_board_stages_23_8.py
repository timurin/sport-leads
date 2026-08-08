"""Work task board stages CRUD + task move (Stage 23.8)."""

from __future__ import annotations

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.sales import Lead, SalesUser
from app.models.work_tasks import WorkTaskBoardStage
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


def test_board_stages_crud_and_task_move() -> None:
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
            backlog_id = backlog.id
            doing_id = doing.id
            db.commit()

        with TestClient(app) as client:
            login_client(client, login="admin")

            listed = client.get("/work-task-board-stages")
            assert listed.status_code == 200, listed.text
            assert len(listed.json()) >= 2

            created = client.post(
                "/work-tasks",
                json={
                    "title": "Kanban task",
                    "lead_id": lead_id,
                    "board_stage_id": backlog_id,
                },
            )
            assert created.status_code == 201, created.text
            task_id = created.json()["id"]
            assert created.json()["board_stage_id"] == backlog_id

            moved = client.patch(
                f"/work-tasks/{task_id}",
                json={"board_stage_id": doing_id},
            )
            assert moved.status_code == 200, moved.text
            assert moved.json()["board_stage_id"] == doing_id

            renamed = client.patch(
                f"/work-task-board-stages/{doing_id}",
                json={"name": "Делаем"},
            )
            assert renamed.status_code == 200, renamed.text
            assert renamed.json()["name"] == "Делаем"

            deleted = client.delete(f"/work-task-board-stages/{doing_id}")
            assert deleted.status_code == 204, deleted.text

            detail = client.get(f"/work-tasks/{task_id}")
            assert detail.status_code == 200
            assert detail.json()["board_stage_id"] is None

        with factory() as db:
            remaining = db.scalars(select(WorkTaskBoardStage)).all()
            assert all(row.id != doing_id for row in remaining)
    finally:
        app.dependency_overrides.pop(get_db, None)
