from pydantic import BaseModel, ConfigDict, Field


class MailboxSettingsRead(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    display_name: str
    email_address: str | None
    smtp_enabled: bool
    smtp_host: str | None
    smtp_port: int
    smtp_use_tls: bool
    smtp_username: str | None
    smtp_from: str | None
    smtp_password_set: bool
    imap_enabled: bool
    imap_host: str | None
    imap_port: int
    imap_use_tls: bool
    imap_username: str | None
    imap_password_set: bool
    inbound_webhook_secret_set: bool
    create_lead_from_unknown: bool
    lead_source_label: str
    inbound_mode: str = "webhook"


class MailboxSettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: str | None = Field(default=None, max_length=255)
    email_address: str | None = Field(default=None, max_length=255)
    smtp_enabled: bool | None = None
    smtp_host: str | None = Field(default=None, max_length=255)
    smtp_port: int | None = Field(default=None, ge=1, le=65535)
    smtp_use_tls: bool | None = None
    smtp_username: str | None = Field(default=None, max_length=255)
    smtp_from: str | None = Field(default=None, max_length=255)
    smtp_password: str | None = Field(default=None, max_length=2000)
    imap_enabled: bool | None = None
    imap_host: str | None = Field(default=None, max_length=255)
    imap_port: int | None = Field(default=None, ge=1, le=65535)
    imap_use_tls: bool | None = None
    imap_username: str | None = Field(default=None, max_length=255)
    imap_password: str | None = Field(default=None, max_length=2000)
    inbound_webhook_secret: str | None = Field(default=None, max_length=2000)
    create_lead_from_unknown: bool | None = None
    lead_source_label: str | None = Field(default=None, max_length=150)
