import assert from "node:assert/strict";
import test from "node:test";

import {
  isTechnicalCardSettingsDirty,
  toTechnicalCardSettingsDraft,
  validateTechnicalCardSettingsDraft,
} from "./technical-card-settings.ts";

const settings = {
  id: 1,
  eligible_nomenclature_types: ["PRODUCT"],
  numbering_template: "{orderNo}-{cardSeq}",
  unit_field_size_type_enabled: true,
  unit_field_size_enabled: true,
  unit_field_personalization_enabled: true,
  unit_field_print_number_enabled: true,
  unit_field_notes_enabled: true,
  stage_label_binding_mode: "snapshot",
  created_at: "2026-07-28T00:00:00Z",
  updated_at: "2026-07-28T00:00:00Z",
};

test("settings draft round-trip starts clean", () => {
  const draft = toTechnicalCardSettingsDraft(settings);
  assert.equal(isTechnicalCardSettingsDirty(settings, draft), false);
  assert.equal(validateTechnicalCardSettingsDraft(draft), null);
});

test("settings draft validates numbering placeholders", () => {
  const draft = {
    ...toTechnicalCardSettingsDraft(settings),
    numbering_template: "TC-{orderNo}",
  };
  assert.equal(
    validateTechnicalCardSettingsDraft(draft),
    "Шаблон нумерации должен содержать {orderNo} и {cardSeq}",
  );
});

test("settings draft detects changed eligibility and unit defaults", () => {
  const draft = {
    ...toTechnicalCardSettingsDraft(settings),
    eligible_nomenclature_types: ["PRODUCT", "SERVICE"],
    unit_field_size_enabled: false,
  };
  assert.equal(isTechnicalCardSettingsDirty(settings, draft), true);
});
