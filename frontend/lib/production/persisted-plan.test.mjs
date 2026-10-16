import test from "node:test";
import assert from "node:assert/strict";
import { fetchTechnicalCard } from "../sales/order-tech-cards-api.ts";

test("card reload preserves backend dates, slack and stale marker without recalculation", async () => {
  const original = globalThis.fetch;
  const summary = { planned_start_date: "2026-10-12", planned_completion_date: "2026-10-19",
    shipping_date: "2026-10-20", buffer_days: 1, on_time: true, delay_days: 0,
    planning_state: "stale", replan_required: true, is_current: false, persisted: true };
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json({ id: 159, planning_summary: summary });
  };
  try {
    const card = await fetchTechnicalCard(159);
    assert.deepEqual(card.planning_summary, summary);
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /technical-cards\/159$/);
    assert.notEqual(calls[0].init?.method, "POST");
  } finally { globalThis.fetch = original; }
});
