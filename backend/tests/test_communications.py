import asyncio
from collections.abc import Coroutine
from copy import deepcopy
from typing import TypeVar

import pytest
from pydantic import ValidationError

from app.communications.base import CommunicationConnector
from app.communications.connectors.mock import (
    MockCommunicationConnector,
    MockConnectorConfig,
)
from app.communications.enums import CommunicationChannel, MessageStatus
from app.communications.exceptions import (
    ConnectorAuthenticationError,
    ConnectorConfigurationError,
    ConnectorNotFoundError,
    ConnectorTemporaryError,
    MessageValidationError,
)
from app.communications.registry import ConnectorRegistry
from app.communications.schemas import OutgoingAttachment, SendMessageCommand
from app.communications.service import CommunicationService


ResultT = TypeVar("ResultT")


def run(coroutine: Coroutine[object, object, ResultT]) -> ResultT:
    return asyncio.run(coroutine)


def message_command(
    channel: CommunicationChannel = CommunicationChannel.TELEGRAM,
    *,
    text: str = "Здравствуйте!",
    attachments: list[OutgoingAttachment] | None = None,
) -> SendMessageCommand:
    return SendMessageCommand(
        channel=channel,
        recipient_external_id="contact-1",
        recipient_name="Сергей Волков",
        text=text,
        attachments=attachments or [],
        metadata={"source": "unit-test"},
        lead_id="lead-1",
        contact_id="lead-1-contact-1",
    )


def webhook_payload() -> dict[str, object]:
    return {
        "event_id": "mock-event-1",
        "message_id": "mock-message-1",
        "conversation_id": "mock-conversation-1",
        "sender_id": "contact-1",
        "sender_name": "Сергей Волков",
        "text": "Добрый день, отправляю логотип.",
        "sent_at": "2026-07-17T10:00:00Z",
        "attachments": [
            {
                "id": "attachment-1",
                "name": "logo.pdf",
                "mime_type": "application/pdf",
                "size_bytes": 120000,
            }
        ],
    }


def test_registry_registers_and_gets_connector() -> None:
    registry = ConnectorRegistry()
    connector = MockCommunicationConnector(CommunicationChannel.TELEGRAM)
    registry.register(connector)

    assert registry.has(CommunicationChannel.TELEGRAM)
    assert registry.get(CommunicationChannel.TELEGRAM) is connector
    assert registry.list_registered() == (connector,)
    assert isinstance(connector, CommunicationConnector)


def test_registry_rejects_missing_connector() -> None:
    registry = ConnectorRegistry()

    with pytest.raises(ConnectorNotFoundError):
        registry.get(CommunicationChannel.EMAIL)


def test_registry_requires_explicit_replacement() -> None:
    registry = ConnectorRegistry()
    first = MockCommunicationConnector(CommunicationChannel.VK)
    second = MockCommunicationConnector(CommunicationChannel.VK)
    registry.register(first)

    with pytest.raises(ConnectorConfigurationError):
        registry.register(second)

    registry.register(second, replace=True)
    assert registry.get(CommunicationChannel.VK) is second


def test_service_sends_and_normalizes_mock_message() -> None:
    connector = MockCommunicationConnector(CommunicationChannel.TELEGRAM)
    registry = ConnectorRegistry()
    registry.register(connector)
    message = run(CommunicationService(registry).send(message_command()))

    assert message.direction.value == "outgoing"
    assert message.status == MessageStatus.SENT
    assert message.external_message_id == "mock-telegram-000001"
    assert message.connector_name == "mock-telegram"
    assert message.is_mock is True
    assert len(connector.sent_messages) == 1


def test_service_preserves_outgoing_attachment_metadata() -> None:
    attachment = OutgoingAttachment(
        name="proposal.pdf",
        mime_type="application/pdf",
        size_bytes=2048,
        storage_key="mock/proposal.pdf",
    )
    connector = MockCommunicationConnector(CommunicationChannel.EMAIL)
    registry = ConnectorRegistry()
    registry.register(connector)

    message = run(
        CommunicationService(registry).send(
            message_command(
                CommunicationChannel.EMAIL,
                attachments=[attachment],
            )
        )
    )

    assert message.attachments[0].id == attachment.id
    assert message.attachments[0].size_bytes == 2048
    assert message.attachments[0].storage_key == "mock/proposal.pdf"


def test_delivery_status_is_available_after_send() -> None:
    connector = MockCommunicationConnector(
        CommunicationChannel.WHATSAPP,
        MockConnectorConfig(delivery_status=MessageStatus.DELIVERED),
    )
    result = run(
        connector.send_message(message_command(CommunicationChannel.WHATSAPP))
    )

    assert result.status == MessageStatus.DELIVERED
    assert run(connector.get_delivery_status(result.external_message_id)) == (
        MessageStatus.DELIVERED
    )


def test_empty_message_without_attachment_is_invalid() -> None:
    with pytest.raises(ValidationError):
        message_command(text="   ")


def test_attachment_only_message_is_valid() -> None:
    command = message_command(
        text="",
        attachments=[OutgoingAttachment(name="logo.pdf", size_bytes=120000)],
    )

    assert command.text == ""
    assert command.attachments[0].name == "logo.pdf"


def test_attachment_rejects_negative_size() -> None:
    with pytest.raises(ValidationError):
        OutgoingAttachment(name="invalid.bin", size_bytes=-1)


def test_internal_channel_cannot_be_sent_externally() -> None:
    service = CommunicationService(ConnectorRegistry())

    with pytest.raises(MessageValidationError):
        run(service.send(message_command(CommunicationChannel.INTERNAL)))


def test_phone_channel_does_not_support_text_messages() -> None:
    service = CommunicationService(ConnectorRegistry())

    with pytest.raises(MessageValidationError):
        run(service.send(message_command(CommunicationChannel.PHONE)))


def test_mock_webhook_is_normalized_with_attachments() -> None:
    connector = MockCommunicationConnector(CommunicationChannel.TELEGRAM)
    messages = run(connector.normalize_webhook(webhook_payload()))

    assert len(messages) == 1
    message = messages[0]
    assert message.direction.value == "incoming"
    assert message.raw_event_id == "mock-event-1"
    assert message.external_message_id == "mock-message-1"
    assert message.attachments[0].external_id == "attachment-1"
    assert message.attachments[0].size_bytes == 120000


def test_service_processes_webhook_without_channel_specific_logic() -> None:
    connector = MockCommunicationConnector(CommunicationChannel.TELEGRAM)
    registry = ConnectorRegistry()
    registry.register(connector)

    messages = run(
        CommunicationService(registry).process_webhook(
            CommunicationChannel.TELEGRAM,
            webhook_payload(),
        )
    )

    assert len(messages) == 1
    assert messages[0].connector_name == connector.name


def test_mock_webhook_rejects_invalid_secret() -> None:
    connector = MockCommunicationConnector(
        CommunicationChannel.VK,
        MockConnectorConfig(webhook_secret="expected-secret"),
    )

    with pytest.raises(ConnectorAuthenticationError):
        run(
            connector.normalize_webhook(
                webhook_payload(),
                {"X-Mock-Secret": "wrong-secret"},
            )
        )


def test_mock_connector_can_simulate_temporary_error() -> None:
    connector = MockCommunicationConnector(
        CommunicationChannel.EMAIL,
        MockConnectorConfig(simulate_temporary_error=True),
    )

    with pytest.raises(ConnectorTemporaryError) as caught:
        run(connector.send_message(message_command(CommunicationChannel.EMAIL)))

    assert caught.value.retryable is True
    assert caught.value.temporary is True
    assert caught.value.mark_message_failed is False


def test_mock_connector_health_check_is_successful_by_default() -> None:
    connector = MockCommunicationConnector(CommunicationChannel.EMAIL)
    health = run(connector.validate_configuration())

    assert health.is_configured is True
    assert health.is_available is True
    assert health.checked_at.tzinfo is not None


def test_webhook_normalization_does_not_mutate_payload_and_is_idempotent() -> None:
    connector = MockCommunicationConnector(CommunicationChannel.WEBSITE)
    payload = webhook_payload()
    original = deepcopy(payload)

    first = run(connector.normalize_webhook(payload))
    duplicate = run(connector.normalize_webhook(payload))

    assert payload == original
    assert len(first) == 1
    assert duplicate == []
