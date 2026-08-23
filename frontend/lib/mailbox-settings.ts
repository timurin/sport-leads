export type MailboxSettings = {
  id: number;
  display_name: string;
  email_address: string | null;
  smtp_enabled: boolean;
  smtp_host: string | null;
  smtp_port: number;
  smtp_use_tls: boolean;
  smtp_username: string | null;
  smtp_from: string | null;
  smtp_password_set: boolean;
  imap_enabled: boolean;
  imap_host: string | null;
  imap_port: number;
  imap_use_tls: boolean;
  imap_username: string | null;
  imap_password_set: boolean;
  inbound_webhook_secret_set: boolean;
  create_lead_from_unknown: boolean;
  lead_source_label: string;
  inbound_mode: string;
};

export type MailboxSettingsDraft = {
  display_name: string;
  email_address: string;
  smtp_enabled: boolean;
  smtp_host: string;
  smtp_port: string;
  smtp_use_tls: boolean;
  smtp_username: string;
  smtp_from: string;
  smtp_password: string;
  imap_enabled: boolean;
  imap_host: string;
  imap_port: string;
  imap_use_tls: boolean;
  imap_username: string;
  imap_password: string;
  inbound_webhook_secret: string;
  create_lead_from_unknown: boolean;
  lead_source_label: string;
};

export function toMailboxSettingsDraft(
  settings: MailboxSettings,
): MailboxSettingsDraft {
  return {
    display_name: settings.display_name,
    email_address: settings.email_address ?? "",
    smtp_enabled: settings.smtp_enabled,
    smtp_host: settings.smtp_host ?? "",
    smtp_port: String(settings.smtp_port),
    smtp_use_tls: settings.smtp_use_tls,
    smtp_username: settings.smtp_username ?? "",
    smtp_from: settings.smtp_from ?? "",
    smtp_password: "",
    imap_enabled: settings.imap_enabled,
    imap_host: settings.imap_host ?? "",
    imap_port: String(settings.imap_port),
    imap_use_tls: settings.imap_use_tls,
    imap_username: settings.imap_username ?? "",
    imap_password: "",
    inbound_webhook_secret: "",
    create_lead_from_unknown: settings.create_lead_from_unknown,
    lead_source_label: settings.lead_source_label,
  };
}

export function mailboxSettingsUpdatePayload(draft: MailboxSettingsDraft) {
  const smtpPort = Number(draft.smtp_port);
  const imapPort = Number(draft.imap_port);
  return {
    display_name: draft.display_name.trim(),
    email_address: draft.email_address.trim() || null,
    smtp_enabled: draft.smtp_enabled,
    smtp_host: draft.smtp_host.trim() || null,
    smtp_port: Number.isInteger(smtpPort) ? smtpPort : 587,
    smtp_use_tls: draft.smtp_use_tls,
    smtp_username: draft.smtp_username.trim() || null,
    smtp_from: draft.smtp_from.trim() || null,
    ...(draft.smtp_password.trim()
      ? { smtp_password: draft.smtp_password }
      : {}),
    imap_enabled: draft.imap_enabled,
    imap_host: draft.imap_host.trim() || null,
    imap_port: Number.isInteger(imapPort) ? imapPort : 993,
    imap_use_tls: draft.imap_use_tls,
    imap_username: draft.imap_username.trim() || null,
    ...(draft.imap_password.trim()
      ? { imap_password: draft.imap_password }
      : {}),
    ...(draft.inbound_webhook_secret.trim()
      ? { inbound_webhook_secret: draft.inbound_webhook_secret.trim() }
      : {}),
    create_lead_from_unknown: draft.create_lead_from_unknown,
    lead_source_label: draft.lead_source_label.trim() || "email",
  };
}

export function validateMailboxSettingsDraft(
  draft: MailboxSettingsDraft,
): string | null {
  if (!draft.display_name.trim()) {
    return "Укажите название ящика";
  }
  const smtpPort = Number(draft.smtp_port);
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
    return "Некорректный порт SMTP";
  }
  const imapPort = Number(draft.imap_port);
  if (!Number.isInteger(imapPort) || imapPort < 1 || imapPort > 65535) {
    return "Некорректный порт IMAP";
  }
  if (draft.smtp_enabled && draft.smtp_host.trim() && !draft.smtp_from.trim()) {
    return "Для SMTP укажите адрес отправителя";
  }
  return null;
}

export function isMailboxSettingsDirty(
  settings: MailboxSettings,
  draft: MailboxSettingsDraft,
): boolean {
  const baseline = toMailboxSettingsDraft(settings);
  return (
    baseline.display_name !== draft.display_name ||
    baseline.email_address !== draft.email_address ||
    baseline.smtp_enabled !== draft.smtp_enabled ||
    baseline.smtp_host !== draft.smtp_host ||
    baseline.smtp_port !== draft.smtp_port ||
    baseline.smtp_use_tls !== draft.smtp_use_tls ||
    baseline.smtp_username !== draft.smtp_username ||
    baseline.smtp_from !== draft.smtp_from ||
    draft.smtp_password.trim() !== "" ||
    baseline.imap_enabled !== draft.imap_enabled ||
    baseline.imap_host !== draft.imap_host ||
    baseline.imap_port !== draft.imap_port ||
    baseline.imap_use_tls !== draft.imap_use_tls ||
    baseline.imap_username !== draft.imap_username ||
    draft.imap_password.trim() !== "" ||
    draft.inbound_webhook_secret.trim() !== "" ||
    baseline.create_lead_from_unknown !== draft.create_lead_from_unknown ||
    baseline.lead_source_label !== draft.lead_source_label
  );
}
