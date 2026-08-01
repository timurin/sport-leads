from __future__ import annotations

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.sales import Lead, LeadMessage, SalesUser
from app.schemas.sales import LeadMessageCreate, LeadMessageRead


class LeadMessageOperationError(RuntimeError):
    pass


class LeadNotFoundError(LeadMessageOperationError):
    pass


class LeadMessageAuthorNotFoundError(LeadMessageOperationError):
    pass


def _locked_lead(db: Session, lead_id: int) -> Lead:
    lead = db.scalar(select(Lead).where(Lead.id == lead_id).with_for_update())
    if lead is None:
        raise LeadNotFoundError("Lead not found")
    return lead


def _require_active_user(db: Session, user_id: int | None) -> SalesUser | None:
    if user_id is None:
        return None
    user = db.get(SalesUser, user_id)
    if user is None or not user.is_active:
        raise LeadMessageAuthorNotFoundError("Active author user not found")
    return user


def _author_name(db: Session, author_id: int | None) -> str | None:
    if author_id is None:
        return None
    user = db.get(SalesUser, author_id)
    if user is None:
        return f"Сотрудник #{author_id}"
    return user.name


def to_lead_message_read(db: Session, message: LeadMessage) -> LeadMessageRead:
    raw_attachments = message.attachments if isinstance(message.attachments, list) else []
    return LeadMessageRead(
        id=message.id,
        lead_id=message.lead_id,
        channel=message.channel,
        direction=message.direction,
        text=message.text,
        status=message.status,
        author_id=message.author_id,
        author_name=_author_name(db, message.author_id),
        sender_name=message.sender_name,
        recipient_name=message.recipient_name,
        external_id=message.external_id,
        attachments=raw_attachments,
        is_mock=message.is_mock,
        sent_at=message.sent_at,
        created_at=message.created_at,
    )


def list_lead_messages(db: Session, lead_id: int) -> list[LeadMessage]:
    if db.get(Lead, lead_id) is None:
        raise LeadNotFoundError("Lead not found")
    return list(
        db.scalars(
            select(LeadMessage)
            .where(LeadMessage.lead_id == lead_id)
            .order_by(LeadMessage.sent_at.asc(), LeadMessage.id.asc())
        ).all()
    )


def create_lead_message(db: Session, lead_id: int, payload: LeadMessageCreate) -> LeadMessage:
    lead = _locked_lead(db, lead_id)
    author = _require_active_user(db, payload.author_id)
    if author is None and lead.responsible_id is not None:
        author = _require_active_user(db, lead.responsible_id)

    author_name = author.name if author is not None else None
    message = LeadMessage(
        lead_id=lead_id,
        channel=payload.channel,
        direction="outgoing",
        text=payload.text,
        status="sent",
        author_id=author.id if author is not None else None,
        sender_name=author_name,
        recipient_name=payload.recipient_name,
        external_id=f"mock-{uuid4()}",
        attachments=[item.model_dump() for item in payload.attachments],
        is_mock=True,
        sent_at=datetime.now(UTC),
    )
    db.add(message)
    db.flush()
    return message
