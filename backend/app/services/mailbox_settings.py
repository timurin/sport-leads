from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.mailbox_settings import MailboxSettings
from app.schemas.mailbox_settings import MailboxSettingsRead, MailboxSettingsUpdate


class MailboxSettingsError(RuntimeError):
    pass


class MailboxSettingsValidationError(MailboxSettingsError):
    pass


def _blank_to_none(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _default_row() -> MailboxSettings:
    return MailboxSettings(
        id=1,
        display_name="Корпоративная почта",
        lead_source_label="email",
    )


def ensure_mailbox_settings(db: Session) -> MailboxSettings:
    row = db.get(MailboxSettings, 1)
    if row is None:
        row = _default_row()
        db.add(row)
        db.flush()
    return row


def _to_read(row: MailboxSettings) -> MailboxSettingsRead:
    return MailboxSettingsRead(
        id=row.id,
        display_name=row.display_name,
        email_address=row.email_address,
        smtp_enabled=row.smtp_enabled,
        smtp_host=row.smtp_host,
        smtp_port=row.smtp_port,
        smtp_use_tls=row.smtp_use_tls,
        smtp_username=row.smtp_username,
        smtp_from=row.smtp_from,
        smtp_password_set=bool(row.smtp_password),
        imap_enabled=row.imap_enabled,
        imap_host=row.imap_host,
        imap_port=row.imap_port,
        imap_use_tls=row.imap_use_tls,
        imap_username=row.imap_username,
        imap_password_set=bool(row.imap_password),
        inbound_webhook_secret_set=bool(row.inbound_webhook_secret),
        create_lead_from_unknown=row.create_lead_from_unknown,
        lead_source_label=row.lead_source_label,
        inbound_mode="webhook",
    )


def get_mailbox_settings(db: Session) -> MailboxSettingsRead:
    return _to_read(ensure_mailbox_settings(db))


def update_mailbox_settings(
    db: Session,
    payload: MailboxSettingsUpdate,
) -> MailboxSettingsRead:
    row = ensure_mailbox_settings(db)
    data = payload.model_dump(exclude_unset=True)
    smtp_password = data.pop("smtp_password", None)
    imap_password = data.pop("imap_password", None)
    inbound_secret = data.pop("inbound_webhook_secret", None)

    for key, value in data.items():
        if key in {"display_name", "lead_source_label"} and isinstance(value, str):
            cleaned = value.strip()
            if not cleaned:
                raise MailboxSettingsValidationError(f"{key} cannot be blank")
            setattr(row, key, cleaned)
            continue
        if key in {
            "email_address",
            "smtp_host",
            "smtp_username",
            "smtp_from",
            "imap_host",
            "imap_username",
        }:
            setattr(row, key, _blank_to_none(value) if isinstance(value, str) else value)
            continue
        setattr(row, key, value)

    if smtp_password is not None and smtp_password.strip():
        row.smtp_password = smtp_password
    if imap_password is not None and imap_password.strip():
        row.imap_password = imap_password
    if inbound_secret is not None and inbound_secret.strip():
        row.inbound_webhook_secret = inbound_secret.strip()

    db.flush()
    return _to_read(row)
