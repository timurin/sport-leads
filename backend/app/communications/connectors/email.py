from collections.abc import Callable, Mapping
from datetime import UTC, datetime
from email.message import EmailMessage
from hashlib import sha256
from hmac import compare_digest
from smtplib import SMTP, SMTPException
from uuid import NAMESPACE_URL, uuid4, uuid5

from pydantic import BaseModel, ConfigDict, EmailStr, Field, ValidationError

from app.communications.enums import (
    CommunicationChannel,
    MessageDirection,
    MessageStatus,
)
from app.communications.exceptions import (
    ConnectorAuthenticationError,
    ConnectorPermanentError,
    ConnectorTemporaryError,
    MessageValidationError,
)
from app.communications.schemas import (
    ConnectorHealth,
    NormalizedMessage,
    SendMessageCommand,
    SendMessageResult,
)

EMAIL_CONNECTOR_NAME = "smtp-email"


class EmailConnectorConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    host: str | None = None
    port: int = 587
    username: str | None = None
    password: str | None = None
    from_address: str | None = None
    use_tls: bool = True
    webhook_secret: str | None = None

    @property
    def is_configured(self) -> bool:
        return bool((self.host or "").strip() and (self.from_address or "").strip())


class EmailInboundPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    event_id: str = Field(min_length=1)
    message_id: str = Field(min_length=1)
    from_email: EmailStr
    from_name: str | None = None
    text: str = ""
    sent_at: datetime
    lead_id: int | None = None


SmtpTransport = Callable[[EmailConnectorConfig, EmailMessage], str]


def smtp_transport(config: EmailConnectorConfig, message: EmailMessage) -> str:
    if not config.host or not config.from_address:
        raise ConnectorPermanentError("SMTP email connector is not configured")
        try:
            with SMTP(config.host, config.port, timeout=15) as smtp:
                if config.use_tls:
                    smtp.starttls()
                if config.username:
                    smtp.login(config.username, config.password or "")
                smtp.send_message(message)
        except OSError as error:
            raise ConnectorTemporaryError(f"SMTP send failed: {error}") from error
        except SMTPException as error:
            raise ConnectorTemporaryError(f"SMTP send failed: {error}") from error
        return message["Message-ID"] or f"smtp-{uuid4()}"


class EmailCommunicationConnector:
    channel = CommunicationChannel.EMAIL
    name = EMAIL_CONNECTOR_NAME

    def __init__(
        self,
        config: EmailConnectorConfig | None = None,
        *,
        transport: SmtpTransport | None = None,
    ) -> None:
        self.config = config or EmailConnectorConfig()
        self._transport = transport or smtp_transport
        self._processed_events: set[tuple[str, str]] = set()

    async def send_message(self, command: SendMessageCommand) -> SendMessageResult:
        if command.channel != CommunicationChannel.EMAIL:
            raise MessageValidationError("Email connector only sends email messages")
        if not self.config.is_configured:
            raise ConnectorPermanentError("SMTP email connector is not configured")

        message = EmailMessage()
        message["From"] = self.config.from_address or ""
        message["To"] = command.recipient_external_id
        message["Subject"] = (
            f"Sport-Lead: сообщение по лиду {command.lead_id}"
            if command.lead_id is not None
            else "Sport-Lead"
        )
        message_id = f"<lead-{command.lead_id or 'none'}-{uuid4().hex}@sport-lead.local>"
        message["Message-ID"] = message_id
        body = command.text
        if command.attachments:
            names = ", ".join(item.name for item in command.attachments)
            body = f"{body}\n\nВложения (метаданные): {names}".strip()
        message.set_content(body)

        try:
            external_id = self._transport(self.config, message)
        except SMTPException as error:
            raise ConnectorTemporaryError(f"SMTP send failed: {error}") from error
        except OSError as error:
            raise ConnectorTemporaryError(f"SMTP send failed: {error}") from error
        return SendMessageResult(
            external_message_id=external_id,
            external_conversation_id=command.recipient_external_id,
            status=MessageStatus.SENT,
            sent_at=datetime.now(UTC),
            connector_name=self.name,
        )

    async def verify_webhook(
        self,
        payload: bytes,
        headers: Mapping[str, str],
    ) -> bool:
        del payload
        expected = self.config.webhook_secret
        if expected is None or not expected.strip():
            return False
        provided = next(
            (
                value
                for key, value in headers.items()
                if key.casefold() in {"x-sport-lead-email-secret", "x-sport-lead-ingest-secret"}
            ),
            "",
        )
        return compare_digest(
            sha256(provided.encode()).digest(),
            sha256(expected.encode()).digest(),
        )

    async def normalize_webhook(
        self,
        payload: Mapping[str, object],
        headers: Mapping[str, str] | None = None,
    ) -> list[NormalizedMessage]:
        if not await self.verify_webhook(b"", headers or {}):
            raise ConnectorAuthenticationError("Invalid email webhook signature")
        try:
            webhook = EmailInboundPayload.model_validate(payload)
        except ValidationError as error:
            raise MessageValidationError("Invalid email webhook payload") from error

        dedupe_key = (webhook.event_id, webhook.message_id)
        if dedupe_key in self._processed_events:
            return []
        self._processed_events.add(dedupe_key)

        return [
            NormalizedMessage(
                id=uuid5(
                    NAMESPACE_URL,
                    ":".join((self.name, webhook.event_id, webhook.message_id)),
                ),
                channel=CommunicationChannel.EMAIL,
                direction=MessageDirection.INCOMING,
                external_message_id=webhook.message_id,
                sender_external_id=str(webhook.from_email),
                sender_name=webhook.from_name,
                text=webhook.text,
                status=MessageStatus.DELIVERED,
                received_at=webhook.sent_at,
                connector_name=self.name,
                raw_event_id=webhook.event_id,
                lead_id=webhook.lead_id,
                is_mock=False,
            )
        ]

    async def get_delivery_status(self, external_message_id: str) -> MessageStatus:
        del external_message_id
        return MessageStatus.SENT

    async def validate_configuration(self) -> ConnectorHealth:
        return ConnectorHealth(
            is_configured=self.config.is_configured,
            is_available=self.config.is_configured,
            message=(
                "SMTP email connector is ready"
                if self.config.is_configured
                else "SMTP host and from address are not configured"
            ),
            checked_at=datetime.now(UTC),
        )
