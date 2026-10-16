"""PC-04.4S: replace the explicitly authorized 30 local stress cards.

Run from the repository root with --rebuild once, then --validate for read-only
checks. Catalogs/norms are never edited. JSON evidence belongs in ignored logs.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from collections import Counter
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.models  # Register all relationships before inspecting metadata.
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.database.base import Base
from app.database.session import engine
from app.models.calendar_allocation import CalendarAllocation
from app.models.calendar_assignment import CalendarAssignment
from app.models.product_model import ProductModel, ProductModelRoutingLink
from app.models.shop_routing import ShopRoutingTemplate
from app.models.technical_card import TechnicalCard
from app.repositories import assembly_variants as assembly_repo
from app.repositories.production_scheduler import lock_scheduler
from app.schemas.production_calendar import AssignmentCreate
from app.schemas.route_variants import RouteVariantSelectionWrite
from app.schemas.technical_card import TechnicalCardStandaloneCreate
from app.services.production_calendar import board, enqueue, sources
from app.services.production_demand import read_technical_card_demand
from app.services.production_diagnostics import card_diagnostics
from app.services.production_scheduler import schedule_card_in_transaction
from app.services.route_variants import resolve_effective_route_snapshot, set_variant_selection
from app.services.standalone_technical_cards import create_standalone_technical_card
from app.services.tech_card_model_assembly import update_technical_card_model_assembly
from app.services.technical_cards import apply_routing_template

OLD_NUMBERS = {f"VIS-STRESS-{index:03}" for index in range(1, 31)}
NEW_NUMBERS = {f"CAL-STRESS-{index:03}" for index in range(1, 31)}
OWNED_TABLES = {
    "technical_card_composition_lines", "technical_card_operation_lines",
    "technical_card_stage_results", "technical_card_route_edges",
    "technical_card_unit_lines", "technical_card_media", "calendar_assignments",
}
CATALOG_TABLES = (
    "product_models", "assembly_variants", "assembly_operation_lines",
    "product_model_routing_links", "product_model_operation_norms",
    "shop_routing_templates", "shop_routing_stage_lines", "shop_routing_node_dependencies",
    "tech_operations", "tech_operation_capacity_resources", "capacity_resources",
    "production_capacity_exceptions", "work_centers", "production_stages",
)
OUTPUT = Path("logs/pc-04-4s")


def write_json(name: str, value) -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    OUTPUT.joinpath(name).write_text(json.dumps(value, ensure_ascii=False, indent=2, default=str), encoding="utf-8")


def exact_old_set(rows) -> None:
    if len(rows) != 30 or {row.number for row in rows} != OLD_NUMBERS:
        raise RuntimeError("STOP: old stress set must be exactly VIS-STRESS-001..030")
    if any(row.order_group_id is None or row.sales_order_id is not None for row in rows):
        raise RuntimeError("STOP: an old stress card is not standalone")


def card_specs(today: date) -> list[dict]:
    quantities = [8, 12, 16, 20, 24, 28, 32, 36, 48, 55, 64, 72, 80, 90, 100,
                  110, 120, 140, 180, 220, 260, 300, 360, 420, 480, 600, 65, 125, 240, 400]
    result = []
    for index, quantity in enumerate(quantities, 1):
        category = "small" if index <= 8 else "medium" if index <= 18 else "large" if index <= 26 else "tight"
        start_offset = 0 if category == "tight" else (index - 1) % 5
        result.append(dict(number=f"CAL-STRESS-{index:03}", quantity=quantity, category=category,
                           priority=index - 26 if category == "tight" else 10 + index,
                           planning_start_date=today + timedelta(days=start_offset),
                           shipping_date=today + timedelta(days=(1 + index % 3) if category == "tight" else 10 + index),
                           selection_status="confirmed" if index % 2 else "preliminary"))
    return result


def dependent_tables():
    for table in Base.metadata.sorted_tables:
        for fk in table.foreign_keys:
            if fk.column.table.name == "technical_cards":
                yield table, fk.parent


def rows(db: Session, table, condition=None) -> list[dict]:
    query = select(table)
    if condition is not None:
        query = query.where(condition)
    return [dict(row) for row in db.execute(query.order_by(*table.primary_key.columns)).mappings()]


def fingerprint(db: Session, excluded_ids: set[int]) -> dict:
    data = {"technical_cards": rows(db, TechnicalCard.__table__, TechnicalCard.id.not_in(excluded_ids))}
    for table, column in dependent_tables():
        data[table.name] = rows(db, table, column.not_in(excluded_ids) | column.is_(None))
    own_assignment_ids = select(CalendarAssignment.id).where(CalendarAssignment.technical_card_id.in_(excluded_ids))
    data["calendar_allocations"] = rows(db, CalendarAllocation.__table__, CalendarAllocation.assignment_id.not_in(own_assignment_ids))
    for name in CATALOG_TABLES:
        if name in Base.metadata.tables:
            data[name] = rows(db, Base.metadata.tables[name])
    return {name: dict(count=len(value), sha256=hashlib.sha256(json.dumps(value, sort_keys=True, default=str).encode()).hexdigest())
            for name, value in data.items()}


def catalog_candidates(db: Session) -> list[tuple]:
    candidates = []
    for model in db.scalars(select(ProductModel).where(ProductModel.status == "active").order_by(ProductModel.id)):
        variants = assembly_repo.list_variants(db, model.id, active_only=True)
        route_ids = list(db.scalars(select(ProductModelRoutingLink.shop_routing_template_id)
                                   .join(ShopRoutingTemplate, ShopRoutingTemplate.id == ProductModelRoutingLink.shop_routing_template_id)
                                   .where(ProductModelRoutingLink.product_model_id == model.id,
                                          ProductModelRoutingLink.is_active.is_(True), ShopRoutingTemplate.is_active.is_(True))
                                   .order_by(ProductModelRoutingLink.sort_order, ShopRoutingTemplate.id)))
        if not variants or not route_ids:
            continue
        # Prefer the most complete real norm; never manufacture missing seconds.
        variant = max(variants, key=lambda value: (sum(line.duration_seconds > 0 for line in value.operation_lines), -value.id))
        candidates.append((model, variant, route_ids))
    if not candidates:
        raise RuntimeError("STOP: no active model with real assembly and allowed active route")
    return candidates


def rebuild(today: date, *, persist: bool = True) -> dict:
    started = time.perf_counter()
    with engine.connect() as connection, connection.begin() as transaction:
        # Service-level commits release savepoints; only this outer transaction
        # can commit cleanup + all 30 replacements together.
        with Session(bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False) as db:
            lock_scheduler(db)
            old = list(db.scalars(select(TechnicalCard).where(TechnicalCard.number.like("VIS-STRESS-%")).order_by(TechnicalCard.number).with_for_update()))
            exact_old_set(old)
            if db.scalar(select(TechnicalCard.id).where(TechnicalCard.number.like("CAL-STRESS-%")).limit(1)):
                raise RuntimeError("STOP: CAL-STRESS already exists; use --validate instead")
            groups = Base.metadata.tables["technical_card_order_groups"]
            if db.scalar(select(groups.c.id).where(groups.c.order_number.like("CAL-STRESS-%")).limit(1)):
                raise RuntimeError("STOP: existing CAL-STRESS order envelope; do not reuse unknown data")
            old_ids = {card.id for card in old}
            print("AUTHORIZED CLEANUP:", [(card.id, card.number) for card in old], flush=True)
            before = fingerprint(db, old_ids)
            backup = {"technical_cards": rows(db, TechnicalCard.__table__, TechnicalCard.id.in_(old_ids))}
            for table, column in dependent_tables():
                owned = rows(db, table, column.in_(old_ids))
                if owned and table.name not in OWNED_TABLES:
                    raise RuntimeError(f"STOP: foreign business records reference old cards: {table.name}")
                backup[table.name] = owned
            old_assignments = [row["id"] for row in backup["calendar_assignments"]]
            backup["calendar_allocations"] = rows(db, CalendarAllocation.__table__, CalendarAllocation.assignment_id.in_(old_assignments))
            backup["order_groups_preserved"] = rows(db, Base.metadata.tables["technical_card_order_groups"],
                Base.metadata.tables["technical_card_order_groups"].c.id.in_({card.order_group_id for card in old}))
            write_json("cleanup-backup.json", backup)
            write_json("unrelated-before.json", before)
            candidates = catalog_candidates(db)[:5]
            db.execute(delete(TechnicalCard).where(TechnicalCard.id.in_(old_ids)))
            db.flush()
            assert not db.scalar(select(TechnicalCard.id).where(TechnicalCard.number.like("VIS-STRESS-%")).limit(1))
            print("VIS-STRESS-* after scoped cleanup: 0", flush=True)
            manifest = []
            for index, spec in enumerate(card_specs(today)):
                model, variant, route_ids = candidates[index % len(candidates)]
                routing_id = route_ids[(index // len(candidates)) % len(route_ids)]
                card = create_standalone_technical_card(db, TechnicalCardStandaloneCreate(
                    nomenclature_name=model.name, order_number=spec["number"] + "-ORDER", tech_cards_planned_count=1,
                    desired_date=spec["shipping_date"], quantity=Decimal(spec["quantity"]),
                    planning_start_date=spec["planning_start_date"], shipping_date=spec["shipping_date"], priority=spec["priority"]))
                card.number = spec["number"]
                card.notes = "PC-04.4S local calendar stress; " + spec["category"]
                db.flush()
                update_technical_card_model_assembly(db, card.id, product_model_id=model.id, assembly_variant_id=variant.id)
                apply_routing_template(db, card.id, routing_id)
                db.refresh(card)
                for group in card.route_variant_groups or []:
                    if not group["active"]:
                        continue
                    member = group["members"][(index // (2 * len(candidates))) % len(group["members"])]
                    set_variant_selection(db, card.id, group["id"], RouteVariantSelectionWrite(
                        selected_operation_snapshot_node_id=member["operation_node_id"],
                        selection_status=spec["selection_status"], replan=False))
                enqueue(db, AssignmentCreate(technical_card_id=card.id, planned_date=spec["planning_start_date"],
                                             note="PC-04.4S entry marker; operation plan requires readiness"))
                db.refresh(card)
                manifest.append(dict(id=card.id, model_id=model.id, model=model.name, assembly_id=variant.id,
                                     routing_id=routing_id, selections=card.route_variant_selections, **spec))
            new_ids = {row["id"] for row in manifest}
            after = fingerprint(db, new_ids)
            assert before == after, "Unrelated records or catalogs changed; rolling back the whole rebuild"
            write_json("unrelated-after.json", after)
            assert {row.number for row in db.scalars(select(TechnicalCard).where(TechnicalCard.id.in_(new_ids)))} == NEW_NUMBERS
            db.commit()
        if persist:
            transaction.commit()
        else:
            transaction.rollback()
    summary = dict(cards=manifest, rebuild_seconds=round(time.perf_counter() - started, 3),
                   old_cards_deleted=30, new_cards_created=30, unrelated_and_catalogs_unchanged=True,
                   old_order_groups="preserved; no parent/business envelope deletion")
    write_json("manifest.json" if persist else "trial-manifest.json", summary)
    print("Atomic rebuild committed:" if persist else "Trial rolled back:", len(manifest), "cards; seconds:", summary["rebuild_seconds"], flush=True)
    return summary


def validate(today: date) -> dict:
    started = time.perf_counter()
    with Session(engine) as db:
        cards = list(db.scalars(select(TechnicalCard).where(TechnicalCard.number.like("CAL-STRESS-%")).order_by(TechnicalCard.number)))
        assert len(cards) == 30 and {card.number for card in cards} == NEW_NUMBERS
        assert not db.scalar(select(TechnicalCard.id).where(TechnicalCard.number.like("VIS-STRESS-%")).limit(1))
        data = []
        for card in cards:
            effective = resolve_effective_route_snapshot(db, card.id)
            demand = read_technical_card_demand(db, card.id)
            diagnostic = card_diagnostics(db, card.id)
            preflight = schedule_card_in_transaction(db, card.id, persist=False, today=today)
            assert card.stage_results and effective.graph.nodes
            assert all(stage.source_routing_stage_line_id is not None for stage in card.stage_results)
            assert not effective.unresolved_groups
            excluded = set(effective.excluded_alternatives)
            stage_ids = {stage.source_routing_stage_line_id: stage.id for stage in card.stage_results}
            assert not any(f"snapshot:{stage_ids[step.routing_stage_line_id]}" in excluded for step in demand.steps)
            data.append(dict(id=card.id, number=card.number, model_id=card.product_model_id, model=card.product_model_name,
                             routing_id=card.routing_template_id, routing=card.routing_template_name,
                             status=preflight.status, diagnostics=diagnostic.model_dump(mode="json"),
                             demand=demand.model_dump(mode="json"), preflight=preflight.model_dump(mode="json"),
                             effective_graph=effective.graph.model_dump(mode="json"), excluded_alternatives=sorted(excluded)))
        ids = {card.id for card in cards}
        assignments = list(db.scalars(select(CalendarAssignment).where(CalendarAssignment.technical_card_id.in_(ids))))
        allocations = rows(db, CalendarAllocation.__table__, CalendarAllocation.assignment_id.in_([row.id for row in assignments]))
        assert len({(row.technical_card_id, row.routing_stage_line_id, row.production_stage_id) for row in assignments}) == len(assignments)
        view = board(db, today, today + timedelta(days=120), None)
        assert {row.technical_card_id for row in view.assignments if row.technical_card_id in ids} == ids
        available = sources(db, "CAL-STRESS-", 100)
        assert {row.id for row in available} == ids
        ready = sum(row["status"] == "planned" for row in data)
        result = dict(ready=ready, blocked=30-ready,
                      warning_cards=sum(any(item["severity"] == "warning" for item in row["diagnostics"]["diagnostics"]) for row in data),
                      cards=data, calendar_cards_visible=30, assignments=len(assignments), allocations=len(allocations),
                      mass_schedule="NOT RUN: fewer than 25 ready" if ready < 25 else "ready for guarded scheduler command",
                      preflight_seconds=round(time.perf_counter() - started, 3))
        db.rollback()
    write_json("preflight.json", result)
    print("PREFLIGHT:", {key: value for key, value in result.items() if key != "cards"}, flush=True)
    counts = Counter((item["code"], item["field"]) for row in data for item in row["diagnostics"]["diagnostics"] if item["severity"] == "error")
    print("BLOCKERS:", dict(counts), flush=True)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--rebuild", action="store_true")
    group.add_argument("--validate", action="store_true")
    group.add_argument("--trial", action="store_true", help="Exercise cleanup/create in a transaction and roll it all back")
    parser.add_argument("--today", type=date.fromisoformat, default=date.today())
    args = parser.parse_args()
    if engine.url.host not in {"localhost", "127.0.0.1"} or engine.url.port != 5432:
        raise RuntimeError("STOP: local PostgreSQL :5432 only")
    engine.echo = False
    if args.rebuild:
        rebuild(args.today)
    if args.trial:
        rebuild(args.today, persist=False)
        with Session(engine) as db:
            exact_old_set(list(db.scalars(select(TechnicalCard).where(TechnicalCard.number.like("VIS-STRESS-%")))))
            assert not db.scalar(select(TechnicalCard.id).where(TechnicalCard.number.like("CAL-STRESS-%")).limit(1))
        print("Trial rollback: original 30 retained; CAL-STRESS count 0", flush=True)
        return
    validate(args.today)


if __name__ == "__main__":
    main()
