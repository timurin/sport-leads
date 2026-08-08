"""Stage 23.6.1 — LeadTask + CollaborationMicrotask → WorkTask data migrate."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.models.auth import PlatformUser
from app.models.collaboration import CollaborationMicrotask
from app.models.sales import Lead, LeadTask, LeadTaskStatus, SalesUser
from app.models.work_tasks import WorkTask, WorkTaskStatus
from app.services.work_task_migration import (
    run_work_task_data_migration,
    revert_work_task_data_migration,
)


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _fk_on(dbapi_connection, _connection_record) -> None:  # noqa: ANN001
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS work_task_migration_map (
                  source_kind VARCHAR(40) NOT NULL,
                  source_id INTEGER NOT NULL,
                  work_task_id INTEGER NOT NULL,
                  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                  PRIMARY KEY (source_kind, source_id),
                  UNIQUE (work_task_id),
                  FOREIGN KEY (work_task_id) REFERENCES work_tasks(id) ON DELETE CASCADE
                )
                """
            )
        )
    return sessionmaker(bind=engine, expire_on_commit=False)


def _seed(db: Session) -> tuple[int, int, int]:
    sales = SalesUser(id=1, name="Мария")
    db.add(sales)
    db.flush()
    owner = PlatformUser(
        login="owner",
        password_hash="x",
        display_name="Owner",
        sales_user_id=1,
    )
    executor = PlatformUser(
        login="exec",
        password_hash="x",
        display_name="Executor",
        sales_user_id=None,
    )
    db.add(owner)
    db.add(executor)
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
    )
    db.add(lead)
    db.flush()

    lead_task = LeadTask(
        lead_id=lead.id,
        title="Позвонить клиенту",
        status=LeadTaskStatus.COMPLETED,
        assigned_to_id=1,
        created_by_id=1,
        due_at=datetime(2026, 8, 1, 12, 0, tzinfo=UTC),
        completed_at=datetime(2026, 8, 2, 9, 0, tzinfo=UTC),
    )
    db.add(lead_task)
    db.flush()

    micro = CollaborationMicrotask(
        lead_id=lead.id,
        sales_order_id=None,
        title="Проверить макет",
        status="open",
        assignee_platform_user_id=executor.id,
        created_by_platform_user_id=owner.id,
    )
    db.add(micro)
    db.commit()
    return lead.id, lead_task.id, micro.id


def test_work_task_data_migration_maps_lead_task_and_microtask() -> None:
    SessionLocal = _session_factory()
    db = SessionLocal()
    try:
        lead_id, lead_task_id, micro_id = _seed(db)
        counts = run_work_task_data_migration(db)
        db.commit()
        assert counts == {"lead_tasks": 1, "collaboration_microtasks": 1}

        tasks = db.query(WorkTask).order_by(WorkTask.id).all()
        assert len(tasks) == 2

        lead_mapped = next(t for t in tasks if t.title == "Позвонить клиенту")
        assert lead_mapped.lead_id == lead_id
        assert lead_mapped.sales_order_id is None
        assert lead_mapped.status == WorkTaskStatus.DONE.value
        assert lead_mapped.executor_platform_user_id is not None
        assert lead_mapped.responsible_platform_user_id is not None

        micro_mapped = next(t for t in tasks if t.title == "Проверить макет")
        assert micro_mapped.lead_id == lead_id
        assert micro_mapped.status == WorkTaskStatus.OPEN.value

        # Idempotent
        again = run_work_task_data_migration(db)
        db.commit()
        assert again == {"lead_tasks": 0, "collaboration_microtasks": 0}
        assert db.query(WorkTask).count() == 2

        # Sources remain
        assert db.get(LeadTask, lead_task_id) is not None
        assert db.get(CollaborationMicrotask, micro_id) is not None

        deleted = revert_work_task_data_migration(db)
        db.commit()
        assert deleted == 2
        assert db.query(WorkTask).count() == 0
    finally:
        db.close()


def test_lead_task_without_platform_user_link_still_migrates() -> None:
    SessionLocal = _session_factory()
    db = SessionLocal()
    try:
        sales = SalesUser(id=2, name="Orphan")
        db.add(sales)
        db.flush()
        lead = Lead(
            contact_name="Пётр",
            company_name="СК",
            phone="+79990000001",
            email="b@example.com",
            city="Москва",
            source="website",
            responsible_id=2,
            sport="Хоккей",
            product_category="Форма",
            need_description="Форма",
        )
        db.add(lead)
        db.flush()
        db.add(
            LeadTask(
                lead_id=lead.id,
                title="Без platform user",
                status=LeadTaskStatus.OPEN,
                assigned_to_id=2,
                created_by_id=2,
            )
        )
        db.commit()

        counts = run_work_task_data_migration(db)
        db.commit()
        assert counts["lead_tasks"] == 1
        task = db.query(WorkTask).one()
        assert task.executor_platform_user_id is None
        assert task.responsible_platform_user_id is None
        assert task.status == WorkTaskStatus.OPEN.value
    finally:
        db.close()
