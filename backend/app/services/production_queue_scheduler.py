"""PC-04.4A: explicit queue orchestration over the existing card engine."""
from datetime import date, datetime, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.calendar_assignment import CalendarAssignment

from app.repositories import production_scheduler as repo
from app.schemas.production_schedule import QueueCardScheduleRead, QueueScheduleRead
from app.services.production_demand import load_card_demand_snapshot
from app.services.production_scheduler import (
    _protected, _value, delete_auto_plan, priority_sort_key, schedule_card_in_transaction,
)
from app.services.technical_card_planning import planning_start_on, platform_timezone_name
from app.services.technical_cards import TechnicalCardConflictError


def schedule_queue(db: Session, *, today: date | None = None) -> QueueScheduleRead:
    """Own one transaction. Domain-blocked cards keep their original plans.

    Restore/replay when a blocked card had capacity in its old AUTO plan. This
    ensures successful higher-priority cards cannot steal a retained old plan's
    capacity. No intermediate round is visible outside this transaction.
    """
    try:
        repo.lock_scheduler(db)
        current = today or planning_start_on(datetime.now(timezone.utc), platform_timezone_name(db))
        from app.services.workshop_queue import respect_workshop_order
        cards = respect_workshop_order(db, sorted(repo.read_queue(db), key=priority_sort_key))
        manual_order = {row.stage_result_id: row.queue_position for row in db.scalars(select(CalendarAssignment).where(
            CalendarAssignment.queue_position.is_not(None)))}
        identities = {card.id: (card.number, card.priority) for card in cards}
        ordered_ids = [card.id for card in cards]
        replaceable, existing = {}, {}
        for card in cards:
            snapshot = load_card_demand_snapshot(db, card.id)
            data = repo.read_inputs(db, card, snapshot, True)
            steps = {step.routing_stage_line_id: step for step in snapshot.steps}
            facts = {fact.stage_order for fact in data["facts"] if _value(fact.status) in {"in_progress", "completed"}}
            entry_stages = {stage.id for stage in data["stages"] if stage.code == "launch_preparation"}
            existing[card.id] = card.plan_locked or any(row.production_stage_id not in entry_stages for row in data["own"])
            replaceable[card.id] = set() if card.plan_locked or data["linkage_issues"] else {
                row.id for row in data["own"] if row.routing_stage_line_id is not None
                and row.production_stage_id not in entry_stages
                and not _protected(row, facts, steps, current)
            }
        active = list(ordered_ids)
        blocked = {}
        while True:
            checkpoint = db.begin_nested()
            delete_auto_plan(db, set().union(*(replaceable[key] for key in active)))
            results = {}
            failed = []
            for card_id in active:
                result = schedule_card_in_transaction(db, card_id, persist=True, today=current)
                if result.status == "planned":
                    for step in result.steps:
                        if step.snapshot_node_id in manual_order:
                            db.get(CalendarAssignment, step.assignment_id).queue_position = manual_order[step.snapshot_node_id]
                    db.flush()
                results[card_id] = result
                if result.status == "blocked":
                    failed.append(card_id)
            # Only failures with removed old occupancy require a replay. Otherwise
            # their protected rows remained visible throughout this round.
            if any(replaceable[key] for key in failed):
                checkpoint.rollback()
                blocked.update({key: results[key] for key in failed})
                active = [key for key in active if key not in failed]
                continue
            checkpoint.commit()
            blocked.update({key: results[key] for key in failed})
            planned = {key: result for key, result in results.items() if result.status == "planned"}
            break
        summary = []
        for key in ordered_ids:
            result = planned.get(key) or blocked[key]
            preserved = (existing[key] if result.status == "blocked" else any(step.preserved for step in result.steps))
            summary.append(QueueCardScheduleRead(
                technical_card_id=key, technical_card_number=identities[key][0], priority=identities[key][1],
                status=result.status, persisted=result.status == "planned", preserved=preserved,
                planned_completion_date=result.planned_completion_date, on_time=result.on_time,
                buffer_days=result.buffer_days, delay_days=result.delay_days,
                steps_count=len(result.steps), deviations=result.deviations,
            ))
        count = len(planned)
        response = QueueScheduleRead(
            status="empty" if not summary else "planned" if count == len(summary) else "partial" if count else "blocked",
            total_cards=len(summary), planned_cards=count, blocked_cards=len(summary) - count,
            deadline_missed_cards=sum(row.on_time is False for row in summary),
            preserved_cards=sum(row.preserved for row in summary), results=summary,
        )
        db.commit()
        return response
    except IntegrityError as error:
        db.rollback()
        raise TechnicalCardConflictError("Queue changed concurrently; retry the explicit command") from error
    except Exception:
        db.rollback()
        raise
