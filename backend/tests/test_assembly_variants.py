from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
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


def test_assembly_variants_ordering_totals_and_inactive_filter() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            model = client.post(
                "/product-models",
                json={
                    "article": "AV-213",
                    "name": "Футболка 213",
                    "size_type": "men",
                },
            )
            assert model.status_code == 201, model.text
            model_id = model.json()["id"]

            other = client.post(
                "/product-models",
                json={
                    "article": "AV-OTHER",
                    "name": "Другая модель",
                    "size_type": "women",
                },
            )
            assert other.status_code == 201, other.text
            other_id = other.json()["id"]

            created = client.post(
                f"/product-models/{model_id}/assembly-variants",
                json={
                    "name": " С отстрочкой ",
                    "operation_lines": [
                        {"operation_name": " Базовая сборка ", "cost": "100.00"},
                        {"operation_name": "Отстрочка", "cost": "50.50", "sequence": 2},
                    ],
                },
            )
            assert created.status_code == 201, created.text
            body = created.json()
            assert body["name"] == "С отстрочкой"
            assert Decimal(body["total_cost"]) == Decimal("150.50")
            assert [line["sequence"] for line in body["operation_lines"]] == [1, 2]
            assert body["operation_lines"][0]["operation_name"] == "Базовая сборка"
            variant_id = body["id"]

            second = client.post(
                f"/product-models/{model_id}/assembly-variants",
                json={"name": "Без отстрочки", "operation_lines": []},
            )
            assert second.status_code == 201, second.text
            second_id = second.json()["id"]
            assert Decimal(second.json()["total_cost"]) == Decimal("0")

            duplicate = client.post(
                f"/product-models/{model_id}/assembly-variants",
                json={"name": "С отстрочкой"},
            )
            assert duplicate.status_code == 409

            foreign = client.get(
                f"/product-models/{other_id}/assembly-variants/{variant_id}"
            )
            assert foreign.status_code == 404

            reordered = client.post(
                f"/product-models/{model_id}/assembly-variants/reorder",
                json={"assembly_variant_ids": [second_id, variant_id]},
            )
            assert reordered.status_code == 200, reordered.text
            assert [row["id"] for row in reordered.json()] == [second_id, variant_id]

            added = client.post(
                f"/product-models/{model_id}/assembly-variants/{variant_id}/operation-lines",
                json={"operation_name": "Контроль", "cost": "10"},
            )
            assert added.status_code == 201, added.text
            assert Decimal(added.json()["total_cost"]) == Decimal("160.50")
            lines = added.json()["operation_lines"]
            assert [line["sequence"] for line in lines] == [1, 2, 3]
            line_ids = [line["id"] for line in lines]

            line_reorder = client.post(
                f"/product-models/{model_id}/assembly-variants/{variant_id}/operation-lines/reorder",
                json={"operation_line_ids": [line_ids[2], line_ids[0], line_ids[1]]},
            )
            assert line_reorder.status_code == 200, line_reorder.text
            assert [line["id"] for line in line_reorder.json()["operation_lines"]] == [
                line_ids[2],
                line_ids[0],
                line_ids[1],
            ]
            assert [line["sequence"] for line in line_reorder.json()["operation_lines"]] == [
                1,
                2,
                3,
            ]
            assert Decimal(line_reorder.json()["total_cost"]) == Decimal("160.50")

            deactivated = client.patch(
                f"/product-models/{model_id}/assembly-variants/{variant_id}",
                json={"is_active": False},
            )
            assert deactivated.status_code == 200, deactivated.text
            assert deactivated.json()["is_active"] is False

            all_variants = client.get(f"/product-models/{model_id}/assembly-variants")
            assert all_variants.status_code == 200
            assert len(all_variants.json()) == 2

            active_only = client.get(
                f"/product-models/{model_id}/assembly-variants",
                params={"active_only": True},
            )
            assert active_only.status_code == 200
            assert [row["id"] for row in active_only.json()] == [second_id]

            deleted_line = client.delete(
                f"/product-models/{model_id}/assembly-variants/{variant_id}/operation-lines/{line_ids[0]}"
            )
            assert deleted_line.status_code == 200, deleted_line.text
            assert Decimal(deleted_line.json()["total_cost"]) == Decimal("60.50")

            removed = client.delete(
                f"/product-models/{model_id}/assembly-variants/{variant_id}"
            )
            assert removed.status_code == 204
            assert (
                client.get(
                    f"/product-models/{model_id}/assembly-variants/{variant_id}"
                ).status_code
                == 404
            )
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_assembly_variant_from_sewing_operations_catalog() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            model = client.post(
                "/product-models",
                json={"article": "AV-SEW", "name": "Модель", "size_type": "men"},
            )
            assert model.status_code == 201, model.text
            model_id = model.json()["id"]

            op_a = client.post(
                "/sewing-operations",
                json={"name": "Базовая сборка", "cost": "100.00", "duration_seconds": 60},
            )
            assert op_a.status_code == 201, op_a.text
            op_b = client.post(
                "/sewing-operations",
                json={"name": "Отстрочка", "cost": "50.50", "duration_seconds": 30},
            )
            assert op_b.status_code == 201, op_b.text
            id_a = op_a.json()["id"]
            id_b = op_b.json()["id"]

            created = client.post(
                f"/product-models/{model_id}/assembly-variants",
                json={
                    "name": "С отстрочкой",
                    "sewing_operation_ids": [id_a, id_b],
                },
            )
            assert created.status_code == 201, created.text
            body = created.json()
            assert Decimal(body["total_cost"]) == Decimal("150.50")
            assert [line["operation_name"] for line in body["operation_lines"]] == [
                "Базовая сборка",
                "Отстрочка",
            ]
            assert [line["duration_seconds"] for line in body["operation_lines"]] == [
                60,
                30,
            ]
            assert [line["sewing_operation_id"] for line in body["operation_lines"]] == [
                id_a,
                id_b,
            ]
            variant_id = body["id"]

            missing = client.post(
                f"/product-models/{model_id}/assembly-variants",
                json={"name": "Bad", "sewing_operation_ids": [999999]},
            )
            assert missing.status_code == 422

            op_c = client.post(
                "/sewing-operations",
                json={"name": "Контроль", "cost": "10.00"},
            )
            assert op_c.status_code == 201, op_c.text
            id_c = op_c.json()["id"]

            appended = client.post(
                f"/product-models/{model_id}/assembly-variants/{variant_id}/sewing-operations",
                json={"sewing_operation_ids": [id_b, id_c]},
            )
            assert appended.status_code == 200, appended.text
            assert Decimal(appended.json()["total_cost"]) == Decimal("160.50")
            assert len(appended.json()["operation_lines"]) == 3

            copied = client.post(
                f"/product-models/{model_id}/assembly-variants/{variant_id}/copy"
            )
            assert copied.status_code == 201, copied.text
            assert copied.json()["name"] == "С отстрочкой (копия)"
            assert copied.json()["is_active"] is True
            assert Decimal(copied.json()["total_cost"]) == Decimal("160.50")
            assert len(copied.json()["operation_lines"]) == 3

            archived = client.patch(
                f"/product-models/{model_id}/assembly-variants/{variant_id}",
                json={"is_active": False},
            )
            assert archived.status_code == 200, archived.text
            assert archived.json()["is_active"] is False
            active_only = client.get(
                f"/product-models/{model_id}/assembly-variants",
                params={"active_only": True},
            )
            assert all(row["is_active"] for row in active_only.json())
            assert variant_id not in [row["id"] for row in active_only.json()]
    finally:
        app.dependency_overrides.pop(get_db, None)
