"""Stage 10.1.1.2 — DesignProject / DesignVersion DB persistence (ADR-021)."""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import create_engine, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.models.design_project import (
    DesignProject,
    DesignProjectStatus,
    DesignVersion,
    DesignVersionStatus,
)
from app.models.sales import (
    Client,
    Lead,
    LeadTask,
    SalesOrder,
    SalesOrderItem,
    SalesOrderStatus,
    SalesUser,
)
from app.models.technical_card import TechnicalCard, TechnicalCardStatus


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    # Mirror Alembic partial unique index (≤1 current per project).
    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_design_versions_one_current "
                "ON design_versions (design_project_id) "
                "WHERE status = 'current'"
            )
        )
    return sessionmaker(bind=engine, expire_on_commit=False)


def _seed_order_and_card(db: Session) -> tuple[int, int, int]:
    db.add(SalesUser(id=1, name="Test"))
    client = Client(contact_name="A", company_name="B", responsible_id=1)
    db.add(client)
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
    db.add(LeadTask(lead_id=lead.id, title="Задача"))
    order = SalesOrder(
        number="SO-DP-1",
        lead_id=lead.id,
        client_id=client.id,
        status=SalesOrderStatus.NEW,
        title="Заказ для DP",
        responsible_id=1,
    )
    db.add(order)
    db.flush()
    item = SalesOrderItem(
        order_id=order.id,
        position=1,
        snapshot_name="Изделие",
        quantity=Decimal("1"),
        unit_price=Decimal("100"),
        line_amount=Decimal("100"),
        discount_amount=Decimal("0"),
        unit="шт",
    )
    db.add(item)
    db.flush()
    card = TechnicalCard(
        sales_order_id=order.id,
        sales_order_item_id=item.id,
        number="SO-DP-1-01",
        card_seq=1,
        status=TechnicalCardStatus.DRAFT,
        quantity=Decimal("1"),
        nomenclature_name="Изделие",
    )
    db.add(card)
    db.flush()
    return order.id, item.id, card.id


def test_design_project_and_version_persist_with_fks() -> None:
    SessionLocal = _session_factory()
    with SessionLocal() as db:
        order_id, item_id, card_id = _seed_order_and_card(db)
        project = DesignProject(
            sales_order_id=order_id,
            number="DP-SO-DP-1-1",
            project_seq=1,
            status=DesignProjectStatus.DRAFT.value,
            title="Макет формы",
        )
        db.add(project)
        db.flush()
        version = DesignVersion(
            design_project_id=project.id,
            version_no=1,
            label="v1",
            status=DesignVersionStatus.CURRENT.value,
            sales_order_item_id=item_id,
            technical_card_id=card_id,
            notes="Первая версия",
        )
        db.add(version)
        db.commit()

        loaded = db.scalars(
            select(DesignProject).where(DesignProject.id == project.id)
        ).one()
        assert loaded.number == "DP-SO-DP-1-1"
        assert loaded.sales_order_id == order_id
        assert len(loaded.versions) == 1
        assert loaded.versions[0].label == "v1"
        assert loaded.versions[0].status == DesignVersionStatus.CURRENT.value
        assert loaded.versions[0].sales_order_item_id == item_id
        assert loaded.versions[0].technical_card_id == card_id


def test_design_project_seq_unique_per_order() -> None:
    SessionLocal = _session_factory()
    with SessionLocal() as db:
        order_id, _, _ = _seed_order_and_card(db)
        db.add(
            DesignProject(
                sales_order_id=order_id,
                number="DP-SO-DP-1-1",
                project_seq=1,
            )
        )
        db.commit()
        db.add(
            DesignProject(
                sales_order_id=order_id,
                number="DP-SO-DP-1-2",
                project_seq=1,
            )
        )
        try:
            db.commit()
            raise AssertionError("expected IntegrityError on duplicate project_seq")
        except IntegrityError:
            db.rollback()


def test_one_current_version_per_project() -> None:
    SessionLocal = _session_factory()
    with SessionLocal() as db:
        order_id, _, _ = _seed_order_and_card(db)
        project = DesignProject(
            sales_order_id=order_id,
            number="DP-SO-DP-1-1",
            project_seq=1,
        )
        db.add(project)
        db.flush()
        db.add(
            DesignVersion(
                design_project_id=project.id,
                version_no=1,
                label="v1",
                status=DesignVersionStatus.CURRENT.value,
            )
        )
        db.commit()
        db.add(
            DesignVersion(
                design_project_id=project.id,
                version_no=2,
                label="v2",
                status=DesignVersionStatus.CURRENT.value,
            )
        )
        try:
            db.commit()
            raise AssertionError("expected IntegrityError on second current")
        except IntegrityError:
            db.rollback()


def test_version_no_unique_per_project() -> None:
    SessionLocal = _session_factory()
    with SessionLocal() as db:
        order_id, _, _ = _seed_order_and_card(db)
        project = DesignProject(
            sales_order_id=order_id,
            number="DP-SO-DP-1-1",
            project_seq=1,
        )
        db.add(project)
        db.flush()
        db.add(
            DesignVersion(
                design_project_id=project.id,
                version_no=1,
                label="v1",
                status=DesignVersionStatus.DRAFT.value,
            )
        )
        db.commit()
        db.add(
            DesignVersion(
                design_project_id=project.id,
                version_no=1,
                label="v1-dup",
                status=DesignVersionStatus.DRAFT.value,
            )
        )
        try:
            db.commit()
            raise AssertionError("expected IntegrityError on duplicate version_no")
        except IntegrityError:
            db.rollback()
