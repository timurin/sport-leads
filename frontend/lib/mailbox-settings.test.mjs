import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  isMailboxSettingsDirty,
  mailboxSettingsUpdatePayload,
  toMailboxSettingsDraft,
  validateMailboxSettingsDraft,
} from "./mailbox-settings.ts";

const SAMPLE = {
  id: 1,
  display_name: "Корпоративная почта",
  email_address: "itd@example.com",
  smtp_enabled: true,
  smtp_host: "smtp.mail.ru",
  smtp_port: 465,
  smtp_use_tls: true,
  smtp_username: "itd@example.com",
  smtp_from: "itd@example.com",
  smtp_password_set: true,
  imap_enabled: false,
  imap_host: "imap.mail.ru",
  imap_port: 993,
  imap_use_tls: true,
  imap_username: "itd@example.com",
  imap_password_set: true,
  inbound_webhook_secret_set: true,
  create_lead_from_unknown: false,
  lead_source_label: "email",
  inbound_mode: "webhook",
};

test("mailbox draft does not send empty passwords", () => {
  const draft = toMailboxSettingsDraft(SAMPLE);
  const payload = mailboxSettingsUpdatePayload(draft);
  assert.equal("smtp_password" in payload, false);
  assert.equal("imap_password" in payload, false);
  assert.equal("inbound_webhook_secret" in payload, false);
  draft.smtp_password = "new-secret";
  assert.equal(mailboxSettingsUpdatePayload(draft).smtp_password, "new-secret");
});

test("mailbox dirty detects password and smtp toggle", () => {
  const draft = toMailboxSettingsDraft(SAMPLE);
  assert.equal(isMailboxSettingsDirty(SAMPLE, draft), false);
  draft.smtp_enabled = false;
  assert.equal(isMailboxSettingsDirty(SAMPLE, draft), true);
  const again = toMailboxSettingsDraft(SAMPLE);
  again.smtp_password = "x";
  assert.equal(isMailboxSettingsDirty(SAMPLE, again), true);
});

test("mailbox validation requires from when smtp host is set", () => {
  const draft = toMailboxSettingsDraft(SAMPLE);
  draft.smtp_from = "";
  assert.match(validateMailboxSettingsDraft(draft) ?? "", /отправителя/);
});

test("mailbox workspace keeps Bitrix-like sections and Soft UI", async () => {
  const path = fileURLToPath(
    new URL("../components/settings/mailbox-settings-workspace.tsx", import.meta.url),
  );
  const source = await readFile(path, "utf8");
  for (const marker of [
    "sl-design-v1",
    "Настройка почтового ящика",
    "Выбранный почтовый клиент",
    "Настройки SMTP",
    "Интеграция с CRM",
    "Создавать лид для входящей почты",
  ]) {
    assert.ok(source.includes(marker), `missing mailbox marker: ${marker}`);
  }
});
