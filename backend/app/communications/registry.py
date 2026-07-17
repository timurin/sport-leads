from app.communications.base import CommunicationConnector
from app.communications.enums import CommunicationChannel
from app.communications.exceptions import (
    ConnectorConfigurationError,
    ConnectorNotFoundError,
)


class ConnectorRegistry:
    def __init__(self) -> None:
        self._connectors: dict[CommunicationChannel, CommunicationConnector] = {}

    def register(
        self,
        connector: CommunicationConnector,
        *,
        replace: bool = False,
    ) -> None:
        if connector.channel in self._connectors and not replace:
            raise ConnectorConfigurationError(
                f"Connector for channel '{connector.channel.value}' is already registered"
            )
        self._connectors[connector.channel] = connector

    def get(self, channel: CommunicationChannel) -> CommunicationConnector:
        connector = self._connectors.get(channel)
        if connector is None:
            raise ConnectorNotFoundError(
                f"Connector for channel '{channel.value}' is not registered"
            )
        return connector

    def has(self, channel: CommunicationChannel) -> bool:
        return channel in self._connectors

    def list_registered(self) -> tuple[CommunicationConnector, ...]:
        return tuple(self._connectors.values())
