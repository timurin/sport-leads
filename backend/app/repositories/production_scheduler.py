"""Batched scheduler inputs. Shared resource locks serialize schedule commands."""
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.models.calendar_allocation import CalendarAllocation
from app.models.calendar_assignment import CalendarAssignment
from app.models.production_capacity import CapacityResource, ProductionCapacityException
from app.models.production_stage import ProductionStage
from app.models.shop_routing import ShopRoutingStageLine, ShopRoutingTemplate, WorkCenter
from app.models.tech_operation import TechOperation
from app.models.technical_card import TechnicalCard, TechnicalCardOperationLine, TechnicalCardStageResult


def lock_scheduler(db: Session) -> None:
    """One transaction-level gate for single and mass scheduler commands.

    Acquire before card/resource locks to prevent batch/single lock inversions.
    SQLite tests use a single writer; PostgreSQL is the deployment database.
    """
    if db.get_bind().dialect.name == "postgresql":
        db.execute(text("SELECT pg_advisory_xact_lock(704044001)"))


def read_queue(db: Session):
    # Readiness failures are included in the summary, not silently filtered out.
    return list(db.scalars(select(TechnicalCard).where(
        TechnicalCard.order_group_id.is_not(None), TechnicalCard.sales_order_id.is_(None),
        TechnicalCard.status.in_(["draft", "in_progress"]),
    ).order_by(TechnicalCard.id).with_for_update().execution_options(populate_existing=True)))


def read_card(db: Session, card_id: int, lock: bool):
    query = select(TechnicalCard).where(TechnicalCard.id == card_id)
    return db.scalar(query.with_for_update() if lock else query)


def _rows_by_id(db: Session, model, identifiers: set[int]) -> dict:
    if not identifiers:
        return {}
    return {row.id: row for row in db.scalars(select(model).where(model.id.in_(identifiers)))}


def read_inputs(db: Session, card, snapshot, lock: bool):
    from app.services.route_verification import route_review_issue
    review = route_review_issue(db, card)
    from app.services.calendar_plan_linkage import card_linkage_issues
    from app.services.calendar_plan_freshness import stale_issue
    own_query = select(CalendarAssignment).where(CalendarAssignment.technical_card_id == card.id).order_by(CalendarAssignment.id)
    own = list(db.scalars(own_query.with_for_update() if lock else own_query))
    keys = {resource.resource_key for step in snapshot.steps for resource in step.resources}
    keys.update(db.scalars(select(CalendarAllocation.resource_key).join(CalendarAssignment).where(CalendarAssignment.technical_card_id == card.id)))
    query = select(CapacityResource).where(CapacityResource.resource_key.in_(keys)).order_by(CapacityResource.resource_key)
    resources = list(db.scalars((query.with_for_update() if lock else query).execution_options(populate_existing=True)))
    # Read allocations only after the shared locks, seeing the preceding command's commit.
    allocations = list(db.execute(select(CalendarAllocation, CalendarAssignment).join(CalendarAssignment).where(CalendarAllocation.resource_key.in_(keys)).order_by(CalendarAllocation.id)))
    owner_ids = {assignment.technical_card_id for _, assignment in allocations}
    volumes = list(db.scalars(select(TechnicalCardOperationLine).where(
        TechnicalCardOperationLine.technical_card_id.in_(owner_ids),
        TechnicalCardOperationLine.source_kind == "routing",
    )))
    return dict(
        route_review_issue=review,
        stale_assignment_ids={row.id for row in own if stale_issue(db, row)},
        linkage_issues=card_linkage_issues(db, card.id),
        own=own, resources=resources, allocations=allocations, volumes=volumes,
        exceptions=list(db.scalars(select(ProductionCapacityException).where(ProductionCapacityException.resource_key.in_(keys)))),
        facts=list(db.scalars((select(TechnicalCardStageResult).where(TechnicalCardStageResult.technical_card_id == card.id).with_for_update())
                             if lock else select(TechnicalCardStageResult).where(TechnicalCardStageResult.technical_card_id == card.id))),
        stages=list(db.scalars(select(ProductionStage))), centers=list(db.scalars(select(WorkCenter))),
        operations=list(db.scalars(select(TechOperation).where(TechOperation.id.in_({step.operation_id for step in snapshot.steps})))),
        snapshot_nodes=_rows_by_id(db, TechnicalCardStageResult, {
            owner.stage_result_id for _, owner in allocations if owner.stage_result_id is not None
        }),
        allocation_lines=_rows_by_id(db, ShopRoutingStageLine, {
            owner.routing_stage_line_id for _, owner in allocations
            if owner.stage_result_id is None and owner.routing_stage_line_id is not None
        }),
        route=db.get(ShopRoutingTemplate, card.routing_template_id) if card.routing_template_id else None,
    )
