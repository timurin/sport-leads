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


def test_tech_operations_crud_and_seed_shape() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            created = client.post(
                "/tech-operations",
                json={
                    "name": " Сублимация тест ",
                    "code": " sub_test ",
                    "volume_unit": "linear_meters",
                    "sort_order": 5,
                },
            )
            assert created.status_code == 201, created.text
            body = created.json()
            assert body["name"] == "Сублимация тест"
            assert body["code"] == "sub_test"
            assert body["volume_unit"] == "linear_meters"
            operation_id = body["id"]

            duplicate = client.post(
                "/tech-operations",
                json={
                    "name": "Сублимация тест",
                    "code": "other",
                    "volume_unit": "pieces",
                },
            )
            assert duplicate.status_code == 409

            listed = client.get("/tech-operations")
            assert listed.status_code == 200
            assert any(row["id"] == operation_id for row in listed.json())

            patched = client.patch(
                f"/tech-operations/{operation_id}",
                json={"is_active": False},
            )
            assert patched.status_code == 200
            assert patched.json()["is_active"] is False

            bad_unit = client.post(
                "/tech-operations",
                json={
                    "name": "Bad",
                    "code": "bad",
                    "volume_unit": "kg",
                },
            )
            assert bad_unit.status_code == 422

            deleted = client.delete(f"/tech-operations/{operation_id}")
            assert deleted.status_code == 204
    finally:
        app.dependency_overrides.clear()


def test_shop_routing_crud_and_stage_sequencing() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as client:
            print_stage = client.post(
                "/production-stages",
                json={"name": "Печать", "code": "print", "sort_order": 30},
            )
            assert print_stage.status_code == 201, print_stage.text
            print_id = print_stage.json()["id"]
            qc_stage = client.post(
                "/production-stages",
                json={"name": "ОТК", "code": "qc", "sort_order": 60},
            )
            assert qc_stage.status_code == 201
            qc_id = qc_stage.json()["id"]
            cut_stage = client.post(
                "/production-stages",
                json={"name": "Раскрой", "code": "cutting", "sort_order": 20},
            )
            pack_stage = client.post(
                "/production-stages",
                json={"name": "Упаковка", "code": "packaging", "sort_order": 70},
            )
            assert cut_stage.status_code == 201 and pack_stage.status_code == 201
            cut_id = cut_stage.json()["id"]
            pack_id = pack_stage.json()["id"]

            op = client.post(
                "/tech-operations",
                json={
                    "name": "Печать",
                    "code": "print",
                    "volume_unit": "linear_meters",
                    "production_stage_id": print_id,
                },
            )
            assert op.status_code == 201, op.text
            op_id = op.json()["id"]

            wc = client.post(
                "/work-centers",
                json={
                    "name": "Принтер 1",
                    "code": "print_shop",
                    "production_stage_id": print_id,
                },
            )
            assert wc.status_code == 201, wc.text
            wc_id = wc.json()["id"]

            bad_gap = client.post(
                "/shop-routings",
                json={
                    "name": "Bad route",
                    "stages": [
                        {"stage_order": 1, "production_stage_id": print_id},
                        {"stage_order": 3, "production_stage_id": qc_id},
                    ],
                },
            )
            assert bad_gap.status_code == 422

            empty = client.post(
                "/shop-routings",
                json={"name": "Empty", "stages": []},
            )
            assert empty.status_code == 422

            created = client.post(
                "/shop-routings",
                json={
                    "name": " Стандартный маршрут ",
                    "code": " std ",
                    "stages": [
                        {
                            "stage_order": 1,
                            "production_stage_id": print_id,
                            "tech_operation_id": op_id,
                            "work_center_id": wc_id,
                        },
                        {
                            "stage_order": 2,
                            "production_stage_id": qc_id,
                            "is_quality_checkpoint": True,
                        },
                    ],
                },
            )
            assert created.status_code == 201, created.text
            body = created.json()
            assert body["name"] == "Стандартный маршрут"
            assert body["code"] == "std"
            assert len(body["stage_lines"]) == 2
            assert body["stage_lines"][0]["tech_operation_id"] == op_id
            assert body["stage_lines"][0]["production_stage_id"] == print_id
            assert body["stage_lines"][0]["stage_label"] == "Печать"
            assert body["stage_lines"][1]["is_quality_checkpoint"] is True
            template_id = body["id"]

            patched = client.patch(
                f"/shop-routings/{template_id}",
                json={
                    "stages": [
                        {"stage_order": 1, "production_stage_id": cut_id},
                        {
                            "stage_order": 2,
                            "production_stage_id": print_id,
                            "tech_operation_id": op_id,
                        },
                        {"stage_order": 3, "production_stage_id": pack_id},
                    ]
                },
            )
            assert patched.status_code == 200, patched.text
            assert len(patched.json()["stage_lines"]) == 3

            listed = client.get("/shop-routings", params={"search": "std"})
            assert listed.status_code == 200
            assert len(listed.json()) == 1

            deleted = client.delete(f"/shop-routings/{template_id}")
            assert deleted.status_code == 204
    finally:
        app.dependency_overrides.clear()
