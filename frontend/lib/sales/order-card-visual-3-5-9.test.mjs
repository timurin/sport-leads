import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("order card layout breakpoints and collapse wiring (3.5.9)", () => {
  const page = readFileSync(
    join(root, "components/sales/sales-order-page.tsx"),
    "utf8",
  );
  assert.ok(page.includes("order-card-comms"));
  assert.ok(page.includes("CollapseToggleButton"));
  assert.ok(page.includes("historyCollapsed"));
  assert.equal(page.includes("commentsCollapsed"), false);
  assert.equal(page.includes("order-main-grid"), false);
  assert.equal(page.includes("splitMainGrid"), false);

  const css = readFileSync(join(root, "app/globals.css"), "utf8");
  assert.ok(css.includes(".order-card-top-triple"));
  assert.ok(css.includes("@media (min-width: 1700px)"));

  const timeline = readFileSync(
    join(root, "components/sales/lead-activity-timeline.tsx"),
    "utf8",
  );
  // Stage 26.6 feed labels: notes channel is «Заметки», not «Комментарии».
  assert.ok(timeline.includes("Заметки"));
  assert.ok(timeline.includes("История активности"));
  assert.equal(timeline.includes("F) Комментарии"), false);
  assert.equal(timeline.includes("D) История"), false);
});

test("sidebar force-compact below 1300px (3.5.9 / DS-SHELL-01)", () => {
  const sidebar = readFileSync(
    join(root, "components/navigation/app-sidebar.tsx"),
    "utf8",
  );
  assert.ok(sidebar.includes("SIDEBAR_FORCE_COMPACT_MAX_PX"));
  assert.ok(sidebar.includes("1299"));
  assert.ok(sidebar.includes("forceCompact"));
});
