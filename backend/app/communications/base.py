from collections.abc import Mapping
from typing import Protocol, runtime_checkable

from app.communications.enums import CommunicationChannel, MessageStatus
from app.communications.schemas import (
    ConnectorHealth,
    NormalizedMessage,
    SendMessageCommand,
    SendMessageResult,
)


@runtime_checkable
class CommunicationConnector(Protocol):
    channel: CommunicationChannel
    name: str

    async def send_message(
        self,
        command: SendMessageCommand,
    ) -> SendMessageResult:
        ...

    async def normalize_webhook(
        self,
        payload: Mapping[str, object],
        headers: Mapping[str, str] | None = None,
    ) -> list[NormalizedMessage]:
        ...

    async def verify_webhook(
        self,
        payload: bytes,
        headers: Mapping[str, str],
    ) -> bool:
        ...

    async def get_delivery_status(
        self,
        external_message_id: str,
    ) -> MessageStatus:
        ...

    async def validate_configuration(self) -> ConnectorHealth:
        ...


class MessageRepository(Protocol):
    """Future persistence boundary; no repository is implemented yet."""

    async def save(self, message: NormalizedMessage) -> None:
        ...
