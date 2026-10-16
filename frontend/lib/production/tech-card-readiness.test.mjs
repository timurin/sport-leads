import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  READINESS_REFRESH_MUTATIONS,
  blockingIssueCount,
  launchBlockedNotice,
  launchDecision,
  managerIssueDetail,
  orderedSteps,
  parseTechnicalCardReadiness,
  progressLabel,
  resolveFixTarget,
  roadmapView,
  showLaunchButton,
  stepPresentation,
  stickerTitle,
} from "./tech-card-readiness.ts";

function step(overrides) {
  return {
    code: "basic",
    title: "Основные данные",
    status: "completed",
    summary: "Данные заполнены и проверены.",
    issues: [],
    fix_action: null,
    fix_url: null,
    blocking: false,
    ...overrides,
  };
}

function readiness(overrides = {}) {
  return {
    technical_card_id: 159,
    lifecycle_status: "draft",
    overall_status: "blocked",
    can_launch: false,
    progress_completed: 5,
    progress_total: 7,
    steps: [
      step({ code: "basic", title: "Основные данные" }),
      step({ code: "model", title: "Модель изделия" }),
      step({ code: "route", title: "Маршрут производства" }),
      step({
        code: "personalization",
        title: "Персонализация",
        status: "warning",
        summary: "Персонализация заполнена на 3 из 4 изделий.",
        blocking: false,
        issues: [{
          code: "personalization_quantity_mismatch",
          severity: "warning",
          message: "Персонализация заполнена на 3 из 4 изделий.",
          fix_action: "Добавьте недостающие изделия (1 шт.) или скорректируйте персонализацию.",
          fix_url: "/production/tech-cards/159",
        }],
      }),
      step({
        code: "norms",
        title: "Производственные нормы",
        status: "blocked",
        summary: "Для операции «Печать» не заполнена норма.",
        blocking: true,
        issues: [{
          code: "missing_operator_norm",
          severity: "error",
          message: "Для операции «Печать» не заполнена норма.",
          fix_action: "Заполните требуемую норму операции или модели.",
          fix_url: "/settings/catalogs/tech-operations/1",
          diagnostic: { code: "missing_operator_norm", category: "CONFIGURATION" },
        }],
      }),
      step({ code: "planning", title: "Производственный план", status: "pending", summary: "План появится после расчёта." }),
      step({ code: "launch", title: "Запуск техкарты", status: "blocked", summary: "Перед запуском устраните блокирующие замечания.", blocking: true }),
    ],
    ...overrides,
  };
}

test("roadmap keeps backend order, titles and progress", () => {
  const view = roadmapView(readiness(), { debugMode: false, cardPath: "/production/tech-cards/159" });
  assert.deepEqual(view.rows.map((row) => row.code), [
    "basic", "model", "route", "personalization", "norms", "planning", "launch",
  ]);
  assert.equal(view.rows[1].title, "Модель изделия");
  assert.equal(view.rows[1].sticker, "Модель");
  assert.equal(stickerTitle("unknown", "Свой шаг"), "Свой шаг");
  assert.equal(view.rows[5].status, "pending");
  assert.equal(view.progress, "5 из 7");
  assert.equal(progressLabel({ progress_completed: 5, progress_total: 7, steps: [] }), "5 из 7");
  assert.deepEqual(orderedSteps(["launch", "basic"]), ["launch", "basic"]);
});

test("step tones stay distinct for completed, warning, blocked and pending", () => {
  assert.deepEqual(stepPresentation("completed"), { marker: "check", tone: "success" });
  assert.deepEqual(stepPresentation("warning"), { marker: "warning", tone: "warning" });
  assert.deepEqual(stepPresentation("blocked"), { marker: "blocked", tone: "danger" });
  assert.deepEqual(stepPresentation("pending"), { marker: "pending", tone: "neutral" });
  const view = roadmapView(readiness(), { debugMode: false, cardPath: "/production/tech-cards/159" });
  assert.equal(view.rows[3].tone, "warning");
  assert.equal(view.rows[4].tone, "danger");
  assert.equal(view.rows[5].tone, "neutral");
});

test("expanded issue keeps the manager text and hides the diagnostic code", () => {
  const view = roadmapView(readiness(), { debugMode: false, cardPath: "/production/tech-cards/159" });
  const issue = view.rows[4].issues[0];
  assert.equal(issue.message, "Для операции «Печать» не заполнена норма.");
  assert.match(issue.fixAction, /норму/);
  assert.equal(issue.diagnostic, null);
  assert.equal(JSON.stringify(issue).includes("missing_operator_norm"), false);
});

test("debug mode can show the separate diagnostic payload", () => {
  const issue = readiness().steps[4].issues[0];
  assert.equal(managerIssueDetail(issue, true).diagnostic.code, "missing_operator_norm");
  assert.equal(managerIssueDetail(issue, false).diagnostic, null);
});

test("fix_url leaves the card and fix_action on the same card scrolls to a section", () => {
  const cardPath = "/production/tech-cards/159";
  const view = roadmapView(readiness(), { debugMode: false, cardPath });
  assert.deepEqual(view.rows[4].issues[0].navigation, {
    kind: "url",
    href: "/settings/catalogs/tech-operations/1",
    label: "Открыть: Производственные нормы",
  });
  assert.equal(view.rows[3].issues[0].navigation.kind, "section");
  assert.equal(view.rows[3].issues[0].navigation.id, "tech-card-personalization");
  assert.equal(view.rows[3].issues[0].navigation.tab, "assembly");
  assert.deepEqual(
    resolveFixTarget(step({ code: "unknown", title: "Шаг" }), {
      fix_action: null,
      fix_url: null,
    }, cardPath),
    { kind: "none" },
  );
});

test("launch follows can_launch and does not invent a second validator", () => {
  assert.equal(launchDecision({ can_launch: true }), "launch");
  assert.equal(launchDecision(readiness({ can_launch: true, overall_status: "warning" })), "launch");
  assert.equal(launchDecision({ can_launch: false }), "blocked");
  assert.equal(launchDecision(null), "blocked");
  assert.equal(blockingIssueCount(readiness()), 1);
  assert.match(launchBlockedNotice(readiness()), /Техкарта не готова к запуску/);
  assert.match(launchBlockedNotice(readiness()), /1/);
  assert.equal(showLaunchButton({ storedStatus: "draft", shopContext: false, lifecycleStatus: "planned" }), true);
  assert.equal(showLaunchButton({ storedStatus: "completed", shopContext: false, lifecycleStatus: "completed" }), false);
  assert.equal(showLaunchButton({ storedStatus: "draft", shopContext: true, lifecycleStatus: "draft" }), false);
});

test("completed card stays a history view without a launch button", () => {
  const done = readiness({
    lifecycle_status: "completed",
    overall_status: "completed",
    can_launch: false,
    progress_completed: 7,
    steps: ["basic", "model", "route", "personalization", "norms", "planning", "launch"].map((code) => step({ code })),
  });
  const view = roadmapView(done, { debugMode: false, cardPath: "/production/tech-cards/159" });
  assert.equal(view.rows.length, 7);
  assert.equal(view.progress, "7 из 7");
  assert.equal(view.overall, "Производство завершено");
  assert.equal(view.rows.find((row) => row.code === "launch").marker, "check");
  assert.equal(blockingIssueCount(done), 0);
  assert.equal(showLaunchButton({
    storedStatus: "completed",
    shopContext: false,
    lifecycleStatus: done.lifecycle_status,
  }), false);
  assert.equal(launchDecision(done), "blocked");
});

test("parser rejects a payload that is not the readiness contract", () => {
  assert.equal(parseTechnicalCardReadiness({ steps: [{ code: "basic" }] }), null);
  const parsed = parseTechnicalCardReadiness(readiness());
  assert.equal(parsed.steps.length, 7);
  assert.equal(parsed.can_launch, false);
});

test("readiness module does not recompute production rules", () => {
  const source = readFileSync(new URL("./tech-card-readiness.ts", import.meta.url), "utf8");
  assert.equal(source.includes("card.quantity"), false);
  assert.equal(source.includes("stage_results"), false);
  assert.equal(source.includes("routing_template"), false);
  assert.deepEqual(READINESS_REFRESH_MUTATIONS, [
    "basic-data",
    "model",
    "assembly",
    "route",
    "personalization",
    "norms",
    "schedule",
    "launch",
  ]);
});
