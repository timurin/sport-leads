"""Persistent VIS-STRESS-001..030 dataset for PC-04.4C.

Repeat runs update only these cards. This script never deletes technical cards,
assignments, or allocations.
"""
from __future__ import annotations

import argparse
import logging
import time
import tracemalloc
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import event, func, select
from sqlalchemy.orm import Session

from app.database.session import SessionLocal, engine
from app.models.calendar_allocation import CalendarAllocation
from app.models.calendar_assignment import CalendarAssignment
from app.models.production_capacity import CapacityResource
from app.models.shop_routing import ShopRoutingStageLine, ShopRoutingTemplate
from app.models.tech_operation import TechOperation
from app.models.technical_card import TechnicalCard, TechnicalCardOperationLine, TechnicalCardOrderGroup
from app.schemas.technical_card import TechnicalCardStandaloneCreate
from app.services.production_queue_scheduler import schedule_queue
from app.services.production_scheduler import _capacity
from app.services.standalone_technical_cards import create_standalone_technical_card
from app.services.technical_cards import apply_routing_template

PREFIX = "VIS-STRESS-"
TODAY = date(2026, 10, 7)

ROUTE_FULL = ("design-op", "sublimation", "heat_transfer", "manual-cut", "sewing", "wto", "packaging")
ROUTE_PRINT = ("sublimation", "heat_transfer", "manual-cut", "sewing", "wto", "packaging")
ROUTE_SHOP = ("manual-cut", "sewing", "wto", "packaging")


def _spec(index: int) -> dict:
    number = f"{PREFIX}{index:03d}"
    order_number = f"TEST-{3000 + index}"
    start = TODAY
    ship = TODAY + timedelta(days=21)
    priority: int | None = 20
    quantity = 20
    route = ROUTE_SHOP
    cutting: str | None = "manual_lay"
    group = "B"
    if index <= 5:
        group, priority, quantity = "A", 9 + index, 8 + (index * 4)
        ship = TODAY + timedelta(days=3 + index)
    elif index <= 12:
        group, priority, quantity = "B", 14 + index, 36 + index
        start = TODAY + timedelta(days=1)
        ship = TODAY + timedelta(days=17)
    elif index <= 18:
        group, priority, quantity = "C", 17 + index, 80 + (index - 12) * 40
        ship = TODAY + timedelta(days=30)
    elif index <= 23:
        group, priority, quantity = "D", 21 + index, 28
        ship = TODAY + timedelta(days=2)
    elif index == 24:
        group, priority, quantity, cutting = "E", 60, 12, None
    elif index == 25:
        group, priority, quantity = "E", 61, 12
    elif index == 26:
        group, priority, quantity, route = "E", 62, 12, ROUTE_PRINT
    elif index == 27:
        group, priority, quantity, route, cutting = "E", 63, 12, ROUTE_FULL, "manual_single"
    elif index == 28:
        group, priority, quantity = "F", None, 18
        start, ship = TODAY + timedelta(days=14), TODAY + timedelta(days=45)
    elif index == 29:
        group, priority, quantity = "F", 80, 18
        start, ship = TODAY + timedelta(days=14), TODAY + timedelta(days=45)
    else:
        group, priority, quantity = "F", 90, 18
        start, ship = TODAY + timedelta(days=14), TODAY + timedelta(days=45)
    return {
        "index": index,
        "number": number,
        "order_number": order_number,
        "group": group,
        "priority": priority,
        "quantity": quantity,
        "planning_start_date": start,
        "shipping_date": ship,
        "route": route,
        "cutting": cutting,
    }


SPECS = [_spec(index) for index in range(1, 31)]
RESHAPE = {"VIS-STRESS-013": 5, "VIS-STRESS-001": 50, "VIS-STRESS-028": 15}


def _route_id(db: Session, codes: tuple[str, ...]) -> int:
    templates = list(db.scalars(select(ShopRoutingTemplate).where(ShopRoutingTemplate.is_active.is_(True))))
    for template in templates:
        steps = list(db.scalars(select(ShopRoutingStageLine).where(
            ShopRoutingStageLine.routing_template_id == template.id
        ).order_by(ShopRoutingStageLine.stage_order, ShopRoutingStageLine.id)))
        found = []
        for step in steps:
            operation = db.get(TechOperation, step.tech_operation_id) if step.tech_operation_id else None
            if operation is not None:
                found.append(operation.code)
        if tuple(found) == codes:
            return template.id
    raise RuntimeError(f"Active routing not found for {codes}")


def _find_card(db: Session, spec: dict) -> TechnicalCard | None:
    card = db.scalar(select(TechnicalCard).where(TechnicalCard.number == spec["number"]))
    if card is not None:
        return card
    group = db.scalar(select(TechnicalCardOrderGroup).where(
        TechnicalCardOrderGroup.order_number == spec["order_number"]
    ))
    if group is None:
        return None
    return db.scalar(select(TechnicalCard).where(
        TechnicalCard.order_group_id == group.id,
        TechnicalCard.sales_order_id.is_(None),
    ))


def _apply_inputs(db: Session, card: TechnicalCard, spec: dict) -> None:
    card.number = spec["number"]
    card.quantity = Decimal(spec["quantity"])
    card.priority = spec["priority"]
    card.planning_start_date = spec["planning_start_date"]
    card.shipping_date = spec["shipping_date"]
    card.plan_locked = False
    card.notes = f"PC-04.4C group {spec['group']}"
    route_id = _route_id(db, spec["route"])
    if card.routing_template_id != route_id:
        apply_routing_template(db, card.id, route_id)
        db.refresh(card)
    for line in list(db.scalars(select(TechnicalCardOperationLine).where(
        TechnicalCardOperationLine.technical_card_id == card.id
    ))):
        operation = db.get(TechOperation, line.tech_operation_id) if line.tech_operation_id else None
        if operation is None:
            continue
        if operation.code == "manual-cut":
            line.cutting_method = spec["cutting"]
        if str(operation.volume_unit) == "linear_meters":
            line.volume = Decimal(0)


def seed(db: Session) -> list[TechnicalCard]:
    started = time.perf_counter()
    cards = []
    for spec in SPECS:
        card = _find_card(db, spec)
        if card is None:
            card = create_standalone_technical_card(db, TechnicalCardStandaloneCreate(
                nomenclature_name=f"Stress {spec['number']}",
                order_number=spec["order_number"],
                tech_cards_planned_count=1,
                desired_date=spec["shipping_date"],
                quantity=Decimal(spec["quantity"]),
                planning_start_date=spec["planning_start_date"],
                shipping_date=spec["shipping_date"],
                priority=spec["priority"],
            ))
        _apply_inputs(db, card, spec)
        db.commit()
        cards.append(card)
    elapsed = time.perf_counter() - started
    print(f"SEED {len(cards)} cards in {elapsed:.3f}s")
    return cards


def _stress_ids(db: Session) -> list[int]:
    return list(db.scalars(select(TechnicalCard.id).where(TechnicalCard.number.like(f"{PREFIX}%")).order_by(TechnicalCard.number)))


def _fingerprint(db: Session, card_ids: list[int]) -> list[tuple]:
    rows = db.execute(select(
        CalendarAssignment.technical_card_id,
        CalendarAssignment.routing_stage_line_id,
        CalendarAssignment.planned_date,
        CalendarAssignment.planned_end_date,
        CalendarAssignment.planning_mode,
        CalendarAssignment.manual_lock,
        CalendarAllocation.resource_key,
        CalendarAllocation.date,
        CalendarAllocation.allocated_amount,
        CalendarAllocation.capacity_unit,
    ).join(CalendarAllocation, CalendarAllocation.assignment_id == CalendarAssignment.id, isouter=True).where(
        CalendarAssignment.technical_card_id.in_(card_ids)
    ).order_by(CalendarAssignment.id, CalendarAllocation.id)).all()
    return [tuple(row) for row in rows]


def _foreign_fingerprint(db: Session, card_ids: list[int]) -> list[tuple]:
    query = select(
        CalendarAssignment.id,
        CalendarAssignment.technical_card_id,
        CalendarAssignment.planned_date,
        CalendarAssignment.planned_end_date,
        CalendarAssignment.planning_mode,
        CalendarAssignment.manual_lock,
        CalendarAssignment.note,
    ).order_by(CalendarAssignment.id)
    if card_ids:
        query = query.where(CalendarAssignment.technical_card_id.not_in(card_ids))
    return [tuple(row) for row in db.execute(query).all()]


def _run_schedule(db: Session):
    queries = {"count": 0}

    def count(*_args) -> None:
        queries["count"] += 1

    event.listen(engine, "before_cursor_execute", count)
    tracemalloc.start()
    started = time.perf_counter()
    try:
        result = schedule_queue(db)
        elapsed = time.perf_counter() - started
        _current, peak = tracemalloc.get_traced_memory()
    finally:
        tracemalloc.stop()
        event.remove(engine, "before_cursor_execute", count)
    return result, elapsed, queries["count"], peak


def _print_result(label: str, result, elapsed: float, queries: int, peak: int) -> None:
    print(
        f"{label} status={result.status} total={result.total_cards} planned={result.planned_cards} "
        f"blocked={result.blocked_cards} deadline_missed={result.deadline_missed_cards} "
        f"preserved={result.preserved_cards} wall={elapsed:.3f}s queries={queries} peak_bytes={peak}"
    )
    codes: dict[str, int] = {}
    for row in result.results:
        code = row.deviations[0].code if row.deviations else row.status
        reason = row.deviations[0].reason if row.deviations else ""
        codes[f"{code}:{reason}"] = codes.get(f"{code}:{reason}", 0) + 1
    for key, count in sorted(codes.items()):
        print(f"  {count} {key}")


def _capacity_report(db: Session, card_ids: list[int]) -> None:
    rows = db.execute(select(
        CalendarAllocation.resource_key,
        CalendarAllocation.date,
        func.sum(CalendarAllocation.allocated_amount),
        func.count(func.distinct(CalendarAssignment.technical_card_id)),
    ).join(CalendarAssignment).group_by(CalendarAllocation.resource_key, CalendarAllocation.date)).all()
    resources = {row.resource_key: row for row in db.scalars(select(CapacityResource))}
    ranked = sorted(rows, key=lambda row: row[2], reverse=True)[:5]
    print("TOP_RESOURCES")
    if not ranked:
        print("  none")
    for key, day, allocated, cards in ranked:
        resource = resources[key]
        capacity = _capacity(resource, day, None, None)
        utilization = "" if capacity in (None, 0) else f"{(allocated / capacity):.2%}"
        print(f"  {key} {day} capacity={capacity} allocated={allocated} utilization={utilization} cards={cards}")
    allocation_count = func.count(CalendarAllocation.id)
    duplicates = db.execute(select(
        CalendarAllocation.assignment_id, CalendarAllocation.resource_key, CalendarAllocation.date, allocation_count
    ).group_by(CalendarAllocation.assignment_id, CalendarAllocation.resource_key, CalendarAllocation.date).having(allocation_count > 1)).all()
    positive = db.scalar(select(func.count(CalendarAllocation.id)).where(CalendarAllocation.allocated_amount <= 0))
    stress_alloc = db.scalar(select(func.count()).select_from(CalendarAllocation).join(CalendarAssignment).where(
        CalendarAssignment.technical_card_id.in_(card_ids)
    )) if card_ids else 0
    print(f"DUPLICATES {len(duplicates)} NONPOSITIVE {positive} STRESS_ALLOCATIONS {stress_alloc}")


def measure(db: Session) -> None:
    card_ids = _stress_ids(db)
    foreign_before = _foreign_fingerprint(db, card_ids)
    first, first_time, first_queries, first_peak = _run_schedule(db)
    _print_result("FIRST", first, first_time, first_queries, first_peak)
    first_plan = _fingerprint(db, card_ids)
    second, second_time, second_queries, second_peak = _run_schedule(db)
    _print_result("SECOND", second, second_time, second_queries, second_peak)
    second_plan = _fingerprint(db, card_ids)
    print(f"DETERMINISTIC {first.model_dump() == second.model_dump() and first_plan == second_plan}")
    print(f"PLAN_ROWS {len(first_plan)} CHANGED_ON_REPEAT {first_plan != second_plan}")
    print(f"FOREIGN_UNCHANGED {_foreign_fingerprint(db, card_ids) == foreign_before}")
    assignments = db.scalar(select(func.count()).select_from(CalendarAssignment).where(CalendarAssignment.technical_card_id.in_(card_ids)))
    allocations = db.scalar(select(func.count()).select_from(CalendarAllocation).join(CalendarAssignment).where(
        CalendarAssignment.technical_card_id.in_(card_ids)
    ))
    print(f"STRESS_ASSIGNMENTS {assignments} STRESS_ALLOCATIONS {allocations}")
    _capacity_report(db, card_ids)


def reshape(db: Session) -> None:
    for number, priority in RESHAPE.items():
        card = db.scalar(select(TechnicalCard).where(TechnicalCard.number == number))
        if card is None:
            raise RuntimeError(f"{number} is missing")
        card.priority = priority
    db.commit()
    card_ids = _stress_ids(db)
    before = _fingerprint(db, card_ids)
    foreign_before = _foreign_fingerprint(db, card_ids)
    result, elapsed, queries, peak = _run_schedule(db)
    _print_result("RESHAPE", result, elapsed, queries, peak)
    after = _fingerprint(db, card_ids)
    again, again_time, again_queries, again_peak = _run_schedule(db)
    _print_result("RESHAPE_REPEAT", again, again_time, again_queries, again_peak)
    print(f"RESHAPE_CHANGED_PLAN {before != after}")
    print(f"RESHAPE_DETERMINISTIC {result.model_dump() == again.model_dump() and after == _fingerprint(db, card_ids)}")
    print(f"FOREIGN_UNCHANGED {_foreign_fingerprint(db, card_ids) == foreign_before}")
    for card in db.scalars(select(TechnicalCard).where(TechnicalCard.number.like(f"{PREFIX}%")).order_by(TechnicalCard.number)):
        print(f"FINAL {card.id} {card.number} priority={card.priority} qty={card.quantity} start={card.planning_start_date} ship={card.shipping_date} route={card.routing_template_id}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--measure", action="store_true")
    parser.add_argument("--reshape", action="store_true")
    args = parser.parse_args()
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    engine.echo = False
    db = SessionLocal()
    try:
        if not args.reshape:
            seed(db)
        if args.measure:
            measure(db)
        if args.reshape:
            reshape(db)
        count = db.scalar(select(func.count()).select_from(TechnicalCard).where(TechnicalCard.number.like(f"{PREFIX}%")))
        print(f"PRESERVED {count}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
