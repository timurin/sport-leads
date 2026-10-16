import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  DEBUG_BACKEND_GAPS,
  debugErrorCount,
  debugLayer,
  diagnosticDetails,
  filterDiagnostics,
  sortDiagnostics,
} from "./tech-card-debug.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function row(patch) {
  return {
    code: "missing_operation_volume",
    severity: "error",
    entity_type: "tech_operation",
    entity_id: 12,
    entity_name: "Сублимационная печать",
    field: "volume",
    field_label: "Объём операции",
    message: "Не рассчитан объём операции для техкарты.",
    fix_scope: "technical_card",
    operation_id: 12,
    resource_key: null,
    ...patch,
  };
}

test("debug sorts blocking errors before warnings and info", () => {
  const rows = sortDiagnostics([
    row({ code: "resource_unavailable", severity: "info", message: "info" }),
    row({ code: "resource_capacity_not_configured", severity: "warning", message: "warning" }),
    row({ code: "missing_operation_volume", severity: "error", message: "error" }),
  ]);
  assert.deepEqual(rows.map((item) => item.severity), ["error", "warning", "info"]);
  assert.equal(debugLayer(rows[0]), "Demand");
  assert.equal(debugLayer(rows[1]), "Capacity");
  assert.equal(debugLayer(row({ code: "completion_after_shipping_date" })), "Scheduler");
  assert.equal(debugLayer(row({ code: "unknown_backend_code", fix_scope: "technical_card" })), null);
  assert.equal(filterDiagnostics(rows, "error").length, 1);
  assert.equal(filterDiagnostics(rows, "warning").length, 1);
  assert.equal(filterDiagnostics(rows, "all").length, 3);
  assert.equal(debugErrorCount(rows), 1);
  assert.equal(filterDiagnostics([], "all").length, 0);
});

test("technical details keep ids and drop secrets", () => {
  const details = diagnosticDetails(row({ resource_key: "postgres://user:secret@db/app" }));
  assert.equal(details.find(([key]) => key === "code")[1], "missing_operation_volume");
  assert.equal(details.find(([key]) => key === "operation_id")[1], "12");
  assert.equal(details.find(([key]) => key === "entity_id")[1], "12");
  assert.equal(details.some(([key]) => key === "resource_key"), false);
  assert.equal(details.some(([, value]) => value.includes("secret")), false);
  assert.equal(diagnosticDetails(row({ operation_id: null })).some(([key]) => key === "operation_id"), false);
  assert.ok(DEBUG_BACKEND_GAPS.some((line) => line.includes("timestamp")));
  assert.ok(DEBUG_BACKEND_GAPS.some((line) => line.includes("snapshot_node_id")));
});

test("journal keeps history and debug reads the diagnostics api", () => {
  const journal = readFileSync(join(root, "components/production/tech-card-journal.tsx"), "utf8");
  const workspace = readFileSync(join(root, "components/production/tech-card-detail-workspace.tsx"), "utf8");
  const actions = readFileSync(join(root, "app/(workspace)/production/tech-cards/tech-card-actions.ts"), "utf8");
  assert.ok(journal.includes('mode === "journal"'));
  assert.ok(journal.includes("ActivityTimeline"));
  assert.ok(journal.includes("История пока пуста"));
  assert.ok(journal.includes("Ошибок и предупреждений не обнаружено."));
  assert.ok(journal.includes("Обновить диагностику"));
  assert.ok(journal.includes("PlatformDiagnosticCard"));
  const card = readFileSync(join(root, "components/platform/platform-diagnostic-card.tsx"), "utf8");
  assert.ok(card.includes("Технические данные"));
  assert.ok(journal.includes("Debug"));
  assert.equal(journal.includes("document.cookie"), false);
  assert.equal(journal.includes("localStorage"), false);
  assert.ok(workspace.includes("TechCardJournal"));
  assert.ok(actions.includes("refreshTechnicalCardDiagnostics"));
});
