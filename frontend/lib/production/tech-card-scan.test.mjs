import assert from "node:assert/strict";
import test from "node:test";

import { isSewingCabinetOwnPath } from "../auth/session-mapping.ts";
import {
  isTechCardScanPath,
  techCardWipStatusLabel,
} from "./tech-card-scan.ts";

test("restricted sewer allowlist includes scan token host", () => {
  assert.equal(isSewingCabinetOwnPath("/production/sewing-cabinet"), true);
  assert.equal(isSewingCabinetOwnPath("/production/scan/abc_token"), true);
  assert.equal(isSewingCabinetOwnPath("/production/scan/abc_token/"), true);
  assert.equal(isSewingCabinetOwnPath("/production/tech-cards/1"), false);
  assert.equal(isTechCardScanPath("/production/scan/xyz"), true);
});

test("computed WIP status labels", () => {
  assert.equal(techCardWipStatusLabel("return"), "Возврат");
  assert.equal(techCardWipStatusLabel("ready"), "Готова");
  assert.equal(techCardWipStatusLabel("partial_ready"), "Частично готова");
  assert.equal(techCardWipStatusLabel("in_work"), "В работе");
});
