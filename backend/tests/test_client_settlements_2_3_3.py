"""Stage 2.3.3 — client settlements summary from order payment markers."""

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.sales import Client, SalesOrder, SalesOrderStatus, SalesUser


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def _money(value: object) -> Decimal:
    return Decimal(str(value))


def test_settlements_summary_projects_order_markers_not_cancelled() -> None:
    factory = _session_factory()
    with factory() as db:
        db.add(SalesUser(id=1, name="Мария"))
        client = Client(contact_name="Иван", company_name="СК Олимп", responsible_id=1)
        empty = Client(contact_name="Анна", responsible_id=1)
        other = Client(contact_name="Чужой", responsible_id=1)
        db.add_all([client, empty, other])
        db.flush()
        db.add_all(
            [
                SalesOrder(
                    number="SO-OPEN",
                    client_id=client.id,
                    status=SalesOrderStatus.CONFIRMED,
                    title="Открытый",
                    amount=Decimal("10000.00"),
                    paid_amount=Decimal("3000.00"),
                    responsible_id=1,
                ),
                SalesOrder(
                    number="SO-DONE",
                    client_id=client.id,
                    status=SalesOrderStatus.COMPLETED,
                    title="Закрытый",
                    amount=Decimal("5000.00"),
                    paid_amount=Decimal("5000.00"),
                    responsible_id=1,
                ),
                SalesOrder(
                    number="SO-CANCEL",
                    client_id=client.id,
                    status=SalesOrderStatus.CANCELLED,
                    title="Отмена",
                    amount=Decimal("99999.00"),
                    paid_amount=Decimal("1.00"),
                    responsible_id=1,
                ),
                SalesOrder(
                    number="SO-OVER",
                    client_id=client.id,
                    status=SalesOrderStatus.PRODUCTION,
                    title="Переплата",
                    amount=Decimal("100.00"),
                    paid_amount=Decimal("150.00"),
                    responsible_id=1,
                ),
                SalesOrder(
                    number="SO-NULL",
                    client_id=client.id,
                    status=SalesOrderStatus.NEW,
                    title="Без суммы",
                    amount=None,
                    paid_amount=Decimal("0.00"),
                    responsible_id=1,
                ),
                SalesOrder(
                    number="SO-OTHER",
                    client_id=other.id,
                    status=SalesOrderStatus.NEW,
                    title="Чужой заказ",
                    amount=Decimal("8000.00"),
                    paid_amount=Decimal("0.00"),
                    responsible_id=1,
                ),
            ]
        )
        db.commit()
        client_id = client.id
        empty_id = empty.id

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as api:
            missing = api.get("/clients/999999/settlements-summary")
            assert missing.status_code == 404

            empty_body = api.get(f"/clients/{empty_id}/settlements-summary").json()
            assert empty_body["open_order_count"] == 0
            assert _money(empty_body["receivable"]) == Decimal("0.00")
            assert empty_body["source"] == "sales_order_payment_markers"
            assert empty_body["ledger_stage"] == "14.2"

            body = api.get(f"/clients/{client_id}/settlements-summary").json()
            assert body["currency_code"] == "RUB"
            assert body["open_order_count"] == 3
            assert _money(body["open_order_amount"]) == Decimal("10100.00")
            assert _money(body["receivable"]) == Decimal("7000.00")
            assert _money(body["advance"]) == Decimal("50.00")
            assert _money(body["paid_total"]) == Decimal("8150.00")
            assert body["orders_without_amount_count"] == 1

            listed = api.get("/clients")
            assert listed.status_code == 200
            row = next(item for item in listed.json() if item["id"] == client_id)
            assert "receivable" not in row
            assert "paid_total" not in row
            assert "ledger_stage" not in row
    finally:
        app.dependency_overrides.clear()
