import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  SCHEDULE_ACTION_LABEL,
  SCHEDULE_PENDING_LABEL,
  autoStepCount,
  calendarPathsAfterSchedule,
  deadlineStatusText,
  deviationText,
  formatPlanSpan,
  scheduleBlockedMessage,
  planningWriteBody,
  schedulePath,
  scheduleStepRows,
} from "./tech-card-schedule.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("schedule CTA posts the card schedule endpoint and shows the loading label", () => {
  assert.equal(schedulePath(41), "/technical-cards/41/schedule");
  assert.equal(SCHEDULE_ACTION_LABEL, "Пересчитать план");
  assert.equal(SCHEDULE_PENDING_LABEL, "Рассчитываем...");

  const api = readFileSync(join(root, "lib/sales/order-tech-cards-api.ts"), "utf8");
  assert.match(api, /\/technical-cards\/\$\{cardId\}\/schedule/);
  assert.match(api, /method:\s*"POST"/);

  const view = readFileSync(join(root, "components/production/tech-card-process.tsx"), "utf8");
  const dates = readFileSync(join(root, "components/production/tech-card-production-plan.tsx"), "utf8");
  assert.ok(view.includes("scheduleTechnicalCardAction"));
  assert.ok(view.includes("SCHEDULE_PENDING_LABEL"));
  assert.ok(view.includes("data-tech-card-schedule-cta"));
  assert.equal(dates.includes("data-tech-card-schedule-cta"), false);
  assert.equal(view.split("\n").filter((line) => line.includes("SCHEDULE_ACTION_LABEL") && !line.trim().startsWith("SCHEDULE_ACTION_LABEL")).length, 1);
  assert.equal(view.includes("После пересчёта плана"), false);
  assert.equal(view.includes("TechCardRouteVariants"), false);
  assert.ok(view.includes("Маршрут производства"));
  assert.ok(view.includes("ReadinessStickers"));
  assert.equal(view.includes("managerWarningCallout"), false);
  assert.ok(view.includes("data-tech-card-route-map"));
  assert.ok(view.includes("xl:overflow-x-auto"));
  assert.ok(view.includes("Изменить даты"));
  assert.ok(view.includes("data-tech-card-dates-editor"));
  assert.ok(view.includes("Сборка:"));
  assert.equal(view.includes("lg:grid-cols-[minmax(0,1fr)_17.5rem]"), false);
  assert.equal(view.includes("min-h-36"), false);
  assert.equal(view.includes("max-w-sm"), false);
  assert.equal(view.includes("md:flex-nowrap"), false);
  assert.equal(view.includes("sm:flex-wrap"), false);
  assert.ok(dates.includes("Даты плана"));
  assert.ok(dates.includes("Сохранить даты"));
  assert.equal(dates.includes("scheduleTechnicalCardAction"), false);
});

test("deadline status is the backend buffer, not a frontend date difference", () => {
  assert.equal(deadlineStatusText({ on_time: true, buffer_days: 0, delay_days: 0 }), "в срок");
  assert.equal(deadlineStatusText({ on_time: true, buffer_days: 3, delay_days: 0 }), "запас 3 дней");
  assert.equal(deadlineStatusText({ on_time: false, buffer_days: -2, delay_days: 2 }), "опоздание 2 дней");
  assert.equal(deadlineStatusText({ on_time: null, buffer_days: null, delay_days: null }), null);
});

test("a blocked schedule explains the next step without repeating the button", () => {
  assert.equal(
    scheduleBlockedMessage({
      status: "blocked",
      deviations: [{ code: "locked_assignment_conflict", reason: "calendar_plan_stale_after_demand_change" }],
    }),
    "Расчёт не выполнен: уже начатые операции нельзя передвинуть, а их план устарел после изменений техкарты.",
  );
  assert.equal(
    scheduleBlockedMessage({
      status: "blocked",
      deviations: [{ code: "readiness_not_complete", reason: "quantity_planning_start_shipping_required" }],
    }),
    "Укажите количество, дату начала и дату отгрузки. После этого план можно рассчитать.",
  );
  assert.equal(scheduleBlockedMessage({ status: "planned", deviations: [] }), null);
});

test("known deviation codes keep the backend reason", () => {
  assert.equal(
    deviationText({ code: "readiness_not_complete", reason: "standalone_active_card_required" }),
    "Карточка не готова к расчёту: standalone_active_card_required",
  );
  assert.equal(
    deviationText({ code: "manual_required", reason: "missing_cutting_mode" }),
    "Нужен ручной ввод: missing_cutting_mode",
  );
  assert.equal(
    deviationText({ code: "capacity_missing", reason: "resource_capacity_not_configured" }),
    "Нет мощности: resource_capacity_not_configured",
  );
  assert.equal(
    deviationText({ code: "no_available_capacity", reason: "120_day_horizon_exhausted" }),
    "Нет свободной мощности: 120_day_horizon_exhausted",
  );
  assert.equal(
    deviationText({ code: "locked_assignment_conflict", reason: "plan_locked" }),
    "План или шаг заблокирован: plan_locked",
  );
  assert.equal(
    deviationText({ code: "demand_calculation_missing", reason: "missing_sewing_norm" }),
    "Не хватает данных для спроса: missing_sewing_norm",
  );
  assert.equal(
    deviationText({ code: "capacity_unit_mismatch", reason: "unit_mismatch" }),
    "Единицы мощности не совпадают: unit_mismatch",
  );
  assert.equal(
    deviationText({ code: "deadline_missed", reason: "completion_after_shipping_date" }),
    "Срок отгрузки не выдержан: completion_after_shipping_date",
  );
});

test("step rows copy backend dates and mark preserved steps locked", () => {
  const rows = scheduleStepRows(
    [
      {
        routing_stage_line_id: 1,
        production_stage_id: 7,
        planned_start_date: "2026-10-08",
        planned_end_date: "2026-10-09",
        preserved: false,
      },
      {
        routing_stage_line_id: 2,
        production_stage_id: 8,
        planned_start_date: "2026-10-10",
        planned_end_date: "2026-10-10",
        preserved: true,
      },
    ],
    new Map([[7, "Печать"], [8, "Пошив"]]),
  );
  assert.deepEqual(rows, [
    { operation: "Печать", span: "08.10–09.10", mode: "auto" },
    { operation: "Пошив", span: "10.10", mode: "locked" },
  ]);
  assert.equal(autoStepCount(rows.map((row) => ({ preserved: row.mode === "locked" }))), 1);
  assert.equal(formatPlanSpan("2026-10-08", "2026-10-09"), "08.10–09.10");
  const source = readFileSync(join(root, "lib/production/tech-card-schedule.ts"), "utf8");
  assert.equal(source.includes("setDate"), false);
  assert.equal(source.includes("86400000"), false);
});

test("planning payload persists dates through the existing planning API", () => {
  const written = planningWriteBody({
    planningStartDate: "2026-10-08",
    shippingDate: "2026-10-20",
    priority: "",
    planLocked: false,
  });
  assert.deepEqual(written, {
    ok: true,
    body: {
      planning_start_date: "2026-10-08",
      shipping_date: "2026-10-20",
      priority: null,
      plan_locked: false,
    },
  });
  assert.equal(planningWriteBody({
    planningStartDate: "2026-10-08",
    shippingDate: "2026-10-20",
    priority: "0",
    planLocked: true,
  }).ok, false);
  const api = readFileSync(join(root, "lib/sales/order-tech-cards-api.ts"), "utf8");
  assert.match(api, /\/technical-cards\/\$\{cardId\}\/planning/);
  const actions = readFileSync(join(root, "app/(workspace)/production/tech-cards/tech-card-actions.ts"), "utf8");
  assert.ok(actions.includes("updateTechnicalCardPlanning"));
});

test("successful persisted schedule refreshes the production calendar paths", () => {
  assert.deepEqual(calendarPathsAfterSchedule(), [
    "/production/calendar",
    "/production/calendar/planning",
    "/production/calendar/capacity",
  ]);
  const actions = readFileSync(join(root, "app/(workspace)/production/tech-cards/tech-card-actions.ts"), "utf8");
  assert.ok(actions.includes("calendarPathsAfterSchedule"));
  assert.match(actions, /schedule\.persisted \|\| schedule\.status === "planned"/);
  const workspace = readFileSync(join(root, "components/production/tech-card-detail-workspace.tsx"), "utf8");
  assert.ok(workspace.includes("TechCardProcess"));
  assert.ok(workspace.includes("TechCardProductionPlan"));
  assert.match(workspace, /sales_order_id == null && card\.order_group_id != null/);
  const orderData = readFileSync(join(root, "components/production/tech-card-order-data-card.tsx"), "utf8");
  assert.ok(orderData.includes("data-tech-card-due-date-calendar"));
});
