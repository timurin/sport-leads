from collections.abc import Mapping
from datetime import datetime, timezone
from hashlib import sha256
from hmac import compare_digest
from itertools import count
from uuid import NAMESPACE_URL, uuid5

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

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
    NormalizedAttachment,
    NormalizedMessage,
    SendMessageCommand,
    SendMessageResult,
)


class MockConnectorConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    webhook_secret: str | None = Field(default=None, min_length=1)
    simulate_temporary_error: bool = False
    delivery_status: MessageStatus = MessageStatus.SENT

    @field_validator("delivery_status")
    @classmethod
    def allow_mock_delivery_status(
        cls,
        value: MessageStatus,
    ) -> MessageStatus:
        if value not in {MessageStatus.SENT, MessageStatus.DELIVERED}:
            raise ValueError("Mock delivery status must be sent or delivered")
        return value


class _MockWebhookAttachment(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    mime_type: str | None = None
    size_bytes: int | None = Field(default=None, ge=0)


class _MockWebhookPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    event_id: str = Field(min_length=1)
    message_id: str = Field(min_length=1)
    conversation_id: str | None = None
    sender_id: str = Field(min_length=1)
    sender_name: str | None = None
    text: str = ""
    sent_at: datetime
    attachments: list[_MockWebhookAttachment] = Field(default_factory=list)


class MockCommunicationConnector:
    def __init__(
        self,
        channel: CommunicationChannel,
        config: MockConnectorConfig | None = None,
    ) -> None:
        self.channel = channel
        self.name = f"mock-{channel.value}"
        self.config = config or MockConnectorConfig()
        self._message_sequence = count(1)
        self._sent_messages: dict[str, SendMessageCommand] = {}
        self._delivery_statuses: dict[str, MessageStatus] = {}
        self._processed_events: set[tuple[str, str, CommunicationChannel, str]] = set()

    @property
    def sent_messages(self) -> tuple[SendMessageCommand, ...]:
        return tuple(
            command.model_copy(deep=True)
            for command in self._sent_messages.values()
        )

    async def send_message(
        self,
        command: SendMessageCommand,
    ) -> SendMessageResult:
        if command.channel != self.channel:
            raise MessageValidationError(
                "Message channel does not match the selected connector"
            )
        if self.config.simulate_temporary_error:
            raise ConnectorTemporaryError("Mock connector is temporarily unavailable")

        external_message_id = (
            f"mock-{self.channel.value}-{next(self._message_sequence):06d}"
        )
        self._sent_messages[external_message_id] = command.model_copy(deep=True)
        self._delivery_statuses[external_message_id] = self.config.delivery_status
        return SendMessageResult(
            external_message_id=external_message_id,
            external_conversation_id=(
                f"mock-conversation-{command.recipient_external_id}"
            ),
            status=self.config.delivery_status,
            sent_at=datetime.now(timezone.utc),
            connector_name=self.name,
        )

    async def verify_webhook(
        self,
        payload: bytes,
        headers: Mapping[str, str],
    ) -> bool:
        del payload
        expected = self.config.webhook_secret
        if expected is None:
            return True
        provided = next(
            (
                value
                for key, value in headers.items()
                if key.casefold() == "x-mock-secret"
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
            raise ConnectorAuthenticationError("Invalid mock webhook signature")
        try:
            webhook = _MockWebhookPayload.model_validate(payload)
        except ValidationError as error:
            raise MessageValidationError("Invalid mock webhook payload") from error

        deduplication_key = (
            webhook.event_id,
            webhook.message_id,
            self.channel,
            self.name,
        )
        if deduplication_key in self._processed_events:
            return []
        # Production deduplication must use a database unique constraint or Redis.
        self._processed_events.add(deduplication_key)

        message_id = uuid5(
            NAMESPACE_URL,
            ":".join((self.name, webhook.event_id, webhook.message_id)),
        )
        attachments = [
            NormalizedAttachment(
                id=uuid5(
                    NAMESPACE_URL,
                    ":".join((self.name, webhook.event_id, attachment.id)),
                ),
                external_id=attachment.id,
                name=attachment.name,
                mime_type=attachment.mime_type,
                size_bytes=attachment.size_bytes,
            )
            for attachment in webhook.attachments
        ]
        return [
            NormalizedMessage(
                id=message_id,
                channel=self.channel,
                direction=MessageDirection.INCOMING,
                external_message_id=webhook.message_id,
                external_conversation_id=webhook.conversation_id,
                sender_external_id=webhook.sender_id,
                sender_name=webhook.sender_name,
                text=webhook.text,
                status=MessageStatus.DELIVERED,
                received_at=webhook.sent_at,
                attachments=attachments,
                connector_name=self.name,
                raw_event_id=webhook.event_id,
                is_mock=True,
            )
        ]

    async def get_delivery_status(
        self,
        external_message_id: str,
    ) -> MessageStatus:
        status = self._delivery_statuses.get(external_message_id)
        if status is None:
            raise ConnectorPermanentError("Mock message was not found")
        return status

    async def validate_configuration(self) -> ConnectorHealth:
        return ConnectorHealth(
            is_configured=True,
            is_available=not self.config.simulate_temporary_error,
            message=(
                "Mock connector is ready"
                if not self.config.simulate_temporary_error
                else "Mock connector is configured to simulate an outage"
            ),
            checked_at=datetime.now(timezone.utc),
        )
