from app.collectors.factory import CollectorFactory
from app.collectors.source_base import SourceCollector
from app.collectors.webhook_form import WEBHOOK_FORM_ADAPTER
from app.communications.base import CommunicationConnector
from app.communications.connectors.email import (
    EMAIL_CONNECTOR_NAME,
    EmailCommunicationConnector,
    EmailConnectorConfig,
)
from app.main import app


def test_source_collectors_do_not_register_smtp_email() -> None:
    types = CollectorFactory.supported_types()
    assert WEBHOOK_FORM_ADAPTER in types
    assert EMAIL_CONNECTOR_NAME not in types
    assert "email" not in types
    assert "smtp" not in types


def test_email_connector_is_not_a_source_collector() -> None:
    connector = EmailCommunicationConnector(
        EmailConnectorConfig(host="smtp.test", from_address="crm@example.com")
    )
    assert isinstance(connector, CommunicationConnector)
    assert not isinstance(connector, SourceCollector)
    assert connector.name == EMAIL_CONNECTOR_NAME


def test_contour_c_openapi_paths_are_registered() -> None:
    paths = app.openapi()["paths"]
    assert "/leads/ingest/website-form" in paths
    assert "/leads/messages/inbound/email" in paths
    assert "/mailbox-settings" in paths
    assert paths["/leads/ingest/website-form"]["post"]["operationId"] == (
        "ingest_website_form_lead"
    )
    assert paths["/leads/messages/inbound/email"]["post"]["operationId"] == (
        "ingest_inbound_email_lead_message"
    )
    assert paths["/mailbox-settings"]["get"]["operationId"] == "get_mailbox_settings"
    assert paths["/mailbox-settings"]["put"]["operationId"] == "update_mailbox_settings"
