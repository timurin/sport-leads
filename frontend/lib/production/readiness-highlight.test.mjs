import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  diagnosticHighlight,
  diagnosticsOnTab,
  fieldHighlight,
  headerDiagnosticPreview,
  openingTab,
  sectionSetupText,
} from "./readiness-highlight.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function row(patch) {
  return {
    code: "missing_operator_norm",
    severity: "error",
    entity_type: "tech_operation",
    entity_id: 7,
    entity_name: "Подготовка макетов",
    field: "demand_rule",
    field_label: "Правило расчёта потребности",
    message: "Операция «Подготовка макетов»: не заполнено поле «Правило расчёта потребности».",
    fix_scope: "tech_operation",
    operation_id: 7,
    ...patch,
  };
}

test("a diagnostic on the current tab highlights the demand section and the norm field", () => {
  const rule = diagnosticHighlight(row({}));
  assert.deepEqual(rule, { tab: "main", fieldId: "demand_rule", scope: "section" });
  assert.equal(sectionSetupText(row({})), "Требует настройки: Правило расчёта потребности");
  assert.equal(fieldHighlight([row({})], "demand_rule").scope, "section");
  const norm = row({ field: "demand_duration_seconds", field_label: "Норма времени", message: "Операция «Подготовка макетов»: не заполнено поле «Норма времени»." });
  assert.deepEqual(diagnosticHighlight(norm), { tab: "main", fieldId: "demand_duration_seconds", scope: "field" });
  assert.equal(fieldHighlight([norm], "demand_duration_seconds").message, norm.message);
});

test("a diagnostic on another tab is counted on that tab and opens it before editing starts", () => {
  const hours = row({ field: "hours_per_day", field_label: "Рабочих часов в день", fix_scope: "capacity_resource", message: "Операция «Печатник»: не заполнено поле «Рабочих часов в день»." });
  const rate = row({ field: "base_rate", field_label: "Производительность", fix_scope: "capacity_resource", code: "resource_capacity_not_configured", message: "Операция «Печатник»: требуется исправление для поля «Производительность»." });
  const machine = row({ field: "work_center_id", field_label: "Оборудование", fix_scope: "work_center", entity_type: "work_center" });
  assert.equal(diagnosticHighlight(hours).tab, "schedule");
  assert.equal(diagnosticHighlight(rate).tab, "capacity");
  assert.equal(diagnosticHighlight(rate).scope, "field");
  assert.equal(diagnosticHighlight(machine).scope, "section");
  assert.equal(diagnosticsOnTab([hours, rate], "schedule").length, 1);
  assert.equal(diagnosticsOnTab([hours, rate], "main").length, 0);
  assert.equal(openingTab({ requestedTab: "main", requestedField: null, diagnostics: [hours], userSteered: false }), "schedule");
  assert.equal(openingTab({ requestedTab: "main", requestedField: null, diagnostics: [hours], userSteered: true }), "main");
  assert.equal(openingTab({ requestedTab: "capacity", requestedField: "base_rate", diagnostics: [hours], userSteered: false }), "capacity");
});

test("several diagnostics collapse to the first message and a resolved list clears the highlight", () => {
  const rows = [0, 1, 2].map((index) => row({ code: `code-${index}`, field: `field-${index}`, message: `Сообщение ${index}` }));
  const preview = headerDiagnosticPreview(rows);
  assert.equal(preview.first.message, "Сообщение 0");
  assert.equal(preview.rest.length, 2);
  assert.equal(headerDiagnosticPreview(rows.filter((item) => item.code !== "code-0")).first.message, "Сообщение 1");
  assert.equal(headerDiagnosticPreview([]).first, null);
  assert.equal(fieldHighlight([], "demand_rule"), null);
});

test("the editor alert uses backend diagnostics and does not keep a second readiness warning", () => {
  const modal = readFileSync(join(root, "components/settings/tech-operation-edit-modal.tsx"), "utf8");
  const fields = readFileSync(join(root, "components/settings/tech-operation-capacity-fields.tsx"), "utf8");
  assert.ok(modal.includes("data-readiness-alert"));
  assert.ok(modal.includes("readDiagnostics(operation.diagnostics)"));
  assert.ok(modal.includes("Ещё "));
  assert.ok(modal.includes("data-tab-diagnostic-count"));
  assert.equal(modal.includes("OperationReadinessLine"), false);
  assert.ok(modal.includes("sectionSetupText"));
  assert.ok(readFileSync(join(root, "lib/production/readiness-highlight.ts"), "utf8").includes("Требует настройки:"));
  assert.ok(modal.includes('data-diagnostic-field="demand_duration_seconds"'));
  assert.ok(modal.includes('data-diagnostic-section="demand_rule"'));
  assert.ok(fields.includes('data-diagnostic-field="hours_per_day"'));
  assert.ok(fields.includes('data-diagnostic-field="base_rate"'));
  assert.ok(fields.includes('data-diagnostic-section="work_center_id"'));
  assert.equal(modal.includes("missing_operator_norm"), false);
});
