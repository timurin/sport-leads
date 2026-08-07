"""Stage 23.1.1 — WorkTask models + XOR anchor CHECK (ADR-028)."""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.models.auth import PlatformUser
from app.models.sales import Lead, SalesUser
from app.models.work_tasks import WorkTask, WorkTaskStatus


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
    )
    db.add(lead)
    db.flush()
    return lead.id


def test_work_task_accepts_lead_anchor_only() -> None:
    SessionLocal = _session_factory()
    db = SessionLocal()
    try:
        lead_id = _seed_lead(db)
        user = PlatformUser(login="owner", password_hash="x", display_name="Owner")
        db.add(user)
        db.flush()
        task = WorkTask(
            title="Правка макета",
            status=WorkTaskStatus.OPEN,
            lead_id=lead_id,
            responsible_platform_user_id=user.id,
            executor_platform_user_id=user.id,
        )
        db.add(task)
        db.commit()
        assert task.id is not None
        assert task.sales_order_id is None
        assert task.production_order_id is None
        assert task.status == WorkTaskStatus.OPEN
    finally:
        db.close()


def test_work_task_rejects_dual_anchor() -> None:
    SessionLocal = _session_factory()
    db = SessionLocal()
    try:
        lead_id = _seed_lead(db)
        # Force dual anchors via raw SQL if ORM validation is absent —
        # CHECK must reject at DB level.
        with pytest.raises(IntegrityError):
            db.execute(
                text(
                    "INSERT INTO work_tasks "
                    "(title, status, lead_id, sales_order_id, production_order_id) "
                    "VALUES ('bad', 'open', :lead_id, 1, NULL)"
                ),
                {"lead_id": lead_id},
            )
            db.commit()
        db.rollback()
    finally:
        db.close()


def test_work_task_rejects_no_anchor() -> None:
    SessionLocal = _session_factory()
    db = SessionLocal()
    try:
        with pytest.raises(IntegrityError):
            db.execute(
                text(
                    "INSERT INTO work_tasks "
                    "(title, status, lead_id, sales_order_id, production_order_id) "
                    "VALUES ('orphan', 'open', NULL, NULL, NULL)"
                )
            )
            db.commit()
        db.rollback()
    finally:
        db.close()
