"""Stage 6.1.17.5 — regression: foreign routing, default ∈ whitelist, norm validation."""

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


def _seed(db: Session) -> dict[str, int]:
    cutting = ProductionStage(name="Раскрой", code="cutting", is_active=True, sort_order=20)
    print_stage = ProductionStage(name="Печать", code="print", is_active=True, sort_order=30)
    inactive_stage = ProductionStage(
        name="Старый цех", code="old", is_active=False, sort_order=99
    )
    db.add_all([cutting, print_stage, inactive_stage])
    db.flush()

    sublimation = TechOperation(
        name="Сублимация",
        code="sub",
        volume_unit=TechOperationVolumeUnit.LINEAR_METERS,
        production_stage_id=print_stage.id,
        is_active=True,
        sort_order=10,
    )
    sewing = TechOperation(
        name="Пошив",
        code="sew",
        volume_unit=TechOperationVolumeUnit.PIECES,
        production_stage_id=cutting.id,  # intentionally different цех for mismatch cases
        is_active=True,
        sort_order=20,
    )
    inactive_op = TechOperation(
        name="Архив-оп",
        code="arch",
        volume_unit=TechOperationVolumeUnit.PIECES,
        production_stage_id=print_stage.id,
        is_active=False,
        sort_order=30,
    )
    t1 = ShopRoutingTemplate(name="Маршрут A", code="ra", is_active=True)
    t2 = ShopRoutingTemplate(name="Маршрут B", code="rb", is_active=True)
    t_foreign = ShopRoutingTemplate(name="Чужой пресет", code="rf", is_active=True)
    t_off = ShopRoutingTemplate(name="Выкл", code="rx", is_active=False)
    db.add_all([sublimation, sewing, inactive_op, t1, t2, t_foreign, t_off])
    db.commit()
    return {
        "cutting_id": cutting.id,
        "print_id": print_stage.id,
        "inactive_stage_id": inactive_stage.id,
        "sub_id": sublimation.id,
        "sew_id": sewing.id,
        "inactive_op_id": inactive_op.id,
        "t1_id": t1.id,
        "t2_id": t2.id,
        "t_foreign_id": t_foreign.id,
        "t_off_id": t_off.id,
    }


def test_routings_regression_foreign_default_and_norms() -> None:
    factory = _session_factory()

    def override_get_db():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with factory() as seed_db:
            ids = _seed(seed_db)

        with TestClient(app) as client:
            model_a = client.post(
                "/product-models",
                json={
                    "article": "REG-RT-A",
                    "name": "Модель A",
                    "size_type": "men",
                },
            )
            assert model_a.status_code == 201, model_a.text
            model_a_id = model_a.json()["id"]

            model_b = client.post(
                "/product-models",
                json={
                    "article": "REG-RT-B",
                    "name": "Модель B",
                    "size_type": "women",
                },
            )
            assert model_b.status_code == 201, model_b.text
            model_b_id = model_b.json()["id"]

            # --- Foreign / unknown / inactive routing attach ---
            unknown = client.post(
                f"/product-models/{model_a_id}/routings",
                json={"shop_routing_template_id": 999_999},
            )
            assert unknown.status_code == 422, unknown.text

            inactive = client.post(
                f"/product-models/{model_a_id}/routings",
                json={"shop_routing_template_id": ids["t_off_id"]},
            )
            assert inactive.status_code == 422, inactive.text

            link_a = client.post(
                f"/product-models/{model_a_id}/routings",
                json={"shop_routing_template_id": ids["t1_id"]},
            )
            assert link_a.status_code == 201, link_a.text
            link_a_id = link_a.json()["id"]

            # Model B cannot read/mutate Model A link
            foreign_get = client.get(
                f"/product-models/{model_b_id}/routings/{link_a_id}"
            )
            assert foreign_get.status_code == 404, foreign_get.text

            foreign_norms = client.put(
                f"/product-models/{model_b_id}/routings/{link_a_id}/norms",
                json={
                    "norms": [
                        {
                            "production_stage_id": ids["print_id"],
                            "norm_qty_per_item": "1",
                            "unit": "pieces",
                        }
                    ]
                },
            )
            assert foreign_norms.status_code == 404, foreign_norms.text

            # --- default ∈ whitelist ---
            # Empty whitelist on model B → active default allowed
            set_default_empty = client.patch(
                f"/product-models/{model_b_id}",
                json={"default_routing_template_id": ids["t_foreign_id"]},
            )
            assert set_default_empty.status_code == 200, set_default_empty.text
            assert (
                set_default_empty.json()["default_routing_template_id"]
                == ids["t_foreign_id"]
            )

            # Model A has whitelist {t1} → foreign default rejected
            bad_default = client.patch(
                f"/product-models/{model_a_id}",
                json={"default_routing_template_id": ids["t_foreign_id"]},
            )
            assert bad_default.status_code == 422, bad_default.text

            ok_default = client.patch(
                f"/product-models/{model_a_id}",
                json={"default_routing_template_id": ids["t1_id"]},
            )
            assert ok_default.status_code == 200, ok_default.text
            assert ok_default.json()["default_routing_template_id"] == ids["t1_id"]

            # Add second link then delete default's link → default cleared
            link_a2 = client.post(
                f"/product-models/{model_a_id}/routings",
                json={"shop_routing_template_id": ids["t2_id"]},
            )
            assert link_a2.status_code == 201, link_a2.text
            deleted = client.delete(
                f"/product-models/{model_a_id}/routings/{link_a_id}"
            )
            assert deleted.status_code == 204
            after = client.get(f"/product-models/{model_a_id}")
            assert after.json()["default_routing_template_id"] is None

            # Recreate link for norms on remaining t2
            remaining = client.get(f"/product-models/{model_a_id}/routings")
            assert remaining.status_code == 200
            assert len(remaining.json()) == 1
            link_t2_id = remaining.json()[0]["id"]

            # --- Norm validation ---
            no_bind = client.put(
                f"/product-models/{model_a_id}/routings/{link_t2_id}/norms",
                json={
                    "norms": [
                        {
                            "norm_qty_per_item": "1",
                            "unit": "pieces",
                        }
                    ]
                },
            )
            assert no_bind.status_code == 422, no_bind.text

            unit_mismatch = client.put(
                f"/product-models/{model_a_id}/routings/{link_t2_id}/norms",
                json={
                    "norms": [
                        {
                            "tech_operation_id": ids["sub_id"],
                            "norm_qty_per_item": "0.7",
                            "unit": "pieces",
                        }
                    ]
                },
            )
            assert unit_mismatch.status_code == 422, unit_mismatch.text

            stage_op_mismatch = client.put(
                f"/product-models/{model_a_id}/routings/{link_t2_id}/norms",
                json={
                    "norms": [
                        {
                            "production_stage_id": ids["print_id"],
                            "tech_operation_id": ids["sew_id"],
                            "norm_qty_per_item": "1",
                            "unit": "pieces",
                        }
                    ]
                },
            )
            assert stage_op_mismatch.status_code == 422, stage_op_mismatch.text

            inactive_stage = client.put(
                f"/product-models/{model_a_id}/routings/{link_t2_id}/norms",
                json={
                    "norms": [
                        {
                            "production_stage_id": ids["inactive_stage_id"],
                            "norm_qty_per_item": "1",
                            "unit": "pieces",
                        }
                    ]
                },
            )
            assert inactive_stage.status_code == 422, inactive_stage.text

            inactive_op = client.put(
                f"/product-models/{model_a_id}/routings/{link_t2_id}/norms",
                json={
                    "norms": [
                        {
                            "tech_operation_id": ids["inactive_op_id"],
                            "norm_qty_per_item": "1",
                            "unit": "pieces",
                        }
                    ]
                },
            )
            assert inactive_op.status_code == 422, inactive_op.text

            dup_bind = client.put(
                f"/product-models/{model_a_id}/routings/{link_t2_id}/norms",
                json={
                    "norms": [
                        {
                            "production_stage_id": ids["print_id"],
                            "tech_operation_id": ids["sub_id"],
                            "norm_qty_per_item": "0.5",
                            "unit": "linear_meters",
                        },
                        {
                            "production_stage_id": ids["print_id"],
                            "tech_operation_id": ids["sub_id"],
                            "norm_qty_per_item": "0.6",
                            "unit": "linear_meters",
                        },
                    ]
                },
            )
            assert dup_bind.status_code == 422, dup_bind.text

            ok_norms = client.put(
                f"/product-models/{model_a_id}/routings/{link_t2_id}/norms",
                json={
                    "norms": [
                        {
                            "tech_operation_id": ids["sub_id"],
                            "norm_qty_per_item": "0.700",
                            "unit": "linear_meters",
                        },
                        {
                            "production_stage_id": ids["cutting_id"],
                            "norm_qty_per_item": "0",
                            "unit": "pieces",
                        },
                    ]
                },
            )
            assert ok_norms.status_code == 200, ok_norms.text
            body = ok_norms.json()
            assert len(body["operation_norms"]) == 2
            qty = Decimal(body["operation_norms"][0]["norm_qty_per_item"])
            assert qty == Decimal("0.700")
            assert body["operation_norms"][0]["production_stage_id"] == ids["print_id"]

            # active_only filter
            client.patch(
                f"/product-models/{model_a_id}/routings/{link_t2_id}",
                json={"is_active": False},
            )
            active_only = client.get(
                f"/product-models/{model_a_id}/routings",
                params={"active_only": True},
            )
            assert active_only.status_code == 200
            assert active_only.json() == []
            all_links = client.get(f"/product-models/{model_a_id}/routings")
            assert len(all_links.json()) == 1
    finally:
        app.dependency_overrides.pop(get_db, None)
