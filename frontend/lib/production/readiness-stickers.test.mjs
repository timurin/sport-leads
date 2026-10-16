import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  diagnosticAdminHref,
  diagnosticCardAnchor,
  diagnosticEditorTarget,
  previewDiagnostics,
  stickerLabel,
  uniqueDiagnostics,
} from "./readiness-stickers.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

const shared = {
  code: "missing_operator_norm",
  severity: "error",
  entity_type: "capacity_resource",
  entity_id: "print_operator",
  entity_name: "Подготовка макетов к печати",
  field: "calculation_mode",
  field_label: "Как рассчитывается потребность",
  message: "Операция «Подготовка макетов к печати»: не настроено производственное правило для поля «Как рассчитывается потребность».",
  fix_scope: "capacity_resource",
  operation_id: 2,
  resource_key: "print_operator",
};

test("one diagnostic keeps the same entity and field caption", () => {
  assert.equal(stickerLabel(shared), "Подготовка макетов к печати · Как рассчитывается потребность");
  assert.equal(stickerLabel({ ...shared, entity_name: "Печатник / подготовка", field_label: "Рабочих часов в день", field: "hours_per_day" }), "Печатник / подготовка · Рабочих часов в день");
  assert.equal(stickerLabel({ ...shared, entity_name: "Epson SC-F9200", field_label: "Производительность", field: "base_rate" }), "Epson SC-F9200 · Производительность");
});

test("click targets the editor field and the admin screen", () => {
  assert.deepEqual(diagnosticEditorTarget(shared), { tab: "main", fieldId: "calculation_mode" });
  assert.equal(diagnosticAdminHref(shared), "/settings/catalogs/tech-operations?operation=2");
  const hours = { ...shared, field: "hours_per_day", field_label: "Рабочих часов в день" };
  assert.equal(diagnosticEditorTarget(hours).tab, "schedule");
  assert.equal(diagnosticAdminHref(hours), "/settings/catalogs/tech-operations?operation=2&tab=schedule");
  assert.equal(diagnosticAdminHref({ ...shared, fix_scope: "work_center", entity_id: 9, operation_id: null }), "/settings/catalogs/work-centers?capacity=9");
  assert.equal(diagnosticCardAnchor({ ...shared, fix_scope: "technical_card", field: "volume" }), "tech-card-route-scheme");
  assert.equal(diagnosticCardAnchor({ ...shared, fix_scope: "route_variant", field: "selected_operation_snapshot_node_id" }), "tech-card-route-scheme");
  assert.equal(diagnosticCardAnchor({ ...shared, fix_scope: "technical_card", field: "planning_start_date" }), "tech-card-production-plan");
});

test("extra diagnostics collapse behind the remaining count and a resolved row disappears", () => {
  const rows = [0, 1, 2, 3, 4].map((index) => ({ ...shared, code: `code-${index}`, field: `field-${index}` }));
  const preview = previewDiagnostics(rows);
  assert.equal(preview.shown.length, 3);
  assert.equal(preview.hidden, 2);
  assert.equal(previewDiagnostics(rows.filter((row) => row.code !== "code-0")).shown.some((row) => row.code === "code-0"), false);
  assert.equal(uniqueDiagnostics([shared, shared]).length, 1);
});

test("three screens share the sticker row and drop the generic route warning", () => {
  const component = readFileSync(join(root, "components/production/readiness-stickers.tsx"), "utf8");
  const operations = readFileSync(join(root, "components/settings/tech-operations-workspace.tsx"), "utf8");
  const routing = readFileSync(join(root, "components/settings/shop-routing-detail-workspace.tsx"), "utf8");
  const card = readFileSync(join(root, "components/production/tech-card-process.tsx"), "utf8");
  assert.ok(component.includes("stickerLabel"));
  assert.ok(component.includes("Ещё "));
  assert.equal(component.includes("Маршрут требует настройки"), false);
  assert.equal(component.includes("Нужен ручной ввод"), false);
  const routingActions = readFileSync(join(root, "app/(workspace)/settings/catalogs/routings/routing-actions.ts"), "utf8");
  assert.ok(routingActions.includes("diagnostics: Array.isArray(body.diagnostics) ? body.diagnostics : []"));
  assert.equal(routing.includes("node_readiness"), false);
  for (const source of [operations, routing, card]) assert.ok(source.includes("ReadinessStickers"));
  assert.equal(card.includes("Маршрут требует настройки"), false);
  assert.equal(card.includes("managerWarningCallout"), false);
});
