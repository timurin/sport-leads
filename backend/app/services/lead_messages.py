from __future__ import annotations

import asyncio
from collections.abc import Mapping
from datetime import UTC, datetime
from uuid import UUID, uuid4, uuid5, NAMESPACE_URL

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.communications.connectors.email import EmailCommunicationConnector, SmtpTransport
from app.communications.enums import CommunicationChannel
from app.communications.exceptions import (
    ConnectorAuthenticationError,
    ConnectorPermanentError,
    ConnectorTemporaryError,
    MessageValidationError,
)
from app.communications.lead_registry import (
    email_connector_config_from_settings,
    has_real_email_send,
    mailbox_lead_source_label,
    should_create_lead_from_unknown_email,
)
from app.communications.registry import ConnectorRegistry
from app.communications.schemas import NormalizedMessage, OutgoingAttachment, SendMessageCommand
from app.communications.service import CommunicationService
from app.models.sales import Lead, LeadMessage, SalesUser
from app.schemas.sales import (
    LeadCreate,
    LeadMessageAttachmentPayload,
    LeadMessageCreate,
    LeadMessageRead,
)
from app.services.lead_creation import create_lead
from app.services.lead_duplicates import LeadDuplicateCriteriaError, find_duplicate_leads


class LeadMessageOperationError(RuntimeError):
    pass


class LeadNotFoundError(LeadMessageOperationError):
    pass


class LeadMessageAuthorNotFoundError(LeadMessageOperationError):
    pass


class LeadMessageRecipientError(LeadMessageOperationError):
    pass


class LeadMessageSendError(LeadMessageOperationError):
    pass


class LeadMessageInboundSecretError(LeadMessageOperationError):
    pass


class LeadMessageInboundPayloadError(LeadMessageOperationError):
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


def create_lead_message(
    db: Session,
    lead_id: int,
    payload: LeadMessageCreate,
    *,
    email_transport: SmtpTransport | None = None,
) -> LeadMessage:
    lead = _locked_lead(db, lead_id)
    author = _require_active_user(db, payload.author_id)
    if author is None and lead.responsible_id is not None:
        author = _require_active_user(db, lead.responsible_id)

    author_name = author.name if author is not None else None
    external_id = f"mock-{uuid4()}"
    is_mock = True
    if payload.channel == CommunicationChannel.EMAIL.value and has_real_email_send(db):
        sent = _send_real_email(db, lead, payload, email_transport=email_transport)
        external_id = sent.external_message_id
        is_mock = False

    message = LeadMessage(
        lead_id=lead_id,
        channel=payload.channel,
        direction="outgoing",
        text=payload.text,
        status="sent",
        author_id=author.id if author is not None else None,
        sender_name=author_name,
        recipient_name=payload.recipient_name,
        external_id=external_id,
        attachments=[item.model_dump() for item in payload.attachments],
        is_mock=is_mock,
        sent_at=datetime.now(UTC),
    )
    db.add(message)
    db.flush()
    return message


def persist_inbound_email_messages(
    db: Session,
    payload: Mapping[str, object],
    headers: Mapping[str, str] | None = None,
) -> list[LeadMessage]:
    config = email_connector_config_from_settings(db)
    if not (config.webhook_secret or "").strip():
        raise LeadMessageInboundSecretError("Email inbound webhook is not configured")
    connector = EmailCommunicationConnector(config)
    registry = ConnectorRegistry()
    registry.register(connector)
    try:
        normalized = asyncio.run(
            CommunicationService(registry).process_webhook(
                CommunicationChannel.EMAIL,
                payload,
                headers,
            )
        )
    except ConnectorAuthenticationError as error:
        raise LeadMessageInboundSecretError("Invalid email inbound webhook secret") from error
    except MessageValidationError as error:
        raise LeadMessageInboundPayloadError(str(error)) from error

    stored: list[LeadMessage] = []
    for item in normalized:
        existing = db.scalar(
            select(LeadMessage).where(
                LeadMessage.channel == CommunicationChannel.EMAIL.value,
                LeadMessage.direction == "incoming",
                LeadMessage.external_id == item.external_message_id,
            )
        )
        if existing is not None:
            stored.append(existing)
            continue
        lead = _resolve_inbound_lead(
            db,
            item.lead_id,
            item.sender_external_id,
            item.sender_name,
        )
        message = LeadMessage(
            lead_id=lead.id,
            channel=CommunicationChannel.EMAIL.value,
            direction="incoming",
            text=item.text,
            status=item.status.value,
            author_id=None,
            sender_name=item.sender_name,
            recipient_name=None,
            external_id=item.external_message_id,
            attachments=[
                {
                    "id": str(attachment.id),
                    "name": attachment.name,
                    "type": attachment.mime_type,
                    "size": attachment.size_bytes,
                }
                for attachment in item.attachments
            ],
            is_mock=False,
            sent_at=item.received_at or item.sent_at or datetime.now(UTC),
        )
        db.add(message)
        db.flush()
        stored.append(message)
    return stored


def _send_real_email(
    db: Session,
    lead: Lead,
    payload: LeadMessageCreate,
    *,
    email_transport: SmtpTransport | None,
) -> NormalizedMessage:
    recipient = (lead.email or "").strip()
    if not recipient:
        raise LeadMessageRecipientError("Lead email is required for SMTP send")
    config = email_connector_config_from_settings(db)
    connector = EmailCommunicationConnector(config, transport=email_transport)
    registry = ConnectorRegistry()
    registry.register(connector)
    command = SendMessageCommand(
        channel=CommunicationChannel.EMAIL,
        recipient_external_id=recipient,
        recipient_name=payload.recipient_name,
        text=payload.text,
        attachments=_outgoing_attachments(payload.attachments),
        lead_id=lead.id,
    )
    try:
        return asyncio.run(CommunicationService(registry).send(command))
    except ConnectorTemporaryError as error:
        raise LeadMessageSendError(str(error)) from error
    except ConnectorPermanentError as error:
        raise LeadMessageSendError(str(error)) from error
    except MessageValidationError as error:
        raise LeadMessageRecipientError(str(error)) from error


def _outgoing_attachments(
    attachments: list[LeadMessageAttachmentPayload],
) -> list[OutgoingAttachment]:
    result: list[OutgoingAttachment] = []
    for item in attachments:
        try:
            attachment_id = UUID(item.id)
        except ValueError:
            attachment_id = uuid5(NAMESPACE_URL, item.id)
        result.append(
            OutgoingAttachment(
                id=attachment_id,
                name=item.name,
                mime_type=item.type,
                size_bytes=item.size,
            )
        )
    return result


def _resolve_inbound_lead(
    db: Session,
    lead_id: int | str | None,
    sender_email: str | None,
    sender_name: str | None = None,
) -> Lead:
    if lead_id is not None:
        try:
            parsed_id = int(lead_id)
        except (TypeError, ValueError) as error:
            raise LeadNotFoundError("Inbound email lead_id is invalid") from error
        lead = db.get(Lead, parsed_id)
        if lead is None:
            raise LeadNotFoundError("Lead not found")
        return lead
    if sender_email:
        try:
            matches = find_duplicate_leads(db, email=sender_email, limit=1)
        except LeadDuplicateCriteriaError:
            matches = []
        if matches:
            return matches[0]
        if should_create_lead_from_unknown_email(db):
            contact_name = (sender_name or "").strip() or sender_email.split("@", 1)[0]
            return create_lead(
                db,
                LeadCreate(
                    contact_name=(contact_name or sender_email)[:255],
                    email=sender_email,
                    source=mailbox_lead_source_label(db),
                    customer_comment="Создан из входящего email",
                ),
            )
    raise LeadNotFoundError("No lead matched inbound email")
