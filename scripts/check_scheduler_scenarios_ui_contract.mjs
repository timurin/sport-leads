/** Replay actual PC-04.3C HTTP responses through PC-04.3B presentation helpers.
 * Generate input with pytest test_scheduler_scenarios_pc_04_3c.py -q -s first.
 * Run: node --experimental-strip-types scripts/check_scheduler_scenarios_ui_contract.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  autoStepCount,
  deadlineStatusText,
  deviationText,
  scheduleStepRows,
} from "../frontend/lib/production/tech-card-schedule.ts";

const bytes = readFileSync(process.argv[2] ?? "logs/pc-04-3c-scenarios.log");
// Windows PowerShell redirects native output as UTF-16LE; Python/CI uses UTF-8.
const log = bytes.toString(bytes[0] === 0xff && bytes[1] === 0xfe ? "utf16le" : "utf8");
const responses = [...log.matchAll(/SCENARIO_[AEF]_RESPONSE=(\{[^\r\n]+\})/g)]
  .map((match) => JSON.parse(match[1]));
assert.equal(responses.length, 4, "Expected A, E and both F scenario responses");
const [onTime, late, manual, missing] = responses;
assert.equal(deadlineStatusText(onTime), "запас 15 дней");
assert.equal(deadlineStatusText(late), "опоздание 2 дней");
assert.equal(deadlineStatusText(manual), null);
assert.equal(deadlineStatusText(missing), null);
assert.equal(autoStepCount(onTime.steps), 1);
assert.equal(autoStepCount(manual.steps), 0);
assert.equal(scheduleStepRows(late.steps, new Map([[1, "Production"]]))[0].span, "07.10–09.10");
assert.match(deviationText(manual.deviations[0]), /missing_operator_norm/);
assert.match(deviationText(missing.deviations[0]), /missing_linear_meters/);
console.log("PASS: 4 actual HTTP responses consumed by PC-04.3B presentation helpers");
