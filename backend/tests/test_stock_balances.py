from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.sales import SalesUser


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as db:
        db.add(SalesUser(id=1, name="Test user"))
        db.commit()
    return factory


def test_list_stock_balances_empty_until_register_posts() -> None:
    """4.10.6 / 4.6.5: no fake demo balances — empty list → UI shows zero."""
    factory = _session_factory()

    def override_get_db():
        db = factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        client = TestClient(app)
        response = client.get("/stock/balances")
        assert response.status_code == 200
        assert response.json() == []

        filtered = client.get("/stock/balances", params=[("nomenclature_id", 1)])
        assert filtered.status_code == 200
        assert filtered.json() == []
    finally:
        app.dependency_overrides.clear()
