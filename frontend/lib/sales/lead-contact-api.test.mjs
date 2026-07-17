import assert from "node:assert/strict";
import test from "node:test";

import {
  fromApiLeadContact,
  toApiLeadContactPayload,
} from "./lead-contact-api.ts";

test("maps a persisted lead contact to the frontend model", () => {
  assert.deepEqual(fromApiLeadContact({
    id: 14,
    lead_id: 3,
    name: "Анна Петрова",
    position: "Закупки",
    phone: null,
    email: "anna@example.test",
    preferred_channel: "email",
    is_primary: true,
    created_at: "2026-07-17T10:00:00Z",
    updated_at: "2026-07-17T10:00:00Z",
  }), {
    id: "14",
    name: "Анна Петрова",
    position: "Закупки",
    phone: undefined,
    email: "anna@example.test",
    preferredChannel: "email",
    isPrimary: true,
  });
});

test("normalizes optional contact values for the API", () => {
  assert.deepEqual(toApiLeadContactPayload({
    name: "  Анна Петрова  ",
    position: " ",
    phone: " +7 900 000-00-00 ",
    email: "",
    preferredChannel: "phone",
    isPrimary: false,
  }), {
    name: "Анна Петрова",
    position: null,
    phone: "+7 900 000-00-00",
    email: null,
    preferred_channel: "phone",
  });
});
