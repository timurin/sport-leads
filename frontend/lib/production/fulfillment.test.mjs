import assert from "node:assert/strict";
import test from "node:test";
import { fetchFulfillmentCards, markTechnicalCardShipped } from "../sales/order-tech-cards-api.ts";

test("fulfillment uses its own read model and forwards session on explicit shipment", async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json(calls.length === 1 ? [{ id: 159, quantity: "4" }] : { id: 159, fulfillment_status: "shipped" });
  };
  try {
    assert.equal((await fetchFulfillmentCards("ready_to_ship", { Cookie: "sl_session=test" }))[0].quantity, "4");
    assert.equal((await markTechnicalCardShipped(159, { Cookie: "sl_session=test" })).fulfillment_status, "shipped");
    assert.match(calls[0].url, /technical-cards\/fulfillment\/ready_to_ship$/);
    assert.equal(calls[0].init.cache, "no-store");
    assert.match(calls[1].url, /technical-cards\/159\/mark-shipped$/);
    assert.equal(calls[1].init.method, "POST");
    assert.equal(calls[1].init.headers.Cookie, "sl_session=test");
  } finally { globalThis.fetch = original; }
});

test("duplicate shipment errors remain errors", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ detail: "Техкарта уже отгружена" }, { status: 409 });
  try {
    await assert.rejects(markTechnicalCardShipped(159, {}), /уже отгружена/);
  } finally { globalThis.fetch = original; }
});
