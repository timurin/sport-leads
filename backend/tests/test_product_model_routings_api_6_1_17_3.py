"""Stage 6.1.17.3 — API /product-models/{id}/routings (+ norms)."""

from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app
from app.models.production_stage import ProductionStage
from app.models.shop_routing import ShopRoutingTemplate
from app.models.tech_operation import TechOperation
from app.models.technical_card import TechOperationVolumeUnit


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def test_product_model_routings_api() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as seed_db:
            print_stage = ProductionStage(
                name="Печать", code="print", is_active=True, sort_order=30
            )
            seed_db.add(print_stage)
            seed_db.flush()
            op = TechOperation(
                name="Сублимация",
                code="sub",
                volume_unit=TechOperationVolumeUnit.LINEAR_METERS,
                production_stage_id=print_stage.id,
                is_active=True,
                sort_order=10,
            )
            t1 = ShopRoutingTemplate(name="Маршрут A", code="ra", is_active=True)
            t2 = ShopRoutingTemplate(name="Маршрут B", code="rb", is_active=True)
            t3 = ShopRoutingTemplate(name="Маршрут C", code="rc", is_active=True)
            t_off = ShopRoutingTemplate(name="Выкл", code="rx", is_active=False)
            seed_db.add_all([op, t1, t2, t3, t_off])
            seed_db.commit()
            t1_id, t2_id, t3_id, t_off_id = t1.id, t2.id, t3.id, t_off.id
            stage_id, op_id = print_stage.id, op.id

        with TestClient(app) as client:
            model = client.post(
                "/product-models",
                json={
                    "article": "API-RT-1",
                    "name": "Модель API RT",
                    "size_type": "men",
                    "default_routing_template_id": t1_id,
                },
            )
            assert model.status_code == 201, model.text
            model_id = model.json()["id"]
            assert model.json()["default_routing_template_id"] == t1_id

            inactive = client.post(
                f"/product-models/{model_id}/routings",
                json={"shop_routing_template_id": t_off_id},
            )
            assert inactive.status_code == 422, inactive.text

            created_b = client.post(
                f"/product-models/{model_id}/routings",
                json={
                    "shop_routing_template_id": t2_id,
                    "norms": [
                        {
                            "production_stage_id": stage_id,
                            "tech_operation_id": op_id,
                            "norm_qty_per_item": "0.700",
                            "unit": "linear_meters",
                        }
                    ],
                },
            )
            assert created_b.status_code == 201, created_b.text
            link_b = created_b.json()
            assert link_b["shop_routing_template_id"] == t2_id
            assert link_b["shop_routing_template_name"] == "Маршрут B"
            assert len(link_b["operation_norms"]) == 1
            assert Decimal(link_b["operation_norms"][0]["norm_qty_per_item"]) == Decimal(
                "0.700"
            )

            # Default cleared when not in whitelist
            refreshed = client.get(f"/product-models/{model_id}")
            assert refreshed.status_code == 200
            assert refreshed.json()["default_routing_template_id"] is None

            created_a = client.post(
                f"/product-models/{model_id}/routings",
                json={"shop_routing_template_id": t1_id},
            )
            assert created_a.status_code == 201, created_a.text
            link_a_id = created_a.json()["id"]
            link_b_id = link_b["id"]

            # default ∈ whitelist ok
            patch_ok = client.patch(
                f"/product-models/{model_id}",
                json={"default_routing_template_id": t1_id},
            )
            assert patch_ok.status_code == 200, patch_ok.text
            assert patch_ok.json()["default_routing_template_id"] == t1_id

            # default not in whitelist rejected
            patch_bad = client.patch(
                f"/product-models/{model_id}",
                json={"default_routing_template_id": t3_id},
            )
            assert patch_bad.status_code == 422, patch_bad.text

            listed = client.get(f"/product-models/{model_id}/routings")
            assert listed.status_code == 200
            assert len(listed.json()) == 2

            reorder = client.post(
                f"/product-models/{model_id}/routings/reorder",
                json={"routing_link_ids": [link_b_id, link_a_id]},
            )
            assert reorder.status_code == 200, reorder.text
            assert [row["id"] for row in reorder.json()] == [link_b_id, link_a_id]

            norms = client.put(
                f"/product-models/{model_id}/routings/{link_a_id}/norms",
                json={
                    "norms": [
                        {
                            "tech_operation_id": op_id,
                            "norm_qty_per_item": "1.250",
                            "unit": "linear_meters",
                        }
                    ]
                },
            )
            assert norms.status_code == 200, norms.text
            assert len(norms.json()["operation_norms"]) == 1
            assert norms.json()["operation_norms"][0]["production_stage_id"] == stage_id

            deactivate = client.patch(
                f"/product-models/{model_id}/routings/{link_b_id}",
                json={"is_active": False},
            )
            assert deactivate.status_code == 200
            active_only = client.get(
                f"/product-models/{model_id}/routings",
                params={"active_only": True},
            )
            assert active_only.status_code == 200
            assert [row["id"] for row in active_only.json()] == [link_a_id]

            delete_a = client.delete(f"/product-models/{model_id}/routings/{link_a_id}")
            assert delete_a.status_code == 204
            after_delete = client.get(f"/product-models/{model_id}")
            assert after_delete.json()["default_routing_template_id"] is None

            dup = client.post(
                f"/product-models/{model_id}/routings",
                json={"shop_routing_template_id": t2_id},
            )
            assert dup.status_code == 409, dup.text

            missing = client.get(f"/product-models/{model_id}/routings/99999")
            assert missing.status_code == 404
    finally:
        app.dependency_overrides.pop(get_db, None)
