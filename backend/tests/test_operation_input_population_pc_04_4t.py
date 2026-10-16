"""Model/routing binding supplies real inputs before the read-only Demand step."""
from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.base import Base
from app.models.product_model import AssemblyOperationLine, AssemblyVariant, ProductModel, ProductModelOperationNorm, ProductModelRoutingLink
from app.models.production_capacity import CapacityResource, TechOperationCapacityResource
from app.models.production_stage import ProductionStage
from app.models.sewing_operation import SewingOperation
from app.models.shop_routing import ShopRoutingStageLine, ShopRoutingTemplate
from app.models.tech_operation import TechOperation
from app.schemas.route_variants import RouteVariantSelectionWrite
from app.schemas.technical_card import TechnicalCardStandaloneCreate, TechnicalCardUnitLineWrite, TechnicalCardUnitLineImportRow
from app.services.production_demand import read_technical_card_demand
from app.services.production_diagnostics import card_diagnostics
from app.services.production_scheduler import schedule_card_in_transaction
from app.services.route_variants import set_variant_selection
from app.services.standalone_technical_cards import create_standalone_technical_card
from app.services.tech_card_model_assembly import update_technical_card_model_assembly
from app.services.technical_cards import (
    _sync_sewing_operation_lines, apply_routing_template, import_unit_lines,
    replace_unit_lines, set_technical_card_quantity, update_operation_line_volume, TechnicalCardValidationError,
)

TODAY = date(2026, 10, 10)


@pytest.fixture
def inputs():
    engine = create_engine("sqlite+pysqlite://")
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)
    with factory() as db:
        db.add_all([
            ProductionStage(id=1, name="Print", code="print"),
            ProductionStage(id=2, name="Sewing", code="sewing"),
            ProductionStage(id=3, name="Cutting", code="cutting"),
            ProductModel(id=1, article="T", name="Model", size_type="men", status="active"),
            SewingOperation(id=1, name="Stitch"),
            ShopRoutingTemplate(id=1, name="Print + sewing"),
            ShopRoutingTemplate(id=2, name="Print only"),
            ShopRoutingTemplate(id=3, name="ONE OF cutting", route_variant_groups=[{
                "id": "cut", "workshop_id": 3, "name": "Cutting", "code": "cut", "active": True,
                "selection_mode": "one_of", "members": [{"operation_node_id": "template:30", "position": 1},
                    {"operation_node_id": "template:31", "position": 2}], "default_operation_node_id": "template:30",
            }]),
        ])
        db.flush()
        db.add_all([
            AssemblyVariant(id=1, product_model_id=1, name="Assembly"),
            TechOperation(id=1, name="Sublimation", code="sublimation", production_stage_id=1, volume_unit="linear_meters"),
            TechOperation(id=2, name="Sewing", code="sewing", production_stage_id=2, volume_unit="pieces"),
            TechOperation(id=3, name="Manual cut", code="manual-cut", production_stage_id=3, volume_unit="pieces"),
            TechOperation(id=4, name="Laser cut", code="laser", production_stage_id=3, volume_unit="pieces"),
            CapacityResource(resource_key="print", name="Print", production_stage_id=1, resource_type="throughput",
                capacity_unit="linear_meter", calculation_mode="rate", base_rate=15, staff_count=1, hours_per_day=8, efficiency=1, working_days=list(range(7))),
            CapacityResource(resource_key="sewers", name="Sewers", production_stage_id=2, resource_type="labor",
                capacity_unit="labor_hour", calculation_mode="sewing_norm", staff_count=1, hours_per_day=8, efficiency=1, working_days=list(range(7))),
            CapacityResource(resource_key="items", name="Cutters", production_stage_id=3, resource_type="throughput",
                capacity_unit="item", calculation_mode="rate", base_rate=100, staff_count=1, hours_per_day=8, efficiency=1, working_days=list(range(7))),
            ProductModelRoutingLink(id=1, product_model_id=1, shop_routing_template_id=1),
            ProductModelRoutingLink(id=2, product_model_id=1, shop_routing_template_id=2),
            ProductModelRoutingLink(id=3, product_model_id=1, shop_routing_template_id=3),
        ])
        db.flush()
        db.add_all([
            AssemblyOperationLine(id=1, assembly_variant_id=1, sequence=1, operation_name="Stitch",
                sewing_operation_id=1, duration_seconds=720, quantity_per_item=2, cost=0),
            ShopRoutingStageLine(id=10, routing_template_id=1, stage_order=1, production_stage_id=1, stage_label="Print", tech_operation_id=1),
            ShopRoutingStageLine(id=11, routing_template_id=1, stage_order=2, production_stage_id=2, stage_label="Sewing", tech_operation_id=2),
            ShopRoutingStageLine(id=20, routing_template_id=2, stage_order=1, production_stage_id=1, stage_label="Print", tech_operation_id=1),
            ShopRoutingStageLine(id=30, routing_template_id=3, stage_order=1, production_stage_id=3, stage_label="Cut", tech_operation_id=3),
            ShopRoutingStageLine(id=31, routing_template_id=3, stage_order=2, production_stage_id=3, stage_label="Cut", tech_operation_id=4),
            ProductModelOperationNorm(id=1, product_model_routing_link_id=1, production_stage_id=1,
                tech_operation_id=1, unit="linear_meters", norm_qty_per_item=Decimal("0.700")),
            ProductModelOperationNorm(id=2, product_model_routing_link_id=2, production_stage_id=1,
                tech_operation_id=1, unit="linear_meters", norm_qty_per_item=Decimal("0.700")),
        ])
        db.add_all([TechOperationCapacityResource(tech_operation_id=operation, resource_key=key)
                    for operation, key in ((1, "print"), (2, "sewers"), (3, "items"), (4, "items"))])
        db.commit()
    yield factory
    engine.dispose()


def create(db, *, bind=True, route=1):
    card = create_standalone_technical_card(db, TechnicalCardStandaloneCreate(
        nomenclature_name="Model", order_number="T-INPUT", tech_cards_planned_count=1,
        desired_date=TODAY + timedelta(days=30), quantity=8,
        planning_start_date=TODAY, shipping_date=TODAY + timedelta(days=30)))
    if bind:
        update_technical_card_model_assembly(db, card.id, product_model_id=1, assembly_variant_id=1)
    apply_routing_template(db, card.id, route)
    return card


def test_new_card_route_and_assembly_inputs_feed_exact_demand_and_scheduler(inputs):
    with inputs() as db:
        card = create(db)
        assert [(row.tech_operation_id, row.volume) for row in card.operation_lines if row.source_kind == "routing"] == [(1, Decimal("5.600")), (2, Decimal("8"))]
        assert [row.volume for row in card.operation_lines if row.source_kind == "sewing"] == [Decimal("16")]
        demand = read_technical_card_demand(db, card.id)
        assert demand.status == "ready"
        assert Decimal(demand.steps[0].demands[0].amount) == Decimal("5.600")
        sewing = demand.steps[1].demands[0]
        assert Decimal(sewing.amount) == Decimal("3.2")  # 720 sec * 2 * 8 / 3600, once.
        assert sewing.details["norm_table"] == "assembly_operation_lines"
        assert not card_diagnostics(db, card.id).diagnostics
        plan = schedule_card_in_transaction(db, card.id, persist=False, today=TODAY)
        assert plan.status == "planned" and not plan.persisted


@pytest.mark.parametrize("bad_source", ["zero", "unit", "operation", "stage", "inactive_link"])
def test_missing_or_foreign_meter_source_remains_missing(inputs, bad_source):
    with inputs() as db:
        existing = create(db) if bad_source == "inactive_link" else None
        norm = db.get(ProductModelOperationNorm, 1)
        if bad_source == "zero":
            norm.norm_qty_per_item = 0
        elif bad_source == "unit":
            norm.unit = "pieces"
        elif bad_source == "operation":
            norm.tech_operation_id = 2
        elif bad_source == "stage":
            norm.production_stage_id = 2
        else:
            db.get(ProductModelRoutingLink, 1).is_active = False
        db.commit()
        card = existing or create(db)
        if existing is not None:
            line = next(row for row in card.operation_lines if row.tech_operation_id == 1)
            update_operation_line_volume(db, card.id, line.id, volume=Decimal("0"))
            _sync_sewing_operation_lines(db, card)
        assert next(row.volume for row in card.operation_lines if row.tech_operation_id == 1) == 0
        demand = read_technical_card_demand(db, card.id)
        assert demand.steps[0].demands[0].details["reason_code"] == "missing_linear_meters"


def test_model_binding_after_route_fills_empty_rows_without_changing_snapshot(inputs):
    with inputs() as db:
        card = create(db, bind=False)
        stage_ids = [row.id for row in card.stage_results]
        assert next(row.volume for row in card.operation_lines if row.tech_operation_id == 1) == 0
        update_technical_card_model_assembly(db, card.id, product_model_id=1, assembly_variant_id=1)
        db.flush()
        assert [row.id for row in card.stage_results] == stage_ids
        assert read_technical_card_demand(db, card.id).status == "ready"


def test_old_positive_volume_is_preserved_and_demand_does_not_read_live_hint(inputs):
    with inputs() as db:
        card = create(db)
        line = next(row for row in card.operation_lines if row.tech_operation_id == 1)
        line.volume = Decimal("7.250")
        line.volume_qty_per_item = None  # A pre-migration/unmarked snapshot input.
        db.get(ProductModelOperationNorm, 1).norm_qty_per_item = 99
        _sync_sewing_operation_lines(db, card)
        db.flush()
        assert line.volume == Decimal("7.250")
        assert read_technical_card_demand(db, card.id).steps[0].demands[0].amount == "7.25"


def test_zero_sewing_time_is_real_blocker_and_not_replaced_by_line_quantity(inputs):
    with inputs() as db:
        db.get(AssemblyOperationLine, 1).duration_seconds = 0
        card = create(db)
        demand = read_technical_card_demand(db, card.id)
        assert demand.steps[1].demands[0].amount is None
        assert demand.steps[1].demands[0].details["reason_code"] == "missing_sewing_norm"


def test_route_without_sewing_does_not_require_unused_assembly_times(inputs):
    with inputs() as db:
        db.get(AssemblyOperationLine, 1).duration_seconds = 0
        card = create(db, route=2)
        assert read_technical_card_demand(db, card.id).status == "ready"
        assert schedule_card_in_transaction(db, card.id, persist=False, today=TODAY).status == "planned"


def test_one_of_demand_contains_only_selected_member(inputs):
    with inputs() as db:
        card = create(db, route=3)
        alternative = next(row for row in card.stage_results if row.tech_operation_id == 4)
        set_variant_selection(db, card.id, "cut", RouteVariantSelectionWrite(
            selected_operation_snapshot_node_id=f"snapshot:{alternative.id}", selection_status="confirmed", replan=False))
        demand = read_technical_card_demand(db, card.id)
        assert [step.operation_id for step in demand.steps] == [4]
        assert demand.steps[0].demands[0].amount == "8"


def test_unique_workshop_default_is_used_only_without_an_operation_norm(inputs):
    with inputs() as db:
        db.get(ProductModelOperationNorm, 1).tech_operation_id = None
        card = create(db)
        assert next(row.volume for row in card.operation_lines if row.tech_operation_id == 1) == Decimal("5.600")


def test_invalid_specific_norm_is_not_hidden_by_a_workshop_default(inputs):
    with inputs() as db:
        db.get(ProductModelOperationNorm, 1).unit = "pieces"
        db.add(ProductModelOperationNorm(product_model_routing_link_id=1, production_stage_id=1,
                                        tech_operation_id=None, unit="linear_meters", norm_qty_per_item=Decimal("0.700")))
        card = create(db)
        assert next(row.volume for row in card.operation_lines if row.tech_operation_id == 1) == 0


def test_quantity_import_rebases_saved_inputs_not_changed_live_norms(inputs):
    with inputs() as db:
        card = create(db)
        stages = [row.id for row in card.stage_results]
        db.get(ProductModelOperationNorm, 1).norm_qty_per_item = 99
        import_unit_lines(db, card.id, [TechnicalCardUnitLineImportRow(quantity=10)])
        assert card.quantity == 8
        assert [row.id for row in card.stage_results] == stages
        unchanged = [(row.tech_operation_id, row.volume) for row in card.operation_lines if row.source_kind == "routing"]
        assert unchanged == [(1, Decimal("5.600")), (2, Decimal("8"))]
        set_technical_card_quantity(db, card.id, Decimal("10"))
        volumes = [(row.tech_operation_id, row.volume) for row in card.operation_lines if row.source_kind == "routing"]
        assert volumes == [(1, Decimal("7.000")), (2, Decimal("10.000"))]
        assert [row.volume for row in card.operation_lines if row.source_kind == "sewing"] == [Decimal("20.000")]
        demand = read_technical_card_demand(db, card.id)
        assert Decimal(demand.steps[1].demands[0].amount) == Decimal("4")


def test_shop_volume_override_clears_basis_and_survives_quantity_change(inputs):
    with inputs() as db:
        card = create(db)
        print_line = next(row for row in card.operation_lines if row.tech_operation_id == 1)
        update_operation_line_volume(db, card.id, print_line.id, volume=Decimal("9.250"))
        assert print_line.volume_qty_per_item is None
        replace_unit_lines(db, card.id, [TechnicalCardUnitLineWrite(unit_index=index) for index in range(1, 11)])
        assert print_line.volume == Decimal("9.250")
        assert read_technical_card_demand(db, card.id).steps[0].demands[0].amount == "9.25"


def test_derived_volume_overflow_is_explicit_not_a_database_write_failure(inputs):
    with inputs() as db:
        db.get(ProductModelOperationNorm, 1).norm_qty_per_item = Decimal("99999999999.999")
        with pytest.raises(TechnicalCardValidationError, match="storage precision"):
            create(db)


def test_model_change_does_not_keep_the_previous_models_meter_basis(inputs):
    with inputs() as db:
        card = create(db)
        db.add(ProductModel(id=2, article="T2", name="Other model", size_type="men", status="active"))
        db.flush()
        db.add(ProductModelRoutingLink(product_model_id=2, shop_routing_template_id=1))
        db.flush()
        update_technical_card_model_assembly(db, card.id, product_model_id=2, assembly_variant_id=None)
        line = next(row for row in card.operation_lines if row.tech_operation_id == 1)
        assert line.volume == 0 and line.volume_qty_per_item is None
        assert read_technical_card_demand(db, card.id).steps[0].demands[0].details["reason_code"] == "missing_linear_meters"


def test_variant_piece_norm_is_copied_instead_of_an_implicit_one(inputs):
    with inputs() as db:
        db.add(ProductModelOperationNorm(product_model_routing_link_id=1, production_stage_id=2,
                                        tech_operation_id=2, unit="pieces", norm_qty_per_item=Decimal("2.500")))
        card = create(db)
        line = next(row for row in card.operation_lines if row.tech_operation_id == 2)
        assert line.volume_qty_per_item == Decimal("2.500")
        assert line.volume == Decimal("20.000")
        set_technical_card_quantity(db, card.id, Decimal("10"))
        assert line.volume == Decimal("25.000")


@pytest.mark.parametrize("unit,basis", [("linear_meters", Decimal("1")), ("pieces", Decimal("0"))])
def test_invalid_configured_piece_norm_does_not_silently_use_one(inputs, unit, basis):
    with inputs() as db:
        db.add(ProductModelOperationNorm(product_model_routing_link_id=1, production_stage_id=2,
                                        tech_operation_id=2, unit=unit, norm_qty_per_item=basis))
        card = create(db)
        line = next(row for row in card.operation_lines if row.tech_operation_id == 2)
        assert line.volume == 0 and line.volume_qty_per_item is None


def test_live_edit_is_frozen_until_explicit_route_reapply(inputs):
    with inputs() as db:
        card = create(db)
        card_id = card.id
        db.commit()
    with inputs() as editor:
        editor.get(ProductModelOperationNorm, 1).norm_qty_per_item = Decimal("0.900")
        editor.commit()
    with inputs() as db:
        from app.services.technical_cards import get_technical_card, to_technical_card_read
        card = get_technical_card(db, card_id)
        assert next(row.volume for row in card.operation_lines if row.tech_operation_id == 1) == Decimal("5.600")
        assert read_technical_card_demand(db, card_id).steps[0].demands[0].amount == "5.6"
        apply_routing_template(db, card_id, 1)
        db.commit()
    with inputs() as db:
        card = get_technical_card(db, card_id)
        line = next(row for row in card.operation_lines if row.tech_operation_id == 1)
        assert line.volume_qty_per_item == Decimal("0.900") and line.volume == Decimal("7.200")
        dto = to_technical_card_read(db, card)
        assert next(row.volume for row in dto.operation_lines if row.tech_operation_id == 1) == Decimal("7.200")


def test_api_read_model_uses_committed_snapshot_not_live_variant(inputs):
    with inputs() as db:
        card = create(db)
        card_id = card.id
        db.commit()
    with inputs() as db:
        db.get(ProductModelOperationNorm, 1).norm_qty_per_item = Decimal("99")
        db.commit()
    with inputs() as db:
        from app.api.technical_cards import read_technical_card
        dto = read_technical_card(card_id, db)
        assert next(row.volume for row in dto.operation_lines if row.tech_operation_id == 1) == Decimal("5.600")
