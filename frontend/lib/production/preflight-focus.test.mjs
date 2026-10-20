import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { preflightFocusTarget, operationNormSelector, routeVariantSelector } from "./preflight-focus.ts";
import { planActionResolves, preflightItems } from "./tech-card-preflight.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function issue(overrides) {
  return {
    code: "model_required",
    severity: "error",
    message: "Модель изделия не выбрана.",
    fix_action: "Выберите модель изделия.",
    fix_url: "/production/tech-cards/1",
    diagnostic: null,
    ...overrides,
  };
}

function step(code, issues = []) {
  const status = issues.some((row) => row.severity === "error") ? "blocked" : issues.length ? "warning" : "completed";
  return { code, title: code, status, summary: "", issues, fix_action: null, fix_url: null, blocking: status === "blocked" };
}

const EMPTY = ["basic", "model", "route", "personalization", "norms", "planning", "launch"].map((code) => step(code));

function card(steps) {
  return {
    technical_card_id: 1,
    lifecycle_status: "draft",
    overall_status: "blocked",
    can_launch: false,
    progress_completed: 0,
    progress_total: 7,
    steps,
  };
}

function only(code, issues, context) {
  const items = preflightItems(card([
    step(code, issues),
    ...EMPTY.filter((row) => row.code !== code),
  ]), "launch", context);
  const row = items.find((item) => item.code === issues[0].code || item.code === "operation_norms" || item.code === "assembly_sewing" || item.code === "plan_review");
  assert.ok(row, items.map((item) => item.code).join(","));
  return preflightFocusTarget(row);
}

test("preflight actions land on the concrete field", () => {
  const dates = only("planning", [issue({ code: "planning_dates_required", message: "Не заполнены даты." })]);
  assert.equal(dates.open, "dates");
  assert.equal(dates.field, "[data-preflight-field='shipping-date']");
  assert.equal(dates.fallbackField, "#tech-card-route");

  const model = only("model", [issue({ code: "model_required", message: "Модель изделия не выбрана." })]);
  assert.equal(model.open, "model");
  assert.equal(model.field, "#tech-card-product-model");

  const assembly = only("model", [issue({ code: "assembly_required", message: "Сборка" })]);
  assert.equal(assembly.open, "assembly");
  assert.equal(assembly.field, "[data-tech-card-assembly-select]");

  const sewing = only("model", [issue({
    code: "missing_sewing_norm",
    message: "Нет нормы пошива.",
    diagnostic: { field_label: "Норма времени" },
  })], { assemblyName: "Пошив" });
  assert.equal(sewing.open, "assembly");
  assert.equal(sewing.field, "[data-tech-card-assembly-select]");

  const meter = only("norms", [issue({
    code: "missing_linear_meters",
    message: "Для операции «Печать» не указан метраж.",
  })]);
  assert.equal(meter.open, "norms");
  assert.equal(meter.operationName, "Печать");
  assert.equal(meter.field, operationNormSelector("Печать"));
  assert.equal(meter.tab, "operations");

  const many = only("norms", [
    issue({ code: "missing_linear_meters", message: "Для операции «Печать» не указан метраж." }),
    issue({ code: "missing_linear_meters", message: "Для операции «Раскрой» не указан метраж.", fix_action: "other", fix_url: "/other" }),
  ]);
  assert.equal(many.field, "#product-model-route-norms");
  assert.equal(many.operationName, null);

  const route = only("route", [issue({ code: "route_required", message: "Маршрут производства не выбран." })]);
  assert.equal(route.open, "route");
  assert.equal(route.field, "#tech-card-route [data-tech-card-routing-select]");

  const variant = only("route", [issue({
    code: "variant_not_selected",
    message: "Для операции «Термоперенос» не выбран вариант.",
  })]);
  assert.equal(variant.open, "variant");
  assert.equal(variant.field, routeVariantSelector("Термоперенос"));
  assert.equal(variant.fallbackField, "[data-route-variant] input[type='radio']");

  const quantityIssue = issue({
    code: "invalid_quantity",
    message: "Количество должно быть больше нуля.",
    diagnostic: { field: "quantity", field_label: "Количество изделий", fix_scope: "technical_card" },
  });
  const quantityRow = preflightItems(card([
    step("basic", [quantityIssue]),
    ...EMPTY.filter((row) => row.code !== "basic"),
  ]), "launch").find((item) => item.code === "invalid_quantity");
  assert.equal(quantityRow.actionLabel, null);
  assert.match(quantityRow.why, /План ТК/);
  const quantity = preflightFocusTarget(quantityRow);
  assert.equal(quantity.open, "section");
  assert.equal(quantity.field, "#tech-card-order-data");
  assert.equal(quantity.field.includes("tech-card-quantity"), false);

  const units = only("personalization", [issue({
    code: "personalization_quantity_mismatch",
    severity: "warning",
    message: "Персонализация заполнена на 3 из 4 изделий.",
  })]);
  assert.equal(units.open, "personalization");
  assert.equal(units.tab, "assembly");
  assert.equal(units.field, "[data-preflight-field='unit-quantity']");

  const plan = only("planning", [issue({ code: "calendar_plan_stale_after_demand_change", message: "План устарел." })]);
  assert.equal(plan.open, "plan");
  assert.equal(plan.field, "[data-tech-card-schedule-cta]");
  assert.equal(plan.sectionId, "tech-card-route");

  const blockedPlan = preflightItems(card([
    step("planning", [issue({ code: "quantity_planning_start_shipping_required", message: "Не хватает данных." })]),
    ...EMPTY.filter((row) => row.code !== "planning"),
  ]), "launch").find((item) => item.code === "plan_review");
  assert.equal(planActionResolves(blockedPlan), false);
  assert.equal(blockedPlan.actionLabel, "Указать даты");
  const blockedTarget = preflightFocusTarget(blockedPlan);
  assert.equal(blockedTarget.open, "dates");
  assert.equal(blockedTarget.field, "[data-preflight-field='shipping-date']");

  const allocationRow = preflightItems(card([
    step("planning", [issue({
      code: "calendar_allocation_amount_mismatch",
      message: "Производственный план требует проверки или пересчёта.",
      fix_action: "Проверьте даты и пересчитайте производственный план.",
      diagnostic: {
        field: "production_plan.assignment.8.calendar_allocation_amount_mismatch.machine",
        field_label: "Распределение нагрузки",
        fix_scope: "technical_card",
      },
    })]),
    ...EMPTY.filter((row) => row.code !== "planning"),
  ]), "launch").find((item) => item.code === "calendar_allocation_amount_mismatch");
  assert.equal(allocationRow.actionLabel, "Показать план");
  assert.equal(allocationRow.diagnosticField.startsWith("production_plan.assignment."), true);
  const allocation = preflightFocusTarget(allocationRow);
  assert.equal(allocation.open, "section");
  assert.equal(allocation.field, "#tech-card-route");
  assert.equal(allocation.field.includes("shipping-date"), false);
});

test("preflight close restores the opener and a fix action does not", () => {
  const modal = readFileSync(join(root, "components/production/tech-card-preflight-modal.tsx"), "utf8");
  const workspace = readFileSync(join(root, "components/production/tech-card-detail-workspace.tsx"), "utf8");
  assert.match(modal, /event\.key !== "Escape"/);
  assert.match(modal, /restoreOpener/);
  assert.match(modal, /data-preflight-action=\{item\.code\}/);
  assert.match(modal, /onClick=\{\(\) => onOpen\(item\)\}/);
  assert.match(workspace, /preflightFocusTarget\(item\)/);
  assert.match(workspace, /revealPreflightTarget\(preflightFocus/);
  assert.doesNotMatch(workspace, /item\.code === "plan_review"[\s\S]{0,80}scheduleBridgeRef/);
});
