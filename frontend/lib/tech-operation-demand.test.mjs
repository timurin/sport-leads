import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { diagnosticEditorTarget } from "./production/readiness-stickers.ts";
import {
  FIXED_DEMAND_EXAMPLE,
  PER_ITEM_DEMAND_EXAMPLE,
  demandDurationField,
  demandRuleHint,
  demandWriteFields,
  parseDemandDuration,
} from "./tech-operation-demand.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("fixed and per-item norms convert minutes to seconds and show the examples", () => {
  assert.equal(parseDemandDuration("60").seconds, 3600);
  assert.equal(parseDemandDuration("2").seconds, 120);
  assert.equal(parseDemandDuration("1,5").seconds, 90);
  assert.deepEqual(demandDurationField(3600), { value: "60", unit: "min" });
  assert.deepEqual(demandDurationField(120), { value: "2", unit: "min" });
  assert.equal(demandRuleHint("fixed_per_order", 3600), FIXED_DEMAND_EXAMPLE);
  assert.equal(demandRuleHint("per_item", 120), PER_ITEM_DEMAND_EXAMPLE);
  assert.equal(FIXED_DEMAND_EXAMPLE, "60 мин. → 1 чел.-ч на техкарту");
  assert.equal(PER_ITEM_DEMAND_EXAMPLE, "2 мин. × 100 шт. → 3 ч 20 мин.");
});

test("an empty norm is not a saved duration and a bad value is rejected", () => {
  assert.deepEqual(parseDemandDuration(""), { seconds: null, error: null });
  assert.deepEqual(parseDemandDuration("   "), { seconds: null, error: null });
  assert.equal(parseDemandDuration("0").error, "Укажите норму времени больше нуля");
  assert.equal(parseDemandDuration("нет").error, "Укажите норму времени");
  assert.equal(demandWriteFields({ demand_rule: "fixed_per_order", demand_duration_minutes: "" }).demand_duration_seconds, null);
  assert.equal(demandWriteFields({ demand_rule: "per_item", demand_duration_minutes: "0" }).error, "Укажите норму времени больше нуля");
  assert.deepEqual(demandWriteFields({}), { include: false });
  const saved = demandWriteFields({ demand_rule: "per_item", demand_duration_minutes: "2" });
  assert.deepEqual(saved, { include: true, demand_rule: "per_item", demand_duration_seconds: 120 });
  assert.equal(demandDurationField(saved.demand_duration_seconds).value, "2");
});

test("the demand sticker focuses the rule or the duration and the editor does not show the internal code", () => {
  assert.deepEqual(diagnosticEditorTarget({ field: "demand_rule", fix_scope: "tech_operation" }), { tab: "main", fieldId: "demand_rule" });
  assert.deepEqual(diagnosticEditorTarget({ field: "demand_duration_seconds", fix_scope: "tech_operation" }), { tab: "main", fieldId: "demand_duration_seconds" });
  const modal = readFileSync(join(root, "components/settings/tech-operation-edit-modal.tsx"), "utf8");
  const demand = readFileSync(join(root, "lib/tech-operation-demand.ts"), "utf8");
  const actions = readFileSync(join(root, "app/(workspace)/settings/catalogs/tech-operations/tech-operation-actions.ts"), "utf8");
  assert.ok(modal.includes("DEMAND_RULE_LABEL"));
  assert.ok(demand.includes("Фиксированное время на техкарту"));
  assert.ok(demand.includes("Время на одно изделие"));
  assert.ok(modal.includes("Норма времени"));
  assert.ok(modal.includes('data-diagnostic-field="demand_rule"'));
  assert.ok(modal.includes('data-diagnostic-field="demand_duration_seconds"'));
  assert.ok(modal.includes("explicit_hours"));
  assert.equal(modal.includes("missing_operator_norm"), false);
  assert.ok(actions.includes('revalidatePath("/settings/catalogs/routings", "layout")'));
  assert.ok(actions.includes('revalidatePath("/production/tech-cards", "layout")'));
});
