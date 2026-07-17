from datetime import datetime
from uuid import UUID, uuid4

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    JsonValue,
    field_validator,
    model_validator,
)

from app.communications.enums import (
    CommunicationChannel,
    MessageDirection,
    MessageStatus,
)


class CommunicationSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")


class NormalizedAttachment(CommunicationSchema):
    id: UUID = Field(default_factory=uuid4)
    external_id: str | None = None
    name: str = Field(min_length=1)
    mime_type: str | None = None
    size_bytes: int | None = Field(default=None, ge=0)
    source_url: str | None = None
    storage_key: str | None = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Attachment name is required")
        return stripped


class OutgoingAttachment(CommunicationSchema):
    id: UUID = Field(default_factory=uuid4)
    name: str = Field(min_length=1)
    mime_type: str | None = None
    size_bytes: int | None = Field(default=None, ge=0)
    source_url: str | None = None
    storage_key: str | None = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Attachment name is required")
        return stripped


class NormalizedMessage(CommunicationSchema):
    id: UUID = Field(default_factory=uuid4)
    channel: CommunicationChannel
    direction: MessageDirection
    external_message_id: str | None = None
    external_conversation_id: str | None = None
    sender_external_id: str | None = None
    sender_name: str | None = None
    recipient_external_id: str | None = None
    recipient_name: str | None = None
    text: str = ""
    status: MessageStatus
    sent_at: datetime | None = None
    received_at: datetime | None = None
    attachments: list[NormalizedAttachment] = Field(default_factory=list)
    metadata: dict[str, JsonValue] = Field(default_factory=dict)
    lead_id: int | str | None = None
    contact_id: int | str | None = None
    connector_name: str | None = None
    raw_event_id: str | None = None
    reply_to_external_message_id: str | None = None
    is_mock: bool = False


class SendMessageCommand(CommunicationSchema):
    channel: CommunicationChannel
    recipient_external_id: str = Field(min_length=1)
    recipient_name: str | None = None
    text: str = Field(default="", max_length=5000)
    attachments: list[OutgoingAttachment] = Field(default_factory=list)
    reply_to_external_message_id: str | None = None
    metadata: dict[str, JsonValue] = Field(default_factory=dict)
    lead_id: int | str | None = None
    contact_id: int | str | None = None

    @field_validator("recipient_external_id")
    @classmethod
    def strip_recipient(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Recipient is required")
        return stripped

    @model_validator(mode="after")
    def require_text_or_attachment(self) -> "SendMessageCommand":
        if not self.text.strip() and not self.attachments:
            raise ValueError("Message text or an attachment is required")
        return self


class SendMessageResult(CommunicationSchema):
    external_message_id: str = Field(min_length=1)
    external_conversation_id: str | None = None
    status: MessageStatus
    sent_at: datetime
    connector_name: str = Field(min_length=1)


class ConnectorHealth(CommunicationSchema):
    is_configured: bool
    is_available: bool
    message: str | None = None
    checked_at: datetime
