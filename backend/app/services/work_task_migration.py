"""One-time data migrate LeadTask + CollaborationMicrotask → WorkTask (23.6.1 / ADR-028)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.work_tasks import WorkTask, WorkTaskStatus

SOURCE_LEAD_TASK = "lead_task"
SOURCE_MICROTASK = "collaboration_microtask"


def _as_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo is not None else value.replace(tzinfo=UTC)
    if isinstance(value, str):
        text_value = value.strip().replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(text_value)
        except ValueError:
            return None
        return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=UTC)
    return None


def _platform_user_for_sales_user(db: Session, sales_user_id: int | None) -> int | None:
    if sales_user_id is None:
        return None
    row = db.execute(
        text(
            """
            SELECT id
            FROM platform_users
            WHERE sales_user_id = :sales_user_id
            ORDER BY id
            LIMIT 1
            """
        ),
        {"sales_user_id": sales_user_id},
    ).first()
    return int(row[0]) if row is not None else None


def _already_migrated(db: Session, source_kind: str, source_id: int) -> bool:
    row = db.execute(
        text(
            """
            SELECT 1
            FROM work_task_migration_map
            WHERE source_kind = :source_kind AND source_id = :source_id
            LIMIT 1
            """
        ),
        {"source_kind": source_kind, "source_id": source_id},
    ).first()
    return row is not None


def _map_lead_task_status(raw: str) -> str:
    value = (raw or "").strip().lower()
    if value == "completed":
        return WorkTaskStatus.DONE.value
    if value == "cancelled":
        return WorkTaskStatus.CANCELLED.value
    return WorkTaskStatus.OPEN.value


def _map_microtask_status(raw: str) -> str:
    value = (raw or "").strip().lower()
    if value == "done":
        return WorkTaskStatus.DONE.value
    return WorkTaskStatus.OPEN.value


def migrate_lead_tasks(db: Session) -> int:
    """Copy lead_tasks rows into work_tasks (lead anchor). Returns inserted count."""
    rows = db.execute(
        text(
            """
            SELECT
              id,
              lead_id,
              title,
              status,
              due_at,
              assigned_to_id,
              created_by_id,
              created_at,
              completed_at
            FROM lead_tasks
            ORDER BY id
            """
        )
    ).mappings().all()

    inserted = 0
    for row in rows:
        source_id = int(row["id"])
        if _already_migrated(db, SOURCE_LEAD_TASK, source_id):
            continue

        created_at = _as_datetime(row["created_at"]) or datetime.now(UTC)
        work_task = WorkTask(
            title=str(row["title"]).strip() or f"Lead task #{source_id}",
            status=_map_lead_task_status(str(row["status"])),
            production_stage_id=None,
            responsible_platform_user_id=_platform_user_for_sales_user(
                db, row["created_by_id"]
            ),
            executor_platform_user_id=_platform_user_for_sales_user(
                db, row["assigned_to_id"]
            ),
            lead_id=int(row["lead_id"]),
            sales_order_id=None,
            production_order_id=None,
            due_at=_as_datetime(row["due_at"]),
            created_at=created_at,
            updated_at=created_at,
            completed_at=_as_datetime(row["completed_at"]),
        )
        db.add(work_task)
        db.flush()
        db.execute(
            text(
                """
                INSERT INTO work_task_migration_map (source_kind, source_id, work_task_id)
                VALUES (:source_kind, :source_id, :work_task_id)
                """
            ),
            {
                "source_kind": SOURCE_LEAD_TASK,
                "source_id": source_id,
                "work_task_id": work_task.id,
            },
        )
        inserted += 1
    return inserted


def migrate_collaboration_microtasks(db: Session) -> int:
    """Copy collaboration_microtasks into work_tasks (lead|order). Returns inserted count."""
    rows = db.execute(
        text(
            """
            SELECT
              id,
              sales_order_id,
              lead_id,
              title,
              status,
              assignee_platform_user_id,
              created_by_platform_user_id,
              created_at,
              updated_at,
              completed_at
            FROM collaboration_microtasks
            ORDER BY id
            """
        )
    ).mappings().all()

    inserted = 0
    for row in rows:
        source_id = int(row["id"])
        if _already_migrated(db, SOURCE_MICROTASK, source_id):
            continue

        lead_id = row["lead_id"]
        sales_order_id = row["sales_order_id"]
        if (lead_id is None) == (sales_order_id is None):
            # Skip malformed anchors; keep source row for manual review.
            continue

        created_at = _as_datetime(row["created_at"]) or datetime.now(UTC)
        updated_at = _as_datetime(row["updated_at"]) or created_at
        work_task = WorkTask(
            title=str(row["title"]).strip() or f"Microtask #{source_id}",
            status=_map_microtask_status(str(row["status"])),
            production_stage_id=None,
            responsible_platform_user_id=int(row["created_by_platform_user_id"]),
            executor_platform_user_id=int(row["assignee_platform_user_id"]),
            lead_id=int(lead_id) if lead_id is not None else None,
            sales_order_id=int(sales_order_id) if sales_order_id is not None else None,
            production_order_id=None,
            due_at=None,
            created_at=created_at,
            updated_at=updated_at,
            completed_at=_as_datetime(row["completed_at"]),
        )
        db.add(work_task)
        db.flush()
        db.execute(
            text(
                """
                INSERT INTO work_task_migration_map (source_kind, source_id, work_task_id)
                VALUES (:source_kind, :source_id, :work_task_id)
                """
            ),
            {
                "source_kind": SOURCE_MICROTASK,
                "source_id": source_id,
                "work_task_id": work_task.id,
            },
        )
        inserted += 1
    return inserted


def run_work_task_data_migration(db: Session) -> dict[str, int]:
    """Idempotent migrate. Old LeadTask / CollaborationMicrotask rows stay."""
    lead_count = migrate_lead_tasks(db)
    micro_count = migrate_collaboration_microtasks(db)
    return {
        "lead_tasks": lead_count,
        "collaboration_microtasks": micro_count,
    }


def revert_work_task_data_migration(db: Session) -> int:
    """Delete WorkTask rows created by this migrate (via map). Returns deleted count."""
    rows = db.execute(
        text(
            """
            SELECT work_task_id
            FROM work_task_migration_map
            ORDER BY work_task_id DESC
            """
        )
    ).all()
    deleted = 0
    for (work_task_id,) in rows:
        task = db.get(WorkTask, int(work_task_id))
        if task is not None:
            db.delete(task)
            deleted += 1
    db.execute(text("DELETE FROM work_task_migration_map"))
    return deleted
