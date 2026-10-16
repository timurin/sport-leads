import assert from "node:assert/strict";
import test from "node:test";

import { presentRouteReadiness, routePlanReady } from "./route-readiness.ts";

test("a filled schedule does not hide a missing demand norm", () => {
  const shown = presentRouteReadiness(
    { status: "ready", issues: [] },
    { status: "blocked", message: "Не настроена производственная норма операции «Подготовка макетов»." },
  );
  assert.equal(shown.status, "warning");
  assert.equal(shown.label, "Требует настройки");
  assert.deepEqual(shown.issues, ["Не настроена производственная норма операции «Подготовка макетов»."]);
  assert.equal(presentRouteReadiness({ status: "ready", issues: [] }, { status: "ready", message: null }).label, "Готово");
  assert.equal(presentRouteReadiness({ status: "ready", issues: [] }, null).label, "Готово");
});

test("an unselected ONE OF alternative does not block the route", () => {
  assert.equal(routePlanReady([
    { status: "ready", affects_route: true },
    { status: "blocked", affects_route: false },
  ]), true);
  assert.equal(routePlanReady([
    { status: "blocked", affects_route: true },
  ]), false);
});
