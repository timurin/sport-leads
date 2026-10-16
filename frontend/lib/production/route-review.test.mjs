import assert from "node:assert/strict";
import test from "node:test";
import { routeReviewPresentation } from "./route-review.ts";
import { deviationText } from "./tech-card-schedule.ts";
for (const protectedFact of [false, true]) {
  test(`route review manager wording and action: protected=${protectedFact}`, () => {
    const presentation = routeReviewPresentation({code: "route_requires_review_before_planning", fix_action: protectedFact ? "Открыть маршрут" : "Обновить маршрут"});
    assert.equal(presentation.protectedFact, protectedFact);
    assert.equal(presentation.actionLabel, protectedFact ? "Открыть маршрут" : "Обновить маршрут");
    assert.doesNotMatch(JSON.stringify(presentation), /snapshot|legacy|исторический снимок|verified|подтверждение полноты/i);
    assert.match(presentation.message, protectedFact ? /начатые операции/ : /необходимые операции/);
  });
}
test("schedule review deviation contains only manager copy", () => {
  assert.equal(deviationText({code:"readiness_not_complete", reason:"route_requires_review_before_planning"}), "Маршрут техкарты требует проверки перед планированием производства.");
  assert.equal(routeReviewPresentation(undefined), null);
});
