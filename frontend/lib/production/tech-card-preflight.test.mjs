import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { preflightBlocks, preflightItems } from "./tech-card-preflight.ts";

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

function step(code, issues = [], status = issues.some((row) => row.severity === "error") ? "blocked" : issues.length ? "warning" : "completed") {
  return {
    code,
    title: code,
    status,
    summary: "",
    issues,
    fix_action: null,
    fix_url: null,
    blocking: status === "blocked",
  };
}

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

const EMPTY = ["basic", "model", "route", "personalization", "norms", "planning", "launch"].map((code) => step(code));

test("model without selected assembly opens the assembly action", () => {
  const items = preflightItems(card([
    ...EMPTY.filter((row) => row.code !== "model"),
    step("model", [issue({
      code: "assembly_required",
      message: "Для пошива не выбрана сборка с производственными нормами.",
    })]),
  ]), "launch");
  const row = items.find((item) => item.code === "assembly_required");
  assert.equal(row.title, "Нужно выбрать сборку изделия");
  assert.equal(row.detail, "Для выбранной модели необходимо выбрать сборку.");
  assert.equal(row.actionLabel, "Открыть сборку");
  assert.equal(row.sectionId, "tech-card-model");
  assert.equal(row.severity, "error");
});

test("selected assembly lists the missing field sent by readiness", () => {
  const items = preflightItems(card([
    ...EMPTY.filter((row) => row.code !== "model"),
    step("model", [issue({
      code: "missing_sewing_norm",
      message: "Модель или сборка изделия не готовы к производству.",
      diagnostic: { field_label: "Норма времени" },
    })]),
  ]), "schedule", { assemblyName: "Пошив футболки" });
  const row = items.find((item) => item.code === "assembly_sewing");
  assert.equal(row.title, "Нужно заполнить параметры сборки");
  assert.equal(row.detail, "Для сборки «Пошив футболки» не заполнено: Норма времени.");
  assert.equal(row.actionLabel, "Открыть сборку");
  assert.equal(row.sectionId, "tech-card-model");
});

test("complete assembly adds no assembly blocker", () => {
  const items = preflightItems(card(EMPTY), "launch");
  assert.equal(items.some((item) => item.code === "assembly_required" || item.code === "missing_sewing_norm"), false);
  assert.equal(preflightBlocks(items), false);
});

test("missing operation norms stay one grouped issue", () => {
  const items = preflightItems(card([
    ...EMPTY.filter((row) => row.code !== "norms"),
    step("norms", [issue({
      code: "missing_operator_norm",
      message: "Для операции «Печать» не заполнена норма.",
      diagnostic: { entity_name: "Печать" },
    })]),
  ]), "schedule", ["Раскрой"]);
  const row = items.find((item) => item.code === "operation_norms");
  assert.deepEqual(row.operations, ["Печать", "Раскрой"]);
  assert.equal(row.actionLabel, "Заполнить нормы");
  assert.equal(row.kind, "norms");
  assert.equal(row.title, "Нужно заполнить нормы производственных операций");
});

test("several blockers stay in one list", () => {
  const items = preflightItems(card([
    step("model", [issue({ code: "assembly_required", message: "Сборка" })]),
    step("route", [issue({ code: "route_required", message: "Маршрут производства не выбран." })]),
    step("norms", [issue({ code: "missing_operator_norm", message: "Для операции «Пошив» не заполнена норма." })]),
    ...EMPTY.filter((row) => !["model", "route", "norms"].includes(row.code)),
  ]), "launch");
  assert.deepEqual(items.map((item) => item.code), ["assembly_required", "route_required", "operation_norms"]);
  assert.equal(preflightBlocks(items), true);
});

test("warning and blocker keep different severity", () => {
  const items = preflightItems(card([
    step("personalization", [issue({
      code: "personalization_quantity_mismatch",
      severity: "warning",
      message: "Персонализация заполнена на 3 из 4 изделий.",
    })], "warning"),
    step("model", [issue({ code: "model_required", message: "Модель изделия не выбрана." })]),
    ...EMPTY.filter((row) => !["personalization", "model"].includes(row.code)),
  ]), "launch");
  assert.equal(items.find((item) => item.code === "personalization_quantity_mismatch").severity, "warning");
  assert.equal(items.find((item) => item.code === "model_required").severity, "error");
});

test("personalization warning alone does not block", () => {
  const items = preflightItems(card([
    ...EMPTY.filter((row) => row.code !== "personalization"),
    step("personalization", [issue({
      code: "personalization_quantity_mismatch",
      severity: "warning",
      message: "Персонализация заполнена на 3 из 4 изделий.",
    })], "warning"),
  ]), "launch");
  assert.equal(items.length, 1);
  assert.equal(items[0].severity, "warning");
  assert.equal(preflightBlocks(items), false);
});

test("fix actions point at the existing card sections", () => {
  const items = preflightItems(card([
    step("route", [issue({ code: "variant_not_selected", message: "Не выбран вариант." })]),
    step("planning", [issue({ code: "planning_dates_required", message: "Не заполнены даты." })]),
    step("basic", [issue({ code: "invalid_quantity", message: "Количество изделий должно быть больше нуля." })]),
    ...EMPTY.filter((row) => !["route", "planning", "basic"].includes(row.code)),
  ]), "launch");
  assert.equal(items.find((item) => item.code === "variant_not_selected").sectionId, "tech-card-route");
  assert.equal(items.find((item) => item.code === "variant_not_selected").tab, null);
  assert.equal(items.find((item) => item.code === "planning_dates_required").sectionId, "tech-card-planning");
  assert.equal(items.find((item) => item.code === "invalid_quantity").sectionId, "tech-card-order-data");
  assert.equal(items.find((item) => item.code === "variant_not_selected").actionLabel, "Выбрать вариант");
});

test("a removed readiness issue disappears after refresh", () => {
  const before = preflightItems(card([
    ...EMPTY.filter((row) => row.code !== "model"),
    step("model", [issue({ code: "assembly_required", message: "Сборка" })]),
  ]), "schedule");
  assert.equal(before.some((item) => item.code === "assembly_required"), true);
  const after = preflightItems(card(EMPTY), "schedule");
  assert.equal(after.some((item) => item.code === "assembly_required"), false);
});

test("preflight does not recompute readiness rules", () => {
  const source = readFileSync(new URL("./tech-card-preflight.ts", import.meta.url), "utf8");
  assert.equal(source.includes("assembly_variant_id"), false);
  assert.equal(source.includes("duration_seconds"), false);
  assert.equal(source.includes("quantity <="), false);
  assert.equal(source.includes("planned_date"), false);
  assert.equal(source.includes("can_launch"), false);
});

test("schedule does not stop on a stale saved plan", () => {
  const items = preflightItems(card([
    ...EMPTY.filter((row) => row.code !== "planning"),
    step("planning", [issue({ code: "calendar_plan_stale_after_demand_change", message: "Производственный план требует проверки или пересчёта." })]),
  ]), "schedule");
  assert.equal(items.some((item) => item.code === "plan_review"), false);
});

test("schedule does not treat a missing plan as a reason to stop calculation", () => {
  const items = preflightItems(card([
    ...EMPTY.filter((row) => row.code !== "planning"),
    step("planning", [issue({ code: "saved_plan_required", message: "Производственный план ещё не рассчитан." })]),
  ]), "schedule");
  assert.equal(items.some((item) => item.code === "plan_review" || item.code === "saved_plan_required"), false);
  const launch = preflightItems(card([
    ...EMPTY.filter((row) => row.code !== "planning"),
    step("planning", [issue({ code: "saved_plan_required", message: "Производственный план ещё не рассчитан." })]),
  ]), "launch");
  assert.equal(launch.some((item) => item.code === "plan_review"), true);
});

test("choosing a model does not raise unrelated planning blockers", () => {
  const items = preflightItems(card([
    step("planning", [issue({ code: "planning_dates_required", message: "Даты" })]),
    step("model", [issue({ code: "assembly_required", message: "Сборка" })]),
    ...EMPTY.filter((row) => !["planning", "model"].includes(row.code)),
  ]), "model");
  assert.deepEqual(items.map((item) => item.code), ["assembly_required"]);
});

test("unverified sewing norm shows the diagnostic field", () => {
  const items = preflightItems(card([
    ...EMPTY.filter((row) => row.code !== "model"),
    step("model", [issue({
      code: "sewing_norm_unverified",
      message: "Модель или сборка изделия не готовы к производству.",
      diagnostic: { field_label: "Сборка изделия / нормы пошива" },
    })]),
  ]), "launch");
  const row = items.find((item) => item.code === "assembly_sewing");
  assert.equal(row.title, "Нужно заполнить параметры сборки");
  assert.equal(row.detail, "Не заполнено: норма пошива.");
  assert.equal(row.why, "Откройте сборку изделия и заполните недостающие параметры.");
  assert.equal(row.actionLabel, "Открыть сборку");
  assert.equal(JSON.stringify(row).includes("sewing_norm_unverified"), false);
});

test("an absent assembly is not also listed as an incomplete assembly", () => {
  const items = preflightItems(card([
    ...EMPTY.filter((row) => row.code !== "model"),
    step("model", [
      issue({ code: "assembly_required", message: "Сборка" }),
      issue({ code: "missing_sewing_norm", message: "Нормы", diagnostic: { field_label: "Норма времени" } }),
    ]),
  ]), "launch");
  assert.equal(items.filter((item) => item.code === "missing_sewing_norm").length, 0);
  assert.equal(items.filter((item) => item.code === "assembly_required").length, 1);
});

test("same meter diagnostics become one card with operation names", () => {
  const items = preflightItems(card([
    ...EMPTY.filter((row) => row.code !== "norms"),
    step("norms", [
      issue({
        code: "missing_linear_meters",
        message: "Не указан метраж для производственной операции.",
        fix_action: "Заполните метраж операции техкарты.",
        diagnostic: { message: "Операция «Сублимационная печать»: требуется исправление для поля «Объём операции».", entity_name: "1310-1" },
      }),
      issue({
        code: "missing_linear_meters",
        message: "Не указан метраж для производственной операции.",
        fix_action: "Заполните метраж операции техкарты.",
        diagnostic: { message: "Операция «Термоперенос»: требуется исправление для поля «Объём операции».", entity_name: "1310-1" },
      }),
    ]),
  ]), "launch");
  const row = items.find((item) => item.code === "operation_norms");
  assert.equal(items.filter((item) => item.code === "operation_norms").length, 1);
  assert.equal(row.title, "Нужно заполнить нормы расхода");
  assert.deepEqual(row.operations, ["Сублимационная печать", "Термоперенос"]);
  assert.equal(row.actionLabel, "Заполнить нормы");
  assert.equal(row.detail.includes("Не указан метраж"), false);
});

test("duplicate plan diagnostics become one card and dates stay separate", () => {
  const items = preflightItems(card([
    ...EMPTY.filter((row) => row.code !== "planning"),
    step("planning", [
      issue({ code: "quantity_planning_start_shipping_required", message: "Производственный план требует проверки или пересчёта." }),
      issue({ code: "calendar_plan_stale_after_demand_change", message: "Производственный план требует проверки или пересчёта." }),
      issue({ code: "planning_dates_required", message: "Не заполнены даты планирования и отгрузки." }),
    ]),
  ]), "launch");
  assert.equal(items.filter((item) => item.code === "plan_review").length, 1);
  assert.equal(items.find((item) => item.code === "plan_review").title, "Производственный план нужно пересчитать");
  assert.equal(items.find((item) => item.code === "plan_review").actionLabel, "Пересчитать план");
  assert.equal(items.find((item) => item.code === "planning_dates_required").title, "Укажите даты производства и отгрузки");
  assert.equal(items.filter((item) => item.title === "Производственный план требует проверки или пересчёта.").length, 0);
});

test("different fix actions stay separate cards", () => {
  const items = preflightItems(card([
    step("route", [
      issue({ code: "variant_not_selected", message: "Не выбран вариант.", fix_action: "Выберите вариант в группе А.", fix_url: "/production/tech-cards/1#a" }),
      issue({ code: "variant_not_selected", message: "Не выбран вариант.", fix_action: "Выберите вариант в группе Б.", fix_url: "/production/tech-cards/1#b" }),
    ]),
    ...EMPTY.filter((row) => row.code !== "route"),
  ]), "launch");
  assert.equal(items.filter((item) => item.code === "variant_not_selected").length, 2);
});
