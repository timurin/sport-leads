import assert from "node:assert/strict";
import test from "node:test";

import {
  auditEventsSummary,
  formatAuditAction,
  formatAuditActor,
} from "./audit-events-mapping.ts";

test("formatAuditAction maps known size-grid codes", () => {
  assert.equal(formatAuditAction("size_grid.create"), "Создание сетки");
  assert.equal(
    formatAuditAction("size_grid.row.update"),
    "Изменение строки размера",
  );
  assert.equal(formatAuditAction("unknown.action"), "unknown.action");
});

test("formatAuditActor and summary", () => {
  assert.equal(
    formatAuditActor({
      id: 1,
      occurred_at: "2026-08-01T00:00:00Z",
      actor_platform_user_id: 1,
      actor_login: "admin",
      action: "size_grid.create",
      entity_type: "size_grid",
      entity_id: "1",
      source: "api",
    }),
    "admin",
  );
  assert.equal(
    formatAuditActor({
      id: 2,
      occurred_at: "2026-08-01T00:00:00Z",
      actor_platform_user_id: null,
      actor_login: null,
      action: "size_grid.create",
      entity_type: "size_grid",
      entity_id: "1",
      source: "system",
    }),
    "Система",
  );
  assert.equal(auditEventsSummary(0), "записей нет");
  assert.equal(auditEventsSummary(1), "1 запись");
  assert.equal(auditEventsSummary(3), "3 записи");
  assert.equal(auditEventsSummary(10), "10 записей");
});
