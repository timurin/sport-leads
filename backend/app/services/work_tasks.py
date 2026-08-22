"""WorkTask service layer (ADR-028 / Stage 23.2)."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.auth import PlatformUser
from app.models.production_order import ProductionOrder
from app.models.production_stage import ProductionStage
from app.models.sales import Client, Lead, SalesOrder
from app.models.work_tasks import WorkTask, WorkTaskAttachment, WorkTaskBoardStage, WorkTaskMessage, WorkTaskStatus
from app.schemas.work_tasks import (
    WorkTaskAttachmentRead,
    WorkTaskCreate,
    WorkTaskListItem,
    WorkTaskMessageRead,
    WorkTaskRead,
    WorkTaskSalesOrderSummary,
    WorkTaskUpdate,
)
from app.services import work_task_board_stages as board_stage_svc
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


def _format_order_amount(amount: object) -> str | None:
    if amount is None:
        return None
    return f"{amount:.2f}"


def _sales_order_summary(
    db: Session, sales_order_id: int | None
) -> WorkTaskSalesOrderSummary | None:
    if sales_order_id is None:
        return None
    order = db.get(SalesOrder, sales_order_id)
    if order is None:
        return None
    client = db.get(Client, order.client_id) if order.client_id else None
    status = order.status.value if hasattr(order.status, "value") else str(order.status)
    return WorkTaskSalesOrderSummary(
        id=order.id,
        number=order.number,
        client_company_name=client.company_name if client is not None else None,
        status=status,
        amount=_format_order_amount(order.amount),
        currency_code=order.currency_code,
        desired_date=order.desired_date,
    )


def _to_read(row: WorkTask, db: Session | None = None) -> WorkTaskRead:
    if db is None:
        return WorkTaskRead.model_validate(row)
    items = _to_list_items(db, [row])
    item = items[0]
    return WorkTaskRead(
        id=row.id,
        title=row.title,
        status=row.status,
        production_stage_id=row.production_stage_id,
        production_stage_name=item.production_stage_name,
        board_stage_id=row.board_stage_id,
        board_stage_name=item.board_stage_name,
        created_by_platform_user_id=row.created_by_platform_user_id,
        created_by_display_name=item.created_by_display_name,
        responsible_platform_user_id=row.responsible_platform_user_id,
        responsible_display_name=item.responsible_display_name,
        executor_platform_user_id=row.executor_platform_user_id,
        executor_display_name=item.executor_display_name,
        lead_id=row.lead_id,
        sales_order_id=row.sales_order_id,
        sales_order_summary=_sales_order_summary(db, row.sales_order_id),
        production_order_id=row.production_order_id,
        due_at=row.due_at,
        created_at=row.created_at,
        updated_at=row.updated_at,
        completed_at=row.completed_at,
    )


def _to_list_items(db: Session, rows: list[WorkTask]) -> list[WorkTaskListItem]:
    stage_ids = {row.production_stage_id for row in rows if row.production_stage_id is not None}
    board_ids = {row.board_stage_id for row in rows if row.board_stage_id is not None}
    user_ids: set[int] = set()
    for row in rows:
        if row.created_by_platform_user_id is not None:
            user_ids.add(row.created_by_platform_user_id)
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

    board_names: dict[int, str] = {}
    if board_ids:
        for stage in db.scalars(
            select(WorkTaskBoardStage).where(WorkTaskBoardStage.id.in_(board_ids))
        ).all():
            board_names[stage.id] = stage.name

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
                board_stage_id=row.board_stage_id,
                board_stage_name=(
                    board_names.get(row.board_stage_id)
                    if row.board_stage_id is not None
                    else None
                ),
                created_by_platform_user_id=row.created_by_platform_user_id,
                created_by_display_name=(
                    user_names.get(row.created_by_platform_user_id)
                    if row.created_by_platform_user_id is not None
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
    return _to_read(row, db)


def create_work_task(
    db: Session,
    payload: WorkTaskCreate,
    *,
    created_by_platform_user_id: int | None = None,
) -> WorkTaskRead:
    _require_anchor(db, payload)
    _require_stage(db, payload.production_stage_id)
    try:
        board_stage_svc.require_board_stage(db, payload.board_stage_id)
    except board_stage_svc.BoardStageValidationError as error:
        raise WorkTaskValidationError(str(error)) from error
    _require_platform_user(
        db, payload.responsible_platform_user_id, label="Responsible user"
    )
    _require_platform_user(db, payload.executor_platform_user_id, label="Executor user")
    _require_platform_user(
        db, created_by_platform_user_id, label="Created-by user"
    )

    board_stage_id = payload.board_stage_id
    if board_stage_id is None:
        first = db.scalar(
            select(WorkTaskBoardStage)
            .where(WorkTaskBoardStage.is_active.is_(True))
            .order_by(WorkTaskBoardStage.sort_order.asc(), WorkTaskBoardStage.id.asc())
        )
        board_stage_id = first.id if first is not None else None

    row = WorkTask(
        title=payload.title,
        status=payload.status,
        production_stage_id=payload.production_stage_id,
        board_stage_id=board_stage_id,
        created_by_platform_user_id=created_by_platform_user_id,
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
    if payload.status in {WorkTaskStatus.DONE.value, "done"}:
        done_stage = board_stage_svc.find_done_board_stage(db)
        if done_stage is not None:
            row.board_stage_id = done_stage.id
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_read(row, db)


def update_work_task(db: Session, task_id: int, payload: WorkTaskUpdate) -> WorkTaskRead:
    row = db.get(WorkTask, task_id)
    if row is None:
        raise WorkTaskNotFoundError("Work task not found")

    data = payload.model_dump(exclude_unset=True)
    if "production_stage_id" in data:
        _require_stage(db, data["production_stage_id"])
    if "board_stage_id" in data:
        try:
            board_stage_svc.require_board_stage(db, data["board_stage_id"])
        except board_stage_svc.BoardStageValidationError as error:
            raise WorkTaskValidationError(str(error)) from error
    if "responsible_platform_user_id" in data:
        _require_platform_user(
            db, data["responsible_platform_user_id"], label="Responsible user"
        )
    if "executor_platform_user_id" in data:
        _require_platform_user(
            db, data["executor_platform_user_id"], label="Executor user"
        )

    previous_board_stage_id = row.board_stage_id
    for key, value in data.items():
        setattr(row, key, value)

    _sync_status_and_board_stage(
        db,
        row,
        status_in_payload="status" in data,
        board_in_payload="board_stage_id" in data,
        previous_board_stage_id=previous_board_stage_id,
    )

    db.commit()
    db.refresh(row)
    return _to_read(row, db)


def _sync_status_and_board_stage(
    db: Session,
    row: WorkTask,
    *,
    status_in_payload: bool,
    board_in_payload: bool,
    previous_board_stage_id: int | None,
) -> None:
    """Keep status=done ↔ board stage «Готово» aligned (2026-08-10)."""
    done_stage = board_stage_svc.find_done_board_stage(db)
    done_stage_id = done_stage.id if done_stage is not None else None
    now = datetime.now(UTC)

    if status_in_payload:
        if row.status == WorkTaskStatus.DONE.value:
            row.completed_at = row.completed_at or now
            if done_stage_id is not None:
                row.board_stage_id = done_stage_id
        else:
            row.completed_at = None
            if (
                done_stage_id is not None
                and row.board_stage_id == done_stage_id
                and not board_in_payload
            ):
                reopen = board_stage_svc.find_reopen_board_stage(db)
                row.board_stage_id = reopen.id if reopen is not None else None

    if board_in_payload:
        if (
            done_stage_id is not None
            and row.board_stage_id == done_stage_id
        ):
            row.status = WorkTaskStatus.DONE.value
            row.completed_at = row.completed_at or now
        elif (
            board_stage_svc.is_done_board_stage_id(db, previous_board_stage_id)
            or (
                row.status == WorkTaskStatus.DONE.value
                and not status_in_payload
            )
        ):
            if row.board_stage_id != done_stage_id:
                if not status_in_payload:
                    row.status = WorkTaskStatus.OPEN.value
                    row.completed_at = None


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
