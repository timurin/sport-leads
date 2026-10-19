import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  DEBUG_MODE_BACKEND_GAP,
  buildDebugLog,
  debugContextFromPath,
  debugLogFilename,
  debugModeContract,
  diagnosticTechnicalRows,
  filterHealthDiagnostics,
  safeFixHref,
  traceChain,
} from "./platform-debug.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function row(patch) {
  return {
    code: "missing_linear_meters",
    severity: "error",
    entity_type: "technical_card",
    entity_id: 53,
    entity_name: "ТК-53",
    field: "volume",
    field_label: "Объём операции",
    message: "Не рассчитан объём операции для техкарты.",
    fix_scope: "technical_card",
    operation_id: 12,
    category: "DATA_FLOW",
    module: "operation_volume",
    debug_details: {},
    trace: [],
    ...patch,
  };
}

test("debug mode stays off until the settings contract has a boolean", () => {
  assert.equal(debugModeContract({ organization_display_name: "Sport-Lead" }).enabled, false);
  assert.equal(debugModeContract({ organization_display_name: "Sport-Lead" }).gap, DEBUG_MODE_BACKEND_GAP);
  assert.equal(debugModeContract({ debug_mode: false }).enabled, false);
  assert.equal(debugModeContract({ debug_mode: true }).enabled, true);
  assert.equal(debugModeContract({ debug_mode: true }).gap, "");
});

test("health filters, search and safe links", () => {
  const rows = [
    row({ code: "missing_linear_meters", category: "DATA_FLOW", message: "объём" }),
    row({ code: "plan_locked", category: "RUNTIME", severity: "warning", message: "план", entity_name: "ТК-2" }),
    row({ code: "broken_reference", category: "INTEGRITY", message: "ссылка" }),
  ];
  assert.deepEqual(filterHealthDiagnostics(rows, "DATA_FLOW", "").map((item) => item.code), ["missing_linear_meters"]);
  assert.deepEqual(filterHealthDiagnostics(rows, "all", "тк-2").map((item) => item.code), ["plan_locked"]);
  assert.equal(filterHealthDiagnostics(rows, "CONFIGURATION", "").length, 0);
  assert.equal(safeFixHref("/production/tech-cards/53"), "/production/tech-cards/53");
  assert.equal(safeFixHref("https://evil.example/x"), null);
  assert.equal(safeFixHref("//evil.example"), null);
  assert.deepEqual(debugContextFromPath("/production/tech-cards/53"), {
    entityType: "technical_card",
    entityId: "53",
    label: "Техкарта 53",
  });
  assert.equal(debugContextFromPath("/production/calendar/planning")?.module, "calendar");
  assert.equal(debugContextFromPath("/sales/orders"), null);
});

test("trace marks only a broken mapped node and details drop secrets", () => {
  const chain = traceChain([
    { source: "ShopRoutingTemplate.stage_lines", value: [1], broken: false },
    { source: "TechnicalCard.stage_results", value: [], broken: true },
    { source: "Demand", value: null, broken: false },
    { source: "Scheduler", value: null, broken: false },
  ]);
  assert.equal(chain.find((node) => node.id === "Source").state, "present");
  assert.equal(chain.find((node) => node.id === "Snapshot").state, "broken");
  assert.equal(chain.find((node) => node.id === "Derived").state, "unknown");
  assert.equal(chain.find((node) => node.id === "Demand").state, "present");
  assert.equal(chain.find((node) => node.id === "Scheduler").state, "present");
  assert.ok(traceChain([]).every((node) => node.state === "unknown"));
  const details = diagnosticTechnicalRows(row({
    resource_key: "postgres://user:secret@db/app",
    debug_details: { password: "hidden", operation_line_id: 7 },
  }));
  assert.equal(details.find(([key]) => key === "operation_line_id")[1], "7");
  assert.equal(details.some(([key]) => key === "password"), false);
  assert.equal(details.some(([, value]) => String(value).includes("secret")), false);
});

test("debug center, settings gap and journal share the diagnostic card", () => {
  const center = readFileSync(join(root, "components/platform/platform-debug-center.tsx"), "utf8");
  const topbar = readFileSync(join(root, "components/navigation/top-navigation.tsx"), "utf8");
  const settings = readFileSync(join(root, "components/settings/system-settings-workspace.tsx"), "utf8");
  const journal = readFileSync(join(root, "components/production/tech-card-journal.tsx"), "utf8");
  const actions = readFileSync(join(root, "app/(workspace)/settings/system/system-settings-actions.ts"), "utf8");
  assert.ok(center.includes("Диагностика платформы"));
  assert.ok(center.includes("Проверить платформу"));
  assert.ok(center.includes("Показать все ошибки платформы"));
  assert.ok(center.includes("Configuration"));
  assert.ok(center.includes("Data Flow"));
  assert.ok(center.includes("Runtime"));
  assert.ok(center.includes("Integrity"));
  assert.ok(center.includes('aria-label="Поиск диагностики"'));
  assert.equal(center.includes("document.cookie"), false);
  assert.equal(center.includes("localStorage"), false);
  assert.ok(topbar.includes("debugMode"));
  assert.ok(topbar.includes("data-platform-debug-button"));
  assert.ok(topbar.includes("debugMode && debugOpen"));
  assert.ok(settings.includes("Режим отладки"));
  assert.ok(settings.includes("debugModeContract"));
  assert.equal(settings.includes("localStorage"), false);
  assert.equal(actions.includes("debug_mode"), true);
  assert.ok(journal.includes("PlatformDiagnosticCard"));
  assert.ok(journal.includes('mode === "journal"'));
  assert.ok(center.includes("Скачать log"));
  assert.ok(center.includes("data-debug-log-download"));
  assert.ok(topbar.includes("debugMode && debugOpen"));
});

test("debug log is a whitelisted json document without secrets", () => {
  const when = new Date("2026-10-12T12:30:00.000Z");
  assert.equal(debugLogFilename(when), "Sport-Leads-debug-2026-10-12T12-30-00.json");
  const empty = buildDebugLog({
    generatedAt: when,
    page: "/production/calendar",
    context: { module: "calendar", label: "Календарь" },
    category: "all",
    query: "",
    offset: 0,
    total: 0,
    diagnostics: [],
  });
  assert.equal(empty.diagnostics_count, 0);
  assert.deepEqual(empty.diagnostics, []);
  assert.equal(empty.module, "calendar");
  assert.equal(empty.page, "/production/calendar");
  const payload = buildDebugLog({
    generatedAt: when,
    page: "/production/tech-cards/53",
    context: { entityType: "technical_card", entityId: "53", label: "Техкарта 53" },
    category: "DATA_FLOW",
    query: "печать",
    offset: 0,
    total: 4,
    diagnostics: [
      row({
        snapshot_node_id: 9,
        reason: "missing_linear_meters",
        expected_source: "ProductModelOperationNorm.norm_qty_per_item",
        source_value: null,
        actual_value: 0,
        formula: "norm_per_item * quantity",
        fix_url: "/settings/catalogs/product-models/41",
        trace: [{ source: "ProductModelOperationNorm.norm_qty_per_item", value: null, broken: true }],
        debug_details: { password: "hidden", snapshot_node_id: 9, operation_line_id: 7 },
        resource_key: "postgres://user:secret@db/app",
      }),
    ],
  });
  assert.equal(payload.entity_type, "technical_card");
  assert.equal(payload.entity_id, "53");
  assert.equal(payload.filters.category, "DATA_FLOW");
  assert.equal(payload.filters.query, "печать");
  assert.equal(payload.diagnostics_count, 1);
  assert.equal(payload.diagnostics[0].code, "missing_linear_meters");
  assert.equal(payload.diagnostics[0].snapshot_node_id, 9);
  assert.equal(payload.diagnostics[0].formula, "norm_per_item * quantity");
  const serialized = JSON.stringify(payload);
  assert.equal(serialized.includes("password"), false);
  assert.equal(serialized.includes("secret"), false);
  assert.equal(serialized.includes("postgres://"), false);
  assert.equal(serialized.includes("cookie"), false);
});

test("missing norms dialog stays manager-facing and fill is permission gated", () => {
  const dialog = readFileSync(join(root, "components/production/missing-operation-norms-dialog.tsx"), "utf8");
  const card = readFileSync(join(root, "components/production/tech-card-model-route-card.tsx"), "utf8");
  const page = readFileSync(join(root, "lib/production/load-tech-card-document.ts"), "utf8");
  const documentPage = readFileSync(join(root, "app/(workspace)/production/tech-cards/[id]/page.tsx"), "utf8");
  const modal = readFileSync(join(root, "components/settings/product-model-full-card-modal.tsx"), "utf8");
  const routings = readFileSync(join(root, "components/settings/product-model-routings-block.tsx"), "utf8");
  assert.ok(dialog.includes("Нормы операций не заполнены!"));
  assert.ok(dialog.includes("Для выбранной модели не заполнены нормы"));
  assert.ok(dialog.includes("Закрыть"));
  assert.ok(dialog.includes("Заполнить"));
  assert.ok(dialog.includes("canEditNorms"));
  assert.equal(dialog.includes("missing_linear_meters"), false);
  assert.equal(dialog.includes("DATA_FLOW"), false);
  assert.equal(dialog.includes("admin"), false);
  assert.ok(card.includes("inspectModelOperationNorms"));
  assert.ok(card.includes("Требует настройки"));
  assert.ok(card.includes("focusNorms"));
  assert.ok(modal.includes("product-model-route-norms"));
  assert.ok(routings.includes('id="product-model-route-norms"'));
  assert.ok(page.includes("PERM_SIZE_GRIDS_WRITE"));
  assert.ok(page.includes("canEditModelNorms"));
  assert.ok(documentPage.includes("loadTechnicalCardDocument"));
  assert.ok(documentPage.includes("TechCardDetailWorkspace"));
});
