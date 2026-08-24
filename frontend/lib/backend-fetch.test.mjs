import assert from "node:assert/strict";
import test from "node:test";

import {
  backendUnreachableError,
  fetchBackend,
  isRetryableNetworkError,
  retryBackendOnce,
} from "./backend-fetch.ts";

function fetchFailed(code = "ECONNRESET") {
  return Object.assign(new TypeError("fetch failed"), {
    cause: { code, syscall: "read" },
  });
}

test("isRetryableNetworkError detects undici ECONNRESET", () => {
  assert.equal(isRetryableNetworkError(fetchFailed()), true);
  assert.equal(isRetryableNetworkError(new Error("Не удалось загрузить")), false);
});

test("fetchBackend retries once after ECONNRESET then succeeds", async () => {
  let calls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) throw fetchFailed();
    return new Response("[]", { status: 200 });
  };
  try {
    const response = await fetchBackend("http://127.0.0.1:8000/sewing-operations");
    assert.equal(response.status, 200);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
  }
});

test("fetchBackend maps persistent fetch failed to a Russian API error", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw fetchFailed();
  };
  try {
    await fetchBackend("http://127.0.0.1:8000/sewing-operations");
    assert.fail("should throw");
  } catch (error) {
    assert.ok(error instanceof Error);
    assert.match(error.message, /Не удалось связаться с API/);
    assert.doesNotMatch(error.message, /^fetch failed$/);
  } finally {
    globalThis.fetch = original;
  }
});

test("retryBackendOnce retries a loader once", async () => {
  let calls = 0;
  const value = await retryBackendOnce(async () => {
    calls += 1;
    if (calls === 1) throw fetchFailed("ECONNREFUSED");
    return 42;
  });
  assert.equal(value, 42);
  assert.equal(calls, 2);
});

test("backendUnreachableError does not leak a bare TypeError message", () => {
  const error = backendUnreachableError(fetchFailed(), "операции пошива");
  assert.match(error.message, /операции пошива/);
  assert.doesNotMatch(error.message, /^fetch failed$/);
});
