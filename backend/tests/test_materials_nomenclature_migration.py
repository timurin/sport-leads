"""Regression for materials → nomenclature cutover (4.6.2) and API removal (4.6.4).

Data cutover: Alembic `z6a7b8c9d012`.
Table drop: Alembic `a1b2c3d4e567`.
"""

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_materials_api_is_removed() -> None:
    with TestClient(app) as client:
        listed = client.get("/materials")
        assert listed.status_code == 404

        created = client.post(
            "/materials",
            json={
                "name": "Ткань",
                "article": "MAT-GONE-1",
                "category": "Ткань",
                "unit": "м",
                "balance": 0,
                "minimum_balance": 0,
            },
        )
        assert created.status_code == 404

        patched = client.patch("/materials/1", json={"name": "X"})
        assert patched.status_code == 404

        deleted = client.delete("/materials/1")
        assert deleted.status_code == 404


def test_material_type_nomenclature_create_without_stock_fields() -> None:
    """Canonical write path after cutover: MATERIAL via /nomenclatures only."""
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            created = client.post(
                "/nomenclatures",
                json={
                    "name": "Ложная сетка 135 г/м²",
                    "category": "Ткань",
                    "unit": "м",
                    "nomenclature_type": "MATERIAL",
                    "description": "Из materials cutover",
                },
            )
            assert created.status_code == 201, created.text
            body = created.json()
            assert body["name"] == "Ложная сетка 135 г/м²"
            assert body["nomenclature_type"] == "MATERIAL"
            assert "balance" not in body
            assert "warehouse" not in body
            assert float(body["base_price"]) == 0.0

            listed = client.get(
                "/nomenclatures",
                params={"search": "Ложная сетка"},
            )
            assert listed.status_code == 200
            assert listed.json()[0]["id"] == body["id"]
    finally:
        app.dependency_overrides.clear()


def test_cutover_sql_inserts_material_and_skips_existing_article() -> None:
    """Mirrors Alembic z6a7b8c9d012 field mapping on SQLite."""
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE materials (
                    id INTEGER PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    article VARCHAR(100) NOT NULL UNIQUE,
                    category VARCHAR(100) NOT NULL,
                    unit VARCHAR(30) NOT NULL,
                    balance NUMERIC(14,3) NOT NULL DEFAULT 0,
                    minimum_balance NUMERIC(14,3) NOT NULL DEFAULT 0,
                    warehouse VARCHAR(255),
                    description TEXT,
                    is_active BOOLEAN NOT NULL DEFAULT 1
                )
                """
            )
        )
        conn.execute(
            text(
                """
                CREATE TABLE nomenclatures (
                    id INTEGER PRIMARY KEY,
                    article VARCHAR(100) NOT NULL UNIQUE,
                    name VARCHAR(255) NOT NULL,
                    short_name VARCHAR(100),
                    description TEXT,
                    category VARCHAR(100) NOT NULL,
                    category_id INTEGER,
                    nomenclature_type VARCHAR(20) NOT NULL,
                    unit VARCHAR(30) NOT NULL,
                    storage_unit_id INTEGER,
                    base_price NUMERIC(14,2) NOT NULL DEFAULT 0,
                    currency VARCHAR(3) NOT NULL DEFAULT 'RUB',
                    is_active BOOLEAN NOT NULL DEFAULT 1
                )
                """
            )
        )
        conn.execute(
            text(
                """
                INSERT INTO materials (
                    id, name, article, category, unit, balance, minimum_balance,
                    warehouse, description, is_active
                ) VALUES (
                    1, 'Сетка', 'FAB-NEW', 'Ткань', 'м', 860, 200,
                    'Основной', 'desc', 1
                )
                """
            )
        )
        conn.execute(
            text(
                """
                INSERT INTO nomenclatures (
                    id, article, name, category, nomenclature_type, unit,
                    base_price, currency, is_active
                ) VALUES (
                    10, 'FAB-EXIST', 'Уже есть', 'Прочее', 'GOODS', 'шт',
                    10, 'RUB', 1
                )
                """
            )
        )
        conn.execute(
            text(
                """
                INSERT INTO materials (
                    id, name, article, category, unit, balance, minimum_balance, is_active
                ) VALUES (
                    2, 'Дубль', 'FAB-EXIST', 'Ткань', 'м', 1, 0, 1
                )
                """
            )
        )

        materials = conn.execute(
            text(
                "SELECT id, name, article, category, unit, description, is_active "
                "FROM materials ORDER BY id"
            )
        ).mappings().all()

        for row in materials:
            article = row["article"].strip()
            existing = conn.execute(
                text(
                    "SELECT id FROM nomenclatures WHERE lower(article) = lower(:a) LIMIT 1"
                ),
                {"a": article},
            ).first()
            if existing is not None:
                continue
            conn.execute(
                text(
                    """
                    INSERT INTO nomenclatures (
                        article, name, description, category, nomenclature_type,
                        unit, base_price, currency, is_active
                    ) VALUES (
                        :article, :name, :description, :category, 'MATERIAL',
                        :unit, 0, 'RUB', :is_active
                    )
                    """
                ),
                {
                    "article": article,
                    "name": row["name"],
                    "description": row["description"],
                    "category": row["category"],
                    "unit": row["unit"],
                    "is_active": row["is_active"],
                },
            )

        created = conn.execute(
            text(
                "SELECT article, nomenclature_type, name, base_price "
                "FROM nomenclatures WHERE article = 'FAB-NEW'"
            )
        ).mappings().one()
        assert created["nomenclature_type"] == "MATERIAL"
        assert created["name"] == "Сетка"
        assert float(created["base_price"]) == 0.0

        existing = conn.execute(
            text(
                "SELECT nomenclature_type, name FROM nomenclatures WHERE article = 'FAB-EXIST'"
            )
        ).mappings().one()
        assert existing["nomenclature_type"] == "GOODS"
        assert existing["name"] == "Уже есть"
