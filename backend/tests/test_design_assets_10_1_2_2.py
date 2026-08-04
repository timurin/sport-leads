"""Stage 10.1.2.2 — DesignVersionAsset / Comment DB persistence (ADR-022)."""

from __future__ import annotations

from decimal import Decimal

from sqlalchemy import create_engine, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.models.design_project import (
    DesignProject,
    DesignVersion,
    DesignVersionAsset,
    DesignVersionAssetKind,
    DesignVersionComment,
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


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_design_version_assets_one_primary "
                "ON design_version_assets (design_version_id) "
                "WHERE is_primary = 1"
            )
        )
    return sessionmaker(bind=engine, expire_on_commit=False)


def _seed_version(db: Session) -> int:
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
        number="SO-DA-1",
        lead_id=lead.id,
        client_id=client.id,
        status=SalesOrderStatus.NEW,
        title="Заказ assets",
        responsible_id=1,
    )
    db.add(order)
    db.flush()
    db.add(
        SalesOrderItem(
            order_id=order.id,
            position=1,
            snapshot_name="Изделие",
            quantity=Decimal("1"),
            unit_price=Decimal("100"),
            line_amount=Decimal("100"),
            discount_amount=Decimal("0"),
            unit="шт",
        )
    )
    project = DesignProject(
        sales_order_id=order.id,
        number="DP-SO-DA-1-1",
        project_seq=1,
    )
    db.add(project)
    db.flush()
    version = DesignVersion(
        design_project_id=project.id,
        version_no=1,
        label="v1",
        status=DesignVersionStatus.CURRENT.value,
    )
    db.add(version)
    db.commit()
    return version.id


def test_asset_and_comment_persist_on_version() -> None:
    SessionLocal = _session_factory()
    with SessionLocal() as db:
        version_id = _seed_version(db)
        asset = DesignVersionAsset(
            design_version_id=version_id,
            kind=DesignVersionAssetKind.LAYOUT.value,
            filename="mockup.png",
            storage_key="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
            mime_type="image/png",
            file_size=1024,
            sort_order=0,
            is_primary=True,
        )
        comment = DesignVersionComment(
            design_version_id=version_id,
            body="Уточнить цвет воротника",
            author_name="Дизайнер",
        )
        db.add_all([asset, comment])
        db.commit()

        version = db.scalars(
            select(DesignVersion).where(DesignVersion.id == version_id)
        ).one()
        assert len(version.assets) == 1
        assert version.assets[0].kind == "layout"
        assert version.assets[0].is_primary is True
        assert len(version.comments) == 1
        assert "воротника" in version.comments[0].body


def test_one_primary_asset_per_version() -> None:
    SessionLocal = _session_factory()
    with SessionLocal() as db:
        version_id = _seed_version(db)
        db.add(
            DesignVersionAsset(
                design_version_id=version_id,
                kind=DesignVersionAssetKind.LAYOUT.value,
                filename="a.png",
                storage_key="key-a",
                mime_type="image/png",
                file_size=10,
                is_primary=True,
            )
        )
        db.commit()
        db.add(
            DesignVersionAsset(
                design_version_id=version_id,
                kind=DesignVersionAssetKind.LOGO.value,
                filename="b.png",
                storage_key="key-b",
                mime_type="image/png",
                file_size=20,
                is_primary=True,
            )
        )
        try:
            db.commit()
            raise AssertionError("expected IntegrityError on second primary")
        except IntegrityError:
            db.rollback()


def test_storage_key_unique() -> None:
    SessionLocal = _session_factory()
    with SessionLocal() as db:
        version_id = _seed_version(db)
        db.add(
            DesignVersionAsset(
                design_version_id=version_id,
                kind=DesignVersionAssetKind.OTHER.value,
                filename="a.pdf",
                storage_key="same-key",
                mime_type="application/pdf",
                file_size=100,
            )
        )
        db.commit()
        db.add(
            DesignVersionAsset(
                design_version_id=version_id,
                kind=DesignVersionAssetKind.OTHER.value,
                filename="b.pdf",
                storage_key="same-key",
                mime_type="application/pdf",
                file_size=200,
            )
        )
        try:
            db.commit()
            raise AssertionError("expected IntegrityError on duplicate storage_key")
        except IntegrityError:
            db.rollback()
