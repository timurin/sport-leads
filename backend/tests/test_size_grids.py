from decimal import Decimal  # noqa: F401 — kept unused for older test imports

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.services.size_grids_seed import (
    MOSMADE_MEN_GRID_NAME,
    MOSMADE_MEN_ROW_46_S,
    MOSMADE_MEN_ROWS,
    MOSMADE_WOMEN_GRID_NAME,
    MOSMADE_WOMEN_ROWS,
    seed_mosmade_reference_grids,
)


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_mosmade_men_and_women_grids_seed_and_read_api() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as db:
            men, women = seed_mosmade_reference_grids(db)
            db.commit()
            men_id, women_id = men.id, women.id
            # Idempotent re-seed keeps counts stable.
            seed_mosmade_reference_grids(db)
            db.commit()
            assert len(men.rows) == len(MOSMADE_MEN_ROWS)
            assert len(women.rows) == len(MOSMADE_WOMEN_ROWS)

        with TestClient(app) as client:
            listed = client.get("/size-grids")
            assert listed.status_code == 200, listed.text
            items = listed.json()
            assert len(items) == 2
            by_name = {item["name"]: item for item in items}
            assert by_name[MOSMADE_MEN_GRID_NAME]["row_count"] == len(MOSMADE_MEN_ROWS)
            assert by_name[MOSMADE_WOMEN_GRID_NAME]["row_count"] == len(MOSMADE_WOMEN_ROWS)

            men_only = client.get("/size-grids", params={"size_type": "men"})
            assert men_only.status_code == 200
            assert len(men_only.json()) == 1

            women_only = client.get("/size-grids", params={"size_type": "women"})
            assert women_only.status_code == 200
            assert len(women_only.json()) == 1

            men_detail = client.get(f"/size-grids/{men_id}")
            assert men_detail.status_code == 200, men_detail.text
            men_body = men_detail.json()
            assert len(men_body["rows"]) == len(MOSMADE_MEN_ROWS)
            row_46 = next(
                row
                for row in men_body["rows"]
                if row["ru_size"] == "46" and row["int_label"] == "S"
            )
            assert row_46["chest"] == MOSMADE_MEN_ROW_46_S["chest"]
            assert row_46["waist"] == MOSMADE_MEN_ROW_46_S["waist"]
            assert row_46["hip"] == MOSMADE_MEN_ROW_46_S["hip"]
            assert row_46["height_s"] == MOSMADE_MEN_ROW_46_S["height_s"]

            women_detail = client.get(f"/size-grids/{women_id}")
            assert women_detail.status_code == 200, women_detail.text
            assert len(women_detail.json()["rows"]) == len(MOSMADE_WOMEN_ROWS)

            missing = client.get("/size-grids/99999")
            assert missing.status_code == 404
    finally:
        app.dependency_overrides.clear()
