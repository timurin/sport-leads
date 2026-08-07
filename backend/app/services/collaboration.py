"""Internal collaboration service (ADR-026 / Stage 19.1–19.2)."""

from __future__ import annotations

import re
from datetime import datetime, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.auth import PlatformUser
from app.models.collaboration import (
    CollaborationMention,
    CollaborationMessage,
    CollaborationMicrotask,
    CollaborationMicrotaskStatus,
    CollaborationNotification,
    CollaborationNotificationKind,
    CollaborationThread,
)
from app.models.sales import Lead, SalesOrder
from app.models.technical_card import TechnicalCard
from app.schemas.collaboration import (
    MICROTASK_TITLE_TEMPLATES,
    CollaborationMentionCandidateRead,
    CollaborationMentionRead,
    CollaborationMessageCreate,
    CollaborationMessageRead,
    CollaborationMicrotaskCreate,
    CollaborationMicrotaskRead,
    CollaborationMicrotaskStatusUpdate,
    CollaborationNotificationListRead,
    CollaborationNotificationRead,
)

_MENTION_RE = re.compile(r"(?<![\w.])@([A-Za-z0-9_./-]{1,64})")


class CollaborationNotFoundError(RuntimeError):
    pass


class CollaborationValidationError(RuntimeError):
    pass


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _get_order(db: Session, order_id: int) -> SalesOrder:
    order = db.get(SalesOrder, order_id)
    if order is None:
        raise CollaborationNotFoundError("Заказ не найден")
    return order


def _get_lead(db: Session, lead_id: int) -> Lead:
    lead = db.get(Lead, lead_id)
    if lead is None:
        raise CollaborationNotFoundError("Лид не найден")
    return lead


def _ensure_technical_card_on_order(
    db: Session,
    *,
    order_id: int,
    technical_card_id: int | None,
) -> None:
    if technical_card_id is None:
        return
    card = db.get(TechnicalCard, technical_card_id)
    if card is None or card.sales_order_id != order_id:
        raise CollaborationValidationError(
            "Техкарта не принадлежит этому заказу"
        )


def get_or_create_thread(db: Session, order_id: int) -> CollaborationThread:
    _get_order(db, order_id)
    thread = db.scalar(
        select(CollaborationThread).where(
            CollaborationThread.sales_order_id == order_id
        )
    )
    if thread is not None:
        return thread
    thread = CollaborationThread(sales_order_id=order_id, lead_id=None)
    db.add(thread)
    db.flush()
    return thread


def get_or_create_lead_thread(db: Session, lead_id: int) -> CollaborationThread:
    _get_lead(db, lead_id)
    thread = db.scalar(
        select(CollaborationThread).where(CollaborationThread.lead_id == lead_id)
    )
    if thread is not None:
        return thread
    thread = CollaborationThread(sales_order_id=None, lead_id=lead_id)
    db.add(thread)
    db.flush()
    return thread


def _message_read(
    message: CollaborationMessage,
    *,
    sales_order_id: int | None = None,
    lead_id: int | None = None,
) -> CollaborationMessageRead:
    author = message.author
    return CollaborationMessageRead(
        id=message.id,
        thread_id=message.thread_id,
        sales_order_id=sales_order_id,
        lead_id=lead_id,
        author_platform_user_id=message.author_platform_user_id,
        author_login=author.login if author is not None else "",
        author_display_name=author.display_name if author is not None else "",
        body=message.body,
        technical_card_id=message.technical_card_id,
        created_at=message.created_at,
        updated_at=message.updated_at,
        mentions=[
            CollaborationMentionRead(
                id=row.id,
                mentioned_platform_user_id=row.mentioned_platform_user_id,
                mentioned_login_snapshot=row.mentioned_login_snapshot,
                created_at=row.created_at,
            )
            for row in message.mentions
        ],
    )


def _microtask_read(row: CollaborationMicrotask) -> CollaborationMicrotaskRead:
    assignee = row.assignee
    created_by = row.created_by
    return CollaborationMicrotaskRead(
        id=row.id,
        sales_order_id=row.sales_order_id,
        lead_id=row.lead_id,
        title=row.title,
        status=row.status,
        assignee_platform_user_id=row.assignee_platform_user_id,
        assignee_login=assignee.login if assignee is not None else "",
        assignee_display_name=assignee.display_name if assignee is not None else "",
        created_by_platform_user_id=row.created_by_platform_user_id,
        created_by_login=created_by.login if created_by is not None else "",
        created_by_display_name=(
            created_by.display_name if created_by is not None else ""
        ),
        technical_card_id=row.technical_card_id,
        source_message_id=row.source_message_id,
        created_at=row.created_at,
        updated_at=row.updated_at,
        completed_at=row.completed_at,
    )


def parse_mention_logins(body: str) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for match in _MENTION_RE.finditer(body):
        login = match.group(1).lower()
        if login in seen:
            continue
        seen.add(login)
        ordered.append(login)
    return ordered


def list_messages(
    db: Session,
    order_id: int,
    *,
    technical_card_id: int | None = None,
) -> list[CollaborationMessageRead]:
    thread = get_or_create_thread(db, order_id)
    stmt = (
        select(CollaborationMessage)
        .options(
            selectinload(CollaborationMessage.author),
            selectinload(CollaborationMessage.mentions),
        )
        .where(CollaborationMessage.thread_id == thread.id)
        .order_by(CollaborationMessage.id.asc())
    )
    if technical_card_id is not None:
        _ensure_technical_card_on_order(
            db, order_id=order_id, technical_card_id=technical_card_id
        )
        stmt = stmt.where(
            CollaborationMessage.technical_card_id == technical_card_id
        )
    rows = list(db.scalars(stmt).all())
    result = [_message_read(row, sales_order_id=order_id) for row in rows]
    db.commit()
    return result


def _deep_link(
    *,
    sales_order_id: int | None,
    lead_id: int | None = None,
    technical_card_id: int | None,
) -> str:
    if technical_card_id is not None:
        return f"/production/tech-cards/{technical_card_id}"
    if lead_id is not None:
        return f"/sales/leads/{lead_id}"
    if sales_order_id is not None:
        return f"/sales/orders/{sales_order_id}"
    return "/"


def _notification_read(row: CollaborationNotification) -> CollaborationNotificationRead:
    return CollaborationNotificationRead(
        id=row.id,
        kind=row.kind,
        title=row.title,
        body=row.body,
        sales_order_id=row.sales_order_id,
        lead_id=row.lead_id,
        technical_card_id=row.technical_card_id,
        source_message_id=row.source_message_id,
        microtask_id=row.microtask_id,
        actor_platform_user_id=row.actor_platform_user_id,
        created_at=row.created_at,
        read_at=row.read_at,
        deep_link=_deep_link(
            sales_order_id=row.sales_order_id,
            lead_id=row.lead_id,
            technical_card_id=row.technical_card_id,
        ),
    )


def _emit_notification(
    db: Session,
    *,
    recipient_id: int,
    actor_id: int | None,
    kind: CollaborationNotificationKind,
    title: str,
    body: str,
    sales_order_id: int | None = None,
    lead_id: int | None = None,
    technical_card_id: int | None = None,
    source_message_id: int | None = None,
    microtask_id: int | None = None,
) -> None:
    if actor_id is not None and recipient_id == actor_id:
        return
    if (sales_order_id is None) == (lead_id is None):
        raise CollaborationValidationError(
            "Уведомление требует ровно один якорь: заказ или лид"
        )
    db.add(
        CollaborationNotification(
            recipient_platform_user_id=recipient_id,
            kind=kind.value,
            title=title,
            body=body,
            sales_order_id=sales_order_id,
            lead_id=lead_id,
            technical_card_id=technical_card_id,
            source_message_id=source_message_id,
            microtask_id=microtask_id,
            actor_platform_user_id=actor_id,
        )
    )


def create_message(
    db: Session,
    order_id: int,
    author: PlatformUser,
    payload: CollaborationMessageCreate,
) -> CollaborationMessageRead:
    thread = get_or_create_thread(db, order_id)
    _ensure_technical_card_on_order(
        db, order_id=order_id, technical_card_id=payload.technical_card_id
    )
    message = CollaborationMessage(
        thread_id=thread.id,
        author_platform_user_id=author.id,
        body=payload.body,
        technical_card_id=payload.technical_card_id,
    )
    db.add(message)
    db.flush()

    for login in parse_mention_logins(payload.body):
        user = db.scalar(
            select(PlatformUser).where(
                func.lower(PlatformUser.login) == login,
                PlatformUser.is_active.is_(True),
            )
        )
        if user is None or user.id == author.id:
            continue
        db.add(
            CollaborationMention(
                message_id=message.id,
                mentioned_platform_user_id=user.id,
                mentioned_login_snapshot=user.login,
            )
        )
        snippet = payload.body[:160]
        _emit_notification(
            db,
            recipient_id=user.id,
            actor_id=author.id,
            kind=CollaborationNotificationKind.MENTION,
            title=f"Упоминание в заказе #{order_id}",
            body=f"{author.display_name} упомянул(а) вас: {snippet}",
            sales_order_id=order_id,
            technical_card_id=payload.technical_card_id,
            source_message_id=message.id,
        )
    db.flush()
    message = db.scalar(
        select(CollaborationMessage)
        .options(
            selectinload(CollaborationMessage.author),
            selectinload(CollaborationMessage.mentions),
        )
        .where(CollaborationMessage.id == message.id)
    )
    assert message is not None
    result = _message_read(message, sales_order_id=order_id)
    db.commit()
    return result


def list_lead_messages(
    db: Session,
    lead_id: int,
) -> list[CollaborationMessageRead]:
    thread = get_or_create_lead_thread(db, lead_id)
    stmt = (
        select(CollaborationMessage)
        .options(
            selectinload(CollaborationMessage.author),
            selectinload(CollaborationMessage.mentions),
        )
        .where(CollaborationMessage.thread_id == thread.id)
        .order_by(CollaborationMessage.id.asc())
    )
    rows = list(db.scalars(stmt).all())
    result = [_message_read(row, lead_id=lead_id) for row in rows]
    db.commit()
    return result


def create_lead_message(
    db: Session,
    lead_id: int,
    author: PlatformUser,
    payload: CollaborationMessageCreate,
) -> CollaborationMessageRead:
    if payload.technical_card_id is not None:
        raise CollaborationValidationError(
            "Контекст техкарты доступен только в переписке заказа"
        )
    thread = get_or_create_lead_thread(db, lead_id)
    message = CollaborationMessage(
        thread_id=thread.id,
        author_platform_user_id=author.id,
        body=payload.body,
        technical_card_id=None,
    )
    db.add(message)
    db.flush()

    for login in parse_mention_logins(payload.body):
        user = db.scalar(
            select(PlatformUser).where(
                func.lower(PlatformUser.login) == login,
                PlatformUser.is_active.is_(True),
            )
        )
        if user is None or user.id == author.id:
            continue
        db.add(
            CollaborationMention(
                message_id=message.id,
                mentioned_platform_user_id=user.id,
                mentioned_login_snapshot=user.login,
            )
        )
        snippet = payload.body[:160]
        _emit_notification(
            db,
            recipient_id=user.id,
            actor_id=author.id,
            kind=CollaborationNotificationKind.MENTION,
            title=f"Упоминание в лиде #{lead_id}",
            body=f"{author.display_name} упомянул(а) вас: {snippet}",
            lead_id=lead_id,
            source_message_id=message.id,
        )
    db.flush()
    message = db.scalar(
        select(CollaborationMessage)
        .options(
            selectinload(CollaborationMessage.author),
            selectinload(CollaborationMessage.mentions),
        )
        .where(CollaborationMessage.id == message.id)
    )
    assert message is not None
    result = _message_read(message, lead_id=lead_id)
    db.commit()
    return result


def list_mention_candidates(
    db: Session,
    *,
    query: str | None = None,
    limit: int = 20,
) -> list[CollaborationMentionCandidateRead]:
    stmt = (
        select(PlatformUser)
        .where(PlatformUser.is_active.is_(True))
        .order_by(PlatformUser.login.asc())
        .limit(max(1, min(limit, 50)))
    )
    if query and query.strip():
        q = f"%{query.strip().lower()}%"
        stmt = stmt.where(
            or_(
                PlatformUser.login.ilike(q),
                PlatformUser.display_name.ilike(q),
            )
        )
    rows = list(db.scalars(stmt).all())
    return [
        CollaborationMentionCandidateRead(
            id=row.id,
            login=row.login,
            display_name=row.display_name,
        )
        for row in rows
    ]


def list_microtasks(
    db: Session,
    order_id: int,
    *,
    assignee_platform_user_id: int | None = None,
) -> list[CollaborationMicrotaskRead]:
    _get_order(db, order_id)
    stmt = (
        select(CollaborationMicrotask)
        .options(
            selectinload(CollaborationMicrotask.assignee),
            selectinload(CollaborationMicrotask.created_by),
        )
        .where(CollaborationMicrotask.sales_order_id == order_id)
        .order_by(CollaborationMicrotask.id.desc())
    )
    if assignee_platform_user_id is not None:
        stmt = stmt.where(
            CollaborationMicrotask.assignee_platform_user_id
            == assignee_platform_user_id
        )
    return [_microtask_read(row) for row in db.scalars(stmt).all()]


def create_microtask(
    db: Session,
    order_id: int,
    created_by: PlatformUser,
    payload: CollaborationMicrotaskCreate,
) -> CollaborationMicrotaskRead:
    _get_order(db, order_id)
    _ensure_technical_card_on_order(
        db, order_id=order_id, technical_card_id=payload.technical_card_id
    )
    assignee = db.get(PlatformUser, payload.assignee_platform_user_id)
    if assignee is None or not assignee.is_active:
        raise CollaborationValidationError("Исполнитель не найден или неактивен")
    if payload.source_message_id is not None:
        message = db.get(CollaborationMessage, payload.source_message_id)
        if message is None:
            raise CollaborationValidationError("Исходное сообщение не найдено")
        thread = db.get(CollaborationThread, message.thread_id)
        if thread is None or thread.sales_order_id != order_id:
            raise CollaborationValidationError(
                "Исходное сообщение не принадлежит этому заказу"
            )
    row = CollaborationMicrotask(
        sales_order_id=order_id,
        title=payload.title,
        status=CollaborationMicrotaskStatus.OPEN.value,
        assignee_platform_user_id=assignee.id,
        created_by_platform_user_id=created_by.id,
        technical_card_id=payload.technical_card_id,
        source_message_id=payload.source_message_id,
    )
    db.add(row)
    db.flush()
    db.refresh(row)
    row = db.scalar(
        select(CollaborationMicrotask)
        .options(
            selectinload(CollaborationMicrotask.assignee),
            selectinload(CollaborationMicrotask.created_by),
        )
        .where(CollaborationMicrotask.id == row.id)
    )
    assert row is not None
    _emit_notification(
        db,
        recipient_id=assignee.id,
        actor_id=created_by.id,
        kind=CollaborationNotificationKind.MICROTASK_ASSIGNED,
        title=f"Назначена микрозадача: {row.title}",
        body=f"{created_by.display_name} назначил(а) вам задачу по заказу #{order_id}",
        sales_order_id=order_id,
        technical_card_id=row.technical_card_id,
        source_message_id=row.source_message_id,
        microtask_id=row.id,
    )
    result = _microtask_read(row)
    db.commit()
    return result


def list_lead_microtasks(
    db: Session,
    lead_id: int,
    *,
    assignee_platform_user_id: int | None = None,
) -> list[CollaborationMicrotaskRead]:
    _get_lead(db, lead_id)
    stmt = (
        select(CollaborationMicrotask)
        .options(
            selectinload(CollaborationMicrotask.assignee),
            selectinload(CollaborationMicrotask.created_by),
        )
        .where(CollaborationMicrotask.lead_id == lead_id)
        .order_by(CollaborationMicrotask.id.desc())
    )
    if assignee_platform_user_id is not None:
        stmt = stmt.where(
            CollaborationMicrotask.assignee_platform_user_id
            == assignee_platform_user_id
        )
    return [_microtask_read(row) for row in db.scalars(stmt).all()]


def create_lead_microtask(
    db: Session,
    lead_id: int,
    created_by: PlatformUser,
    payload: CollaborationMicrotaskCreate,
) -> CollaborationMicrotaskRead:
    _get_lead(db, lead_id)
    if payload.technical_card_id is not None:
        raise CollaborationValidationError(
            "Контекст техкарты доступен только в переписке заказа"
        )
    assignee = db.get(PlatformUser, payload.assignee_platform_user_id)
    if assignee is None or not assignee.is_active:
        raise CollaborationValidationError("Исполнитель не найден или неактивен")
    if payload.source_message_id is not None:
        message = db.get(CollaborationMessage, payload.source_message_id)
        if message is None:
            raise CollaborationValidationError("Исходное сообщение не найдено")
        thread = db.get(CollaborationThread, message.thread_id)
        if thread is None or thread.lead_id != lead_id:
            raise CollaborationValidationError(
                "Исходное сообщение не принадлежит этому лиду"
            )
    row = CollaborationMicrotask(
        sales_order_id=None,
        lead_id=lead_id,
        title=payload.title,
        status=CollaborationMicrotaskStatus.OPEN.value,
        assignee_platform_user_id=assignee.id,
        created_by_platform_user_id=created_by.id,
        technical_card_id=None,
        source_message_id=payload.source_message_id,
    )
    db.add(row)
    db.flush()
    row = db.scalar(
        select(CollaborationMicrotask)
        .options(
            selectinload(CollaborationMicrotask.assignee),
            selectinload(CollaborationMicrotask.created_by),
        )
        .where(CollaborationMicrotask.id == row.id)
    )
    assert row is not None
    _emit_notification(
        db,
        recipient_id=assignee.id,
        actor_id=created_by.id,
        kind=CollaborationNotificationKind.MICROTASK_ASSIGNED,
        title=f"Назначена микрозадача: {row.title}",
        body=f"{created_by.display_name} назначил(а) вам задачу по лиду #{lead_id}",
        lead_id=lead_id,
        source_message_id=row.source_message_id,
        microtask_id=row.id,
    )
    result = _microtask_read(row)
    db.commit()
    return result


def update_microtask_status(
    db: Session,
    microtask_id: int,
    payload: CollaborationMicrotaskStatusUpdate,
    *,
    actor: PlatformUser,
) -> CollaborationMicrotaskRead:
    row = db.scalar(
        select(CollaborationMicrotask)
        .options(
            selectinload(CollaborationMicrotask.assignee),
            selectinload(CollaborationMicrotask.created_by),
        )
        .where(CollaborationMicrotask.id == microtask_id)
    )
    if row is None:
        raise CollaborationNotFoundError("Микрозадача не найдена")
    previous = row.status
    row.status = payload.status
    row.completed_at = (
        _utcnow() if payload.status == CollaborationMicrotaskStatus.DONE.value else None
    )
    db.flush()
    if (
        previous != CollaborationMicrotaskStatus.DONE.value
        and payload.status == CollaborationMicrotaskStatus.DONE.value
    ):
        anchor_label = (
            f"заказ #{row.sales_order_id}"
            if row.sales_order_id is not None
            else f"лид #{row.lead_id}"
        )
        done_body = (
            f"{actor.display_name} отметил(а) задачу выполненной ({anchor_label})"
        )
        _emit_notification(
            db,
            recipient_id=row.created_by_platform_user_id,
            actor_id=actor.id,
            kind=CollaborationNotificationKind.MICROTASK_COMPLETED,
            title=f"Микрозадача выполнена: {row.title}",
            body=done_body,
            sales_order_id=row.sales_order_id,
            lead_id=row.lead_id,
            technical_card_id=row.technical_card_id,
            source_message_id=row.source_message_id,
            microtask_id=row.id,
        )
        if row.assignee_platform_user_id != row.created_by_platform_user_id:
            _emit_notification(
                db,
                recipient_id=row.assignee_platform_user_id,
                actor_id=actor.id,
                kind=CollaborationNotificationKind.MICROTASK_COMPLETED,
                title=f"Микрозадача выполнена: {row.title}",
                body=done_body,
                sales_order_id=row.sales_order_id,
                lead_id=row.lead_id,
                technical_card_id=row.technical_card_id,
                source_message_id=row.source_message_id,
                microtask_id=row.id,
            )
    result = _microtask_read(row)
    db.commit()
    return result


def list_notifications(
    db: Session,
    recipient: PlatformUser,
    *,
    unread_only: bool = False,
    limit: int = 50,
) -> CollaborationNotificationListRead:
    unread_count = (
        db.scalar(
            select(func.count())
            .select_from(CollaborationNotification)
            .where(
                CollaborationNotification.recipient_platform_user_id == recipient.id,
                CollaborationNotification.read_at.is_(None),
            )
        )
        or 0
    )
    stmt = (
        select(CollaborationNotification)
        .where(
            CollaborationNotification.recipient_platform_user_id == recipient.id
        )
        .order_by(CollaborationNotification.id.desc())
        .limit(max(1, min(limit, 100)))
    )
    if unread_only:
        stmt = stmt.where(CollaborationNotification.read_at.is_(None))
    items = [_notification_read(row) for row in db.scalars(stmt).all()]
    return CollaborationNotificationListRead(
        items=items,
        unread_count=int(unread_count),
    )


def mark_notification_read(
    db: Session,
    notification_id: int,
    recipient: PlatformUser,
) -> CollaborationNotificationRead:
    row = db.get(CollaborationNotification, notification_id)
    if row is None or row.recipient_platform_user_id != recipient.id:
        raise CollaborationNotFoundError("Уведомление не найдено")
    if row.read_at is None:
        row.read_at = _utcnow()
        db.flush()
    result = _notification_read(row)
    db.commit()
    return result


def mark_all_notifications_read(
    db: Session,
    recipient: PlatformUser,
) -> int:
    rows = list(
        db.scalars(
            select(CollaborationNotification).where(
                CollaborationNotification.recipient_platform_user_id == recipient.id,
                CollaborationNotification.read_at.is_(None),
            )
        ).all()
    )
    now = _utcnow()
    for row in rows:
        row.read_at = now
    db.flush()
    db.commit()
    return len(rows)


def list_microtask_title_templates() -> list[str]:
    return list(MICROTASK_TITLE_TEMPLATES)
