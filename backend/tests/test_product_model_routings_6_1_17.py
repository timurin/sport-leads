"""Stage 6.1.17.2 smoke: product model routing link + norms service CRUD (no API yet)."""

from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.models.product_model import ProductModel, ProductModelSizeType
from app.models.production_stage import ProductionStage
from app.models.shop_routing import ShopRoutingTemplate
from app.models.tech_operation import TechOperation
from app.models.technical_card import TechOperationVolumeUnit
from app.schemas.product_model import (
    ProductModelCreate,
    ProductModelOperationNormCreate,
    ProductModelOperationNormReplace,
    ProductModelRoutingLinkCreate,
    ProductModelRoutingLinkReorder,
    ProductModelRoutingLinkUpdate,
    ProductModelUpdate,
)
from app.services import product_model_routings as routing_service
from app.services import product_models as models_service


def _session_factory() -> sessionmaker[Session]:
    engine = create_engine(
        "sqlite+pysqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)


def _seed_catalog(db: Session) -> tuple[int, int, int, int, int, int]:
    cutting = ProductionStage(name="Раскрой", code="cutting", is_active=True, sort_order=20)
    print_stage = ProductionStage(name="Печать", code="print", is_active=True, sort_order=30)
    db.add_all([cutting, print_stage])
    db.flush()

    op = TechOperation(
        name="Сублимация",
        code="sub",
        volume_unit=TechOperationVolumeUnit.LINEAR_METERS,
        production_stage_id=print_stage.id,
        is_active=True,
        sort_order=10,
    )
    db.add(op)
    db.flush()

    t1 = ShopRoutingTemplate(name="Маршрут A", code="ra", is_active=True)
    t2 = ShopRoutingTemplate(name="Маршрут B", code="rb", is_active=True)
    t3 = ShopRoutingTemplate(name="Маршрут C", code="rc", is_active=True)
    t_inactive = ShopRoutingTemplate(name="Выкл", code="rx", is_active=False)
    db.add_all([t1, t2, t3, t_inactive])
    db.commit()
    return t1.id, t2.id, t3.id, t_inactive.id, print_stage.id, op.id


def test_product_model_routing_links_service_crud() -> None:
    factory = _session_factory()
    with factory() as db:
        t1_id, t2_id, t3_id, t_inactive_id, print_stage_id, op_id = _seed_catalog(db)

        model = models_service.create_product_model(
            db,
            ProductModelCreate(
                article="RT-213",
                name="Модель RT",
                size_type=ProductModelSizeType.MEN,
                default_routing_template_id=t1_id,
            ),
        )
        model_id = model.id
        assert model.default_routing_template_id == t1_id

        # Foreign inactive rejected
        try:
            routing_service.create_routing_link(
                db,
                model_id,
                ProductModelRoutingLinkCreate(shop_routing_template_id=t_inactive_id),
            )
            raise AssertionError("expected inactive template reject")
        except routing_service.ProductModelRoutingValidationError:
            pass

        # Add t2 only → default t1 cleared (not in whitelist)
        link_b = routing_service.create_routing_link(
            db,
            model_id,
            ProductModelRoutingLinkCreate(
                shop_routing_template_id=t2_id,
                norms=[
                    ProductModelOperationNormCreate(
                        production_stage_id=print_stage_id,
                        tech_operation_id=op_id,
                        norm_qty_per_item=Decimal("0.700"),
                        unit="linear_meters",
                    )
                ],
            ),
        )
        assert link_b.shop_routing_template_id == t2_id
        assert len(link_b.operation_norms) == 1
        assert link_b.operation_norms[0].norm_qty_per_item == Decimal("0.700")

        refreshed = db.get(ProductModel, model_id)
        assert refreshed is not None
        assert refreshed.default_routing_template_id is None

        # Add t1 and set default ∈ whitelist
        link_a = routing_service.create_routing_link(
            db,
            model_id,
            ProductModelRoutingLinkCreate(shop_routing_template_id=t1_id),
        )
        models_service.update_product_model(
            db,
            model_id,
            ProductModelUpdate(default_routing_template_id=t1_id),
        )
        refreshed = db.get(ProductModel, model_id)
        assert refreshed is not None
        assert refreshed.default_routing_template_id == t1_id

        # Active template not in whitelist rejected as default
        try:
            models_service.update_product_model(
                db,
                model_id,
                ProductModelUpdate(default_routing_template_id=t3_id),
            )
            raise AssertionError("expected foreign default reject")
        except models_service.ProductModelValidationError:
            pass

        # Reorder
        reordered = routing_service.reorder_routing_links(
            db,
            model_id,
            ProductModelRoutingLinkReorder(
                routing_link_ids=[link_b.id, link_a.id],
            ),
        )
        assert [row.id for row in reordered] == [link_b.id, link_a.id]

        # Replace norms (resolve stage from op)
        replaced = routing_service.replace_routing_link_norms(
            db,
            model_id,
            link_a.id,
            ProductModelOperationNormReplace(
                norms=[
                    ProductModelOperationNormCreate(
                        tech_operation_id=op_id,
                        norm_qty_per_item=Decimal("1.250"),
                        unit="linear_meters",
                    )
                ]
            ),
        )
        assert len(replaced.operation_norms) == 1
        assert replaced.operation_norms[0].production_stage_id == print_stage_id
        assert replaced.operation_norms[0].norm_qty_per_item == Decimal("1.250")

        # Delete default's link → default cleared
        routing_service.delete_routing_link(db, model_id, link_a.id)
        refreshed = db.get(ProductModel, model_id)
        assert refreshed is not None
        assert refreshed.default_routing_template_id is None

        active_only = routing_service.list_routing_links(db, model_id, active_only=True)
        assert len(active_only) == 1
        assert active_only[0].id == link_b.id

        routing_service.update_routing_link(
            db,
            model_id,
            link_b.id,
            ProductModelRoutingLinkUpdate(is_active=False),
        )
        assert routing_service.list_routing_links(db, model_id, active_only=True) == []

        # Duplicate attach rejected
        routing_service.update_routing_link(
            db,
            model_id,
            link_b.id,
            ProductModelRoutingLinkUpdate(is_active=True),
        )
        try:
            routing_service.create_routing_link(
                db,
                model_id,
                ProductModelRoutingLinkCreate(shop_routing_template_id=t2_id),
            )
            raise AssertionError("expected duplicate reject")
        except routing_service.ProductModelRoutingConflictError:
            pass
