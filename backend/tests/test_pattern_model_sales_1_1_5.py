"""Stage 1.1.5 — pattern-model sales analytics API."""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.characteristics import NomenclatureVariant  # noqa: F401
from app.models.media import NomenclatureMedia  # noqa: F401
from app.models.nomenclature import NomenclatureHistoryEntry  # noqa: F401
from app.models.sales import (
    Client,
    Lead,
    LeadRejectionReason,
    LeadStatus,
    SalesOrder,
    SalesOrderItem,
    SalesOrderStatus,
    SalesUser,
)
from app.models.sales_commercial import SalesInvoice, SalesQuotation  # noqa: F401


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
        db.add(SalesUser(id=1, name="Test user"))
        db.add(
            LeadRejectionReason(
                id=1, code="no_budget", name="Нет бюджета", category="Клиент"
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


def _seed_orders(db: Session) -> None:
    client_row = Client(company_name="ООО Тест", contact_name="Иван")
    db.add(client_row)
    db.flush()

    def add_order(
        *,
        number: str,
        status: SalesOrderStatus,
        created: datetime,
        article: str,
        qty: Decimal,
        line_amount: Decimal,
        sewing: Decimal | None,
    ) -> None:
        lead = Lead(
            contact_name=f"Lead {number}",
            status=LeadStatus.NEW,
            responsible_id=1,
        )
        db.add(lead)
        db.flush()
        order = SalesOrder(
            number=number,
            lead_id=lead.id,
            client_id=client_row.id,
            status=status,
            title=f"Order {number}",
            amount=line_amount,
            created_at=created,
            updated_at=created,
        )
        db.add(order)
        db.flush()
        db.add(
            SalesOrderItem(
                order_id=order.id,
                snapshot_name=article,
                product_model_id=10 if article == "PM-TOP" else 11,
                product_model_article=article,
                product_model_name=f"Model {article}",
                assembly_variant_total_cost=sewing,
                quantity=qty,
                unit_price=line_amount / qty,
                discount_amount=Decimal("0"),
                line_amount=line_amount,
                vat_amount=Decimal("0"),
            )
        )

    add_order(
        number="SO-A",
        status=SalesOrderStatus.COMPLETED,
        created=datetime(2026, 7, 10, tzinfo=timezone.utc),
        article="PM-TOP",
        qty=Decimal("10"),
        line_amount=Decimal("10000"),
        sewing=Decimal("50"),
    )
    add_order(
        number="SO-B",
        status=SalesOrderStatus.PRODUCTION,
        created=datetime(2026, 7, 12, tzinfo=timezone.utc),
        article="PM-TOP",
        qty=Decimal("5"),
        line_amount=Decimal("5000"),
        sewing=Decimal("50"),
    )
    add_order(
        number="SO-C",
        status=SalesOrderStatus.READY,
        created=datetime(2026, 7, 15, tzinfo=timezone.utc),
        article="PM-OTHER",
        qty=Decimal("3"),
        line_amount=Decimal("3000"),
        sewing=None,
    )
    add_order(
        number="SO-X",
        status=SalesOrderStatus.CANCELLED,
        created=datetime(2026, 7, 11, tzinfo=timezone.utc),
        article="PM-TOP",
        qty=Decimal("100"),
        line_amount=Decimal("99999"),
        sewing=Decimal("1"),
    )
    db.commit()


def test_pattern_model_sales_rollup(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    with session_factory() as db:
        _seed_orders(db)

    response = client.get(
        "/analytics/pattern-model-sales",
        params={
            "date_from": "2026-07-01",
            "date_to": "2026-07-31",
            "limit": 10,
        },
    )
    assert response.status_code == 200, response.text
    items = response.json()["items"]
    assert len(items) == 2
    top = items[0]
    assert top["product_model_article"] == "PM-TOP"
    assert top["order_count"] == 2
    assert float(top["units_ordered"]) == 15
    # completed(10) + production(0) → manufactured 10
    assert float(top["units_manufactured"]) == 10
    assert float(top["order_amount"]) == 15000
    assert float(top["sewing_cost_amount"]) == 750  # 50*10 + 50*5


def test_pattern_model_sales_article_filter(
    client: TestClient, session_factory: sessionmaker[Session]
) -> None:
    with session_factory() as db:
        _seed_orders(db)

    response = client.get(
        "/analytics/pattern-model-sales",
        params={"article": "other", "date_from": "2026-07-01", "date_to": "2026-07-31"},
    )
    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 1
    assert items[0]["product_model_article"] == "PM-OTHER"
    assert float(items[0]["units_manufactured"]) == 3
