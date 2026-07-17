from collections.abc import Mapping
from copy import deepcopy
from uuid import uuid4

from loguru import logger

from app.communications.base import MessageRepository
from app.communications.enums import (
    CommunicationChannel,
    MessageDirection,
)
from app.communications.exceptions import MessageValidationError
from app.communications.registry import ConnectorRegistry
from app.communications.schemas import (
    NormalizedAttachment,
    NormalizedMessage,
    SendMessageCommand,
)


class CommunicationService:
    def __init__(
        self,
        registry: ConnectorRegistry,
        repository: MessageRepository | None = None,
    ) -> None:
        self.registry = registry
        self.repository = repository

    async def send(
        self,
        command: SendMessageCommand,
    ) -> NormalizedMessage:
        if command.channel == CommunicationChannel.INTERNAL:
            raise MessageValidationError(
                "Internal messages cannot be sent through an external connector"
            )
        if command.channel == CommunicationChannel.PHONE:
            raise MessageValidationError(
                "The phone channel does not support text messages"
            )

        connector = self.registry.get(command.channel)
        result = await connector.send_message(command)
        message = NormalizedMessage(
            id=uuid4(),
            channel=command.channel,
            direction=MessageDirection.OUTGOING,
            external_message_id=result.external_message_id,
            external_conversation_id=result.external_conversation_id,
            recipient_external_id=command.recipient_external_id,
            recipient_name=command.recipient_name,
            text=command.text,
            status=result.status,
            sent_at=result.sent_at,
            attachments=[
                NormalizedAttachment(
                    id=attachment.id,
                    name=attachment.name,
                    mime_type=attachment.mime_type,
                    size_bytes=attachment.size_bytes,
                    source_url=attachment.source_url,
                    storage_key=attachment.storage_key,
                )
                for attachment in command.attachments
            ],
            metadata=deepcopy(command.metadata),
            lead_id=command.lead_id,
            contact_id=command.contact_id,
            connector_name=result.connector_name,
            reply_to_external_message_id=command.reply_to_external_message_id,
            is_mock=result.connector_name.startswith("mock-"),
        )
        if self.repository is not None:
            await self.repository.save(message)
        logger.bind(
            channel=message.channel.value,
            connector=message.connector_name,
            message_id=str(message.id),
            status=message.status.value,
        ).info("Communication message sent")
        return message

    async def process_webhook(
        self,
        channel: CommunicationChannel,
        payload: Mapping[str, object],
        headers: Mapping[str, str] | None = None,
    ) -> list[NormalizedMessage]:
        connector = self.registry.get(channel)
        messages = await connector.normalize_webhook(payload, headers)
        if self.repository is not None:
            for message in messages:
                await self.repository.save(message)
        for message in messages:
            logger.bind(
                channel=message.channel.value,
                connector=message.connector_name,
                message_id=str(message.id),
                event_id=message.raw_event_id,
                status=message.status.value,
            ).info("Communication webhook normalized")
        return messages
