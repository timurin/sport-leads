import assert from "node:assert/strict";
import test from "node:test";

import {
  brandInitials,
  isPlatformSystemSettingsDirty,
  toPlatformSystemSettingsDraft,
  validatePlatformSystemSettingsDraft,
} from "../lib/platform-system-settings.ts";

const sample = {
  id: 1,
  organization_display_name: "Sport-Lead",
  default_timezone: "Europe/Moscow",
  support_email: null,
  ui_locale: "ru-RU",
  notes: null,
  logo_url: null,
  logo_filename: null,
  created_at: "2026-08-02T00:00:00Z",
  updated_at: "2026-08-02T00:00:00Z",
};

test("draft mirrors settings and dirty detects edits", () => {
  const draft = toPlatformSystemSettingsDraft(sample);
  assert.equal(isPlatformSystemSettingsDirty(sample, draft), false);
  draft.organization_display_name = "Demo";
  assert.equal(isPlatformSystemSettingsDirty(sample, draft), true);
});

test("validation rejects empty org name and bad email", () => {
  const draft = toPlatformSystemSettingsDraft(sample);
  draft.organization_display_name = "  ";
  assert.match(
    validatePlatformSystemSettingsDraft(draft) ?? "",
    /название организации/i,
  );
  draft.organization_display_name = "Sport-Lead";
  draft.support_email = "not-an-email";
  assert.match(validatePlatformSystemSettingsDraft(draft) ?? "", /email/i);
  draft.support_email = "ops@example.com";
  assert.equal(validatePlatformSystemSettingsDraft(draft), null);
});

test("brandInitials from organization display name", () => {
  assert.equal(brandInitials("MOSMADE"), "MO");
  assert.equal(brandInitials("Sport Lead"), "SL");
});
