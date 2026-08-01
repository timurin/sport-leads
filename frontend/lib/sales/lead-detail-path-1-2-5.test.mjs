import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

test("1.2.5 lead detail path is API-only", () => {
  const details = readFileSync(join(root, "lib/sales/lead-details.ts"), "utf8");
  assert.equal(details.includes("fromDemoLead"), false);
  assert.equal(details.includes("@/lib/demo-data/sales"), false);
  assert.match(details, /if \(!\/\^\\d\+\$\/\.test\(leadId\)\)/);

  const page = readFileSync(join(root, "app/(workspace)/sales/leads/[leadId]/page.tsx"), "utf8");
  assert.equal(page.includes("getDefaultLeadStages"), false);
  assert.match(page, /if \(!\/\^\\d\+\$\/\.test\(leadId\)\)/);

  const header = readFileSync(join(root, "components/sales/lead-header.tsx"), "utf8");
  assert.equal(header.includes("isDemoLead"), false);
  assert.equal(header.includes("salesManagers"), false);
  assert.match(header, /managers: UserSummary\[\]/);
});
