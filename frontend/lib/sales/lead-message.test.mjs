import assert from "node:assert/strict";
import test from "node:test";

import {
  canSendLeadMessage,
  filterLeadMessages,
  formatAttachmentSize,
  getLeadMessageDestination,
  sortLeadMessages,
  buildLeadChannelThread,
} from "./lead-message.ts";

const contact = {
  id: "contact-1",
  name: "Сергей",
  phone: "+7 900 000-00-00",
  email: "sergey@example.test",
  messenger: "@sergey",
  preferredChannel: "telegram",
  isPrimary: true,
};
const messages = [
  { id: "new", leadId: "lead-1", channel: "email", direction: "outgoing", text: "new", sentAt: "2026-07-16T10:00:00Z" },
  { id: "old", leadId: "lead-1", channel: "telegram", direction: "incoming", text: "old", sentAt: "2026-07-15T10:00:00Z" },
];

test("sorts messages from old to new and filters by channel", () => {
  assert.deepEqual(sortLeadMessages(messages).map((message) => message.id), ["old", "new"]);
  assert.deepEqual(filterLeadMessages(messages, "email").map((message) => message.id), ["new"]);
});

test("resolves destinations from the primary contact", () => {
  assert.equal(getLeadMessageDestination("email", contact), "sergey@example.test");
  assert.equal(getLeadMessageDestination("whatsapp", contact), "+7 900 000-00-00");
  assert.equal(getLeadMessageDestination("telegram", contact), "@sergey");
  assert.equal(getLeadMessageDestination("vk", contact), undefined);
  assert.equal(canSendLeadMessage("email", "sergey@example.test"), true);
  assert.equal(canSendLeadMessage("phone", "+7 900 000-00-00"), false);
});

test("formats attachment metadata", () => {
  assert.equal(formatAttachmentSize(184 * 1024), "184 КБ");
  assert.equal(formatAttachmentSize(2 * 1024 * 1024), "2 МБ");
});

test("builds a per-channel thread newest first without mixing channels", () => {
  const thread = buildLeadChannelThread("email", messages, [
    { id: "call", type: "incoming_call", occurredAt: "2026-07-16T12:00:00Z", title: "call", channel: "phone" },
    { id: "mail-act", type: "email_received", occurredAt: "2026-07-16T11:00:00Z", title: "mail", channel: "email", description: "extra" },
  ]);
  assert.deepEqual(thread.map((item) => item.id), ["mail-act", "message-new"]);
  assert.deepEqual(buildLeadChannelThread("telegram", messages).map((item) => item.id), ["message-old"]);
  assert.deepEqual(buildLeadChannelThread("whatsapp", messages), []);
});
