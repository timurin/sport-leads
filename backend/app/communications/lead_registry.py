from sqlalchemy.orm import Session

from app.communications.connectors.email import (
    EmailCommunicationConnector,
    EmailConnectorConfig,
)
from app.communications.registry import ConnectorRegistry
from app.config.settings import settings
from app.models.mailbox_settings import MailboxSettings


def email_connector_config_from_settings(
    db: Session | None = None,
) -> EmailConnectorConfig:
    env = EmailConnectorConfig(
        host=settings.smtp_host,
        port=settings.smtp_port,
        username=settings.smtp_username,
        password=settings.smtp_password,
        from_address=settings.smtp_from,
        use_tls=settings.smtp_use_tls,
        webhook_secret=settings.lead_email_webhook_secret,
    )
    if db is None:
        return env
    row = db.get(MailboxSettings, 1)
    if row is None:
        return env
    webhook = (row.inbound_webhook_secret or "").strip() or env.webhook_secret
    if not row.smtp_enabled:
        return EmailConnectorConfig(
            host=None,
            port=row.smtp_port or env.port,
            username=None,
            password=None,
            from_address=None,
            use_tls=row.smtp_use_tls,
            webhook_secret=webhook,
        )
    return EmailConnectorConfig(
        host=(row.smtp_host or "").strip() or env.host,
        port=row.smtp_port or env.port,
        username=(row.smtp_username or "").strip() or env.username,
        password=row.smtp_password or env.password,
        from_address=(row.smtp_from or "").strip() or env.from_address,
        use_tls=row.smtp_use_tls,
        webhook_secret=webhook,
    )


def build_lead_connector_registry(db: Session | None = None) -> ConnectorRegistry:
    registry = ConnectorRegistry()
    config = email_connector_config_from_settings(db)
    if config.is_configured or bool((config.webhook_secret or "").strip()):
        registry.register(EmailCommunicationConnector(config))
    return registry


def has_real_email_send(db: Session | None = None) -> bool:
    return email_connector_config_from_settings(db).is_configured


def should_create_lead_from_unknown_email(db: Session) -> bool:
    row = db.get(MailboxSettings, 1)
    return bool(row is not None and row.create_lead_from_unknown)


def mailbox_lead_source_label(db: Session) -> str:
    row = db.get(MailboxSettings, 1)
    if row is None or not (row.lead_source_label or "").strip():
        return "email"
    return row.lead_source_label.strip()
