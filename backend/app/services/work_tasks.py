"""WorkTask service layer (ADR-028 / Stage 23.2)."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.auth import PlatformUser
from app.models.production_order import ProductionOrder
from app.models.production_stage import ProductionStage
from app.models.sales import Lead, SalesOrder
from app.models.work_tasks import WorkTask, WorkTaskAttachment, WorkTaskMessage, WorkTaskStatus
from app.schemas.work_tasks import (
    WorkTaskAttachmentRead,
    WorkTaskCreate,
    WorkTaskListItem,
    WorkTaskMessageRead,
    WorkTaskRead,
    WorkTaskUpdate,
)
from app.services.work_task_media import (
    WorkTaskMediaError,
    assert_allowed_task_image_mime,
    build_task_attachment_storage_key,
    resolve_task_attachment_path,
    write_task_attachment_bytes,
)


class WorkTaskNotFoundError(RuntimeError):
    pass


class WorkTaskValidationError(RuntimeError):
    pass


def _to_read(row: WorkTask) -> WorkTaskRead:
    return WorkTaskRead.model_validate(row)


def _to_list_items(db: Session, rows: list[WorkTask]) -> list[WorkTaskListItem]:
    stage_ids = {row.production_stage_id for row in rows if row.production_stage_id is not None}
    user_ids: set[int] = set()
    for row in rows:
        if row.responsible_platform_user_id is not None:
            user_ids.add(row.responsible_platform_user_id)
        if row.executor_platform_user_id is not None:
            user_ids.add(row.executor_platform_user_id)

    stage_names: dict[int, str] = {}
    if stage_ids:
        for stage in db.scalars(
            select(ProductionStage).where(ProductionStage.id.in_(stage_ids))
        ).all():
            stage_names[stage.id] = stage.name

    user_names: dict[int, str] = {}
    if user_ids:
        for user in db.scalars(
            select(PlatformUser).where(PlatformUser.id.in_(user_ids))
        ).all():
            user_names[user.id] = user.display_name

    items: list[WorkTaskListItem] = []
    for row in rows:
        items.append(
            WorkTaskListItem(
                id=row.id,
                title=row.title,
                status=row.status,
                production_stage_id=row.production_stage_id,
                production_stage_name=(
                    stage_names.get(row.production_stage_id)
                    if row.production_stage_id is not None
                    else None
                ),
                responsible_platform_user_id=row.responsible_platform_user_id,
                responsible_display_name=(
                    user_names.get(row.responsible_platform_user_id)
                    if row.responsible_platform_user_id is not None
                    else None
                ),
                executor_platform_user_id=row.executor_platform_user_id,
                executor_display_name=(
                    user_names.get(row.executor_platform_user_id)
                    if row.executor_platform_user_id is not None
                    else None
                ),
                lead_id=row.lead_id,
                sales_order_id=row.sales_order_id,
                production_order_id=row.production_order_id,
                due_at=row.due_at,
                created_at=row.created_at,
                updated_at=row.updated_at,
            )
        )
    return items


def _require_platform_user(db: Session, user_id: int | None, *, label: str) -> None:
    if user_id is None:
        return
    if db.get(PlatformUser, user_id) is None:
        raise WorkTaskValidationError(f"{label} not found")


def _require_stage(db: Session, stage_id: int | None) -> None:
    if stage_id is None:
        return
    if db.get(ProductionStage, stage_id) is None:
        raise WorkTaskValidationError("Production stage not found")


def _require_anchor(db: Session, payload: WorkTaskCreate) -> None:
    if payload.lead_id is not None and db.get(Lead, payload.lead_id) is None:
        raise WorkTaskNotFoundError("Lead not found")
    if payload.sales_order_id is not None and db.get(SalesOrder, payload.sales_order_id) is None:
        raise WorkTaskNotFoundError("Order not found")
    if (
        payload.production_order_id is not None
        and db.get(ProductionOrder, payload.production_order_id) is None
    ):
        raise WorkTaskNotFoundError("Production order not found")


ANCHOR_TYPES = frozenset({"lead", "sales_order", "production_order"})


def list_work_tasks(
    db: Session,
    *,
    status: str | None = None,
    production_stage_id: int | None = None,
    executor_platform_user_id: int | None = None,
    responsible_platform_user_id: int | None = None,
    lead_id: int | None = None,
    sales_order_id: int | None = None,
    production_order_id: int | None = None,
    anchor_type: str | None = None,
) -> list[WorkTaskListItem]:
    if anchor_type is not None and anchor_type not in ANCHOR_TYPES:
        raise WorkTaskValidationError(
            "anchor_type must be one of: lead, sales_order, production_order"
        )
    stmt = select(WorkTask).order_by(WorkTask.id.desc())
    if status is not None:
        stmt = stmt.where(WorkTask.status == status)
    if production_stage_id is not None:
        stmt = stmt.where(WorkTask.production_stage_id == production_stage_id)
    if executor_platform_user_id is not None:
        stmt = stmt.where(WorkTask.executor_platform_user_id == executor_platform_user_id)
    if responsible_platform_user_id is not None:
        stmt = stmt.where(
            WorkTask.responsible_platform_user_id == responsible_platform_user_id
        )
    if lead_id is not None:
        stmt = stmt.where(WorkTask.lead_id == lead_id)
    if sales_order_id is not None:
        stmt = stmt.where(WorkTask.sales_order_id == sales_order_id)
    if production_order_id is not None:
        stmt = stmt.where(WorkTask.production_order_id == production_order_id)
    if anchor_type == "lead":
        stmt = stmt.where(WorkTask.lead_id.is_not(None))
    elif anchor_type == "sales_order":
        stmt = stmt.where(WorkTask.sales_order_id.is_not(None))
    elif anchor_type == "production_order":
        stmt = stmt.where(WorkTask.production_order_id.is_not(None))
    rows = list(db.scalars(stmt).all())
    return _to_list_items(db, rows)


def get_work_task(db: Session, task_id: int) -> WorkTaskRead:
    row = db.get(WorkTask, task_id)
    if row is None:
        raise WorkTaskNotFoundError("Work task not found")
    return _to_read(row)


def create_work_task(db: Session, payload: WorkTaskCreate) -> WorkTaskRead:
    _require_anchor(db, payload)
    _require_stage(db, payload.production_stage_id)
    _require_platform_user(
        db, payload.responsible_platform_user_id, label="Responsible user"
    )
    _require_platform_user(db, payload.executor_platform_user_id, label="Executor user")

    row = WorkTask(
        title=payload.title,
        status=payload.status,
        production_stage_id=payload.production_stage_id,
        responsible_platform_user_id=payload.responsible_platform_user_id,
        executor_platform_user_id=payload.executor_platform_user_id,
        lead_id=payload.lead_id,
        sales_order_id=payload.sales_order_id,
        production_order_id=payload.production_order_id,
        due_at=payload.due_at,
        completed_at=(
            datetime.now(UTC)
            if payload.status in {WorkTaskStatus.DONE.value, "done"}
            else None
        ),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_read(row)


def update_work_task(db: Session, task_id: int, payload: WorkTaskUpdate) -> WorkTaskRead:
    row = db.get(WorkTask, task_id)
    if row is None:
        raise WorkTaskNotFoundError("Work task not found")

    data = payload.model_dump(exclude_unset=True)
    if "production_stage_id" in data:
        _require_stage(db, data["production_stage_id"])
    if "responsible_platform_user_id" in data:
        _require_platform_user(
            db, data["responsible_platform_user_id"], label="Responsible user"
        )
    if "executor_platform_user_id" in data:
        _require_platform_user(
            db, data["executor_platform_user_id"], label="Executor user"
        )

    for key, value in data.items():
        setattr(row, key, value)

    if "status" in data:
        if data["status"] == WorkTaskStatus.DONE.value:
            row.completed_at = row.completed_at or datetime.now(UTC)
        elif data["status"] != WorkTaskStatus.DONE.value:
            row.completed_at = None

    db.commit()
    db.refresh(row)
    return _to_read(row)


def _message_to_read(
    row: WorkTaskMessage,
    *,
    author_display_name: str | None = None,
) -> WorkTaskMessageRead:
    return WorkTaskMessageRead(
        id=row.id,
        work_task_id=row.work_task_id,
        author_platform_user_id=row.author_platform_user_id,
        author_display_name=author_display_name,
        body=row.body,
        created_at=row.created_at,
        attachments=[
            WorkTaskAttachmentRead.model_validate(item) for item in row.attachments
        ],
    )


def _messages_to_read(db: Session, rows: list[WorkTaskMessage]) -> list[WorkTaskMessageRead]:
    author_ids = {row.author_platform_user_id for row in rows}
    names: dict[int, str] = {}
    if author_ids:
        for user in db.scalars(
            select(PlatformUser).where(PlatformUser.id.in_(author_ids))
        ).all():
            names[user.id] = user.display_name
    return [
        _message_to_read(row, author_display_name=names.get(row.author_platform_user_id))
        for row in rows
    ]


def _get_task_or_404(db: Session, task_id: int) -> WorkTask:
    row = db.get(WorkTask, task_id)
    if row is None:
        raise WorkTaskNotFoundError("Work task not found")
    return row


def list_work_task_messages(db: Session, task_id: int) -> list[WorkTaskMessageRead]:
    _get_task_or_404(db, task_id)
    stmt = (
        select(WorkTaskMessage)
        .where(WorkTaskMessage.work_task_id == task_id)
        .order_by(WorkTaskMessage.id)
    )
    rows = list(db.scalars(stmt).all())
    return _messages_to_read(db, rows)


def create_work_task_message(
    db: Session,
    task_id: int,
    author: PlatformUser,
    *,
    body: str,
    file_bytes: bytes | None = None,
    filename: str | None = None,
    content_type: str | None = None,
) -> WorkTaskMessageRead:
    task = _get_task_or_404(db, task_id)
    text = (body or "").strip()
    has_file = bool(file_bytes)
    if not text and not has_file:
        raise WorkTaskValidationError("Message body or image file is required")

    message = WorkTaskMessage(
        work_task_id=task.id,
        author_platform_user_id=author.id,
        body=text,
    )
    db.add(message)
    db.flush()

    if has_file:
        mime = (content_type or "").split(";")[0].strip().lower() or "application/octet-stream"
        try:
            assert_allowed_task_image_mime(mime)
        except WorkTaskMediaError as error:
            raise WorkTaskValidationError(str(error)) from error
        safe_name = filename or "image.bin"
        try:
            storage_key = build_task_attachment_storage_key(task.id, safe_name)
            write_task_attachment_bytes(storage_key, file_bytes or b"")
        except WorkTaskMediaError as error:
            raise WorkTaskValidationError(str(error)) from error
        attachment = WorkTaskAttachment(
            message_id=message.id,
            storage_key=storage_key,
            mime_type=mime,
            size_bytes=len(file_bytes or b""),
            original_filename=safe_name[:255],
        )
        db.add(attachment)

    db.commit()
    db.refresh(message)
    return _message_to_read(message, author_display_name=author.display_name)


def get_work_task_attachment_file(
    db: Session, task_id: int, attachment_id: int
) -> tuple[bytes, str, str]:
    _get_task_or_404(db, task_id)
    attachment = db.get(WorkTaskAttachment, attachment_id)
    if attachment is None:
        raise WorkTaskNotFoundError("Attachment not found")
    message = db.get(WorkTaskMessage, attachment.message_id)
    if message is None or message.work_task_id != task_id:
        raise WorkTaskNotFoundError("Attachment not found")
    try:
        path = resolve_task_attachment_path(attachment.storage_key)
    except WorkTaskMediaError as error:
        raise WorkTaskValidationError(str(error)) from error
    if not path.exists():
        raise WorkTaskNotFoundError("Attachment file missing")
    return path.read_bytes(), attachment.mime_type, attachment.original_filename


def list_lead_work_tasks(db: Session, lead_id: int) -> list[WorkTaskListItem]:
    if db.get(Lead, lead_id) is None:
        raise WorkTaskNotFoundError("Lead not found")
    return list_work_tasks(db, lead_id=lead_id)


def list_order_work_tasks(db: Session, order_id: int) -> list[WorkTaskListItem]:
    if db.get(SalesOrder, order_id) is None:
        raise WorkTaskNotFoundError("Order not found")
    return list_work_tasks(db, sales_order_id=order_id)


def list_production_order_work_tasks(
    db: Session, production_order_id: int
) -> list[WorkTaskListItem]:
    if db.get(ProductionOrder, production_order_id) is None:
        raise WorkTaskNotFoundError("Production order not found")
    return list_work_tasks(db, production_order_id=production_order_id)
